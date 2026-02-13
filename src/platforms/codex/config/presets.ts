/**
 * Codex Provider 预设配置
 * 基于 cc-switch 的完整供应商列表
 */

import { CodexProviderPreset } from '@/types/provider'

export const codexProviderPresets: CodexProviderPreset[] = [
  {
    id: 'openai-official',
    name: 'OpenAI Official',
    category: 'official',
    websiteUrl: 'https://platform.openai.com',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI 官方 API',
    icon: 'openai',
    iconColor: '#10A37F',
    config: {
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'openai',
        model: 'gpt-5-codex',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          openai: {
            name: 'openai',
            base_url: 'https://api.openai.com/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
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
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'custom',
        model: 'gpt-5-codex',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          custom: {
            name: 'custom',
            base_url: '',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    category: 'official',
    websiteUrl: 'https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/codex',
    description: '微软 Azure OpenAI 服务',
    icon: 'azure',
    iconColor: '#0078D4',
    config: {
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'azure_openai',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          azure_openai: {
            name: 'azure_openai',
            base_url: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
    endpointCandidates: ['https://YOUR_RESOURCE_NAME.openai.azure.com/openai'],
  },
  {
    id: 'aihubmix',
    name: 'AiHubMix',
    category: 'aggregator',
    websiteUrl: 'https://aihubmix.com',
    apiKeyUrl: 'https://aihubmix.com',
    description: 'AiHubMix API 聚合平台',
    icon: 'aihubmix',
    iconColor: '#006FFB',
    config: {
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'aihubmix',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          aihubmix: {
            name: 'aihubmix',
            base_url: 'https://aihubmix.com/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
    endpointCandidates: ['https://aihubmix.com/v1', 'https://api.aihubmix.com/v1'],
  },
  {
    id: 'dmxapi',
    name: 'DMXAPI',
    category: 'aggregator',
    websiteUrl: 'https://www.dmxapi.cn',
    apiKeyUrl: 'https://www.dmxapi.cn',
    description: 'DMXAPI 聚合平台',
    isPartner: true,
    config: {
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'dmxapi',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          dmxapi: {
            name: 'dmxapi',
            base_url: 'https://www.dmxapi.cn/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
    endpointCandidates: ['https://www.dmxapi.cn/v1'],
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
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'packycode',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          packycode: {
            name: 'packycode',
            base_url: 'https://www.packyapi.com/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
    endpointCandidates: ['https://www.packyapi.com/v1', 'https://api-slb.packyapi.com/v1'],
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
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'cubence_codex',
        model: 'gpt-5-codex',
        model_reasoning_effort: 'high',
        disable_response_storage: true,
        model_providers: {
          cubence_codex: {
            name: 'cubence_codex',
            base_url: 'https://api.cubence.com/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
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
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'aigocode',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          aigocode: {
            name: 'aigocode',
            base_url: 'https://api.aigocode.com',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
  },
  {
    id: 'rightcode',
    name: 'RightCode',
    category: 'third_party',
    websiteUrl: 'https://www.right.codes',
    apiKeyUrl: 'https://www.right.codes/register?aff=CCSWITCH',
    description: 'RightCode API 中转服务',
    icon: 'rc',
    iconColor: '#E96B2C',
    isPartner: true,
    config: {
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'rightcode',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          rightcode: {
            name: 'rightcode',
            base_url: 'https://right.codes/codex/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
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
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'aicodemirror',
        model: 'gpt-5.2',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          aicodemirror: {
            name: 'aicodemirror',
            base_url: 'https://api.aicodemirror.com/api/codex/backend-api/codex',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
    endpointCandidates: [
      'https://api.aicodemirror.com/api/codex/backend-api/codex',
      'https://api.claudecode.net.cn/api/codex/backend-api/codex',
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
      auth: {
        OPENAI_API_KEY: '',
      },
      config: {
        model_provider: 'openrouter',
        model: 'openai/gpt-4-turbo',
        model_reasoning_effort: 'high',
        disable_response_storage: false,
        model_providers: {
          openrouter: {
            name: 'openrouter',
            base_url: 'https://openrouter.ai/api/v1',
            wire_api: 'responses',
            requires_openai_auth: true,
          },
        },
      },
    },
  },
]

export function getCodexPreset(id: string): CodexProviderPreset | undefined {
  return codexProviderPresets.find((p) => p.id === id)
}

export function getCodexPresetsByCategory(category: string): CodexProviderPreset[] {
  return codexProviderPresets.filter((p) => p.category === category)
}
