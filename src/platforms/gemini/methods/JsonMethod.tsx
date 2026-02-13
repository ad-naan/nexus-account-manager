/**
 * Gemini 平台 - JSON 导入方式
 * 
 * 支持从 Provider 预设或 JSON 格式导入 Google Gemini API 配置
 */

import { logError } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { geminiProviderPresets } from '../config/presets'
import { ProviderCarousel, ProviderInfo } from '@/components/common/ProviderCarousel'
import type { AddMethodProps } from '@/types/platform'
import type { GeminiAccount, EnvConfig, ConfigJson, SettingsJson, GeminiConfig } from '@/types/account'

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
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // 模型配置
  const [model, setModel] = useState('')

  // 配置编辑器
  const [showEnvEditor, setShowEnvEditor] = useState(isEdit ? false : true)
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  const [showSettingsEditor, setShowSettingsEditor] = useState(false)
  const [envValue, setEnvValue] = useState('')
  const [configValue, setConfigValue] = useState('')
  const [settingsValue, setSettingsValue] = useState('')
  const [envError, setEnvError] = useState('')
  const [configError, setConfigError] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [envKey, setEnvKey] = useState(0)
  const [configKey, setConfigKey] = useState(0)
  const [settingsKey, setSettingsKey] = useState(0)

  // 初始化编辑模式数据
  useEffect(() => {
    if (initialData && isEdit) {
      try {
        const data = JSON.parse(initialData)
        if (data.config) {
          // 从 env 读取
          if (data.config.env) {
            setBaseUrl(data.config.env.GOOGLE_GEMINI_BASE_URL || '')
            setApiKey(data.config.env.GEMINI_API_KEY || '')
            setModel(data.config.env.GEMINI_MODEL || '')
          }
          // 从 settings 读取
          if (data.config.settings) {
            setSettingsValue(JSON.stringify(data.config.settings, null, 2))
          }
        }
      } catch (e) {
        logError('Failed to parse initial data:', e)
      }
    }
  }, [initialData, isEdit])

  // 当表单字段变化时，同步更新 env、config 和 settings（仅在编辑器展开时）
  useEffect(() => {
    if (!showEnvEditor && !showConfigEditor && !showSettingsEditor) return
    
    try {
      // 构建 .env 格式文本
      const envLines: string[] = []
      if (baseUrl.trim()) envLines.push(`GOOGLE_GEMINI_BASE_URL=${baseUrl.trim()}`)
      if (apiKey.trim()) envLines.push(`GEMINI_API_KEY=${apiKey.trim()}`)
      if (model.trim()) envLines.push(`GEMINI_MODEL=${model.trim()}`)
      setEnvValue(envLines.join('\n'))
      setEnvKey(prev => prev + 1)

      // 构建 config (可以为空对象或包含其他配置)
      const config: ConfigJson = {}
      setConfigValue(JSON.stringify(config, null, 2))
      setConfigKey(prev => prev + 1)

      // 构建 settings (默认配置)
      const settings: SettingsJson = {
        ide: {
          enabled: true,
        },
        security: {
          auth: {
            selectedType: 'gemini-api-key',
          },
        },
      }
      setSettingsValue(JSON.stringify(settings, null, 2))
      setSettingsKey(prev => prev + 1)

      setEnvError('')
      setConfigError('')
      setSettingsError('')
    } catch (e: any) {
      logError('Failed to sync config:', e)
    }
  }, [baseUrl, apiKey, model, showEnvEditor, showConfigEditor, showSettingsEditor])

  // 解析 .env 格式文本
  const parseEnvText = (text: string): EnvConfig => {
    const env: EnvConfig = {}
    const lines = text.split('\n')
    
    lines.forEach(line => {
      line = line.trim()
      if (!line || line.startsWith('#')) return
      
      const equalIndex = line.indexOf('=')
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim()
        const value = line.substring(equalIndex + 1).trim()
        env[key] = value
      }
    })
    
    return env
  }

  // 应用 env 配置
  const handleApplyEnv = () => {
    try {
      const parsed = parseEnvText(envValue)
      setBaseUrl(parsed.GOOGLE_GEMINI_BASE_URL || '')
      setApiKey(parsed.GEMINI_API_KEY || '')
      setModel(parsed.GEMINI_MODEL || '')
      setEnvError('')
      setMessage(isEn ? 'Environment variables applied' : '环境变量已应用')
      setStatus('success')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
    } catch (e: any) {
      setEnvError(e.message || (isEn ? 'Invalid .env format' : '.env 格式无效'))
    }
  }

  // 应用 config 配置
  const handleApplyConfig = () => {
    try {
      JSON.parse(configValue) as ConfigJson
      setConfigError('')
      setMessage(isEn ? 'Config applied successfully' : '配置应用成功')
      setStatus('success')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
    } catch (e: any) {
      setConfigError(e.message || (isEn ? 'Invalid JSON format' : 'JSON 格式无效'))
    }
  }

  // 应用 settings 配置
  const handleApplySettings = () => {
    try {
      JSON.parse(settingsValue) as SettingsJson
      setSettingsError('')
      setMessage(isEn ? 'Settings applied successfully' : '设置应用成功')
      setStatus('success')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
    } catch (e: any) {
      setSettingsError(e.message || (isEn ? 'Invalid JSON format' : 'JSON 格式无效'))
    }
  }

  // 当选择预设时，自动填充配置
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = geminiProviderPresets.find((p) => p.id === presetId)
    if (preset && preset.config) {
      // 从预设的 env 中读取
      if (preset.config.env) {
        setBaseUrl(preset.config.env.GOOGLE_GEMINI_BASE_URL || '')
        setModel(preset.config.env.GEMINI_MODEL || '')
        // 不自动填充 API Key
      }
    }
  }

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      setStatus('error')
      setMessage(isEn ? 'API Key is required' : 'API Key 是必需的')
      return
    }

    setStatus('processing')
    setMessage(isEn ? 'Processing...' : '正在处理...')

    try {
      const selectedPreset = geminiProviderPresets.find((p) => p.id === selectedPresetId)
      const config: GeminiConfig = {
        env: JSON.parse(envValue || '{}'),
        config: JSON.parse(configValue || '{}'),
        settings: JSON.parse(settingsValue || '{}'),
      }

      // 创建账号对象
      const account: GeminiAccount = {
        id: crypto.randomUUID(),
        platform: 'gemini',
        email: extractEmailFromUrl(baseUrl) || selectedPreset?.name || 'gemini@google',
        name: selectedPreset?.name || extractNameFromUrl(baseUrl) || 'Google Gemini',
        isActive: false,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        providerId: selectedPresetId || undefined,
        config: config,
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

  const selectedPreset = geminiProviderPresets.find((p) => p.id === selectedPresetId)

  return (
    <div className="space-y-6">
      {/* Provider 预设选择 - 统一轮播 */}
      <div className="space-y-3">
        <Label>
          {isEn ? 'Select Provider' : '选择供应商'} <span className="text-red-500">*</span>
        </Label>
        
        <ProviderCarousel
          providers={geminiProviderPresets}
          selectedId={selectedPresetId}
          onSelect={handlePresetChange}
          isEn={isEn}
        />
      </div>

      {/* 选中后显示详细信息和配置 */}
      {selectedPresetId && (
        <>
          {/* 供应商详细信息 */}
          {selectedPreset && (
            <ProviderInfo provider={selectedPreset} isEn={isEn} />
          )}

          {/* Base URL（自定义时可编辑） */}
          {selectedPresetId === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="base-url">
                Base URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="base-url"
                type="text"
                placeholder="https://generativelanguage.googleapis.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={status === 'processing'}
              />
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">
              API Key <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showPassword ? "text" : "password"}
                placeholder={isEn ? 'Enter your API key' : '输入你的 API Key'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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

          {/* Advanced Settings - Model Configuration */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{isEn ? 'Advanced Settings' : '高级设置'}</span>
              <span className={cn("transition-transform", showAdvanced && "rotate-180")}>▼</span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  {isEn 
                    ? 'Optional: Specify default Gemini model. Leave empty to use system defaults.'
                    : '可选：指定默认使用的 Gemini 模型，留空则使用系统默认。'
                  }
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">
                    {isEn ? 'Model' : '模型'}
                  </Label>
                  <Input
                    id="model"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gemini-3-pro"
                    disabled={status === 'processing'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* .env Editor */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowEnvEditor(!showEnvEditor)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{isEn ? 'Environment Variables (.env)' : '环境变量 (.env)'}</span>
                <span className={cn("transition-transform", showEnvEditor && "rotate-180")}>▼</span>
              </button>

              {showEnvEditor && (
                <div className="space-y-2">
                  <Textarea
                    key={envKey}
                    defaultValue={envValue}
                    onChange={(e) => setEnvValue(e.target.value)}
                    onBlur={handleApplyEnv}
                    className="font-mono text-xs min-h-[150px] resize-y"
                    placeholder={isEn ? 'Edit environment variables...' : '编辑环境变量...'}
                    disabled={status === 'processing'}
                  />
                  {envError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{envError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* config.json Editor */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowConfigEditor(!showConfigEditor)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{isEn ? 'Configuration (config.json)' : '配置文件 (config.json)'}</span>
                <span className={cn("transition-transform", showConfigEditor && "rotate-180")}>▼</span>
              </button>

              {showConfigEditor && (
                <div className="space-y-2">
                  <Textarea
                    key={configKey}
                    defaultValue={configValue}
                    onChange={(e) => setConfigValue(e.target.value)}
                    onBlur={handleApplyConfig}
                    className="font-mono text-xs min-h-[150px] resize-y"
                    placeholder={isEn ? 'Edit config.json...' : '编辑 config.json...'}
                    disabled={status === 'processing'}
                  />
                  {configError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{configError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* settings.json Editor */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowSettingsEditor(!showSettingsEditor)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{isEn ? 'Settings (settings.json)' : '设置 (settings.json)'}</span>
                <span className={cn("transition-transform", showSettingsEditor && "rotate-180")}>▼</span>
              </button>

              {showSettingsEditor && (
                <div className="space-y-2">
                  <Textarea
                    key={settingsKey}
                    defaultValue={settingsValue}
                    onChange={(e) => setSettingsValue(e.target.value)}
                    onBlur={handleApplySettings}
                    className="font-mono text-xs min-h-[200px] resize-y"
                    placeholder={isEn ? 'Edit settings.json...' : '编辑 settings.json...'}
                    disabled={status === 'processing'}
                  />
                  {settingsError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{settingsError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={status === 'processing' || !apiKey.trim() || (selectedPresetId === 'custom' && !baseUrl.trim())}
          >
            {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit 
              ? (isEn ? 'Update Account' : '更新账号')
              : (isEn ? 'Add Account' : '添加账号')
            }
          </Button>
        </>
      )}

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
    </div>
  )
}
