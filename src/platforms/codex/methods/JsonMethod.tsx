/**
 * Codex 平台 - JSON 导入方式
 * 
 * 支持从 JSON 格式导入 OpenAI Codex API 配置
 * 格式: {"env": {"OPENAI_API_KEY": "...", "OPENAI_BASE_URL": "..."}}
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { logError } from '@/lib/logger'
import type { AddMethodProps } from '@/types/platform'
import type { CodexEnvConfig } from '@/types/account'

type Status = 'idle' | 'processing' | 'success' | 'error'

interface JsonMethodProps extends AddMethodProps {
  initialData?: string
  isEdit?: boolean
}

export function JsonMethod({ onSuccess, onError, onClose, initialData, isEdit = false }: JsonMethodProps) {
  const { i18n } = useTranslation()
  const isEn = i18n.language === 'en'

  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [jsonInput, setJsonInput] = useState(initialData || '')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [jsonValid, setJsonValid] = useState(true)

  // 初始化编辑模式数据
  useEffect(() => {
    if (initialData && isEdit) {
      try {
        const data = JSON.parse(initialData)
        if (data.config?.env) {
          setApiKey(data.config.env.OPENAI_API_KEY || '')
          setBaseUrl(data.config.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
          setJsonInput(JSON.stringify(data.config, null, 2))
        }
      } catch (e) {
        logError('Failed to parse initial data:', e)
      }
    }
  }, [initialData, isEdit])

  // 验证 JSON 格式
  const validateJson = (text: string): boolean => {
    if (!text.trim()) {
      setJsonValid(true)
      return true
    }

    try {
      JSON.parse(text)
      setJsonValid(true)
      return true
    } catch {
      setJsonValid(false)
      return false
    }
  }

  // 从 JSON 同步到输入框
  useEffect(() => {
    if (!jsonInput.trim()) return

    try {
      const config: CodexEnvConfig = JSON.parse(jsonInput)
      if (config.env) {
        if (config.env.OPENAI_API_KEY) {
          setApiKey(config.env.OPENAI_API_KEY)
        }
        if (config.env.OPENAI_BASE_URL) {
          setBaseUrl(config.env.OPENAI_BASE_URL)
        }
      }
    } catch {
      // JSON 格式错误时不同步
    }
  }, [jsonInput])

  // 从输入框同步到 JSON
  useEffect(() => {
    if (apiKey || baseUrl !== 'https://api.openai.com/v1') {
      const config: CodexEnvConfig = {
        env: {
          OPENAI_API_KEY: apiKey || undefined,
          OPENAI_BASE_URL: baseUrl || undefined,
        }
      }
      setJsonInput(JSON.stringify(config, null, 2))
    }
  }, [apiKey, baseUrl])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setJsonInput(content)
      validateJson(content)
    }
    reader.readAsText(file)
  }

  const handleJsonChange = (value: string) => {
    setJsonInput(value)
    validateJson(value)
  }

  const handleSubmit = async () => {
    // 优先使用输入框的值
    const finalApiKey = apiKey.trim()
    const finalBaseUrl = baseUrl.trim()

    if (!finalApiKey) {
      setStatus('error')
      setMessage(isEn ? 'Please enter OPENAI_API_KEY' : '请输入 OPENAI_API_KEY')
      return
    }

    // 如果有 JSON 输入，验证其格式
    if (jsonInput.trim() && !jsonValid) {
      setStatus('error')
      setMessage(isEn ? 'Invalid JSON format' : 'JSON 格式错误')
      return
    }

    setStatus('processing')
    setMessage(isEn ? 'Processing...' : '正在处理...')

    try {
      let organizationId: string | undefined
      const config: CodexEnvConfig = JSON.parse(jsonInput)

      // 创建账号对象
      const account: any = {
        id: crypto.randomUUID(),
        platform: 'codex',
        email: extractEmailFromUrl(finalBaseUrl) || 'codex@openai',
        name: extractNameFromUrl(finalBaseUrl) || 'OpenAI Codex',
        isActive: false,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        apiKey: finalApiKey,
        organizationId,
        baseUrl: finalBaseUrl || 'https://api.openai.com/v1',
        config: config, // 保存完整配置
      }

      onSuccess(account)
      setStatus('success')
      setMessage(isEdit 
        ? (isEn ? 'Account updated successfully!' : '账号更新成功！')
        : (isEn ? 'Account added successfully!' : '账号添加成功！')
      )
      setTimeout(onClose, 1500)

    } catch (e: any) {
      setStatus('error')
      setMessage(e.message || (isEn ? 'Failed to add account' : '添加账号失败'))
      onError(e.message)
    }
  }

  const extractEmailFromUrl = (url?: string): string | null => {
    if (!url) return null
    try {
      const hostname = new URL(url).hostname
      return `api@${hostname}`
    } catch {
      return null
    }
  }

  const extractNameFromUrl = (url?: string): string | null => {
    if (!url) return null
    try {
      const hostname = new URL(url).hostname
      const parts = hostname.split('.')
      return parts[0] || hostname
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      {/* API Key 输入框 */}
      <div className="space-y-2">
        <Label htmlFor="codex-api-key">
          {isEn ? 'API Key' : 'API 密钥'} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="codex-api-key"
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={status === 'processing'}
          className="font-mono"
        />
      </div>

      {/* Base URL 输入框 */}
      <div className="space-y-2">
        <Label htmlFor="codex-base-url">
          {isEn ? 'Base URL' : '基础 URL'}
        </Label>
        <Input
          id="codex-base-url"
          type="text"
          placeholder="https://api.openai.com/v1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          disabled={status === 'processing'}
          className="font-mono"
        />
      </div>

      {/* JSON 配置输入框 */}
      <div className="space-y-2">
        <Label>
          {isEn ? 'JSON Configuration (Optional)' : 'JSON 配置（可选）'}
        </Label>
        <textarea
          className={cn(
            "w-full h-32 rounded-lg border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none transition-colors",
            !jsonValid && "border-red-500 focus-visible:ring-red-500"
          )}
          placeholder={`{
  "env": {
    "OPENAI_API_KEY": "sk-...",
    "OPENAI_BASE_URL": "https://api.openai.com/v1"
  }
}`}
          value={jsonInput}
          onChange={(e) => handleJsonChange(e.target.value)}
          disabled={status === 'processing'}
        />
        {!jsonValid && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {isEn ? 'Invalid JSON format' : 'JSON 格式错误'}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => document.getElementById('codex-json-file-input')?.click()}
          disabled={status === 'processing'}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isEn ? 'Upload File' : '上传文件'}
        </Button>
        <input
          id="codex-json-file-input"
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileUpload}
        />
        
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={status === 'processing' || !apiKey.trim() || !jsonValid}
        >
          {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit 
            ? (isEn ? 'Update Account' : '更新账号')
            : (isEn ? 'Add Account' : '添加账号')
          }
        </Button>
      </div>

      {/* Status Message */}
      {message && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg text-sm",
          status === 'success' && "bg-green-500/10 text-green-600",
          status === 'error' && "bg-red-500/10 text-red-600",
          status === 'processing' && "bg-blue-500/10 text-blue-600"
        )}>
          {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
          {status === 'processing' && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      {/* Format Hint */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
        <p className="font-semibold">{isEn ? 'Supported fields:' : '支持的字段：'}</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>OPENAI_API_KEY {isEn ? '(required)' : '（必需）'}</li>
          <li>OPENAI_ORGANIZATION {isEn ? '(optional)' : '（可选）'}</li>
          <li>OPENAI_BASE_URL {isEn ? '(optional)' : '（可选）'}</li>
        </ul>
      </div>
    </div>
  )
}
