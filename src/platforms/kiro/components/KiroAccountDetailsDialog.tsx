import { AccountDetailsDialog, DetailRow, DetailGrid } from '@/components/accounts/AccountDetailsDialogBase'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useTranslation } from 'react-i18next'
import type { KiroAccount } from '@/types/account'
import { cn } from '@/lib/utils'
import {
  Mail, User, Shield, Clock, Database, Award, TrendingUp, Gem, Diamond, Circle
} from 'lucide-react'

interface KiroAccountDetailsDialogProps {
  account: KiroAccount
  open: boolean
  onClose: () => void
}

const getSubscriptionIcon = (type?: string) => {
  const t = (type || '').toLowerCase()
  if (t.includes('pro') && t.includes('plus')) return <Gem className="w-4 h-4 fill-current" />
  if (t.includes('pro')) return <Diamond className="w-4 h-4 fill-current" />
  return <Circle className="w-4 h-4" />
}

const getSubscriptionStyle = (type?: string) => {
  const t = (type || '').toLowerCase()
  if (t.includes('pro') && t.includes('plus')) return 'bg-purple-600 text-white border-purple-600'
  if (t.includes('pro')) return 'bg-blue-600 text-white border-blue-600'
  return 'bg-secondary text-secondary-foreground'
}

export function KiroAccountDetailsDialog({ account, open, onClose }: KiroAccountDetailsDialogProps) {
  const { t } = useTranslation()

  const subscriptionType = account.subscription?.type || 'Free'
  const usagePercent = (account.usage?.percentUsed || 0) * 100

  const sections = [
    // 基础信息
    {
      title: t('accounts.basicInfo'),
      icon: <User className="h-4 w-4" />,
      content: (
        <DetailGrid columns={1}>
          <DetailRow
            label={t('common.email')}
            value={account.email}
            icon={<Mail className="h-4 w-4" />}
            copyable
          />
          {account.name && (
            <DetailRow
              label={t('common.name')}
              value={account.name}
              icon={<User className="h-4 w-4" />}
            />
          )}
          <DetailRow
            label={t('accounts.platform')}
            value={
              <div className="flex items-center gap-2">
                <Badge variant="outline">{account.idp || 'Kiro'}</Badge>
                <Badge variant="outline">{account.credentials.authMethod}</Badge>
              </div>
            }
            icon={<Shield className="h-4 w-4" />}
          />
          <DetailRow
            label={t('common.status')}
            value={
              <Badge className={cn(
                account.status === 'active' && 'bg-green-500',
                account.status === 'error' && 'bg-red-500',
                account.status === 'banned' && 'bg-red-600',
                account.status === 'refreshing' && 'bg-blue-500'
              )}>
                {account.status?.toUpperCase() || 'ACTIVE'}
              </Badge>
            }
          />
        </DetailGrid>
      )
    },

    // 订阅信息
    {
      title: t('accounts.subscription'),
      icon: <Award className="h-4 w-4" />,
      content: (
        <DetailGrid columns={1}>
          <DetailRow
            label={t('common.type')}
            value={
              <Badge className={cn('border-0', getSubscriptionStyle(subscriptionType))}>
                {getSubscriptionIcon(subscriptionType)}
                <span className="ml-1.5">{subscriptionType}</span>
              </Badge>
            }
          />
          {account.subscription?.title && (
            <DetailRow
              label={t('common.title')}
              value={account.subscription.title}
            />
          )}
        </DetailGrid>
      )
    },

    // 使用情况
    account.usage && {
      title: t('accounts.usage'),
      icon: <TrendingUp className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('accounts.current')}</span>
              <span className="font-mono font-semibold">
                {account.usage.current} / {account.usage.limit}
              </span>
            </div>
            <Progress
              value={usagePercent}
              className="h-2 bg-secondary"
              indicatorClassName={cn(
                "transition-all",
                usagePercent > 90 ? "bg-red-500" :
                  usagePercent > 70 ? "bg-amber-500" : "bg-primary"
              )}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{t('accounts.percentUsed')}</span>
              <span className="font-mono">{usagePercent.toFixed(1)}%</span>
            </div>
          </div>
          {account.usage.lastUpdated && (
            <DetailRow
              label={t('accounts.lastUpdated')}
              value={new Date(account.usage.lastUpdated).toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
            />
          )}
        </div>
      )
    },

    // 凭证信息
    {
      title: t('accounts.credentials'),
      icon: <Shield className="h-4 w-4" />,
      content: (
        <DetailGrid columns={1}>
          {account.credentials.clientId && (
            <DetailRow
              label="Client ID"
              value={account.credentials.clientId}
              copyable
            />
          )}
          {account.credentials.region && (
            <DetailRow
              label={t('common.region')}
              value={account.credentials.region}
              icon={<Database className="h-4 w-4" />}
            />
          )}
          {account.credentials.expiresAt && (
            <DetailRow
              label={t('accounts.expiresAt')}
              value={new Date(account.credentials.expiresAt).toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
            />
          )}
        </DetailGrid>
      )
    },

    // 时间戳
    {
      title: t('accounts.timestamps'),
      icon: <Clock className="h-4 w-4" />,
      content: (
        <DetailGrid columns={2}>
          <DetailRow
            label={t('accounts.createdAt')}
            value={new Date(account.createdAt).toLocaleString()}
          />
          {account.lastUsedAt && (
            <DetailRow
              label={t('accounts.lastUsedAt')}
              value={new Date(account.lastUsedAt).toLocaleString()}
            />
          )}
          {account.lastCheckedAt && (
            <DetailRow
              label={t('accounts.lastCheckedAt')}
              value={new Date(account.lastCheckedAt).toLocaleString()}
            />
          )}
        </DetailGrid>
      )
    }
  ].filter(Boolean)

  return (
    <AccountDetailsDialog
      open={open}
      onClose={onClose}
      title={account.name || account.email.split('@')[0]}
      subtitle={account.email}
      avatar={
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
          {account.email.charAt(0).toUpperCase()}
        </div>
      }
      badges={
        <>
          <Badge className={cn('border-0', getSubscriptionStyle(subscriptionType))}>
            {getSubscriptionIcon(subscriptionType)}
            <span className="ml-1.5">{subscriptionType}</span>
          </Badge>
          {account.isActive && (
            <Badge className="bg-green-500/90 text-white border-0">
              {t('accounts.active')}
            </Badge>
          )}
          {account.status === 'banned' && (
            <Badge variant="destructive">
              {t('accounts.banned')}
            </Badge>
          )}
          <Badge variant="outline" className="bg-background/50">
            {account.idp || 'Kiro'}
          </Badge>
        </>
      }
      sections={sections as any}
      maxWidth="2xl"
    />
  )
}
