import { logError } from '@/lib/logger'
import { useState, useMemo, useDeferredValue } from 'react'
import { AddAccountDialog } from './AddAccountDialog'
import { EditAccountDialog } from './EditAccountDialog'
import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { CodexAccountCard } from './CodexAccountCard'
import { AccountTable } from '@/components/accounts/AccountTable'
import { AccountSearch } from '@/components/accounts/AccountSearch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { useTranslation } from 'react-i18next'
import { Download, LayoutGrid, List, Search } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import type { Account, CodexAccount } from '@/types/account'

type ViewMode = 'grid' | 'list'

export function CodexAccountList() {
  const { t } = useTranslation()
  const accounts = usePlatformStore((state) => state.accounts)
  const updateAccount = usePlatformStore((state) => state.updateAccount)
  const [exportOpen, setExportOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [editAccount, setEditAccount] = useState<CodexAccount | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 性能优化：使用 useDeferredValue 延迟搜索查询，避免输入卡顿
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const codexAccounts = useMemo(
    () => accounts.filter((acc): acc is CodexAccount => acc.platform === 'codex'),
    [accounts]
  )

  const filteredAccounts = useMemo(() => {
    if (!deferredSearchQuery.trim()) return codexAccounts

    const query = deferredSearchQuery.toLowerCase().trim()
    return codexAccounts.filter((account) => {
      const email = account.email?.toLowerCase() || ''
      const name = account.name?.toLowerCase() || ''
      return email.includes(query) || name.includes(query)
    })
  }, [codexAccounts, deferredSearchQuery])

  const setSwitchAccount = async (account: Account) => {
    if (account.platform !== 'codex') return
    
    const codexAccount = account as CodexAccount
    
    // 防止重复切换
    if (isSwitching) return
    
    setIsSwitching(true)
    
    try {
      // 1. 将其他账户设置为非激活状态
      const updatePromises = codexAccounts
        .filter(acc => acc.id !== account.id && acc.isActive)
        .map(acc => updateAccount(acc.id, { isActive: false }))
      
      await Promise.all(updatePromises)
      
      // 2. 调用 Rust 后端切换账户配置
      const config = codexAccount.config

      if (!config) {
        toast.error(t('codex.errors.noConfig', 'Configuration not found in account'))
        return
      }
      
      await invoke('switch_codex_account', { settings: JSON.stringify(config) })
      
      // 3. 更新当前账户为激活状态
      await updateAccount(account.id, { 
        isActive: true,
        lastUsedAt: Date.now()
      })
      
      toast.success(t('codex.switchSuccess', 'Codex account switched successfully'))
    } catch (error: any) {
      logError('Failed to switch Codex account:', error)
      toast.error(t('codex.errors.switchFailed', `Failed to switch account: ${error.message || error}`))
    } finally {
      setIsSwitching(false)
    }
  }

  const setEdit = (account: Account) => {
    if (account.platform === 'codex') {
      setEditAccount(account as CodexAccount)
      setEditOpen(true)
    }
  }

  const handleEditClose = () => {
    setEditOpen(false)
    setEditAccount(null)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            OpenAI Codex
          </h2>
          <p className="text-muted-foreground mt-2 text-lg font-light">
            {t('platforms.codex.description', 'Manage your OpenAI Codex API accounts')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {codexAccounts.length > 0 && (
            <>
              <AccountSearch
                value={searchQuery}
                onChange={setSearchQuery}
                resultCount={filteredAccounts.length}
                className="w-64"
              />
              <div className="flex items-center gap-1 bg-background/50 backdrop-blur-sm border border-white/10 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 px-2"
                  title={t('common.gridView', { defaultValue: 'Grid View' })}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 px-2"
                  title={t('common.listView', { defaultValue: 'List View' })}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen(true)}
                className="bg-background/50 backdrop-blur-sm border-white/10 hover:bg-background/80"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('common.export', { defaultValue: 'Export' })}
              </Button>
            </>
          )}
          <div className="relative z-10">
            <AddAccountDialog />
          </div>
        </div>
      </div>

      {codexAccounts.length === 0 ? (
        <Card className="bg-card/30 border-dashed border-2 border-muted hover:border-muted-foreground/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="p-4 rounded-full bg-background/50 mb-4 ring-1 ring-white/10">
              <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
            </div>
            <p className="text-lg font-medium mb-2">{t('accounts.noAccounts', 'No accounts yet')}</p>
            <p className="text-sm text-muted-foreground mb-6">Get started by adding your first account</p>
            <AddAccountDialog />
          </CardContent>
        </Card>
      ) : filteredAccounts.length === 0 ? (
        <Card className="bg-card/30 border-dashed border-2 border-muted">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">{t('common.noResults', 'No results found')}</p>
            <p className="text-sm text-muted-foreground">
              {t('common.tryDifferentSearch', 'Try a different search term')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAccounts.map((account) => (
                <CodexAccountCard
                  key={account.id}
                  account={account}
                  onSwitch={() => setSwitchAccount(account)}
                  onExport={() => setExportOpen(true)}
                  onEdit={() => setEdit(account)}
                />
              ))}
            </div>
          ) : (
            <AccountTable
              accounts={filteredAccounts}
              onSwitch={setSwitchAccount}
              onEdit={setEdit}
              isSwitching={isSwitching}
            />
          )}
        </>
      )}

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        accounts={codexAccounts}
      />

      <EditAccountDialog
        account={editAccount}
        open={editOpen}
        onClose={handleEditClose}
      />
    </div>
  )
}
