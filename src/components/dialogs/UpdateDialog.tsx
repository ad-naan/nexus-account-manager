import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Download, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { logError, logInfo } from '@/lib/logger'

interface UpdateInfo {
  current_version: string
  latest_version: string
  has_update: boolean
  release_notes?: string
  download_url?: string
}

interface UpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  updateInfo: UpdateInfo | null
}

type UpdateState = 'idle' | 'downloading' | 'ready' | 'error'

export function UpdateDialog({ open, onOpenChange, updateInfo }: UpdateDialogProps) {
  const { t } = useTranslation()
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [error, setError] = useState<string>('')

  const handleUpdate = async () => {
    if (!updateInfo?.has_update) return

    setUpdateState('downloading')
    setError('')

    try {
      logInfo('Starting update download...')
      await invoke('download_and_install_update')
      
      setUpdateState('ready')
      logInfo('Update downloaded successfully, restarting...')
      
      // 延迟重启，让用户看到成功消息
      setTimeout(async () => {
        try {
          await relaunch()
        } catch (e) {
          logError('Failed to relaunch:', e)
          setError(t('update.relaunchError'))
          setUpdateState('error')
        }
      }, 1500)
    } catch (e) {
      logError('Update failed:', e)
      setError(String(e))
      setUpdateState('error')
    }
  }

  const handleClose = () => {
    if (updateState === 'downloading') return
    onOpenChange(false)
    setUpdateState('idle')
    setError('')
  }

  if (!updateInfo) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {updateState === 'ready' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('update.readyTitle')}
              </>
            ) : updateState === 'error' ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                {t('update.errorTitle')}
              </>
            ) : (
              <>
                <Download className="h-5 w-5 text-blue-500" />
                {t('update.availableTitle')}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {updateState === 'ready' ? (
              t('update.readyDescription')
            ) : updateState === 'error' ? (
              t('update.errorDescription')
            ) : updateInfo.has_update ? (
              t('update.availableDescription', {
                current: updateInfo.current_version,
                latest: updateInfo.latest_version,
              })
            ) : (
              t('update.upToDate')
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 更新状态 */}
          {updateState === 'downloading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('update.downloading')}</span>
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {/* 错误信息 */}
          {updateState === 'error' && error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* 版本信息 */}
          {updateInfo.has_update && updateState === 'idle' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t('update.currentVersion')}</p>
                  <p className="font-mono font-medium">{updateInfo.current_version}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t('update.latestVersion')}</p>
                  <p className="font-mono font-medium text-green-600 dark:text-green-400">
                    {updateInfo.latest_version}
                  </p>
                </div>
              </div>

              {/* 更新说明 */}
              {updateInfo.release_notes && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('update.releaseNotes')}</p>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg bg-muted p-3 text-sm">
                    <pre className="whitespace-pre-wrap font-sans text-muted-foreground">
                      {updateInfo.release_notes}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 成功状态 */}
          {updateState === 'ready' && (
            <div className="flex items-center justify-center py-4">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {t('update.restarting')}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {updateState === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
              {updateInfo.has_update && (
                <Button onClick={handleUpdate}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('update.downloadAndInstall')}
                </Button>
              )}
            </>
          )}
          {updateState === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t('common.close')}
              </Button>
              <Button onClick={handleUpdate}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('common.retry')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
