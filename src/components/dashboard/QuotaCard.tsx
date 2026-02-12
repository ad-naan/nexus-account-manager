// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { AntigravityAccount } from '@/types/account'
import { Progress } from '@/components/ui/Progress'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface QuotaCardProps {
    accounts: AntigravityAccount[]
    className?: string
}

export function QuotaCard({ accounts, className }: QuotaCardProps) {
    const { t } = useTranslation()
    // Calculate average quota usage
    const totalQuota = accounts.reduce((acc, curr) => {
        const model = curr.quota?.models[0] // Assuming first model for now
        return acc + (model?.percentage || 0)
    }, 0)

    const avgQuota = accounts.length > 0 ? Math.round(totalQuota / accounts.length) : 0

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">{avgQuota}%</span>
                <span className="text-sm text-muted-foreground mb-1 font-medium">{t('dashboard.averageQuota')}</span>
            </div>
            <div className="space-y-2">
                <Progress
                    value={avgQuota}
                    className="h-2 bg-secondary"
                    indicatorClassName={cn(
                        "transition-all duration-500",
                        avgQuota > 90 ? "bg-destructive" :
                            avgQuota > 70 ? "bg-yellow-500" : "bg-primary"
                    )}
                />
                <p className="text-xs text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
                        {t('dashboard.acrossAntigravity', { count: accounts.length })}
                    </span>
                    <span>{avgQuota}% Used</span>
                </p>
            </div>
        </div>
    )
}
