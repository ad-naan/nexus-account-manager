import { usePlatformStore } from '@/stores/usePlatformStore'
import { getAllPlatforms } from '@/platforms/registry'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StatCard } from '@/components/dashboard/StatCard'
import { QuotaCard } from '@/components/dashboard/QuotaCard'
import { SubscriptionCard } from '@/components/dashboard/SubscriptionCard'
import { Users, Activity, Layers, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AntigravityAccount, KiroAccount } from '@/types/account'

export function Dashboard() {
  const accounts = usePlatformStore((state) => state.accounts)
  const navigate = useNavigate()
  const platforms = getAllPlatforms()
  const { t } = useTranslation()

  const activeAccounts = accounts.filter((a) => a.isActive).length
  const antigravityAccounts = accounts.filter((a): a is AntigravityAccount => a.platform === 'antigravity')
  const kiroAccounts = accounts.filter((a): a is KiroAccount => a.platform === 'kiro')

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Button onClick={() => navigate('/accounts')} size="lg" className="shadow-sm">
          {t('dashboard.manageAccounts') || "Manage Accounts"}
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('dashboard.totalAccounts')}
          value={accounts.length}
          icon={Users}
          description="Total managed accounts"
          className="bg-card shadow-sm border-border"
        />
        <StatCard
          title={t('dashboard.activeAccount')}
          value={activeAccounts}
          icon={Activity}
          description="Currently active"
          trend={{ value: 12, label: 'vs last month', positive: true }}
          className="bg-card shadow-sm border-border"
        />
        <StatCard
          title="Antigravity"
          value={antigravityAccounts.length}
          icon={Layers}
          description="AI Service Accounts"
          className="bg-card shadow-sm border-border"
        />
        <StatCard
          title="Kiro IDE"
          value={kiroAccounts.length}
          icon={Layers}
          description="IDE Licenses"
          className="bg-card shadow-sm border-border"
        />
      </div>

      {/* Detailed Analytics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-all">
          <h2 className="text-lg font-semibold mb-6 text-foreground">Quota Usage (Antigravity)</h2>
          <QuotaCard accounts={antigravityAccounts} />
        </div>
        <div className="col-span-3 bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-all">
          <h2 className="text-lg font-semibold mb-6 text-foreground">License Types (Kiro)</h2>
          <SubscriptionCard accounts={kiroAccounts} />
        </div>
      </div>

      {/* Platform Quick Access */}
      <div>
        <h2 className="text-xl font-semibold mb-6 text-foreground">{t('dashboard.platformsTitle')}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {platforms.map((platform) => {
            const Icon = platform.icon
            const platformAccounts = accounts.filter((a) => a.platform === platform.id)

            return (
              <div
                key={platform.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer"
                onClick={() => navigate(`/accounts?platform=${platform.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div
                        className="p-4 rounded-xl transition-all duration-300 bg-secondary group-hover:bg-primary group-hover:text-primary-foreground text-foreground"
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-xl tracking-tight text-foreground">{t(`platforms.${platform.id}.name`)}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {platformAccounts.length} {t('common.accounts')}
                        </p>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:bg-primary/10">
                      <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
