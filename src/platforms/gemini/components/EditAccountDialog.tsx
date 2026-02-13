/**
 * Gemini 编辑账号对话框
 * 
 * 使用 JSON 方式编辑账号配置
 */

import { logError } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from 'react-i18next'
import { usePlatformStore } from '@/stores/usePlatformStore'
import { JsonMethod } from '../methods/JsonMethod'
import type { Account, GeminiAccount } from '@/types/account'

interface EditAccountDialogProps {
    account: GeminiAccount | null
    open: boolean
    onClose: () => void
}

export function EditAccountDialog({ account, open, onClose }: EditAccountDialogProps) {
    const { t } = useTranslation()
    const { updateAccount, loadAllAccounts } = usePlatformStore()
    const [initialData, setInitialData] = useState<string>('')

    // 当账号变化时，更新初始数据
    useEffect(() => {
        if (account && open) {
            // 构造初始 JSON 数据
            const data = {
                email: account.email,
                name: account.name || '',
                config: account.config || {}
            }
            setInitialData(JSON.stringify(data, null, 2))
        }
    }, [account, open])

    // 更新成功回调
    const handleSuccess = async (updatedAccount: Account) => {
        if (!account) return
        
        // 保留原有的 ID 和其他字段，只更新可编辑的字段
        await updateAccount(account.id, {
            email: updatedAccount.email,
            name: updatedAccount.name,
            config: (updatedAccount as GeminiAccount).config, // 更新 config 用于前端显示
            lastUsedAt: Date.now()
        })
        
        await loadAllAccounts()
        onClose()
    }

    // 更新失败回调
    const handleError = (error: string) => {
        logError('Edit account error:', error)
    }

    if (!account) return null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col border-border bg-card text-card-foreground shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {t('platforms.gemini.editAccount', 'Edit Gemini Account')}
                    </DialogTitle>
                </DialogHeader>

                {/* JSON 编辑方式 */}
                <div className="flex-1 overflow-y-scroll pr-2 -mr-2">
                    <JsonMethod
                        platform="gemini"
                        onSuccess={handleSuccess}
                        onError={handleError}
                        onClose={onClose}
                        initialData={initialData}
                        isEdit={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
