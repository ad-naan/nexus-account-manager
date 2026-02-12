/**
 * Claude 平台 - JSON 导入方式
 * 
 * 支持从 JSON 格式导入 Claude API 配置
 * 格式参考: {
 *   "env": {
 *     "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
 *     "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
 *   },
 * }
 */

import { logError } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { AddMethodProps } from '@/types/platform'
import type { ClaudeAccount } from '@/types/account'

type Status = 'idle' | 'processing' | 'success' | 'error'

interface ClaudeConfig {
  model?: string
  env: {
    ANTHROPIC_BASE_URL?: string
    ANTHROPIC_AUTH_TOKEN?: string
    NODE_ENV?: string
    [key: string]: any
  }
  permissions?: {
    defaultMode?: string
    allow?: string[]
    deny?: string[]
  }
  hooks?: {
    [key: string]: any
  }
  effortLevel?: string
  [key: string]: any
}

interface JsonMethodProps extends AddMethodProps {
  initialData?: string
  isEdit?: boolean
}

export function JsonMethod({ onSuccess, onError, onClose, initialData, isEdit = false }: JsonMethodProps) {
  const { i18n } = useTranslation()
  const isEn = i18n.language === 'en'

  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.anthropic.com')
  const [authToken, setAuthToken] = useState('sk-xxx')
  const [jsonInput, setJsonInput] = useState(initialData || `{
    "env": {
        "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
        "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
      }
    }`)
  const [showPassword, setShowPassword] = useState(false)
  const [isUpdatingFromJson, setIsUpdatingFromJson] = useState(false)
  const [isUpdatingFromInputs, setIsUpdatingFromInputs] = useState(false)

  // 初始化编辑模式数据
  useEffect(() => {
    if (initialData && isEdit) {
      try {
        const data = JSON.parse(initialData)
        if (data.config?.env) {
          setBaseUrl(data.config.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com')
          setAuthToken(data.config.env.ANTHROPIC_AUTH_TOKEN || 'sk-xxx')
          setJsonInput(JSON.stringify(data.config, null, 2))
        }
      } catch (e) {
        logError('Failed to parse initial data:', e)
      }
    }
  }, [initialData, isEdit])

  // 从 JSON 中提取 baseUrl 和 authToken（JSON -> 输入框）
  useEffect(() => {
    if (!jsonInput.trim() || isUpdatingFromInputs) return

    try {
      const config: ClaudeConfig = JSON.parse(jsonInput)
      if (config.env) {
        setIsUpdatingFromJson(true)
        if (config.env.ANTHROPIC_BASE_URL && config.env.ANTHROPIC_BASE_URL !== baseUrl) {
          setBaseUrl(config.env.ANTHROPIC_BASE_URL)
        }
        if (config.env.ANTHROPIC_AUTH_TOKEN && config.env.ANTHROPIC_AUTH_TOKEN !== authToken) {
          setAuthToken(config.env.ANTHROPIC_AUTH_TOKEN)
        }
        setTimeout(() => setIsUpdatingFromJson(false), 0)
      }
    } catch {
      // JSON 解析失败时不做处理
    }
  }, [jsonInput])

  // 当 baseUrl 或 authToken 改变时，更新 JSON（输入框 -> JSON）
  useEffect(() => {
    if (!jsonInput.trim() || isUpdatingFromJson) return

    try {
      const config: ClaudeConfig = JSON.parse(jsonInput)
      if (config.env) {
        setIsUpdatingFromInputs(true)
        config.env.ANTHROPIC_BASE_URL = baseUrl
        config.env.ANTHROPIC_AUTH_TOKEN = authToken
        setJsonInput(JSON.stringify(config, null, 2))
        setTimeout(() => setIsUpdatingFromInputs(false), 0)
      }
    } catch {
      // JSON 解析失败时不做处理
    }
  }, [baseUrl, authToken])

  const validateJsonStructure = (config: ClaudeConfig): void => {
    // 验证必需字段
    if (!config.env) {
      throw new Error(isEn ? 'Missing required field: "env"' : '缺少必需字段："env"')
    }

    if (!config.env.ANTHROPIC_AUTH_TOKEN && !authToken) {
      throw new Error(isEn 
        ? 'ANTHROPIC_AUTH_TOKEN is required' 
        : 'ANTHROPIC_AUTH_TOKEN 是必需的')
    }

    // 验证 permissions 结构（如果存在）
    if (config.permissions) {
      const { defaultMode, allow, deny } = config.permissions
      
      if (defaultMode && typeof defaultMode !== 'string') {
        throw new Error(isEn 
          ? 'permissions.defaultMode must be a string' 
          : 'permissions.defaultMode 必须是字符串')
      }

      if (allow && !Array.isArray(allow)) {
        throw new Error(isEn 
          ? 'permissions.allow must be an array' 
          : 'permissions.allow 必须是数组')
      }

      if (deny && !Array.isArray(deny)) {
        throw new Error(isEn 
          ? 'permissions.deny must be an array' 
          : 'permissions.deny 必须是数组')
      }
    }

    // 验证 hooks 结构（如果存在）
    if (config.hooks && typeof config.hooks !== 'object') {
      throw new Error(isEn 
        ? 'hooks must be an object' 
        : 'hooks 必须是对象')
    }
  }

  const handleSubmit = async () => {
    // 验证输入框
    if (!baseUrl.trim()) {
      setStatus('error')
      setMessage(isEn ? 'ANTHROPIC_BASE_URL is required' : 'ANTHROPIC_BASE_URL 是必需的')
      return
    }

    if (!authToken.trim()) {
      setStatus('error')
      setMessage(isEn ? 'ANTHROPIC_AUTH_TOKEN is required' : 'ANTHROPIC_AUTH_TOKEN 是必需的')
      return
    }

    const trimmed = jsonInput.trim()
    if (!trimmed) {
      setStatus('error')
      setMessage(isEn ? 'Please enter JSON configuration' : '请输入 JSON 配置')
      return
    }

    setStatus('processing')
    setMessage(isEn ? 'Processing...' : '正在处理...')

    try {
      // 解析 JSON
      const config: ClaudeConfig = JSON.parse(trimmed)
      
      // 验证 JSON 结构完整性
      validateJsonStructure(config)

      // 合并输入框的值到 config.env
      config.env.ANTHROPIC_BASE_URL = baseUrl.trim()
      config.env.ANTHROPIC_AUTH_TOKEN = authToken.trim()

      // 创建账号对象
      const account: ClaudeAccount = {
        id: crypto.randomUUID(),
        platform: 'claude',
        email: extractEmailFromUrl(baseUrl) || 'claude@api',
        name: extractNameFromUrl(baseUrl) || 'Claude API',
        isActive: false,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        // authToken: authToken.trim(),
        // baseUrl: baseUrl.trim(),
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
      setMessage(e.message || (isEn ? 'Invalid JSON format' : 'JSON 格式错误'))
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
      {/* ANTHROPIC_BASE_URL 输入框 */}
      <div className="space-y-2">
        <Label htmlFor="base-url">
          ANTHROPIC_BASE_URL <span className="text-red-500">*</span>
        </Label>
        <Input
          id="base-url"
          type="text"
          placeholder="https://api.anthropic.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          disabled={status === 'processing'}
        />
      </div>

      {/* ANTHROPIC_AUTH_TOKEN 输入框 */}
      <div className="space-y-2">
        <Label htmlFor="auth-token">
          ANTHROPIC_AUTH_TOKEN <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="auth-token"
            type={showPassword ? "text" : "password"}
            placeholder="sk-xxx"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            disabled={status === 'processing'}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={status === 'processing'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* JSON 配置输入框 */}
      <div className="space-y-2">
        <Label>
          {isEn ? 'JSON Configuration' : 'JSON 配置'} <span className="text-red-500">*</span>
        </Label>
        <textarea
          className="w-full h-48 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          placeholder={`{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
  }
}`}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          disabled={status === 'processing'}
        />
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={status === 'processing' || !baseUrl.trim() || !authToken.trim() || !jsonInput.trim()}
      >
        {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit 
          ? (isEn ? 'Update Account' : '更新账号')
          : (isEn ? 'Add Account' : '添加账号')
        }
      </Button>

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
        <p className="font-semibold">{isEn ? 'Required JSON fields:' : 'JSON 必需字段：'}</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>env {isEn ? '(object, required)' : '（对象，必需）'}</li>
        </ul>
        <p className="font-semibold mt-2">{isEn ? 'Optional JSON fields:' : 'JSON 可选字段：'}</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>model {isEn ? '(string)' : '（字符串）'}</li>
          <li>permissions {isEn ? '(object with defaultMode, allow, deny)' : '（对象，包含 defaultMode、allow、deny）'}</li>
          <li>hooks {isEn ? '(object)' : '（对象）'}</li>
          <li>effortLevel {isEn ? '(string)' : '（字符串）'}</li>
        </ul>
      </div>
    </div>
  )
}
