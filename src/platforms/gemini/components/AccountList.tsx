import { logError } from '@/lib/logger'
import { useState, useMemo, useDeferredValue } from 'react'
import { AddAccountDialog } from './AddAccountDialog'
import { EditAccountDialog } from './EditAccountDialog'
import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { GeminiAccountCard } from './GeminiAccountCard'
import { AccountTable } from '@/components/accounts/AccountTable'
import { AccountSearch } from '@/components/accounts/AccountSearch'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { useTranslation } from 'react-i18next'
import { Download, LayoutGrid, List, Search } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import type { Account, GeminiAccount } from '@/types/account'

type ViewMode = 'grid' | 'list'

export function GeminiAccountList() {
  const { t } = useTranslation()
  const accounts = usePlatformStore((state) => state.accounts)
  const [exportOpen, setExportOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [editAccount, setEditAccount] = useState<GeminiAccount | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 性能优化：使用 useDeferredValue 延迟搜索查询，避免输入卡顿
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const geminiAccounts = useMemo(
    () => accounts.filter((acc): acc is GeminiAccount => acc.platform === 'gemini'),
    [accounts]
  )

  const filteredAccounts = useMemo(() => {
    if (!deferredSearchQuery.trim()) return geminiAccounts

    const query = deferredSearchQuery.toLowerCase().trim()
    return geminiAccounts.filter((account) => {
      const email = account.email?.toLowerCase() || ''
      const name = account.name?.toLowerCase() || ''
      return email.includes(query) || name.includes(query)
    })
  }, [geminiAccounts, deferredSearchQuery])

  const setSwitchAccount = async (account: Account) => {
    if (account.platform !== 'gemini') return
    
    // 防止重复切换
    if (isSwitching) return
    
    setIsSwitching(true)
    
    try {
      // 调用 Rust 后端切换账户（会自动更新 active 状态和写入配置文件）
      await invoke('switch_gemini_account', { id: account.id })
      
      // 重新加载账户列表以获取最新状态
      const updatedAccounts = await invoke<Account[]>('get_accounts')
      usePlatformStore.setState({ accounts: updatedAccounts })
      
      toast.success(t('gemini.switchSuccess', 'Gemini account switched successfully'))
    } catch (error: any) {
      logError('Failed to switch Gemini account:', error)
      toast.error(t('gemini.errors.switchFailed', `Failed to switch account: ${error.message || error}`))
    } finally {
      setIsSwitching(false)
    }
  }

  const setEdit = (account: Account) => {
    if (account.platform === 'gemini') {
      setEditAccount(account as GeminiAccount)
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
            Google Gemini
          </h2>
          <p className="text-muted-foreground mt-2 text-lg font-light">
            {t('platforms.gemini.description', 'Manage your Google Gemini API accounts')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {geminiAccounts.length > 0 && (
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

      {geminiAccounts.length === 0 ? (
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
                <GeminiAccountCard
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
        accounts={geminiAccounts}
      />

      <EditAccountDialog
        account={editAccount}
        open={editOpen}
        onClose={handleEditClose}
      />
    </div>
  )
}
