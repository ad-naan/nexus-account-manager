import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { usePlatformStore } from '@/stores/usePlatformStore'
import type { Account, AntigravityAccount, KiroAccount } from '@/types/account'
import {
    Power,
    Copy,
    Check,
    Edit,
    Trash2,
    Gem,
    Diamond,
    Circle,
    Download
} from 'lucide-react'
import { toast } from 'sonner'

// 订阅类型颜色
const getSubscriptionStyle = (tier?: string) => {
    const t = (tier || '').toLowerCase()
    if (t.includes('ultra')) return 'bg-purple-600 text-white border-purple-600'
    if (t.includes('pro')) return 'bg-blue-600 text-white border-blue-600'
    if (t.includes('enterprise')) return 'bg-orange-500 text-white border-orange-500'
    return 'bg-secondary text-secondary-foreground'
}

const getSubscriptionIcon = (tier?: string) => {
    const t = (tier || '').toLowerCase()
    if (t.includes('ultra')) return <Gem className="w-3 h-3" />
    if (t.includes('pro')) return <Diamond className="w-3 h-3" />
    return <Circle className="w-3 h-3" />
}

interface AccountTableProps {
    accounts: Account[]
    onSwitch?: (account: Account) => void
    onEdit?: (account: Account) => void
    onDelete?: (account: Account) => void
    isSwitching?: boolean
}

export function AccountTable({
    accounts,
    onSwitch,
    onEdit,
    onDelete,
    isSwitching = false
}: AccountTableProps) {
    const { t } = useTranslation()
    const deleteAccount = usePlatformStore(state => state.deleteAccount)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const handleCopyEmail = async (email: string, id: string) => {
        await navigator.clipboard.writeText(email)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 1500)
    }

    const handleDelete = (account: Account) => {
        if (confirm(t('common.confirmDelete', { defaultValue: `Delete ${account.email}?` }))) {
            deleteAccount(account.id)
            onDelete?.(account)
            toast.success(t('common.deleteSuccess', { defaultValue: 'Account deleted' }))
        }
    }

    const handleDownload = (account: Account) => {
        const data = JSON.stringify(account, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${account.platform}-${account.email}-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(t('common.downloadSuccess', { defaultValue: 'Account downloaded' }))
    }

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }

    const getAccountInfo = (account: Account) => {
        const isAntigravity = account.platform === 'antigravity'
        const isKiro = account.platform === 'kiro'
        const isClaude = account.platform === 'claude'
        const isCodex = account.platform === 'codex'
        const isGemini = account.platform === 'gemini'
        
        const antigravity = isAntigravity ? account as AntigravityAccount : null
        const kiro = isKiro ? account as KiroAccount : null

        const subscriptionTier = antigravity?.quota?.subscription_tier || 
                                 kiro?.subscription?.type || 
                                 (isClaude || isCodex || isGemini ? 'API' : 'Free')

        const platformName = isAntigravity ? 'Antigravity' : 
                           isKiro ? (kiro?.idp || 'Kiro') : 
                           isClaude ? 'Claude' : 
                           isCodex ? 'Codex' : 
                           'Gemini'

        return { subscriptionTier, platformName }
    }

    return (
        <Card className="bg-card/30 border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border/60 bg-muted/30">
                            <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                                {t('common.no', { defaultValue: '#' })}
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.status', { defaultValue: 'Status' })}
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.email', { defaultValue: 'Email' })}
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.name', { defaultValue: 'Name' })}
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.type', { defaultValue: 'Type' })}
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.createdAt', { defaultValue: 'Created' })}
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.lastUsed', { defaultValue: 'Last Used' })}
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t('common.actions', { defaultValue: 'Actions' })}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {accounts.map((account, index) => {
                            const { subscriptionTier, platformName } = getAccountInfo(account)
                            
                            return (
                                <tr
                                    key={account.id}
                                    className={cn(
                                        'transition-colors hover:bg-muted/20',
                                        account.isActive && 'bg-primary/5'
                                    )}
                                >
                                    <td className="py-3 px-3 text-center">
                                        <span className="text-xs font-mono text-muted-foreground">
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {account.isActive ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                                    <span className="text-xs font-medium text-green-500">
                                                        {t('common.active', { defaultValue: 'Active' })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <Circle className="h-2 w-2 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">
                                                        {t('common.inactive', { defaultValue: 'Inactive' })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate max-w-[200px]">
                                                {account.email}
                                            </span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 hover:bg-white/10"
                                                onClick={() => handleCopyEmail(account.email, account.id)}
                                                title={t('common.copy', { defaultValue: 'Copy' })}
                                            >
                                                {copiedId === account.id ? (
                                                    <Check className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                                            {account.name || '-'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Badge className={cn('text-[10px] h-5 px-2 border-0 shadow-sm', getSubscriptionStyle(subscriptionTier))}>
                                                {getSubscriptionIcon(subscriptionTier)}
                                                <span className="ml-1.5 font-medium">{subscriptionTier.toUpperCase()}</span>
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] h-5 px-2 text-muted-foreground border-border bg-muted/30">
                                                {platformName}
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {formatDate(account.createdAt)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        {account.lastUsedAt ? (
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {formatDate(account.lastUsedAt)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 hover:bg-white/10 hover:text-primary"
                                                onClick={() => onSwitch?.(account)}
                                                title={t('common.switch', { defaultValue: 'Switch' })}
                                                disabled={account.isActive || isSwitching}
                                            >
                                                <Power className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 hover:bg-white/10 hover:text-green-400"
                                                onClick={() => handleDownload(account)}
                                                title={t('common.download', { defaultValue: 'Download' })}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 hover:bg-white/10 hover:text-blue-400"
                                                onClick={() => onEdit?.(account)}
                                                title={t('common.edit', { defaultValue: 'Edit' })}
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 hover:bg-red-500/10 hover:text-red-500"
                                                onClick={() => handleDelete(account)}
                                                title={t('common.delete', { defaultValue: 'Delete' })}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}
