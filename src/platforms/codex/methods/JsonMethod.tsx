/**
 * Codex 平台 - JSON 导入方式
 * 
 * 支持从 Provider 预设或 JSON 格式导入 OpenAI Codex API 配置
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
import { codexProviderPresets } from '../config/presets'
import { ProviderCarousel, ProviderInfo } from '@/components/common/ProviderCarousel'
import type { AddMethodProps } from '@/types/platform'
import type { CodexAccount, AuthJson, ConfigToml, CodexConfig } from '@/types/account'

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
  const [modelProvider, setModelProvider] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState('')
  const [disableResponseStorage, setDisableResponseStorage] = useState(false)
  const [wireApi, setWireApi] = useState('')
  const [requiresOpenaiAuth, setRequiresOpenaiAuth] = useState(true)

  // JSON/TOML 编辑器
  const [showAuthJsonEditor, setShowAuthJsonEditor] = useState(isEdit ? false : true)
  const [showConfigTomlEditor, setShowConfigTomlEditor] = useState(isEdit ? false : true)
  const [authJsonValue, setAuthJsonValue] = useState('')
  const [configTomlValue, setConfigTomlValue] = useState('')
  const [authJsonError, setAuthJsonError] = useState('')
  const [configTomlError, setConfigTomlError] = useState('')
  const [authJsonKey, setAuthJsonKey] = useState(0)
  const [configTomlKey, setConfigTomlKey] = useState(0)

  // 初始化编辑模式数据
  useEffect(() => {
    if (initialData && isEdit) {
      try {
        const data = JSON.parse(initialData)
        if (data.config) {
          // 从 auth.json 读取
          if (data.config.auth) {
            setApiKey(data.config.auth.OPENAI_API_KEY || '')
          }
          // 从 config.toml 读取
          if (data.config.config) {
            setModel(data.config.config.model || '')
            setModelProvider(data.config.config.model_provider || '')
            setReasoningEffort(data.config.config.model_reasoning_effort || '')
            setDisableResponseStorage(data.config.config.disable_response_storage || false)
            
            // 从 model_providers 读取
            const providerKey = data.config.config.model_provider || 'codex'
            const providerConfig = data.config.config.model_providers?.[providerKey]
            if (providerConfig) {
              setBaseUrl(providerConfig.base_url || '')
              setWireApi(providerConfig.wire_api || '')
              setRequiresOpenaiAuth(providerConfig.requires_openai_auth !== false)
            }
          }
        }
      } catch (e) {
        logError('Failed to parse initial data:', e)
      }
    }
  }, [initialData, isEdit])

  // 当表单字段变化时，同步更新 auth.json 和 config.toml（仅在编辑器展开时）
  useEffect(() => {
    if (!showAuthJsonEditor && !showConfigTomlEditor) return
    
    try {
      // 构建 auth.json
      const authJson: AuthJson = {
        OPENAI_API_KEY: apiKey.trim() || undefined,
      }
      Object.keys(authJson).forEach(key => {
        if (!authJson[key]) delete authJson[key]
      })
      setAuthJsonValue(JSON.stringify(authJson, null, 2))
      setAuthJsonKey(prev => prev + 1)

      // 构建 config.toml
      const providerKey = modelProvider.trim() || 'codex'
      const configToml: ConfigToml = {
        model_provider: modelProvider.trim() || undefined,
        model: model.trim() || undefined,
        model_reasoning_effort: reasoningEffort.trim() || undefined,
        disable_response_storage: disableResponseStorage || undefined,
        model_providers: {
          [providerKey]: {
            name: providerKey,
            base_url: baseUrl.trim() || undefined,
            wire_api: wireApi.trim() || undefined,
            requires_openai_auth: requiresOpenaiAuth,
          }
        }
      }
      
      // 移除空值
      Object.keys(configToml).forEach(key => {
        if (!configToml[key]) delete configToml[key]
      })
      if (configToml.model_providers) {
        Object.keys(configToml.model_providers[providerKey]).forEach(key => {
          if (configToml.model_providers![providerKey][key] === undefined) {
            delete configToml.model_providers![providerKey][key]
          }
        })
      }

      // 转换为 TOML 格式字符串
      setConfigTomlValue(convertToToml(configToml))
      setConfigTomlKey(prev => prev + 1)
      setAuthJsonError('')
      setConfigTomlError('')
    } catch (e: any) {
      logError('Failed to sync config:', e)
    }
  }, [apiKey, baseUrl, model, modelProvider, reasoningEffort, disableResponseStorage, wireApi, requiresOpenaiAuth, showAuthJsonEditor, showConfigTomlEditor])

  // 简单的 TOML 转换函数
  const convertToToml = (config: ConfigToml): string => {
    let toml = ''
    
    // 顶层字段
    if (config.model_provider) toml += `model_provider = "${config.model_provider}"\n`
    if (config.model) toml += `model = "${config.model}"\n`
    if (config.model_reasoning_effort) toml += `model_reasoning_effort = "${config.model_reasoning_effort}"\n`
    if (config.disable_response_storage !== undefined) toml += `disable_response_storage = ${config.disable_response_storage}\n`
    
    // model_providers 部分
    if (config.model_providers) {
      Object.entries(config.model_providers).forEach(([key, value]) => {
        toml += `\n[model_providers.${key}]\n`
        if (value.name) toml += `name = "${value.name}"\n`
        if (value.base_url) toml += `base_url = "${value.base_url}"\n`
        if (value.wire_api) toml += `wire_api = "${value.wire_api}"\n`
        if (value.requires_openai_auth !== undefined) toml += `requires_openai_auth = ${value.requires_openai_auth}\n`
      })
    }
    
    return toml
  }

  // 简单的 TOML 解析函数
  const parseToml = (toml: string): ConfigToml => {
    const config: ConfigToml = { model_providers: {} }
    const lines = toml.split('\n')
    let currentSection: string | null = null
    let currentProvider: string | null = null

    lines.forEach(line => {
      line = line.trim()
      if (!line || line.startsWith('#')) return

      // 解析 section
      const sectionMatch = line.match(/^\[model_providers\.(.+)\]$/)
      if (sectionMatch) {
        currentSection = 'model_providers'
        currentProvider = sectionMatch[1]
        if (!config.model_providers![currentProvider]) {
          config.model_providers![currentProvider] = {}
        }
        return
      }

      // 解析键值对
      const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/)
      if (kvMatch) {
        const [, key, value] = kvMatch
        let parsedValue: any = value.trim()
        
        // 移除引号
        if (parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
          parsedValue = parsedValue.slice(1, -1)
        } else if (parsedValue === 'true') {
          parsedValue = true
        } else if (parsedValue === 'false') {
          parsedValue = false
        }

        if (currentSection === 'model_providers' && currentProvider) {
          config.model_providers![currentProvider][key] = parsedValue
        } else {
          config[key] = parsedValue
        }
      }
    })

    return config
  }

  // 应用 auth.json 配置
  const handleApplyAuthJson = () => {
    try {
      const parsed = JSON.parse(authJsonValue) as AuthJson
      setApiKey(parsed.OPENAI_API_KEY || '')
      setAuthJsonError('')
      setStatus('idle')
      setMessage('')
    } catch (e: any) {
      setAuthJsonError(e.message || (isEn ? 'Invalid JSON format' : 'JSON 格式无效'))
    }
  }

  // 应用 config.toml 配置
  const handleApplyConfigToml = () => {
    try {
      const parsed = parseToml(configTomlValue)
      
      setModel(parsed.model || '')
      setModelProvider(parsed.model_provider || '')
      setReasoningEffort(parsed.model_reasoning_effort || '')
      setDisableResponseStorage(parsed.disable_response_storage || false)

      // 从 model_providers 读取
      const providerKey = parsed.model_provider || ''
      const providerConfig = parsed.model_providers?.[providerKey]
      if (providerConfig) {
        setBaseUrl(providerConfig.base_url || '')
        setWireApi(providerConfig.wire_api || '')
        setRequiresOpenaiAuth(providerConfig.requires_openai_auth !== false)
      }

      setConfigTomlError('')
      setStatus('idle')
       setMessage('')
    } catch (e: any) {
      setConfigTomlError(e.message || (isEn ? 'Invalid TOML format' : 'TOML 格式无效'))
    }
  }

  // 当选择预设时，自动填充配置
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = codexProviderPresets.find((p) => p.id === presetId)
    if (preset && preset.config) {
      // 从预设的 config 中读取
      if (preset.config.config) {
        setModel(preset.config.config.model || '')
        setModelProvider(preset.config.config.model_provider || '')
        setReasoningEffort(preset.config.config.model_reasoning_effort || '')
        setDisableResponseStorage(preset.config.config.disable_response_storage || false)
        
        const providerKey = preset.config.config.model_provider || ''
        const providerConfig = preset.config.config.model_providers?.[providerKey]
        if (providerConfig) {
          setBaseUrl(providerConfig.base_url || '')
          setWireApi(providerConfig.wire_api || '')
          setRequiresOpenaiAuth(providerConfig.requires_openai_auth !== false)
        }
      }
    }
  }

  const handleSubmit = async () => {
    // 验证：要么有完整的 JSON/TOML 配置，要么有 API Key
    const hasJsonTomlConfig = authJsonValue.trim() && configTomlValue.trim()
    if (!hasJsonTomlConfig && !apiKey.trim()) {
      setStatus('error')
      setMessage(isEn ? 'API Key is required or provide auth.json and config.toml' : 'API Key 是必需的，或提供 auth.json 和 config.toml')
      return
    }

    setStatus('processing')
    setMessage(isEn ? 'Processing...' : '正在处理...')

    try {
      const selectedPreset = codexProviderPresets.find((p) => p.id === selectedPresetId)
      
      // 构建配置对象
      const config: CodexConfig = {
        auth: JSON.parse(authJsonValue),
        config: parseToml(configTomlValue)
      }

      // 创建账号对象
      const account: CodexAccount = {
        id: crypto.randomUUID(),
        platform: 'codex',
        email: extractEmailFromUrl(baseUrl) || selectedPreset?.name || 'codex@openai',
        name: selectedPreset?.name || extractNameFromUrl(baseUrl) || 'OpenAI Codex',
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

  const selectedPreset = codexProviderPresets.find((p) => p.id === selectedPresetId)

  return (
    <div className="space-y-6">
      {/* Provider 预设选择 - 统一轮播 */}
      <div className="space-y-3">
        <Label>
          {isEn ? 'Select Provider' : '选择供应商'} <span className="text-red-500">*</span>
        </Label>
        
        <ProviderCarousel
          providers={codexProviderPresets}
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
                placeholder="https://api.openai.com/v1"
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
                    ? 'Optional: Specify model provider, model, and other configurations.'
                    : '可选：指定模型提供商、模型和其他配置。'
                  }
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model Provider */}
                  <div className="space-y-2">
                    <Label htmlFor="model-provider">
                      {isEn ? 'Model Provider' : '模型提供商'}
                    </Label>
                    <Input
                      id="model-provider"
                      type="text"
                      value={modelProvider}
                      onChange={(e) => setModelProvider(e.target.value)}
                      placeholder="codex"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Model */}
                  <div className="space-y-2">
                    <Label htmlFor="model">
                      {isEn ? 'Model' : '模型'}
                    </Label>
                    <Input
                      id="model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="gpt-5-codex"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Reasoning Effort */}
                  <div className="space-y-2">
                    <Label htmlFor="reasoning-effort">
                      {isEn ? 'Reasoning Effort' : '推理强度'}
                    </Label>
                    <Input
                      id="reasoning-effort"
                      type="text"
                      value={reasoningEffort}
                      onChange={(e) => setReasoningEffort(e.target.value)}
                      placeholder="high"
                      disabled={status === 'processing'}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isEn ? 'Options: low, medium, high' : '选项：low, medium, high'}
                    </p>
                  </div>

                  {/* Wire API */}
                  <div className="space-y-2">
                    <Label htmlFor="wire-api">
                      {isEn ? 'Wire API' : 'Wire API'}
                    </Label>
                    <Input
                      id="wire-api"
                      type="text"
                      value={wireApi}
                      onChange={(e) => setWireApi(e.target.value)}
                      placeholder="responses"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Disable Response Storage */}
                  <div className="space-y-2 flex items-center gap-2">
                    <input
                      id="disable-storage"
                      type="checkbox"
                      checked={disableResponseStorage}
                      onChange={(e) => setDisableResponseStorage(e.target.checked)}
                      disabled={status === 'processing'}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="disable-storage" className="cursor-pointer">
                      {isEn ? 'Disable Response Storage' : '禁用响应存储'}
                    </Label>
                  </div>

                  {/* Requires OpenAI Auth */}
                  <div className="space-y-2 flex items-center gap-2">
                    <input
                      id="requires-auth"
                      type="checkbox"
                      checked={requiresOpenaiAuth}
                      onChange={(e) => setRequiresOpenaiAuth(e.target.checked)}
                      disabled={status === 'processing'}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="requires-auth" className="cursor-pointer">
                      {isEn ? 'Requires OpenAI Auth' : '需要 OpenAI 认证'}
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* auth.json Editor */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAuthJsonEditor(!showAuthJsonEditor)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{isEn ? 'auth.json Editor' : 'auth.json 编辑器'}</span>
                <span className={cn("transition-transform", showAuthJsonEditor && "rotate-180")}>▼</span>
              </button>

              {showAuthJsonEditor && (
                <div className="space-y-2">
                  <Textarea
                    key={authJsonKey}
                    defaultValue={authJsonValue}
                    onChange={(e) => setAuthJsonValue(e.target.value)}
                    onBlur={handleApplyAuthJson}
                    className="font-mono text-xs min-h-[120px] resize-y"
                    placeholder={isEn ? 'Edit auth.json...' : '编辑 auth.json...'}
                    disabled={status === 'processing'}
                  />
                  {authJsonError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{authJsonError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* config.toml Editor */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowConfigTomlEditor(!showConfigTomlEditor)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{isEn ? 'config.toml Editor' : 'config.toml 编辑器'}</span>
              <span className={cn("transition-transform", showConfigTomlEditor && "rotate-180")}>▼</span>
            </button>

            {showConfigTomlEditor && (
              <div className="space-y-2">
                <Textarea
                  key={configTomlKey}
                  defaultValue={configTomlValue}
                  onChange={(e) => setConfigTomlValue(e.target.value)}
                  onBlur={handleApplyConfigToml}
                  className="font-mono text-xs min-h-[240px] resize-y"
                  placeholder={isEn ? 'Edit config.toml...' : '编辑 config.toml...'}
                  disabled={status === 'processing'}
                />
                {configTomlError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{configTomlError}</span>
                  </div>
                )}
              </div>
            )}
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

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={
              status === 'processing' || 
              (!(authJsonValue.trim() && configTomlValue.trim()) && !apiKey.trim()) || 
              (selectedPresetId === 'custom' && !baseUrl.trim() && !(authJsonValue.trim() && configTomlValue.trim()))
            }
          >
            {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit 
              ? (isEn ? 'Update Account' : '更新账号')
              : (isEn ? 'Add Account' : '添加账号')
            }
          </Button>
        </>
      )}

      
    </div>
  )
}
