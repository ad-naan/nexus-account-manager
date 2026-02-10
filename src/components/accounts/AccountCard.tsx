import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AccountDetailsDialog } from '@/components/dialogs/AccountDetailsDialog'
import { QuotaItem } from '@/components/accounts/QuotaItem'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { usePlatformStore } from '@/stores/usePlatformStore'
import type { AntigravityAccount, KiroAccount, ClaudeAccount, CodexAccount, GeminiAccount, Account } from '@/types/account'
import {
    RefreshCw,
    Trash2,
    Copy,
    Power,
    Info,
    Check,
    Download,
    Ban,
    Gem,
    Diamond,
    Circle,
    Edit
} from 'lucide-react'

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

interface AccountCardProps {
    account: Account
    onRefresh?: () => void
    onSwitch?: (account:Account) => void
    onDelete?: (account:Account) => void
    onExport?: () => void
    onEdit?: (account:Account) => void
}

export const AccountCard = memo(function AccountCard({
    account,
    onRefresh,
    onSwitch,
    onDelete,
    onExport,
    onEdit,
}: AccountCardProps) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const deleteAccount = usePlatformStore(state => state.deleteAccount)
    const setActiveAccount = usePlatformStore(state => state.setActiveAccount)
    const updateAccount = usePlatformStore(state => state.updateAccount)

    // 判断平台
    const isAntigravity = account.platform === 'antigravity'
    const isKiro = account.platform === 'kiro'
    const isClaude = account.platform === 'claude'
    const isCodex = account.platform === 'codex'
    const isGemini = account.platform === 'gemini'
    const antigravity = isAntigravity ? account as AntigravityAccount : null
    const kiro = isKiro ? account as KiroAccount : null
    const claude = isClaude ? account as ClaudeAccount : null
    const codex = isCodex ? account as CodexAccount : null
    const gemini = isGemini ? account as GeminiAccount : null

    // 获取订阅信息
    const subscriptionTier = antigravity?.quota?.subscription_tier || kiro?.subscription?.type || (isClaude || isCodex || isGemini ? 'API' : 'Free')
    const isForbidden = antigravity?.is_forbidden || antigravity?.quota?.is_forbidden

    // 获取使用率
    const usagePercent = isAntigravity
        ? (antigravity?.quota?.models?.[0]?.percentage || 0)
        : isKiro
            ? ((kiro?.usage?.percentUsed || 0) * 100)
            : 0 // Claude/Codex/Gemini 暂不显示使用率

    const handleCopyEmail = async () => {
        await navigator.clipboard.writeText(account.email)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        onRefresh?.()
        // 模拟刷新 - 实际应调用后端 API
        setTimeout(() => setIsRefreshing(false), 1000)
    }

    const handleSwitch = () => {
        // 更新当前账号的 isActive 状态
        updateAccount(account.id, { isActive: true })
        setActiveAccount(account)
        onSwitch?.(account)
    }

    const handleDoubleClick = () => {
        if (!account.isActive) {
            handleSwitch()
        }
    }

    const handleDelete = () => {
        if (confirm(t('common.confirmDelete', { name: account.email }))) {
            deleteAccount(account.id)
            onDelete?.(account)
        }
    }

    const handleEdit = () => {
        onEdit?.(account)
    }

    return (
        <>
            <Card
                className={cn(
                    'relative transition-all duration-300 cursor-pointer overflow-hidden group border-border/60',
                    'bg-card shadow-sm',
                    'hover:shadow-lg hover:-translate-y-1 hover:border-primary/20',
                    // Active style
                    account.isActive && 'ring-2 ring-primary shadow-lg shadow-primary/10 bg-primary/5',
                    // Banned style
                    isForbidden && 'border-destructive/30 bg-destructive/5'
                )}
                onDoubleClick={handleDoubleClick}
            >
                {/* Banned Badge */}
                {isForbidden && (
                    <div className="absolute top-0 right-0 bg-destructive/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-medium flex items-center gap-1 z-20">
                        <Ban className="w-3 h-3" />
                        Banned
                    </div>
                )}

                {/* Active Indicator Line */}
                {account.isActive && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                )}

                <CardContent className="p-5 space-y-4">
                    {/* Header: Email + Status */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3
                                    className={cn(
                                        "font-semibold text-sm truncate cursor-pointer transition-colors",
                                        copied ? "text-green-500" : "hover:text-primary"
                                    )}
                                    onClick={handleCopyEmail}
                                    title={`${account.email} (${t('common.clickToCopy')})`}
                                >
                                    {copied ? t('common.copied') : account.email}
                                </h3>
                                {account.isActive && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                )}
                            </div>
                            {account.name && (
                                <p className="text-xs text-muted-foreground truncate font-light tracking-wide">
                                    {account.name}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Badges Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Subscription Badge */}
                        <Badge className={cn('text-[10px] h-5 px-2 border-0 shadow-sm', getSubscriptionStyle(subscriptionTier))}>
                            {getSubscriptionIcon(subscriptionTier)}
                            <span className="ml-1.5 font-medium">{subscriptionTier.toUpperCase()}</span>
                        </Badge>

                        {/* Platform Badge */}
                        <Badge variant="outline" className="text-[10px] h-5 px-2 text-muted-foreground border-border bg-muted/30">
                            {isAntigravity ? 'Antigravity' : isKiro ? (kiro?.idp || 'Kiro') : isClaude ? 'Claude' : isCodex ? 'Codex' : 'Gemini'}
                        </Badge>
                    </div>

                    {/* Quota Display */}
                    {isAntigravity && antigravity?.quota && (
                        <div className="space-y-1.5 pt-1">
                            {antigravity.quota.is_forbidden ? (
                                <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-200 dark:border-red-900/30">
                                    <Ban className="w-4 h-4 shrink-0" />
                                    <span>Account Forbidden</span>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {antigravity.quota.models?.slice(0, 3).map((model) => (
                                        <QuotaItem
                                            key={model.name}
                                            label={model.name}
                                            percentage={model.percentage}
                                            resetTime={model.reset_time}
                                        />
                                    ))}
                                    {antigravity.quota.models && antigravity.quota.models.length > 3 && (
                                        <div className="text-[10px] text-muted-foreground/50 text-center">
                                            +{antigravity.quota.models.length - 3} more models
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Kiro Usage */}
                    {isKiro && kiro && (
                        <div className="space-y-2 pt-1">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-light">{t('accounts.usage')}</span>
                                <span className={cn(
                                    "font-mono font-medium",
                                    usagePercent > 80 ? "text-amber-500" : "text-foreground/80"
                                )}>
                                    {usagePercent.toFixed(0)}%
                                </span>
                            </div>
                            <Progress
                                value={usagePercent}
                                className="h-1.5 bg-secondary/50"
                                indicatorClassName={cn(
                                    "transition-all duration-500",
                                    usagePercent > 90 ? "bg-red-500" :
                                        usagePercent > 70 ? "bg-amber-500" : "bg-primary"
                                )}
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground/70">
                                <span>{kiro.usage.current} / {kiro.usage.limit}</span>
                            </div>
                        </div>
                    )}

                    {/* Actions - Hover Reveal */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="flex items-center gap-0.5">
                            {/* Switch */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white/10 hover:text-primary"
                                onClick={handleSwitch}
                                title={t('common.switch')}
                                disabled={account.isActive}
                            >
                                <Power className="h-3.5 w-3.5" />
                            </Button>

                            {/* Refresh */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white/10 hover:text-blue-400"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                title={t('common.refresh')}
                            >
                                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                            </Button>

                            {/* Copy */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white/10"
                                onClick={handleCopyEmail}
                                title={t('common.copy')}
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>

                            {/* Export */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white/10"
                                onClick={onExport}
                                title={t('common.export')}
                            >
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-0.5">
                            {/* Edit */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white/10 hover:text-blue-400"
                                onClick={handleEdit}
                                title={t('common.edit')}
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </Button>

                            {/* Details */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-white/10"
                                onClick={() => setDetailsOpen(true)}
                                title={t('common.details')}
                            >
                                <Info className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-red-500/10 hover:text-red-500"
                                onClick={handleDelete}
                                title={t('common.delete')}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Details Dialog */}
            <AccountDetailsDialog
                account={account}
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
            />
        </>
    )
})
