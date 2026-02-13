/**
 * Gemini Provider 预设配置
 * 基于 cc-switch 的完整供应商列表
 */

import { GeminiProviderPreset } from '@/types/provider'

export const geminiProviderPresets: GeminiProviderPreset[] = [
  {
    id: 'google-official',
    name: 'Google Official',
    category: 'official',
    websiteUrl: 'https://ai.google.dev',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Google 官方 Gemini API',
    icon: 'google',
    iconColor: '#4285F4',
    config: {
      env: {
        GEMINI_API_KEY: '',
      },
    },
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    category: 'custom',
    websiteUrl: '',
    description: '自定义供应商配置',
    config: {
      env: {
        GOOGLE_GEMINI_BASE_URL: '',
        GEMINI_API_KEY: '',
      },
    },
  },
  {
    id: 'packycode',
    name: 'PackyCode',
    category: 'third_party',
    websiteUrl: 'https://www.packyapi.com',
    apiKeyUrl: 'https://www.packyapi.com/register?aff=cc-switch',
    description: 'PackyCode API 中转服务',
    icon: 'packycode',
    isPartner: true,
    config: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://www.packyapi.com',
        GEMINI_API_KEY: '',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    endpointCandidates: ['https://api-slb.packyapi.com', 'https://www.packyapi.com'],
  },
  {
    id: 'cubence',
    name: 'Cubence',
    category: 'third_party',
    websiteUrl: 'https://cubence.com',
    apiKeyUrl: 'https://cubence.com/signup?code=CCSWITCH&source=ccs',
    description: 'Cubence API 中转服务',
    icon: 'cubence',
    iconColor: '#000000',
    isPartner: true,
    config: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://api.cubence.com',
        GEMINI_API_KEY: '',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    endpointCandidates: [
      'https://api.cubence.com/v1',
      'https://api-cf.cubence.com/v1',
      'https://api-dmit.cubence.com/v1',
      'https://api-bwg.cubence.com/v1',
    ],
  },
  {
    id: 'aigocode',
    name: 'AIGoCode',
    category: 'third_party',
    websiteUrl: 'https://aigocode.com',
    apiKeyUrl: 'https://aigocode.com/invite/CC-SWITCH',
    description: 'AIGoCode API 中转服务',
    icon: 'aigocode',
    iconColor: '#5B7FFF',
    isPartner: true,
    config: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://api.aigocode.com',
        GEMINI_API_KEY: '',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
  },
  {
    id: 'aicodemirror',
    name: 'AICodeMirror',
    category: 'third_party',
    websiteUrl: 'https://www.aicodemirror.com',
    apiKeyUrl: 'https://www.aicodemirror.com/register?invitecode=9915W3',
    description: 'AICodeMirror API 中转服务',
    icon: 'aicodemirror',
    iconColor: '#000000',
    isPartner: true,
    config: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://api.aicodemirror.com/api/gemini',
        GEMINI_API_KEY: '',
        GEMINI_MODEL: 'gemini-3-pro',
      },
    },
    endpointCandidates: [
      'https://api.aicodemirror.com/api/gemini',
      'https://api.claudecode.net.cn/api/gemini',
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'aggregator',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    description: 'OpenRouter API 聚合平台',
    icon: 'openrouter',
    iconColor: '#6566F1',
    config: {
      env: {
        GOOGLE_GEMINI_BASE_URL: 'https://openrouter.ai/api',
        GEMINI_API_KEY: '',
        GEMINI_MODEL: 'gemini-3-pro-preview',
      },
    },
  },
]

export function getGeminiPreset(id: string): GeminiProviderPreset | undefined {
  return geminiProviderPresets.find((p) => p.id === id)
}

export function getGeminiPresetsByCategory(category: string): GeminiProviderPreset[] {
  return geminiProviderPresets.filter((p) => p.category === category)
}
