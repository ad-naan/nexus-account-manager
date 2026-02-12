import { memo, useState } from 'react'
import { AccountCard } from '@/components/accounts/AccountCardBase'
import { Badge } from '@/components/ui/Badge'
import { ClaudeAccountDetailsDialog } from './ClaudeAccountDetailsDialog'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { toast } from '@/lib/toast'
import { Edit, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { invoke } from '@tauri-apps/api/core'
import type { ClaudeAccount } from '@/types/account'

interface ClaudeAccountCardProps {
  account: ClaudeAccount
  onExport?: () => void
  onEdit?: () => void
  onSwitch?: () => void
}

export const ClaudeAccountCard = memo(function ClaudeAccountCard({
  account,
  onSwitch,
  onExport,
  onEdit,
}: ClaudeAccountCardProps) {
  const { t } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const deleteAccount = usePlatformStore(state => state.deleteAccount)
  const setActiveAccount = usePlatformStore(state => state.setActiveAccount)

  const handleSwitch = () => {
    setActiveAccount(account)
    toast.success(t('accounts.switchSuccess'), account.email)
    onSwitch?.()
  }

  const handleDelete = async () => {
    try {
      await deleteAccount(account.id)
      toast.success(t('accounts.deleteSuccess'), account.email)
    } catch (e: any) {
      toast.error(t('accounts.deleteFailed'), e.message || t('common.unknownError'))
    }
  }

  const handleVerify = async () => {
    try {
      setIsVerifying(true)
      
      // 从账户配置中获取 API Key
      const apiKey = account.config?.env.ANTHROPIC_API_KEY || account.config?.env.ANTHROPIC_AUTH_TOKEN
      if (!apiKey) {
        toast.error(t('platforms.claude.errors.noApiKey'))
        return
      }

      // 调用 Rust 后端验证 API Key
      const result = await invoke<{ valid: boolean; message: string }>('verify_claude_api_key', {
        apiKey,
        baseUrl: account.config?.env.ANTHROPIC_BASE_URL
      })

      if (result.valid) {
        toast.success(t('platforms.claude.verifySuccess'))
      } else {
        toast.error(t('platforms.claude.verifyFailed'), result.message)
      }
    } catch (e: any) {
      toast.error(t('platforms.claude.verifyFailed'), e.message || t('common.unknownError'))
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <>
      <AccountCard
        id={account.id}
        email={account.email}
        name={account.name}
        isActive={account.isActive}
        badges={
          <Badge variant="outline" className="text-[10px] h-5 px-2 text-muted-foreground">
            Claude
          </Badge>
        }
        onSwitch={handleSwitch}
        onExport={onExport}
        onDetails={() => setDetailsOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
        customActions={[
          ...(onEdit ? [{
            icon: Edit,
            label: t('common.edit'),
            onClick: onEdit
          }] : []),
          {
            icon: CheckCircle,
            label: isVerifying ? t('platforms.claude.verifying') : t('platforms.claude.verify'),
            onClick: handleVerify,
            loading: isVerifying,
            disabled: isVerifying
          }
        ]}
      />

      <ClaudeAccountDetailsDialog
        account={account}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('common.delete')}
        description={t('common.confirmDelete', { name: account.email })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
})
