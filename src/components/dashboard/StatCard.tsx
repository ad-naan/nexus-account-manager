import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    description?: string
    trend?: {
        value: number
        label: string
        positive?: boolean
    }
    className?: string
    // kept for compatibility but ignored
    variant?: string
}

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
    return (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-300 border-border bg-card shadow-sm group",
            "hover:border-primary/50 hover:shadow-md",
            className
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className={cn(
                    "p-2 rounded-md transition-colors duration-300 bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                )}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
                {(description || trend) && (
                    <div className="flex items-center gap-2 mt-2">
                        {trend && (
                            <span className={cn(
                                "flex items-center font-medium px-1.5 py-0.5 rounded text-[10px]",
                                trend.positive
                                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                            )}>
                                {trend.positive ? '↑' : '↓'} {trend.value}%
                            </span>
                        )}
                        {description && (
                            <p className="text-xs text-muted-foreground opacity-80 font-medium">
                                {description}
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
