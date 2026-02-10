/**
 * Gemini 平台 - JSON 导入方式
 * 
 * 支持从 JSON 格式导入 Google Gemini API 配置
 * 格式: {"env": {"GEMINI_API_KEY": "...", "GEMINI_PROJECT_ID": "...", "GEMINI_BASE_URL": "..."}}
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { AddMethodProps } from '@/types/platform'

type Status = 'idle' | 'processing' | 'success' | 'error'

interface GeminiEnvConfig {
  env: {
    GEMINI_API_KEY?: string
    GOOGLE_API_KEY?: string
    GEMINI_PROJECT_ID?: string
    GEMINI_BASE_URL?: string
  }
}

export function JsonMethod({ onSuccess, onError, onClose }: AddMethodProps) {
  const { i18n } = useTranslation()
  const isEn = i18n.language === 'en'

  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [projectId, setProjectId] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://generativelanguage.googleapis.com/v1')
  const [jsonValid, setJsonValid] = useState(true)

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
      const config: GeminiEnvConfig = JSON.parse(jsonInput)
      if (config.env) {
        const key = config.env.GEMINI_API_KEY || config.env.GOOGLE_API_KEY
        if (key) {
          setApiKey(key)
        }
        if (config.env.GEMINI_PROJECT_ID) {
          setProjectId(config.env.GEMINI_PROJECT_ID)
        }
        if (config.env.GEMINI_BASE_URL) {
          setBaseUrl(config.env.GEMINI_BASE_URL)
        }
      }
    } catch {
      // JSON 格式错误时不同步
    }
  }, [jsonInput])

  // 从输入框同步到 JSON
  useEffect(() => {
    if (apiKey || projectId || baseUrl !== 'https://generativelanguage.googleapis.com/v1') {
      const config: GeminiEnvConfig = {
        env: {
          GEMINI_API_KEY: apiKey || undefined,
          GEMINI_PROJECT_ID: projectId || undefined,
          GEMINI_BASE_URL: baseUrl || undefined,
        }
      }
      setJsonInput(JSON.stringify(config, null, 2))
    }
  }, [apiKey, projectId, baseUrl])

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
    const finalProjectId = projectId.trim()
    const finalBaseUrl = baseUrl.trim()

    if (!finalApiKey) {
      setStatus('error')
      setMessage(isEn ? 'Please enter GEMINI_API_KEY' : '请输入 GEMINI_API_KEY')
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
      // 解析完整配置
      let config: GeminiEnvConfig | undefined
      if (jsonInput.trim()) {
        try {
          config = JSON.parse(jsonInput)
        } catch {
          // 如果 JSON 解析失败，使用输入框的值构建配置
          config = {
            env: {
              GEMINI_API_KEY: finalApiKey,
              GEMINI_PROJECT_ID: finalProjectId || undefined,
              GEMINI_BASE_URL: finalBaseUrl || undefined,
            }
          }
        }
      } else {
        // 没有 JSON 输入时，使用输入框的值构建配置
        config = {
          env: {
            GEMINI_API_KEY: finalApiKey,
            GEMINI_PROJECT_ID: finalProjectId || undefined,
            GEMINI_BASE_URL: finalBaseUrl || undefined,
          }
        }
      }

      // 创建账号对象
      const account: any = {
        id: crypto.randomUUID(),
        platform: 'gemini',
        email: extractEmailFromUrl(finalBaseUrl) || 'gemini@google',
        name: extractNameFromUrl(finalBaseUrl) || 'Google Gemini',
        isActive: false,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        apiKey: finalApiKey,
        projectId: finalProjectId || undefined,
        baseUrl: finalBaseUrl || 'https://generativelanguage.googleapis.com/v1',
        config: config, // 保存完整配置
      }

      onSuccess(account)
      setStatus('success')
      setMessage(isEn ? 'Account added successfully!' : '账号添加成功！')
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
        <Label htmlFor="gemini-api-key">
          {isEn ? 'API Key' : 'API 密钥'} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="gemini-api-key"
          type="password"
          placeholder="AIza..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={status === 'processing'}
          className="font-mono"
        />
      </div>

      {/* Project ID 输入框 */}
      <div className="space-y-2">
        <Label htmlFor="gemini-project-id">
          {isEn ? 'Project ID' : '项目 ID'}
        </Label>
        <Input
          id="gemini-project-id"
          type="text"
          placeholder="my-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={status === 'processing'}
          className="font-mono"
        />
      </div>

      {/* Base URL 输入框 */}
      <div className="space-y-2">
        <Label htmlFor="gemini-base-url">
          {isEn ? 'Base URL' : '基础 URL'}
        </Label>
        <Input
          id="gemini-base-url"
          type="text"
          placeholder="https://generativelanguage.googleapis.com/v1"
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
    "GEMINI_API_KEY": "AIza...",
    "GEMINI_PROJECT_ID": "my-project",
    "GEMINI_BASE_URL": "https://generativelanguage.googleapis.com/v1"
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
          onClick={() => document.getElementById('gemini-json-file-input')?.click()}
          disabled={status === 'processing'}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isEn ? 'Upload File' : '上传文件'}
        </Button>
        <input
          id="gemini-json-file-input"
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
          {isEn ? 'Add Account' : '添加账号'}
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
          <li>GEMINI_API_KEY / GOOGLE_API_KEY {isEn ? '(required)' : '（必需）'}</li>
          <li>GEMINI_PROJECT_ID {isEn ? '(optional)' : '（可选）'}</li>
          <li>GEMINI_BASE_URL {isEn ? '(optional)' : '（可选）'}</li>
        </ul>
      </div>
    </div>
  )
}
