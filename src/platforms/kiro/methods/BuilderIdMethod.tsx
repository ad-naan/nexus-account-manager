/**
 * Kiro 平台 - BuilderID 登录方式
 * 
 * 使用 AWS Builder ID 的 Device Code Flow 登录
 */

import { logError, logInfo } from '@/lib/logger'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Loader2, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import type { AddMethodProps } from '@/types/platform'
import type { KiroAccount, KiroSubscriptionType } from '@/types/account'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'waiting' | 'success' | 'error'

interface DeviceCodeData {
    deviceCode: string
    userCode: string
    verificationUri: string
    verificationUriComplete?: string
    expiresIn: number
    interval: number
    clientId: string
    clientSecret: string
}

// Backend response type (snake_case from Rust)
interface BackendKiroAccount {
    id: string
    email: string
    name?: string | null
    access_token: string
    refresh_token?: string | null
    client_id?: string | null
    client_secret?: string | null
    expires_in: number
    quota: {
        subscription_type?: string
        subscription_title?: string
        current?: number
        limit?: number
    }
}

interface PollResult {
    completed: boolean
    account?: BackendKiroAccount
    error?: string
}

export function BuilderIdMethod({ onSuccess, onError, onClose }: AddMethodProps) {
    const { t } = useTranslation()

    const [status, setStatus] = useState<Status>('idle')
    const [message, setMessage] = useState('')
    const [deviceCodeData, setDeviceCodeData] = useState<DeviceCodeData | null>(null)
    const [copied, setCopied] = useState(false)
    const [usePrivateMode, setUsePrivateMode] = useState(true) // 默认启用隐私模式
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // 清理轮询
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [])

    // 打开浏览器（支持隐私模式）
    const openBrowser = async (url: string) => {
        try {
            if (usePrivateMode) {
                // 使用隐私模式命令
                logInfo('[Browser] Attempting to open in private mode:', url)
                await invoke('open_url_in_private_mode', { url })
                logInfo('[Browser] Private mode command completed')
            } else {
                // 使用默认浏览器 - 使用 Tauri opener plugin
                logInfo('[Browser] Opening in default browser:', url)
                const { openUrl } = await import('@tauri-apps/plugin-opener')
                await openUrl(url)
                logInfo('[Browser] Default browser opened')
            }
        } catch (e) {
            logError("Open browser failed:", e)
            setMessage(`${t('platforms.kiro.auth.builderId.browserOpenFailed')}: ${e}. ${t('platforms.kiro.auth.builderId.tryingFallback')}`)
            // 回退到 window.open
            window.open(url, '_blank')
        }
    }

    // 开始登录
    const handleStartLogin = async () => {
        setStatus('waiting')
        setMessage(t('platforms.kiro.auth.builderId.initializing'))

        try {
            const result = await invoke<DeviceCodeData>('kiro_start_device_auth')
            setDeviceCodeData(result)
            setMessage(t('platforms.kiro.auth.builderId.completeInBrowser'))

            // 优先使用完整的验证 URL（携带 user_code）
            const urlToOpen = result.verificationUriComplete || result.verificationUri
            await openBrowser(urlToOpen)

            // 开始轮询
            startPolling(result.interval, result)
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || t('platforms.kiro.auth.builderId.loginFailed'))
            onError(e.message)
        }
    }

    // 轮询授权状态
    const startPolling = (interval: number, authData: DeviceCodeData) => {
        if (pollRef.current) clearInterval(pollRef.current!)

        let pollCount = 0
        const maxPolls = Math.floor(authData.expiresIn / interval) // 根据过期时间计算最大轮询次数

        pollRef.current = setInterval(async () => {
            pollCount++
            
            try {
                const result = await invoke<PollResult>('kiro_poll_token', {
                    deviceCode: authData.deviceCode,
                    clientId: authData.clientId,
                    clientSecret: authData.clientSecret
                })

                if (result.completed && result.account) {
                    clearInterval(pollRef.current!)
                    
                // Transform backend account (snake_case) to frontend KiroAccount (camelCase)
                const backendAccount = result.account
                const kiroAccount: KiroAccount = {
                    id: backendAccount.id,
                    platform: 'kiro',
                    email: backendAccount.email,
                    name: backendAccount.name || undefined,
                    isActive: false,
                    lastUsedAt: Date.now(),
                    createdAt: Date.now(),
                    idp: 'BuilderId',
                    credentials: {
                        accessToken: backendAccount.access_token,
                        refreshToken: backendAccount.refresh_token || undefined,
                        clientId: backendAccount.client_id || undefined,
                        clientSecret: backendAccount.client_secret || undefined,
                        expiresAt: Date.now() + backendAccount.expires_in * 1000,
                        authMethod: 'oidc',
                        region: 'us-east-1'
                    },
                    subscription: {
                        type: (backendAccount.quota.subscription_type as KiroSubscriptionType) || 'Free',
                        title: backendAccount.quota.subscription_title
                    },
                    usage: {
                        current: backendAccount.quota.current || 0,
                        limit: backendAccount.quota.limit || 25,
                        percentUsed: backendAccount.quota.limit && backendAccount.quota.limit > 0
                            ? (backendAccount.quota.current || 0) / backendAccount.quota.limit
                            : 0,
                        lastUpdated: Date.now()
                    },
                    status: 'active',
                    lastCheckedAt: Date.now()
                }
                    
                    setStatus('success')
                    setMessage(t('platforms.kiro.auth.builderId.loginSuccess'))
                    onSuccess(kiroAccount)
                    setTimeout(onClose, 1000)
                } else if (result.error) {
                    // 只有在非预期错误时才停止轮询
                    // pending 和 slow_down 会在后端处理，这里不会收到
                    clearInterval(pollRef.current!)
                    setStatus('error')
                    setMessage(`${t('platforms.kiro.auth.builderId.authFailed')}: ${result.error}`)
                    onError(result.error)
                }
            } catch (e: any) {
                logError('[Poll] Error:', e)
                // 检查是否超时
                if (pollCount >= maxPolls) {
                    clearInterval(pollRef.current!)
                    setStatus('error')
                    setMessage(t('platforms.kiro.auth.builderId.authTimeout'))
                    onError('Authorization timed out')
                }
                // 其他错误继续轮询
            }
        }, interval * 1000)
    }

    // 复制验证码
    const handleCopy = async () => {
        if (deviceCodeData?.userCode) {
            await navigator.clipboard.writeText(deviceCodeData.userCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    // 取消登录
    const handleCancel = () => {
        if (pollRef.current) clearInterval(pollRef.current)
        invoke('kiro_cancel_auth').catch(() => { })
        setStatus('idle')
        setDeviceCodeData(null)
        setMessage('')
    }

    return (
        <div className="space-y-4">
            {status === 'idle' && (
                <>
                    {/* 隐私模式选项 */}
                    <div className="px-2">
                        <button
                            type="button"
                            onClick={() => setUsePrivateMode(!usePrivateMode)}
                            className={cn(
                                "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200",
                                usePrivateMode 
                                    ? 'bg-primary/5 border-primary/30 hover:bg-primary/10' 
                                    : 'bg-muted/30 border-transparent hover:bg-muted/50'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                    usePrivateMode ? 'bg-primary/20' : 'bg-muted'
                                )}>
                                    <EyeOff className={cn(
                                        "w-4 h-4",
                                        usePrivateMode ? 'text-primary' : 'text-muted-foreground'
                                    )} />
                                </div>
                                <div className="text-left">
                                    <div className={cn(
                                        "text-sm font-medium",
                                        usePrivateMode ? 'text-foreground' : 'text-muted-foreground'
                                    )}>
                                        {t('accounts.privateMode')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {usePrivateMode 
                                            ? t('platforms.kiro.auth.builderId.privateModeEnabled')
                                            : t('platforms.kiro.auth.builderId.privateModeDisabled')}
                                    </div>
                                </div>
                            </div>
                            <div className={cn(
                                "relative w-11 h-6 rounded-full transition-colors",
                                usePrivateMode ? 'bg-primary' : 'bg-muted-foreground/30'
                            )}>
                                <div className={cn(
                                    "absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all",
                                    usePrivateMode 
                                        ? 'translate-x-5 bg-background' 
                                        : 'translate-x-0.5 bg-white'
                                )} />
                            </div>
                        </button>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full py-6 gap-2"
                        onClick={handleStartLogin}
                    >
                        <ExternalLink className="h-4 w-4" />
                        {t('platforms.kiro.auth.builderId.title')}
                    </Button>
                </>
            )}

            {/* Device Code Display */}
            {deviceCodeData && status === 'waiting' && (
                <div className="space-y-3 animate-in fade-in">
                    <div className="text-center p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">
                            {t('platforms.kiro.auth.builderId.verificationCode')}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                            <code className="text-2xl font-bold tracking-widest">
                                {deviceCodeData.userCode}
                            </code>
                            <Button variant="ghost" size="icon" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={async () => {
                                const urlToOpen = deviceCodeData.verificationUriComplete || deviceCodeData.verificationUri
                                await openBrowser(urlToOpen)
                            }}
                        >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {t('platforms.kiro.auth.builderId.openBrowser')}
                        </Button>
                        <Button variant="ghost" onClick={handleCancel}>
                            {t('platforms.kiro.auth.builderId.cancel')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Status Message */}
            {message && (
                <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    status === 'success' && "bg-green-500/10 text-green-600",
                    status === 'error' && "bg-red-500/10 text-red-600",
                    status === 'waiting' && "bg-blue-500/10 text-blue-600"
                )}>
                    {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
                    {status === 'waiting' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                    <span>{message}</span>
                </div>
            )}
        </div>
    )
}
