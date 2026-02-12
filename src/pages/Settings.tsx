import { logError } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/hooks/useTheme'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { StorageService } from '@/services/StorageService'
import {
  FolderOpen,
  Save,
  Database,
  Download,
  Upload,
  Palette,
  Moon,
  Sun,
  Laptop,
  Info,
  CheckCircle2,
  RotateCcw
} from 'lucide-react'

export function Settings() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const [storagePath, setStoragePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const storageService = StorageService.getInstance()

  useEffect(() => {
    loadStoragePath()
  }, [])

  const loadStoragePath = async () => {
    try {
      const path = await storageService.getCurrentPath()
      setStoragePath(path)
    } catch (error) {
      logError('Failed to load storage path:', error)
    }
  }

  const handleSelectDirectory = async () => {
    try {
      const selected = await storageService.selectDirectory()
      if (selected) {
        setStoragePath(selected)
      }
    } catch (error) {
      logError('Failed to select directory:', error)
    }
  }

  const handleUpdatePath = async () => {
    if (!storagePath) return
    setLoading(true)
    try {
      await storageService.setStoragePath(storagePath)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      logError('Failed to set storage path:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPath = async () => {
    setLoading(true)
    try {
      await storageService.resetToDefault()
      await loadStoragePath()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      logError('Failed to reset path:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('settings.title')}
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Storage Settings */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">{t('settings.storage')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.dataLocationDesc')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <FolderOpen className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={storagePath.replace(/[\\\/]accounts\.json$/, '')}
                  readOnly
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-10 py-2 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-default"
                  placeholder={t('settings.storagePath')}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSelectDirectory}
                className="bg-background hover:bg-muted"
                title={t('settings.browse')}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {t('settings.browse')}
              </Button>
              <Button
                variant="outline"
                onClick={handleResetPath}
                disabled={loading}
                className="bg-background hover:bg-muted"
                title={t('settings.reset')}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('settings.reset')}
              </Button>
              <Button
                onClick={handleUpdatePath}
                disabled={loading}
                className={cn(
                  "min-w-[100px] transition-all",
                  success ? "bg-green-600 hover:bg-green-700" : ""
                )}
              >
                {loading ? (
                  t('common.loading')
                ) : success ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('common.success')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('common.save')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pl-1 flex items-start gap-2">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                {t('settings.currentPath', { path: storagePath.replace(/[\\\/]accounts\.json$/, '') })}
              </span>
            </p>
          </div>

          <div className="pt-6 border-t border-border">
            <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t('settings.dataManagement')}
            </h4>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" className="bg-background hover:bg-muted">
                <Upload className="mr-2 h-4 w-4" />
                {t('settings.importLegacy')}
              </Button>
              <Button variant="outline" size="sm" className="bg-background hover:bg-muted">
                <Download className="mr-2 h-4 w-4" />
                {t('settings.exportData')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 dark:text-purple-400">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">{t('settings.appearance')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.theme')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              className={cn(
                "h-24 flex flex-col gap-2 transition-all",
                theme !== 'light' && "bg-background border-input hover:bg-muted"
              )}
              onClick={() => setTheme('light')}
            >
              <Sun className="h-6 w-6" />
              <span className="text-sm font-medium">{t('settings.light')}</span>
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              className={cn(
                "h-24 flex flex-col gap-2 transition-all",
                theme !== 'dark' && "bg-background border-input hover:bg-muted"
              )}
              onClick={() => setTheme('dark')}
            >
              <Moon className="h-6 w-6" />
              <span className="text-sm font-medium">{t('settings.dark')}</span>
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              className={cn(
                "h-24 flex flex-col gap-2 transition-all",
                theme !== 'system' && "bg-background border-input hover:bg-muted"
              )}
              onClick={() => setTheme('system')}
            >
              <Laptop className="h-6 w-6" />
              <span className="text-sm font-medium">{t('settings.system')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500 dark:text-green-400">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">{t('settings.about')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Nexus Account Manager
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 rounded-lg bg-background border border-border">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.version')}</span>
              <p className="text-lg font-mono font-medium mt-1">1.0.0</p>
            </div>
            <div className="p-4 rounded-lg bg-background border border-border">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.author')}</span>
              <p className="text-lg font-medium mt-1">Adnaan</p>
            </div>
            <div className="p-4 rounded-lg bg-background border border-border">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.license')}</span>
              <p className="text-lg font-medium mt-1">MIT</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
