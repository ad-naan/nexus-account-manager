/**
 * Antigravity 平台 - OAuth 添加方式
 * 
 * 通过 Google OAuth 授权添加账号
 */

import { logError, logInfo, logWarn } from '@/lib/logger'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
// @ts-ignore
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core'
import type { AddMethodProps } from '@/types/platform'
import type { AntigravityAccount, AntigravityQuotaData } from '@/types/account'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'waiting' | 'processing' | 'success' | 'error'

export function OAuthMethod({ onSuccess, onError, onClose }: AddMethodProps) {
    const { i18n } = useTranslation()
    const isEn = i18n.language === 'en'

    const [status, setStatus] = useState<Status>('idle')
    const [message, setMessage] = useState('')
    const [authCode, setAuthCode] = useState('')
    const [oauthUrl, setOauthUrl] = useState('')
    
    // 使用 ref 来避免闭包问题
    const statusRef = useRef(status)
    const oauthUrlRef = useRef(oauthUrl)
    
    useEffect(() => {
        statusRef.current = status
    }, [status])
    
    useEffect(() => {
        oauthUrlRef.current = oauthUrl
    }, [oauthUrl])

    // 自动完成 OAuth（后端已接收到回调）
    const autoCompleteOAuth = useCallback(async () => {
        logInfo('[OAuth] Auto-completing OAuth flow...')
        setStatus('processing')
        setMessage(isEn ? 'Processing authorization...' : '正在处理授权...')

        try {
            // 调用后端完成 OAuth（不需要 code，后端已经处理了）
            const accountData = await invoke<{
                id: string
                email: string
                name: string | null
                refresh_token: string
            }>('antigravity_complete_oauth', { code: '' })

            logInfo('[OAuth] Account data received:', accountData.email)

            // 刷新 token 获取 access_token
            const tokenResponse = await invoke<{
                access_token: string
                expires_in: number
                token_type: string
            }>('antigravity_refresh_token', {
                refreshToken: accountData.refresh_token
            })

            logInfo('[OAuth] Token refreshed')

            // 获取配额信息
            let quotaData: AntigravityQuotaData | undefined = undefined
            try {
                quotaData = await invoke<AntigravityQuotaData>('antigravity_get_quota', {
                    accessToken: tokenResponse.access_token
                })
                logInfo('[OAuth] Quota data fetched')
            } catch (e) {
                logWarn('Failed to fetch quota:', e)
            }

            // 构造完整的 AntigravityAccount 对象
            const now = Date.now()
            const expiryTimestamp = now + (tokenResponse.expires_in * 1000)
            
            const account: AntigravityAccount = {
                id: accountData.id,
                platform: 'antigravity',
                email: accountData.email,
                name: accountData.name || undefined,
                isActive: false,
                lastUsedAt: now,
                createdAt: now,
                token: {
                    access_token: tokenResponse.access_token,
                    refresh_token: accountData.refresh_token,
                    expires_in: tokenResponse.expires_in,
                    expiry_timestamp: expiryTimestamp,
                    token_type: tokenResponse.token_type
                },
                quota: quotaData,
                is_forbidden: quotaData?.is_forbidden || false
            }

            logInfo('[OAuth] Account object constructed, adding to store...')
            setStatus('success')
            setMessage(isEn ? 'Account added successfully!' : '账号添加成功！')

            setTimeout(() => {
                onSuccess(account)
                onClose()
            }, 1000)
        } catch (e: any) {
            logError('[OAuth] Auto-complete failed:', e)
            setStatus('error')
            setMessage(e.message || (isEn ? 'OAuth failed' : 'OAuth 失败'))
            if (onError) {
                onError(e.message)
            }
        }
    }, [isEn, onSuccess, onError, onClose])

    // 监听 OAuth 回调事件
    useEffect(() => {
        let unlisten: (() => void) | undefined

        const setupListener = async () => {
            unlisten = await listen('oauth-callback-received', async () => {
                logInfo('[OAuth] Event received, status:', statusRef.current)
                
                // 只有在等待状态时才自动完成
                if (statusRef.current !== 'waiting') {
                    logInfo('[OAuth] Ignoring event, not in waiting state')
                    return
                }

                logInfo('[OAuth] Starting auto-complete...')
                await autoCompleteOAuth()
            })
            
            logInfo('[OAuth] Event listener registered')
        }

        setupListener()

        return () => {
            if (unlisten) {
                unlisten()
                logInfo('[OAuth] Event listener unregistered')
            }
        }
    }, [autoCompleteOAuth])

    // 启动 OAuth 流程
    const handleStartOAuth = async () => {
        try {
            setStatus('waiting')
            setMessage(isEn ? 'Opening browser for authorization...' : '正在打开浏览器授权...')

            // 调用后端生成 OAuth URL
            const url = await invoke<string>('antigravity_prepare_oauth_url')
            setOauthUrl(url)
            
            logInfo('[OAuth] OAuth URL generated:', url)

            // 打开浏览器
            try {
                // @ts-ignore
                await openUrl(url)
                setMessage(isEn
                    ? 'Please complete authorization in browser. The account will be added automatically.'
                    : '请在浏览器中完成授权，账号将自动添加。')
                logInfo('[OAuth] Browser opened, waiting for callback...')
            } catch (e) {
                logError("Failed to open URL via plugin, falling back to window.open", e);
                window.open(url, '_blank')
                setMessage(isEn
                    ? 'Please complete authorization in browser. The account will be added automatically.'
                    : '请在浏览器中完成授权，账号将自动添加。')
            }
        } catch (e: any) {
            logError('[OAuth] Failed to start OAuth:', e)
            setStatus('error')
            setMessage(e.message || (isEn ? 'Failed to start OAuth' : 'OAuth 启动失败'))
            if (onError) {
                onError(e.message)
            }
        }
    }

    // 手动完成 OAuth 流程（用户手动输入授权码）
    const handleManualComplete = async () => {
        if (!authCode.trim()) {
            setMessage(isEn ? 'Please enter authorization code' : '请输入授权码')
            return
        }

        setStatus('processing')
        setMessage(isEn ? 'Processing authorization...' : '正在处理授权...')

        try {
            const accountData = await invoke<{
                id: string
                email: string
                name: string | null
                refresh_token: string
            }>('antigravity_complete_oauth', {
                code: authCode.trim()
            })

            // 刷新 token 获取 access_token
            const tokenResponse = await invoke<{
                access_token: string
                expires_in: number
                token_type: string
            }>('antigravity_refresh_token', {
                refreshToken: accountData.refresh_token
            })

            // 获取配额信息
            let quotaData: AntigravityQuotaData | undefined = undefined
            try {
                quotaData = await invoke<AntigravityQuotaData>('antigravity_get_quota', {
                    accessToken: tokenResponse.access_token
                })
            } catch (e) {
                logWarn('Failed to fetch quota:', e)
            }

            // 构造完整的 AntigravityAccount 对象
            const now = Date.now()
            const expiryTimestamp = now + (tokenResponse.expires_in * 1000)
            
            const account: AntigravityAccount = {
                id: accountData.id,
                platform: 'antigravity',
                email: accountData.email,
                name: accountData.name || undefined,
                isActive: false,
                lastUsedAt: now,
                createdAt: now,
                token: {
                    access_token: tokenResponse.access_token,
                    refresh_token: accountData.refresh_token,
                    expires_in: tokenResponse.expires_in,
                    expiry_timestamp: expiryTimestamp,
                    token_type: tokenResponse.token_type
                },
                quota: quotaData,
                is_forbidden: quotaData?.is_forbidden || false
            }

            setStatus('success')
            setMessage(isEn ? 'Account added successfully!' : '账号添加成功！')

            setTimeout(() => {
                onSuccess(account)
                onClose()
            }, 1000)
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || (isEn ? 'OAuth failed' : 'OAuth 失败'))
            if (onError) {
                onError(e.message)
            }
        }
    }

    return (
        <div className="space-y-4">
            {/* Step 1: Start OAuth */}
            <Button
                variant="outline"
                className="w-full py-6 gap-2"
                onClick={handleStartOAuth}
                disabled={status === 'waiting' || status === 'processing'}
            >
                <ExternalLink className="h-4 w-4" />
                {isEn ? 'Open Google Authorization' : '打开 Google 授权页面'}
            </Button>

            {/* Step 2: Manual code input (optional fallback) */}
            {status === 'waiting' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs text-muted-foreground text-center">
                        {isEn 
                            ? 'If auto-completion fails, you can manually paste the authorization code below:'
                            : '如果自动完成失败，您可以手动粘贴授权码：'}
                    </div>
                    <div className="grid gap-2">
                        <Label>{isEn ? 'Authorization Code (Optional)' : '授权码（可选）'}</Label>
                        <Input
                            placeholder={isEn ? 'Paste code here...' : '粘贴授权码...'}
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                            className="font-mono"
                        />
                    </div>
                    <Button
                        className="w-full"
                        onClick={handleManualComplete}
                        disabled={!authCode.trim()}
                    >
                        {isEn ? 'Complete Manually' : '手动完成'}
                    </Button>
                </div>
            )}

            {/* Status Message */}
            {message && (
                <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    status === 'success' && "bg-green-500/10 text-green-600",
                    status === 'error' && "bg-red-500/10 text-red-600",
                    (status === 'waiting' || status === 'processing') && "bg-blue-500/10 text-blue-600"
                )}>
                    {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
                    {(status === 'waiting' || status === 'processing') && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                    <span>{message}</span>
                </div>
            )}
        </div>
    )
}
