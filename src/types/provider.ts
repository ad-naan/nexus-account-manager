import { AuthJson, ConfigToml, ClaudeEnvConfig  } from './account'

/**
 * Provider 预设配置类型定义
 * 从 cc-switch 提取的供应商管理功能
 */

export type ProviderCategory =
  | 'official'      // 官方
  | 'cn_official'   // 国产官方
  | 'aggregator'    // 聚合网站
  | 'third_party'   // 第三方供应商
  | 'custom'        // 自定义

export interface ProviderPreset {
  id: string
  name: string
  category: ProviderCategory
  websiteUrl: string
  apiKeyUrl?: string
  description?: string
  icon?: string
  iconColor?: string
  
  // 配置模板
  config: Record<string, any>
  
  // 端点候选列表（用于测速）
  endpointCandidates?: string[]
  
  // 是否为合作伙伴
  isPartner?: boolean
  partnerPromotionKey?: string
}

// Claude Provider 预设
export interface ClaudeProviderPreset extends ProviderPreset {
  config: ClaudeEnvConfig
}

// Codex Provider 预设
export interface CodexProviderPreset extends ProviderPreset {
  config: {
    auth: AuthJson
    config: ConfigToml
    [key: string]: any
  }
}

// Gemini Provider 预设
export interface GeminiProviderPreset extends ProviderPreset {
  config: {
    env: {
      GEMINI_API_KEY?: string
      GOOGLE_API_KEY?: string
      GEMINI_MODEL?: string
      GOOGLE_GEMINI_BASE_URL?: string
      [key: string]: any
    }
  }
}
