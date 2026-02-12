/**
 * Kiro 平台 - 社交登录方式
 * 
 * 支持 Google 和 GitHub 登录
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import type { AddMethodProps } from '@/types/platform'
import type { KiroAccount } from '@/types/account'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'waiting' | 'success' | 'error'
type Provider = 'Google' | 'Github'

export function SocialMethod({ onSuccess, onError, onClose }: AddMethodProps) {
    const { t } = useTranslation()

    const [status, setStatus] = useState<Status>('idle')
    const [message, setMessage] = useState('')
    const [provider, setProvider] = useState<Provider | null>(null)

    const handleLogin = async (selectedProvider: Provider) => {
        setProvider(selectedProvider)
        setStatus('waiting')
        setMessage(t('platforms.kiro.auth.social.loggingIn', { provider: selectedProvider }))

        try {
            const result = await invoke<any>('kiro_social_login', {
                provider: selectedProvider
            })

            // Transform backend account to frontend KiroAccount
            const kiroAccount: KiroAccount = {
                id: result.id,
                platform: 'kiro',
                email: result.email,
                name: result.name,
                isActive: false,
                lastUsedAt: Date.now(),
                createdAt: Date.now(),
                idp: selectedProvider === 'Google' ? 'Google' : 'Github',
                credentials: {
                    accessToken: result.access_token,
                    refreshToken: result.refresh_token,
                    expiresAt: result.expires_in ? Date.now() + result.expires_in * 1000 : undefined,
                    authMethod: 'social'
                },
                subscription: {
                    type: result.quota?.subscription_type || 'Free',
                    title: result.quota?.subscription_title
                },
                usage: {
                    current: result.quota?.current || 0,
                    limit: result.quota?.limit || 25,
                    percentUsed: result.quota?.limit > 0
                        ? result.quota.current / result.quota.limit
                        : 0,
                    lastUpdated: Date.now()
                },
                status: 'active',
                lastCheckedAt: Date.now()
            }

            setStatus('success')
            setMessage(t('platforms.kiro.auth.social.loginSuccess'))
            onSuccess(kiroAccount)
            setTimeout(onClose, 1000)
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || t('platforms.kiro.auth.social.loginFailed'))
            onError(e.message)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    className="py-6 gap-2"
                    onClick={() => handleLogin('Google')}
                    disabled={status === 'waiting'}
                >
                    {status === 'waiting' && provider === 'Google' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                </Button>

                <Button
                    variant="outline"
                    className="py-6 gap-2"
                    onClick={() => handleLogin('Github')}
                    disabled={status === 'waiting'}
                >
                    {status === 'waiting' && provider === 'Github' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                </Button>
            </div>

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
