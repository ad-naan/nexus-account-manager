import { invoke } from '@tauri-apps/api/core'
import { CodexProviderPreset } from '@/types/provider'
import { CodexConfig } from '@/types/account'

export class CodexProviderService {
  async getCurrentConfig(): Promise<CodexConfig> {
    return await invoke<CodexConfig>('get_codex_provider_config')
  }

  async applyProvider(_preset: CodexProviderPreset, _apiKey: string): Promise<void> {
    // TODO: Implement provider preset application logic
    throw new Error('Not implemented')
  }

  async applyConfig(config: CodexConfig): Promise<void> {
    await invoke('apply_codex_provider', { config })
  }
}

export const codexProviderService = new CodexProviderService()
