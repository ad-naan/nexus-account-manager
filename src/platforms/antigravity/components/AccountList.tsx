import { useState, useMemo } from 'react'
import { AddAccountDialog } from './AddAccountDialog'
import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { AntigravityAccountCard } from './AntigravityAccountCard'
import { AccountTable } from '@/components/accounts/AccountTable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { useTranslation } from 'react-i18next'
import { AntigravityAccount } from '@/types/account'
import { Download, LayoutGrid, List } from 'lucide-react'

type ViewMode = 'grid' | 'list'

export function AntigravityAccountList() {
  const { t } = useTranslation()
  const accounts = usePlatformStore((state) => state.accounts)
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const antigravityAccounts = useMemo(
    () => accounts.filter((acc): acc is AntigravityAccount => acc.platform === 'antigravity'),
    [accounts]
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {t('platforms.antigravity.name')}
          </h2>
          <p className="text-muted-foreground mt-2 text-lg font-light">
            {t('platforms.antigravity.description', 'Manage your Google/Anthropic AI service accounts')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {antigravityAccounts.length > 0 && (
            <>
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

      {antigravityAccounts.length === 0 ? (
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
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {antigravityAccounts.map((account) => (
                <AntigravityAccountCard
                  key={account.id}
                  account={account}
                  onExport={() => setExportOpen(true)}
                />
              ))}
            </div>
          ) : (
            <AccountTable accounts={antigravityAccounts} />
          )}
        </>
      )}

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        accounts={antigravityAccounts}
      />
    </div>
  )
}
