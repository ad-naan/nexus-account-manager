import { invoke } from '@tauri-apps/api/core'
import { GeminiProviderPreset } from '@/types/provider'
import { GeminiConfig } from '@/types/account'

export class GeminiProviderService {
  async getCurrentConfig(): Promise<GeminiConfig> {
    return await invoke<GeminiConfig>('get_gemini_provider_config')
  }

  async applyProvider(_preset: GeminiProviderPreset, _apiKey: string): Promise<void> {
    // TODO: Implement provider preset application logic
    throw new Error('Not implemented')
  }

  async applyConfig(config: GeminiConfig): Promise<void> {
    await invoke('apply_gemini_provider', { config })
  }
}

export const geminiProviderService = new GeminiProviderService()
