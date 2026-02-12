/**
 * Antigravity 平台 - Token 添加方式
 * 
 * 通过粘贴 Refresh Token 批量添加账号
 */

import { logWarn } from '@/lib/logger'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import type { AddMethodProps } from '@/types/platform'
import type { AntigravityAccount, AntigravityQuotaData } from '@/types/account'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'processing' | 'success' | 'error'

export function TokenMethod({ onSuccess, onError, onClose }: AddMethodProps) {
    const { i18n } = useTranslation()
    const isEn = i18n.language === 'en'

    const [status, setStatus] = useState<Status>('idle')
    const [message, setMessage] = useState('')
    const [tokenInput, setTokenInput] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })

    // 解析 Token
    const parseTokens = (input: string): string[] => {
        const trimmed = input.trim()
        const tokens: string[] = []

        // 尝试 JSON 解析
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed)
                if (Array.isArray(parsed)) {
                    parsed.forEach((item: any) => {
                        const token = typeof item === 'string' ? item : item.refresh_token || item.token
                        if (token && token.startsWith('1//')) {
                            tokens.push(token)
                        }
                    })
                }
            } catch { }
        }

        // 正则提取
        if (tokens.length === 0) {
            const regex = /1\/\/[a-zA-Z0-9_\-]+/g
            const matches = trimmed.match(regex)
            if (matches) tokens.push(...matches)
        }

        return [...new Set(tokens)]
    }

    // 处理提交
    const handleSubmit = async () => {
        const tokens = parseTokens(tokenInput)

        if (tokens.length === 0) {
            setStatus('error')
            setMessage(isEn ? 'No valid tokens found' : '未找到有效的 Token')
            return
        }

        setStatus('processing')
        setProgress({ current: 0, total: tokens.length })
        setMessage(isEn ? `Processing ${tokens.length} tokens...` : `正在处理 ${tokens.length} 个 Token...`)

        let successCount = 0
        const errors: string[] = []

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]
            setProgress({ current: i + 1, total: tokens.length })

            try {
                // 调用后端命令获取账户基本信息
                const accountData = await invoke<{
                    id: string
                    email: string
                    name: string | null
                    refresh_token: string
                }>('antigravity_add_by_token', {
                    refreshToken: token
                })

                // 刷新token获取access_token
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

                onSuccess(account)
                successCount++
            } catch (e: any) {
                errors.push(`Token ${i + 1}: ${e.message || 'Failed'}`)
            }
        }

        if (successCount === tokens.length) {
            setStatus('success')
            setMessage(isEn
                ? `Successfully added ${successCount} accounts!`
                : `成功添加 ${successCount} 个账号！`)
            // Auto-close dialog after 1 second
            setTimeout(() => {
                onClose()
            }, 1000)
        } else if (successCount > 0) {
            setStatus('success')
            setMessage(isEn
                ? `Added ${successCount}/${tokens.length} accounts`
                : `添加了 ${successCount}/${tokens.length} 个账号`)
            // Auto-close dialog after 1.5 seconds for partial success
            setTimeout(() => {
                onClose()
            }, 1500)
        } else {
            setStatus('error')
            setMessage(errors[0] || (isEn ? 'All tokens failed' : '所有 Token 都失败了'))
            if (onError) {
                onError(errors.join('\n'))
            }
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>{isEn ? 'Refresh Token(s)' : '刷新令牌'}</Label>
                <textarea
                    className="w-full h-32 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder={isEn
                        ? 'Paste tokens here (JSON array or one per line)...'
                        : '粘贴 Token（JSON 数组或每行一个）...'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={status === 'processing'}
                />
                <p className="text-xs text-muted-foreground">
                    {isEn
                        ? 'Supports JSON array format or tokens starting with "1//"'
                        : '支持 JSON 数组格式或以 "1//" 开头的 Token'}
                </p>
            </div>

            <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={status === 'processing' || !tokenInput.trim()}
            >
                {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status === 'processing'
                    ? `${progress.current}/${progress.total}`
                    : (isEn ? 'Add Accounts' : '添加账号')}
            </Button>

            {/* Status Message */}
            {message && (
                <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    status === 'success' && "bg-green-500/10 text-green-600",
                    status === 'error' && "bg-red-500/10 text-red-600",
                    status === 'processing' && "bg-blue-500/10 text-blue-600"
                )}>
                    {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
                    {status === 'processing' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                    <span>{message}</span>
                </div>
            )}
        </div>
    )
}
