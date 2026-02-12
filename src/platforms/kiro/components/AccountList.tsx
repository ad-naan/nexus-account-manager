import { useState, useMemo, useDeferredValue } from 'react'
import { AddAccountDialog } from './AddAccountDialog'
import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { KiroAccountCard } from './KiroAccountCard'
import { AccountTable } from '@/components/accounts/AccountTable'
import { AccountSearch } from '@/components/accounts/AccountSearch'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { useTranslation } from 'react-i18next'
import { KiroAccount } from '@/types/account'
import { Download, LayoutGrid, List, Search } from 'lucide-react'

type ViewMode = 'grid' | 'list'

export function KiroAccountList() {
  const { t } = useTranslation()
  const accounts = usePlatformStore((state) => state.accounts)
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 性能优化：使用 useDeferredValue 延迟搜索查询，避免输入卡顿
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const kiroAccounts = useMemo(
    () => accounts.filter((acc): acc is KiroAccount => acc.platform === 'kiro'),
    [accounts]
  )

  const filteredAccounts = useMemo(() => {
    if (!deferredSearchQuery.trim()) return kiroAccounts

    const query = deferredSearchQuery.toLowerCase().trim()
    return kiroAccounts.filter((account) => {
      const email = account.email?.toLowerCase() || ''
      const name = account.name?.toLowerCase() || ''
      return email.includes(query) || name.includes(query)
    })
  }, [kiroAccounts, deferredSearchQuery])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {t('platforms.kiro.name')}
          </h2>
          <p className="text-muted-foreground mt-2 text-lg font-light">
            {t('platforms.kiro.description', 'Manage your Kiro IDE accounts and licenses')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {kiroAccounts.length > 0 && (
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

      {kiroAccounts.length === 0 ? (
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
                <KiroAccountCard
                  key={account.id}
                  account={account}
                  onExport={() => setExportOpen(true)}
                />
              ))}
            </div>
          ) : (
            <AccountTable accounts={filteredAccounts} />
          )}
        </>
      )}

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        accounts={kiroAccounts}
      />
    </div>
  )
}
