/**
 * Kiro Account Service
 * 
 * Handles Kiro account operations including:
 * - Token refresh
 * - Quota checking
 * - Account status management
 * - Batch operations
 * - Machine ID binding (device fingerprint isolation)
 */

import { logError, logInfo, logWarn } from '@/lib/logger'
import { invoke } from '@tauri-apps/api/core'
import { MachineIdService } from '@/services/MachineIdService'
import type { KiroAccount, KiroAccountStatus } from '@/types/account'

export interface RefreshTokenResult {
    success: boolean
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    error?: string
}

export interface CheckStatusResult {
    success: boolean
    status?: KiroAccountStatus
    usage?: KiroAccount['usage']
    subscription?: KiroAccount['subscription']
    email?: string
    userId?: string
    idp?: string
    newCredentials?: {
        accessToken: string
        refreshToken?: string
        expiresAt: number
    }
    error?: string
    isBanned?: boolean
}

export interface BatchRefreshResult {
    successCount: number
    failedCount: number
    results: Array<{
        id: string
        success: boolean
        data?: RefreshTokenResult
        error?: string
    }>
}

export interface BatchCheckResult {
    successCount: number
    failedCount: number
    results: Array<{
        id: string
        success: boolean
        data?: CheckStatusResult
        error?: string
    }>
}

export class KiroAccountService {
    /**
     * Switch to a Kiro account
     * Writes credentials to local AWS SSO cache so VS Code AWS Toolkit can use them
     */
    static async switchAccount(accountId: string): Promise<void> {
        const { usePlatformStore } = await import('@/stores/usePlatformStore')
        const store = usePlatformStore.getState()
        const accounts = store.accounts
        const targetAccount = accounts.find(a => a.id === accountId) as KiroAccount | undefined

        if (!targetAccount || targetAccount.platform !== 'kiro') {
            throw new Error('Account not found or not a Kiro account')
        }

        logInfo(`[Kiro Switch] Starting switch to: ${targetAccount.email}`)

        // 1. Ensure account has bound machine ID (device fingerprint isolation)
        const machineService = MachineIdService.getInstance()
        let machineId = await machineService.getMachineIdForAccount(accountId)
        
        if (!machineId) {
            machineId = await machineService.generateMachineId()
            await machineService.bindMachineId(accountId, machineId)
            logInfo(`[Kiro Switch] Generated and bound new machine ID for account: ${targetAccount.email}`)
        }

        // 2. Refresh token if needed
        if (targetAccount.credentials.refreshToken) {
            try {
                const tokenResult = await invoke<{
                    accessToken: string
                    refreshToken?: string
                    expiresIn: number
                }>('kiro_refresh_token', {
                    refreshToken: targetAccount.credentials.refreshToken,
                    clientId: targetAccount.credentials.clientId || '',
                    clientSecret: targetAccount.credentials.clientSecret || ''
                })

                const now = Date.now()
                await store.updateAccount(accountId, {
                    credentials: {
                        ...targetAccount.credentials,
                        accessToken: tokenResult.accessToken,
                        refreshToken: tokenResult.refreshToken || targetAccount.credentials.refreshToken,
                        expiresAt: now + (tokenResult.expiresIn * 1000)
                    }
                })

                // Update targetAccount reference with new credentials
                targetAccount.credentials.accessToken = tokenResult.accessToken
                if (tokenResult.refreshToken) {
                    targetAccount.credentials.refreshToken = tokenResult.refreshToken
                }

                logInfo(`[Kiro Switch] Token refreshed successfully`)
            } catch (e) {
                logWarn(`[Kiro Switch] Token refresh failed, continuing with existing token:`, e)
            }
        }

        // 3. Write credentials to AWS SSO cache
        try {
            await invoke('switch_kiro_account', {
                accessToken: targetAccount.credentials.accessToken,
                refreshToken: targetAccount.credentials.refreshToken || '',
                clientId: targetAccount.credentials.clientId || '',
                clientSecret: targetAccount.credentials.clientSecret || '',
                region: targetAccount.credentials.region,
                startUrl: undefined, // Use default
                authMethod: targetAccount.idp === 'BuilderId' ? 'IdC' : 'social',
                provider: targetAccount.idp
            })
            logInfo(`[Kiro Switch] Credentials written to AWS SSO cache`)
        } catch (e) {
            logError(`[Kiro Switch] Failed to write SSO cache:`, e)
            throw new Error(`切换账号失败: ${e}`)
        }

        // 4. Batch update: deactivate all Kiro accounts, then activate target
        const kiroAccounts = accounts.filter(a => a.platform === 'kiro')
        
        logInfo(`[Kiro Switch] Updating ${kiroAccounts.length} Kiro accounts`)
        
        // Deactivate all accounts first
        for (const acc of kiroAccounts) {
            if (acc.id !== accountId && acc.isActive) {
                await store.updateAccount(acc.id, {
                    isActive: false
                })
                logInfo(`[Kiro Switch] Deactivated: ${acc.email}`)
            }
        }

        // Activate target account
        const now = Date.now()
        await store.updateAccount(accountId, {
            isActive: true,
            lastUsedAt: now
        })

        logInfo(`[Kiro Switch] Activated: ${targetAccount.email}`)
        logInfo(`[Kiro Switch] Switch completed successfully`)
    }

    /**
     * Refresh account token and quota
     */
    static async refreshToken(account: KiroAccount): Promise<RefreshTokenResult> {
        try {
            if (!account.credentials.refreshToken) {
                return {
                    success: false,
                    error: 'No refresh token available'
                }
            }

            // Ensure account has bound machine ID
            const machineService = MachineIdService.getInstance()
            let machineId = await machineService.getMachineIdForAccount(account.id)
            
            if (!machineId) {
                machineId = await machineService.generateMachineId()
                await machineService.bindMachineId(account.id, machineId)
                logInfo(`[Kiro Refresh] Generated and bound new machine ID for account: ${account.email}`)
            }

            // 1. 刷新 token
            const tokenResult = await invoke<{
                accessToken: string
                refreshToken?: string
                expiresIn: number
            }>('kiro_refresh_token', {
                refreshToken: account.credentials.refreshToken,
                clientId: account.credentials.clientId || '',
                clientSecret: account.credentials.clientSecret || ''
            })

            // 2. 获取最新配额
            const quotaResult = await invoke<any>('kiro_check_quota', {
                accessToken: tokenResult.accessToken
            })

            // 3. 更新账户数据
            const { usePlatformStore } = await import('@/stores/usePlatformStore')
            const store = usePlatformStore.getState()
            const now = Date.now()

            await store.updateAccount(account.id, {
                credentials: {
                    ...account.credentials,
                    accessToken: tokenResult.accessToken,
                    refreshToken: tokenResult.refreshToken || account.credentials.refreshToken,
                    expiresAt: now + (tokenResult.expiresIn * 1000)
                },
                usage: {
                    current: quotaResult.currentUsage || 0,
                    limit: quotaResult.totalLimit || 25,
                    percentUsed: quotaResult.percentUsed || 0,
                    lastUpdated: now,
                    baseLimit: quotaResult.baseLimit,
                    baseCurrent: quotaResult.baseCurrent,
                    freeTrialLimit: quotaResult.freeTrialLimit,
                    freeTrialCurrent: quotaResult.freeTrialCurrent,
                    freeTrialExpiry: quotaResult.freeTrialExpiry,
                    bonuses: quotaResult.bonuses,
                    nextResetDate: quotaResult.nextResetDate,
                    resourceDetail: quotaResult.resourceDetail
                },
                subscription: {
                    type: quotaResult.subscriptionType || 'Free',
                    title: quotaResult.subscriptionTitle,
                    expiresAt: quotaResult.subscriptionExpiresAt,
                    daysRemaining: quotaResult.daysRemaining,
                    autoRenew: quotaResult.subscriptionAutoRenew
                },
                email: quotaResult.email || account.email,
                userId: quotaResult.userId,
                lastUsedAt: now
            })

            return {
                success: true,
                accessToken: tokenResult.accessToken,
                refreshToken: tokenResult.refreshToken,
                expiresIn: tokenResult.expiresIn
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    /**
     * Check account status and quota
     */
    static async checkStatus(account: KiroAccount): Promise<CheckStatusResult> {
        try {
            const result = await invoke<any>('kiro_check_quota', {
                accessToken: account.credentials.accessToken
            })

            // Check if account is banned
            const isBanned = result.error?.includes('UnauthorizedException') ||
                result.error?.includes('AccountSuspendedException')

            if (isBanned) {
                return {
                    success: false,
                    status: 'banned',
                    error: result.error,
                    isBanned: true
                }
            }

            // Parse usage data
            const usage: KiroAccount['usage'] = {
                current: result.current || 0,
                limit: result.limit || 25,
                percentUsed: result.limit > 0 ? result.current / result.limit : 0,
                lastUpdated: Date.now(),
                baseLimit: result.baseLimit,
                baseCurrent: result.baseCurrent,
                freeTrialLimit: result.freeTrialLimit,
                freeTrialCurrent: result.freeTrialCurrent,
                freeTrialExpiry: result.freeTrialExpiry,
                bonuses: result.bonuses,
                nextResetDate: result.nextResetDate,
                resourceDetail: result.resourceDetail
            }

            // Parse subscription data
            const subscription: KiroAccount['subscription'] = {
                type: result.subscriptionType || 'Free',
                title: result.subscriptionTitle,
                expiresAt: result.subscriptionExpiresAt,
                daysRemaining: result.subscriptionDaysRemaining,
                autoRenew: result.subscriptionAutoRenew
            }

            return {
                success: true,
                status: 'active',
                usage,
                subscription,
                email: result.email,
                userId: result.userId,
                idp: result.idp
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const isBanned = errorMessage.includes('UnauthorizedException') ||
                errorMessage.includes('AccountSuspendedException')

            return {
                success: false,
                status: isBanned ? 'banned' : 'error',
                error: errorMessage,
                isBanned
            }
        }
    }

    /**
     * Batch refresh tokens (background operation)
     */
    static async batchRefresh(
        accounts: Array<{
            id: string
            email: string
            credentials: KiroAccount['credentials']
        }>,
        concurrency: number = 10
    ): Promise<BatchRefreshResult> {
        try {
            const result = await invoke<BatchRefreshResult>('kiro_batch_refresh', {
                accounts,
                concurrency
            })
            return result
        } catch (error) {
            return {
                successCount: 0,
                failedCount: accounts.length,
                results: accounts.map(acc => ({
                    id: acc.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }))
            }
        }
    }

    /**
     * Batch check account status (background operation)
     */
    static async batchCheck(
        accounts: Array<{
            id: string
            email: string
            credentials: KiroAccount['credentials']
            idp?: string
        }>,
        concurrency: number = 10
    ): Promise<BatchCheckResult> {
        try {
            const result = await invoke<BatchCheckResult>('kiro_batch_check', {
                accounts,
                concurrency
            })
            return result
        } catch (error) {
            return {
                successCount: 0,
                failedCount: accounts.length,
                results: accounts.map(acc => ({
                    id: acc.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }))
            }
        }
    }

    /**
     * Check if token is expiring soon (within 5 minutes)
     */
    static isTokenExpiring(account: KiroAccount): boolean {
        if (!account.credentials.expiresAt) return false
        const now = Date.now()
        const expiresIn = account.credentials.expiresAt - now
        return expiresIn < 5 * 60 * 1000 // 5 minutes
    }

    /**
     * Check if token is expired
     */
    static isTokenExpired(account: KiroAccount): boolean {
        if (!account.credentials.expiresAt) return false
        return Date.now() >= account.credentials.expiresAt
    }
}
