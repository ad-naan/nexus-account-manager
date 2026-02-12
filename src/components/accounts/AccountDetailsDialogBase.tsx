/**
 * 通用账户详情对话框基础组件
 * 提供统一的对话框结构，支持平台自定义内容渲染
 */
import { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface DetailSection {
  title: string
  icon?: ReactNode
  content: ReactNode
}

export interface AccountDetailsDialogProps {
  open: boolean
  onClose: () => void
  
  // 基础信息
  title: string
  subtitle?: string
  avatar?: ReactNode
  
  // 状态徽章
  badges?: ReactNode
  
  // 详情分组
  sections: DetailSection[]
  
  // 样式
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export function AccountDetailsDialog({
  open,
  onClose,
  title,
  subtitle,
  avatar,
  badges,
  sections,
  className,
  maxWidth = 'xl'
}: AccountDetailsDialogProps) {
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[maxWidth]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(maxWidthClass, 'max-h-[85vh] overflow-hidden flex flex-col', className)}>
        {/* 头部 */}
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-4">
            {avatar && (
              <div className="shrink-0">
                {avatar}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">{title}</DialogTitle>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {badges && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {badges}
            </div>
          )}
        </DialogHeader>

        {/* 内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2">
                {section.icon}
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
              <div className="space-y-2">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 详情行组件 - 用于快速构建详情内容
export interface DetailRowProps {
  label: string
  value: string | ReactNode
  icon?: ReactNode
  copyable?: boolean
  className?: string
}

export function DetailRow({ label, value, icon, copyable = false, className }: DetailRowProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (typeof value === 'string') {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50",
      className
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="text-sm font-mono truncate">
            {value || '-'}
          </div>
        </div>
      </div>
      {copyable && value && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 shrink-0"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  )
}

// 详情网格组件 - 用于多列布局
export interface DetailGridProps {
  children: ReactNode
  columns?: 1 | 2 | 3
  className?: string
}

export function DetailGrid({ children, columns = 1, className }: DetailGridProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }[columns]

  return (
    <div className={cn('grid gap-3', gridClass, className)}>
      {children}
    </div>
  )
}
