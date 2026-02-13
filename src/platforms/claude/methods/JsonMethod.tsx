/**
 * Claude 平台 - JSON 导入方式
 * 
 * 支持从 Provider 预设或 JSON 格式导入 Claude API 配置
 */

import { logError } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { claudeProviderPresets } from '../config/presets'
import { ProviderCarousel, ProviderInfo } from '@/components/common/ProviderCarousel'
import type { AddMethodProps } from '@/types/platform'
import type { ClaudeAccount } from '@/types/account'

type Status = 'idle' | 'processing' | 'success' | 'error'

interface ClaudeConfig {
  model?: string
  env: {
    ANTHROPIC_BASE_URL?: string
    ANTHROPIC_AUTH_TOKEN?: string
    ANTHROPIC_MODEL?: string
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string
    [key: string]: any
  }
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
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom')
  const [baseUrl, setBaseUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showJsonEditor, setShowJsonEditor] = useState(isEdit ? false : true)
  const [claudeConfig, setClaudeConfig] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [claudeConfigKey, setClaudeConfigKey] = useState(0);
  
  // 模型配置
  const [mainModel, setMainModel] = useState('')
  const [reasoningModel, setReasoningModel] = useState('')
  const [haikuModel, setHaikuModel] = useState('')
  const [sonnetModel, setSonnetModel] = useState('')
  const [opusModel, setOpusModel] = useState('')

  // 初始化编辑模式数据
  useEffect(() => {
    if (initialData && isEdit) {
      try {
        const data = JSON.parse(initialData)
        if (data.config?.env) {
          setBaseUrl(data.config.env.ANTHROPIC_BASE_URL || '')
          setAuthToken(data.config.env.ANTHROPIC_AUTH_TOKEN || '')
          setMainModel(data.config.env.ANTHROPIC_MODEL || '')
          setReasoningModel(data.config.env.ANTHROPIC_REASONING_MODEL || '')
          setHaikuModel(data.config.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '')
          setSonnetModel(data.config.env.ANTHROPIC_DEFAULT_SONNET_MODEL || '')
          setOpusModel(data.config.env.ANTHROPIC_DEFAULT_OPUS_MODEL || '')
          setClaudeConfig(JSON.stringify(data.config || {}, null, 2))
        }
      } catch (e) {
        logError('Failed to parse initial data:', e)
      }
    }
  }, [initialData, isEdit])

  // 当表单字段变化时，同步更新 claudeConfig（仅在非手动编辑时）
  useEffect(() => {
    if (!showJsonEditor) return
    
    try {
      const config: ClaudeConfig = JSON.parse(claudeConfig);
      
      config.env.ANTHROPIC_BASE_URL = baseUrl.trim() || undefined
      config.env.ANTHROPIC_AUTH_TOKEN = authToken.trim() || undefined
      config.env.ANTHROPIC_MODEL = mainModel.trim() || undefined
      config.env.ANTHROPIC_REASONING_MODEL = reasoningModel.trim() || undefined
      config.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = haikuModel.trim() || undefined
      config.env.ANTHROPIC_DEFAULT_SONNET_MODEL = sonnetModel.trim() || undefined
      config.env.ANTHROPIC_DEFAULT_OPUS_MODEL = opusModel.trim() || undefined

      // 移除空值
      Object.keys(config.env).forEach(key => {
        if (!config.env[key]) {
          delete config.env[key]
        }
      })

      setClaudeConfig(JSON.stringify(config, null, 2))
      setJsonError('')
      setClaudeConfigKey(prev => prev + 1);
    } catch (e: any) {
      logError('Failed to sync config:', e)
    }
  }, [baseUrl, authToken, mainModel, reasoningModel, haikuModel, sonnetModel, opusModel, showJsonEditor])

  // 当选择预设时，自动填充配置
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = claudeProviderPresets.find((p) => p.id === presetId)
    if (preset) {
      setBaseUrl(preset.config.env.ANTHROPIC_BASE_URL || '')
      setMainModel(preset.config.env.ANTHROPIC_MODEL || '')
      setHaikuModel(preset.config.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '')
      setSonnetModel(preset.config.env.ANTHROPIC_DEFAULT_SONNET_MODEL || '')
      setOpusModel(preset.config.env.ANTHROPIC_DEFAULT_OPUS_MODEL || '')
      setClaudeConfig(JSON.stringify(preset.config || {}, null, 2))
      setJsonError('')
    }
  }

  // 应用 JSON 配置到表单字段
  const handleApplyJsonConfig = () => {
    try {
      const parsed = JSON.parse(claudeConfig) as ClaudeConfig

      // 验证必需字段
      if (!parsed.env) {
        throw new Error(isEn ? 'Missing "env" field' : '缺少 "env" 字段')
      }
      setBaseUrl(parsed.env.ANTHROPIC_BASE_URL || '')
      setAuthToken(parsed.env.ANTHROPIC_AUTH_TOKEN || '')
      setMainModel(parsed.env.ANTHROPIC_MODEL || '')
      setReasoningModel(parsed.env.ANTHROPIC_REASONING_MODEL || '')
      setHaikuModel(parsed.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '')
      setSonnetModel(parsed.env.ANTHROPIC_DEFAULT_SONNET_MODEL || '')
      setOpusModel(parsed.env.ANTHROPIC_DEFAULT_OPUS_MODEL || '')
      setJsonError('')
      setStatus('idle')
      setMessage('')
    } catch (e: any) {
      setJsonError(e.message || (isEn ? 'Invalid JSON format' : 'JSON 格式无效'))
    }
  }

  const handleSubmit = async () => {
    if (!claudeConfig.trim() && !authToken.trim()) {
      setStatus('error')
      setMessage(isEn ? 'API Key is required' : 'API Key 是必需的')
      return
    }

    setStatus('processing')
    setMessage(isEn ? 'Processing...' : '正在处理...')

    try {
      const selectedPreset = claudeProviderPresets.find((p) => p.id === selectedPresetId)

      // 创建账号对象
      const account: ClaudeAccount = {
        id: crypto.randomUUID(),
        platform: 'claude',
        email: extractEmailFromUrl(baseUrl) || selectedPreset?.name || 'claude@api',
        name: selectedPreset?.name || extractNameFromUrl(baseUrl) || 'Claude API',
        isActive: false,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        providerId: selectedPresetId || undefined,
        config: JSON.parse(claudeConfig),
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

  const selectedPreset = claudeProviderPresets.find((p) => p.id === selectedPresetId)

  return (
    <div className="space-y-6">
      {/* Provider 预设选择 - 统一轮播 */}
      <div className="space-y-3">
        <Label>
          {isEn ? 'Select Provider' : '选择供应商'} <span className="text-red-500">*</span>
        </Label>
        
        <ProviderCarousel
          providers={claudeProviderPresets}
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
                placeholder="https://api.anthropic.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={status === 'processing'}
              />
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="auth-token">
              API Key <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="auth-token"
                type="password"
                placeholder={isEn ? 'Enter your API key' : '输入你的 API Key'}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                disabled={status === 'processing'}
              />
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
                    ? 'Optional: Specify default Claude models. Leave empty to use system defaults.'
                    : '可选：指定默认使用的 Claude 模型，留空则使用系统默认。'
                  }
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Main Model */}
                  <div className="space-y-2">
                    <Label htmlFor="main-model">
                      {isEn ? 'Main Model' : '主模型'}
                    </Label>
                    <Input
                      id="main-model"
                      type="text"
                      value={mainModel}
                      onChange={(e) => setMainModel(e.target.value)}
                      placeholder="claude-sonnet-4.5"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Reasoning Model */}
                  <div className="space-y-2">
                    <Label htmlFor="reasoning-model">
                      {isEn ? 'Reasoning Model' : '推理模型'}
                    </Label>
                    <Input
                      id="reasoning-model"
                      type="text"
                      value={reasoningModel}
                      onChange={(e) => setReasoningModel(e.target.value)}
                      placeholder="claude-opus-4.5"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Haiku Default Model */}
                  <div className="space-y-2">
                    <Label htmlFor="haiku-model">
                      {isEn ? 'Haiku Default Model' : 'Haiku 默认模型'}
                    </Label>
                    <Input
                      id="haiku-model"
                      type="text"
                      value={haikuModel}
                      onChange={(e) => setHaikuModel(e.target.value)}
                      placeholder="claude-haiku-4.5"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Sonnet Default Model */}
                  <div className="space-y-2">
                    <Label htmlFor="sonnet-model">
                      {isEn ? 'Sonnet Default Model' : 'Sonnet 默认模型'}
                    </Label>
                    <Input
                      id="sonnet-model"
                      type="text"
                      value={sonnetModel}
                      onChange={(e) => setSonnetModel(e.target.value)}
                      placeholder="claude-sonnet-4.5"
                      disabled={status === 'processing'}
                    />
                  </div>

                  {/* Opus Default Model */}
                  <div className="space-y-2">
                    <Label htmlFor="opus-model">
                      {isEn ? 'Opus Default Model' : 'Opus 默认模型'}
                    </Label>
                    <Input
                      id="opus-model"
                      type="text"
                      value={opusModel}
                      onChange={(e) => setOpusModel(e.target.value)}
                      placeholder="claude-opus-4.5"
                      disabled={status === 'processing'}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* JSON Configuration Editor */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowJsonEditor(!showJsonEditor)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{isEn ? 'JSON Configuration Editor' : 'JSON 配置编辑器'}</span>
              <span className={cn("transition-transform", showJsonEditor && "rotate-180")}>▼</span>
            </button>

            {showJsonEditor && (
              <div className="space-y-2">
                <Textarea
                  key={claudeConfigKey}
                  defaultValue={claudeConfig}
                  onChange={(e) => setClaudeConfig(e.target.value)}
                  onBlur={handleApplyJsonConfig}
                  className="font-mono text-xs min-h-[240px] resize-y"
                  placeholder={isEn ? 'Edit JSON configuration...' : '编辑 JSON 配置...'}
                  disabled={status === 'processing'}
                />
                {jsonError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{jsonError}</span>
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
              (!claudeConfig.trim() && !authToken.trim()) || 
              (selectedPresetId === 'custom' && !baseUrl.trim() && !claudeConfig.trim())
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
