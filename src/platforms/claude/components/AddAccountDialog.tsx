/**
 * Claude 添加/修改对话框
 * 
 * 直接使用 JSON 导入方式
 */

import { logError } from '@/lib/logger'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { JsonMethod } from '../methods/JsonMethod'
import type { Account } from '@/types/platform'

export function AddAccountDialog() {
    const [open, setOpen] = useState(false)
    const { t } = useTranslation()
    const { addAccount, loadAllAccounts } = usePlatformStore()

    // 添加成功回调
    const handleSuccess = async (account: Account) => {
        await addAccount(account)
        await loadAllAccounts()
    }

    // 添加失败回调
    const handleError = (error: string) => {
        logError('Add account error:', error)
    }

    // 关闭对话框
    const handleClose = () => {
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('accounts.add')}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col border-border bg-card text-card-foreground shadow-2xl">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-xl font-bold">
                        {t('dialog.addAccount')}
                    </DialogTitle>
                </DialogHeader>

                {/* JSON 导入方式 - 可滚动区域 */}
                <div className="flex-1 overflow-y-scroll pr-2 -mr-2">
                    <JsonMethod
                        platform="claude"
                        onSuccess={handleSuccess}
                        onError={handleError}
                        onClose={handleClose}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
