import { logError } from '@/lib/logger'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { getAllPlatforms, getPlatform } from '@/platforms/registry'
import { cn } from '@/lib/utils'
import type { Account } from '@/types/platform'

export function AddAccountDialog() {
  const [open, setOpen] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const { t } = useTranslation()
  const { addAccount, loadAllAccounts } = usePlatformStore()
  const platforms = getAllPlatforms()

  const platform = selectedPlatform ? getPlatform(selectedPlatform) : null
  const methods = platform?.addMethods || []

  useEffect(() => {
    if (open && !selectedPlatform && platforms.length > 0) {
      setSelectedPlatform(platforms[0].id)
    }
  }, [open, selectedPlatform, platforms])

  useEffect(() => {
    if (!selectedMethod && methods.length > 0) {
      setSelectedMethod(methods[0].id)
    }
  }, [methods, selectedMethod])

  const handlePlatformChange = (platformId: string) => {
    setSelectedPlatform(platformId)
    setSelectedMethod(null)
  }

  const handleSuccess = async (account: Account) => {
    await addAccount(account)
    await loadAllAccounts()
  }

  const handleError = (error: string) => {
    logError('Add account error:', error)
  }

  const handleClose = () => {
    setOpen(false)
    setSelectedMethod(null)
  }

  const renderMethodSelector = () => (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {methods.map((method) => {
        const Icon = method.icon
        const isActive = selectedMethod === method.id

        return (
          <button
            key={method.id}
            onClick={() => setSelectedMethod(method.id)}
            className={cn(
              'group relative overflow-hidden rounded-xl border p-4 text-left transition-all',
              isActive
                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                : 'border-border/60 bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
            )}
          >
            <div className="mb-1.5 flex items-center gap-3">
              <div
                className={cn(
                  'rounded-lg p-2 transition-colors',
                  'bg-muted group-hover:bg-primary/10 group-hover:text-primary',
                  isActive && 'bg-primary text-primary-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                {method.name}
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {method.description}
            </p>
          </button>
        )
      })}
    </div>
  )

  const renderMethodContent = () => {
    if (!selectedMethod) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t('dialog.selectMethod', '请选择添加方式')}
        </div>
      )
    }

    const method = methods.find((item) => item.id === selectedMethod)
    if (!method || !selectedPlatform) return null

    const MethodComponent = method.component

    return (
      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
        <MethodComponent
          platform={selectedPlatform}
          onSuccess={handleSuccess}
          onError={handleError}
          onClose={handleClose}
        />
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) {
          setSelectedMethod(null)
          setTimeout(() => setSelectedPlatform(null), 300)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('accounts.add')}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[90vh] w-full max-w-[880px] flex-col overflow-hidden border-border bg-card text-card-foreground shadow-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-bold">{t('dialog.addAccount')}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Choose Platform</p>
              <p className="text-xs text-muted-foreground">
                Pick the target platform first, then select the most suitable import method.
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-2xl border border-border/60 bg-muted/20 p-2">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {platforms.map((item) => {
                  const Icon = item.icon
                  const isActive = selectedPlatform === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePlatformChange(item.id)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-all',
                        isActive
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border/60 bg-background/70 hover:border-primary/40 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'rounded-lg p-2',
                            isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {platform && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Choose Method</p>
                <p className="text-xs text-muted-foreground">{platform.description}</p>
              </div>
              {renderMethodSelector()}
            </div>
          )}

          <div className="min-h-[220px]">{renderMethodContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
