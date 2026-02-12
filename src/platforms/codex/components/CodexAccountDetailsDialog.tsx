import { AccountDetailsDialog, DetailRow, DetailGrid } from '@/components/accounts/AccountDetailsDialogBase'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from 'react-i18next'
import type { CodexAccount } from '@/types/account'
import { Mail, User, Clock } from 'lucide-react'

interface CodexAccountDetailsDialogProps {
  account: CodexAccount
  open: boolean
  onClose: () => void
}

export function CodexAccountDetailsDialog({ account, open, onClose }: CodexAccountDetailsDialogProps) {
  const { t } = useTranslation()

  const sections = [
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
        </DetailGrid>
      )
    },
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
        </DetailGrid>
      )
    }
  ]

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
          {account.isActive && (
            <Badge className="bg-green-500/90 text-white border-0">
              {t('accounts.active')}
            </Badge>
          )}
          <Badge variant="outline" className="bg-background/50">Codex</Badge>
        </>
      }
      sections={sections}
      maxWidth="lg"
    />
  )
}
