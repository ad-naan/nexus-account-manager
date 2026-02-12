/**
 * Antigravity 平台账号服务
 * 处理平台特定的账号操作逻辑
 */

import { logError, logInfo } from '@/lib/logger'
import { invoke } from '@tauri-apps/api/core'
import type { AntigravityAccount, AntigravityQuotaData } from '@/types/account'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { MachineIdService } from '@/services/MachineIdService'

export class AntigravityAccountService {
  /**
   * 切换账号（完整实现）
   * Antigravity 平台的切换逻辑：
   * 1. 验证账号存在
   * 2. 刷新 Token 确保有效
   * 3. 确保账号有绑定的机器码（设备指纹隔离）
   * 4. 关闭 Antigravity IDE
   * 5. 注入 Token 到数据库
   * 6. 重启 Antigravity IDE
   * 7. 批量更新账号状态（同平台只有一个活跃）
   */
  static async switchAccount(accountId: string): Promise<void> {
    const store = usePlatformStore.getState()
    const accounts = store.accounts
    const targetAccount = accounts.find(a => a.id === accountId) as AntigravityAccount | undefined

    if (!targetAccount || targetAccount.platform !== 'antigravity') {
      throw new Error('Account not found or not an Antigravity account')
    }

    logInfo(`[Switch] Starting switch to: ${targetAccount.email}`)

    // 1. 调用后端切换命令（包含进程控制和数据库注入）
    const tokenResponse = await invoke<{
      access_token: string
      expires_in: number
      token_type: string
    }>('antigravity_switch_account', {
      accountId: targetAccount.id,
      refreshToken: targetAccount.token.refresh_token,
      email: targetAccount.email,
    })

    logInfo('[Switch] Backend switch completed successfully')

    // 2. 确保账号有绑定的机器码（设备指纹隔离）
    const machineService = MachineIdService.getInstance()
    let machineId = await machineService.getMachineIdForAccount(accountId)
    
    if (!machineId) {
      // 如果没有绑定机器码，生成新的并绑定
      machineId = await machineService.generateMachineId()
      await machineService.bindMachineId(accountId, machineId)
      logInfo(`[Switch] Generated and bound new machine ID for account: ${targetAccount.email}`)
    }

    // 3. 准备更新数据
    const now = Date.now()
    const expiryTimestamp = now + (tokenResponse.expires_in * 1000)

    // 4. 批量更新：先将所有同平台账号设为非活跃，再激活目标账号
    const antigravityAccounts = accounts.filter(a => a.platform === 'antigravity')
    
    logInfo(`[Switch] Updating ${antigravityAccounts.length} Antigravity accounts`)
    
    // 先将所有账号设为非活跃
    for (const acc of antigravityAccounts) {
      if (acc.id !== accountId && acc.isActive) {
        await store.updateAccount(acc.id, {
          isActive: false
        })
        logInfo(`[Switch] Deactivated: ${acc.email}`)
      }
    }

    // 然后激活目标账号并更新 Token
    await store.updateAccount(accountId, {
      isActive: true,
      lastUsedAt: now,
      token: {
        ...targetAccount.token,
        access_token: tokenResponse.access_token,
        expires_in: tokenResponse.expires_in,
        expiry_timestamp: expiryTimestamp,
      }
    })

    logInfo(`[Switch] Activated: ${targetAccount.email}`)
    logInfo(`[Switch] Switch completed successfully`)
  }

  /**
   * 刷新账号配额
   * Antigravity 平台的刷新逻辑：
   * 1. 刷新 access token
   * 2. 获取最新配额信息
   * 3. 更新账号数据
   */
  static async refreshAccount(account: AntigravityAccount): Promise<void> {
    const store = usePlatformStore.getState()

    // 刷新 token
    const tokenResponse = await invoke<{
      access_token: string
      expires_in: number
      token_type: string
    }>('antigravity_refresh_token', {
      refreshToken: account.token.refresh_token
    })

    // 获取配额
    const quotaData = await invoke<AntigravityQuotaData>('antigravity_get_quota', {
      accessToken: tokenResponse.access_token
    })

    // 更新账户
    const now = Date.now()
    await store.updateAccount(account.id, {
      token: {
        ...account.token,
        access_token: tokenResponse.access_token,
        expires_in: tokenResponse.expires_in,
        expiry_timestamp: now + (tokenResponse.expires_in * 1000),
      },
      quota: quotaData,
      is_forbidden: quotaData?.is_forbidden || false,
      lastUsedAt: now
    })
  }

  /**
   * 批量刷新所有 Antigravity 账号的配额
   */
  static async refreshAllAccounts(): Promise<{ success: number; failed: number }> {
    const store = usePlatformStore.getState()
    const antigravityAccounts = store.accounts.filter(
      a => a.platform === 'antigravity'
    ) as AntigravityAccount[]

    let success = 0
    let failed = 0

    for (const account of antigravityAccounts) {
      try {
        await this.refreshAccount(account)
        success++
      } catch (e) {
        logError(`Failed to refresh account ${account.email}:`, e)
        failed++
      }
    }

    return { success, failed }
  }
}
