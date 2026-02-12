import { logError, logInfo } from '@/lib/logger'
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { Account, KiroAccount } from '@/types/account'
import { KiroAccountService } from '@/platforms/kiro/services/KiroAccountService'

// Auto-refresh timer
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
// Auto-refresh interval for account status (5 minutes)
// Currently not used but reserved for future auto-refresh implementation
// const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

// Backend Account Structure (matches Rust struct)
interface BackendAccount {
  id: string
  platform: string
  name: string | null
  email: string
  avatar: string | null
  is_active: boolean
  last_used_at: number
  created_at: number
  platform_data: any
}

interface PlatformStore {
  accounts: Account[]
  activeAccount: Account | null
  selectedPlatform: string | null
  isLoading: boolean
  error: string | null
  
  // Auto-refresh settings
  autoRefreshEnabled: boolean
  autoRefreshInterval: number // minutes

  loadAllAccounts: () => Promise<void>
  addAccount: (account: Account) => Promise<void>
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  setActiveAccount: (account: Account | null) => void
  setSelectedPlatform: (platform: string | null) => void
  getAccountsByPlatform: (platform: string) => Account[]
  
  // Kiro-specific operations
  refreshKiroToken: (id: string) => Promise<boolean>
  checkKiroStatus: (id: string) => Promise<void>
  batchRefreshKiroTokens: (ids: string[]) => Promise<void>
  
  // Auto-refresh management
  startAutoRefresh: () => void
  stopAutoRefresh: () => void
  checkAndRefreshExpiringTokens: () => Promise<void>
  setAutoRefresh: (enabled: boolean, interval?: number) => void
}

// Helper: Transform Frontend -> Backend
const toBackend = (account: Account): BackendAccount => {
  // Extract common fields
  const { id, platform, name, email, avatar, isActive, lastUsedAt, createdAt, ...rest } = account

  return {
    id,
    platform,
    name: name || null,
    email,
    avatar: avatar || null,
    is_active: isActive,
    last_used_at: lastUsedAt,
    created_at: createdAt,
    platform_data: rest // Store remaining platform-specific fields in platform_data
  }
}

// Helper: Transform Backend -> Frontend
const toFrontend = (backend: BackendAccount): Account => {
  const { id, platform, name, email, avatar, is_active, last_used_at, created_at, platform_data } = backend

  const common = {
    id,
    platform: platform as 'antigravity' | 'kiro' | 'claude' | 'codex' | 'gemini',
    name: name || undefined,
    email,
    avatar: avatar || undefined,
    isActive: is_active,
    lastUsedAt: last_used_at, // Provide default if missing? No, backend guarantees i64.
    createdAt: created_at,
  }

  // Merge common fields with platform data
  return { ...common, ...platform_data } as Account
}

export const usePlatformStore = create<PlatformStore>((set, get) => ({
  accounts: [],
  activeAccount: null,
  selectedPlatform: null,
  isLoading: false,
  error: null,
  autoRefreshEnabled: true,
  autoRefreshInterval: 5, // minutes

  loadAllAccounts: async () => {
    set({ isLoading: true, error: null })
    try {
      const backendAccounts = await invoke<BackendAccount[]>('get_accounts')
      const accounts = backendAccounts.map(toFrontend)
      set({ accounts, isLoading: false })
    } catch (err: any) {
      logError('Failed to load accounts:', err)
      set({ error: err.message || 'Failed to load accounts', isLoading: false })
    }
  },

  addAccount: async (account) => {
    set({ isLoading: true, error: null })
    try {
      logInfo('[Store] Adding account:', JSON.stringify(account, null, 2))
      const backendAccount = toBackend(account)
      logInfo('[Store] Backend account:', JSON.stringify(backendAccount, null, 2))
      await invoke('add_account', { account: backendAccount })
      set((state) => ({
        accounts: [...state.accounts, account],
        isLoading: false
      }))
    } catch (err: any) {
      logError('Failed to add account:', err)
      set({ error: err.message || 'Failed to add account', isLoading: false })
      throw err
    }
  },

  updateAccount: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const current = get().accounts.find(a => a.id === id)
      if (!current) throw new Error('Account not found')

      // Deep merge for nested objects like credentials
      const updated = { ...current, ...data } as Account
      
      // Special handling for Kiro accounts: deep merge credentials
      if (updated.platform === 'kiro' && 'credentials' in data && data.credentials) {
        const currentKiro = current as KiroAccount
        const updatedKiro = updated as KiroAccount
        updatedKiro.credentials = {
          ...currentKiro.credentials,
          ...data.credentials
        }
      }

      const backendAccount = toBackend(updated)
      await invoke('update_account', { id, account: backendAccount })

      set((state) => ({
        accounts: state.accounts.map((acc) => (acc.id === id ? updated : acc)),
        isLoading: false
      }))
    } catch (err: any) {
      logError('Failed to update account:', err)
      set({ error: err.message || 'Failed to update account', isLoading: false })
      throw err
    }
  },

  deleteAccount: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await invoke('delete_account', { id })
      set((state) => ({
        accounts: state.accounts.filter((acc) => acc.id !== id),
        activeAccount: state.activeAccount?.id === id ? null : state.activeAccount,
        isLoading: false
      }))
    } catch (err: any) {
      logError('Failed to delete account:', err)
      set({ error: err.message || 'Failed to delete account', isLoading: false })
    }
  },

  setActiveAccount: (account) => set({ activeAccount: account }),

  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),

  getAccountsByPlatform: (platform) => {
    return get().accounts.filter((acc) => acc.platform === platform)
  },

  // ==================== Kiro-specific operations ====================

  refreshKiroToken: async (id) => {
    const account = get().accounts.find(a => a.id === id) as KiroAccount | undefined
    if (!account || account.platform !== 'kiro') return false

    // Update status to refreshing
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === id && acc.platform === 'kiro'
          ? { ...acc, status: 'refreshing' as const }
          : acc
      )
    }))

    try {
      const result = await KiroAccountService.refreshToken(account)

      if (result.success && result.accessToken) {
        // Update account with new credentials
        const updated: Partial<KiroAccount> = {
          credentials: {
            ...account.credentials,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken || account.credentials.refreshToken,
            expiresAt: Date.now() + (result.expiresIn || 3600) * 1000
          },
          status: 'active',
          lastError: undefined,
          lastCheckedAt: Date.now()
        }

        await get().updateAccount(id, updated)
        return true
      } else {
        // Update with error status
        await get().updateAccount(id, {
          status: 'error',
          lastError: result.error,
          lastCheckedAt: Date.now()
        } as Partial<KiroAccount>)
        return false
      }
    } catch (error) {
      await get().updateAccount(id, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheckedAt: Date.now()
      } as Partial<KiroAccount>)
      return false
    }
  },

  checkKiroStatus: async (id) => {
    const account = get().accounts.find(a => a.id === id) as KiroAccount | undefined
    if (!account || account.platform !== 'kiro') return

    // Update status to refreshing (visual feedback)
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === id && acc.platform === 'kiro'
          ? { ...acc, status: 'refreshing' as const }
          : acc
      )
    }))

    try {
      const result = await KiroAccountService.checkStatus(account)

      if (result.success) {
        const updated: Partial<KiroAccount> = {
          status: result.status || 'active',
          usage: result.usage || account.usage,
          subscription: result.subscription || account.subscription,
          email: result.email || account.email,
          userId: result.userId || account.userId,
          lastCheckedAt: Date.now(),
          lastError: undefined
        }

        // If credentials were refreshed, update them
        if (result.newCredentials) {
          updated.credentials = {
            ...account.credentials,
            accessToken: result.newCredentials.accessToken,
            refreshToken: result.newCredentials.refreshToken || account.credentials.refreshToken,
            expiresAt: result.newCredentials.expiresAt
          }
        }

        await get().updateAccount(id, updated)
      } else {
        await get().updateAccount(id, {
          status: result.isBanned ? 'banned' : 'error',
          lastError: result.error,
          lastCheckedAt: Date.now()
        } as Partial<KiroAccount>)
      }
    } catch (error) {
      await get().updateAccount(id, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheckedAt: Date.now()
      } as Partial<KiroAccount>)
    }
  },

  batchRefreshKiroTokens: async (ids) => {
    const kiroAccounts = ids
      .map(id => get().accounts.find(a => a.id === id))
      .filter((acc): acc is KiroAccount => acc?.platform === 'kiro' && !!acc.credentials.refreshToken)

    if (kiroAccounts.length === 0) return

    logInfo(`[BatchRefresh] Refreshing ${kiroAccounts.length} Kiro accounts...`)

    // Update all to refreshing status
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        ids.includes(acc.id) && acc.platform === 'kiro'
          ? { ...acc, status: 'refreshing' as const }
          : acc
      )
    }))

    // Prepare accounts for batch refresh
    const accountsToRefresh = kiroAccounts.map(acc => ({
      id: acc.id,
      email: acc.email,
      credentials: acc.credentials
    }))

    try {
      const result = await KiroAccountService.batchRefresh(accountsToRefresh, 10)

      // Update each account based on result
      for (const item of result.results) {
        if (item.success && item.data?.accessToken) {
          const account = kiroAccounts.find(a => a.id === item.id)
          if (account) {
            await get().updateAccount(item.id, {
              credentials: {
                ...account.credentials,
                accessToken: item.data.accessToken,
                refreshToken: item.data.refreshToken || account.credentials.refreshToken,
                expiresAt: Date.now() + (item.data.expiresIn || 3600) * 1000
              },
              status: 'active',
              lastError: undefined,
              lastCheckedAt: Date.now()
            } as Partial<KiroAccount>)
          }
        } else {
          await get().updateAccount(item.id, {
            status: 'error',
            lastError: item.error,
            lastCheckedAt: Date.now()
          } as Partial<KiroAccount>)
        }
      }

      logInfo(`[BatchRefresh] Completed: ${result.successCount} success, ${result.failedCount} failed`)
    } catch (error) {
      logError('[BatchRefresh] Error:', error)
    }
  },

  // ==================== Auto-refresh management ====================

  startAutoRefresh: () => {
    if (autoRefreshTimer) return

    const { autoRefreshInterval } = get()
    const intervalMs = autoRefreshInterval * 60 * 1000

    autoRefreshTimer = setInterval(() => {
      get().checkAndRefreshExpiringTokens()
    }, intervalMs)

    logInfo(`[AutoRefresh] Started with interval: ${autoRefreshInterval} minutes`)
  },

  stopAutoRefresh: () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
      logInfo('[AutoRefresh] Stopped')
    }
  },

  checkAndRefreshExpiringTokens: async () => {
    const { accounts, autoRefreshEnabled } = get()
    if (!autoRefreshEnabled) return

    const kiroAccounts = accounts.filter((acc): acc is KiroAccount => acc.platform === 'kiro')
    const expiringAccounts = kiroAccounts.filter(acc =>
      KiroAccountService.isTokenExpiring(acc) || KiroAccountService.isTokenExpired(acc)
    )

    if (expiringAccounts.length > 0) {
      logInfo(`[AutoRefresh] Found ${expiringAccounts.length} expiring tokens`)
      await get().batchRefreshKiroTokens(expiringAccounts.map(a => a.id))
    }
  },

  setAutoRefresh: (enabled, interval) => {
    set({
      autoRefreshEnabled: enabled,
      autoRefreshInterval: interval !== undefined ? interval : get().autoRefreshInterval
    })

    if (enabled) {
      get().stopAutoRefresh()
      get().startAutoRefresh()
    } else {
      get().stopAutoRefresh()
    }
  },
}))
