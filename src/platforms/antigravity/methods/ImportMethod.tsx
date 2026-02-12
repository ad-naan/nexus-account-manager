/**
 * Antigravity 平台 - 数据库导入方式
 * 
 * 从 VSCode/Cursor 的 state.vscdb 导入账号
 */

import { logError, logWarn } from '@/lib/logger'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Loader2, CheckCircle2, AlertCircle, FolderOpen, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'

import type { AddMethodProps } from '@/types/platform'
import type { AntigravityAccount, AntigravityQuotaData } from '@/types/account'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'scanning' | 'found' | 'importing' | 'success' | 'error'

interface FoundToken {
    source: string
    token: string
}

export function ImportMethod({ onSuccess, onClose }: AddMethodProps) {
    const { i18n } = useTranslation()
    const isEn = i18n.language === 'en'

    const [status, setStatus] = useState<Status>('idle')
    const [message, setMessage] = useState('')
    const [dbPath, setDbPath] = useState('')
    const [foundTokens, setFoundTokens] = useState<FoundToken[]>([])

    // 自动扫描默认路径
    const handleAutoScan = async () => {
        setStatus('scanning')
        setMessage(isEn ? 'Scanning for databases...' : '正在扫描数据库...')

        try {
            const result = await invoke<FoundToken[]>('antigravity_scan_databases')

            if (result.length > 0) {
                setFoundTokens(result)
                setStatus('found')
                setMessage(isEn
                    ? `Found ${result.length} tokens`
                    : `找到 ${result.length} 个 Token`)
            } else {
                setStatus('error')
                setMessage(isEn ? 'No tokens found' : '未找到 Token')
            }
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || (isEn ? 'Scan failed' : '扫描失败'))
        }
    }

    // 选择文件 - 使用 Tauri 命令
    const handleSelectFile = async () => {
        try {
            const selected = await invoke<string | null>('select_db_file')
            if (selected) {
                setDbPath(selected)
            }
        } catch (e: any) {
            logError('File picker error:', e)
        }
    }

    // 从指定路径导入
    const handleImportFromPath = async () => {
        if (!dbPath.trim()) return

        setStatus('scanning')
        setMessage(isEn ? 'Reading database...' : '正在读取数据库...')

        try {
            const result = await invoke<FoundToken[]>('import_from_db', { path: dbPath })

            if (result.length > 0) {
                setFoundTokens(result)
                setStatus('found')
                setMessage(isEn
                    ? `Found ${result.length} tokens`
                    : `找到 ${result.length} 个 Token`)
            } else {
                setStatus('error')
                setMessage(isEn ? 'No tokens found in database' : '数据库中未找到 Token')
            }
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || (isEn ? 'Import failed' : '导入失败'))
        }
    }

    // 确认导入
    const handleConfirmImport = async () => {
        if (foundTokens.length === 0) return

        setStatus('importing')
        setMessage(isEn ? 'Importing accounts...' : '正在导入账号...')

        let successCount = 0

        for (const item of foundTokens) {
            try {
                // 调用后端命令获取账户基本信息
                const accountData = await invoke<{
                    id: string
                    email: string
                    name: string | null
                    refresh_token: string
                }>('antigravity_add_by_token', {
                    refreshToken: item.token
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
            } catch (e) {
                logError('Failed to import token:', e)
            }
        }

        if (successCount > 0) {
            setStatus('success')
            setMessage(isEn
                ? `Imported ${successCount} accounts!`
                : `成功导入 ${successCount} 个账号！`)
            // Auto-close dialog after 1 second
            setTimeout(() => {
                onClose()
            }, 1000)
        } else {
            setStatus('error')
            setMessage(isEn ? 'Import failed' : '导入失败')
        }
    }

    return (
        <div className="space-y-4">
            {/* Auto Scan */}
            <Button
                variant="outline"
                className="w-full py-6 gap-2"
                onClick={handleAutoScan}
                disabled={status === 'scanning' || status === 'importing'}
            >
                <Search className="h-4 w-4" />
                {isEn ? 'Auto Scan (VSCode/Cursor)' : '自动扫描 (VSCode/Cursor)'}
            </Button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        {isEn ? 'OR' : '或'}
                    </span>
                </div>
            </div>

            {/* Manual Path */}
            <div className="space-y-2">
                <Label>{isEn ? 'Database Path' : '数据库路径'}</Label>
                <div className="flex gap-2">
                    <Input
                        placeholder="C:\Users\...\state.vscdb"
                        value={dbPath}
                        onChange={(e) => setDbPath(e.target.value)}
                        className="font-mono text-xs flex-1"
                    />
                    <Button variant="outline" size="icon" onClick={handleSelectFile}>
                        <FolderOpen className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleImportFromPath}
                    disabled={!dbPath.trim() || status === 'scanning'}
                >
                    {status === 'scanning' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEn ? 'Scan This File' : '扫描此文件'}
                </Button>
            </div>

            {/* Found Tokens Preview */}
            {foundTokens.length > 0 && (status === 'found' || status === 'importing') && (
                <div className="space-y-2 animate-in fade-in">
                    <Label>{isEn ? 'Found Tokens' : '发现的 Token'}</Label>
                    <div className="rounded-lg border p-2 bg-muted/50 max-h-32 overflow-y-auto">
                        {foundTokens.map((item, i) => (
                            <div key={i} className="text-xs font-mono truncate py-1 border-b last:border-0 border-border/50">
                                <span className="font-semibold text-primary">{item.source}:</span>{' '}
                                <span className="text-muted-foreground">{item.token.substring(0, 20)}...</span>
                            </div>
                        ))}
                    </div>
                    <Button className="w-full" onClick={handleConfirmImport} disabled={status === 'importing'}>
                        {status === 'importing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEn ? `Import ${foundTokens.length} Accounts` : `导入 ${foundTokens.length} 个账号`}
                    </Button>
                </div>
            )}

            {/* Status Message */}
            {message && (
                <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    status === 'success' && "bg-green-500/10 text-green-600",
                    status === 'error' && "bg-red-500/10 text-red-600",
                    (status === 'scanning' || status === 'importing') && "bg-blue-500/10 text-blue-600"
                )}>
                    {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
                    {(status === 'scanning' || status === 'importing') && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                    <span>{message}</span>
                </div>
            )}
        </div>
    )
}
