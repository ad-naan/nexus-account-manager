export type PlatformType = 'antigravity' | 'kiro' | 'claude' | 'codex' | 'gemini';

// --- Common Fields ---
export interface BaseAccount {
    id: string;
    platform: PlatformType;
    email: string;
    name?: string;
    avatar?: string;
    isActive: boolean;
    lastUsedAt: number;
    createdAt: number;
}

// --- Antigravity Specifics ---
export interface AntigravityTokenData {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expiry_timestamp: number;
    token_type: string;
    session_id?: string;
}

export interface ModelQuota {
    name: string;
    percentage: number;
    reset_time: string;
}

export interface AntigravityQuotaData {
    models: ModelQuota[];
    last_updated: number;
    is_forbidden: boolean;
    subscription_tier?: 'FREE' | 'PRO' | 'ULTRA';
}

export interface DeviceProfile {
    machine_id: string;
    mac_machine_id: string;
    dev_device_id: string;
    sqm_id: string;
}

export interface AntigravityAccount extends BaseAccount {
    platform: 'antigravity';
    token: AntigravityTokenData;
    quota?: AntigravityQuotaData;
    // Security & Proxy
    is_forbidden: boolean;
    proxy_id?: string;
    // Device
    device_profile?: DeviceProfile;
}

// --- Kiro Specifics ---
export type KiroIdpType = 'Google' | 'Github' | 'BuilderId' | 'AWSIdC' | 'Enterprise';
export type KiroSubscriptionType = 'Free' | 'Pro' | 'Ultra' | 'Enterprise';
export type KiroAccountStatus = 'active' | 'error' | 'refreshing' | 'unknown' | 'banned';

export interface KiroCredentials {
    accessToken: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    region?: string;
    expiresAt?: number;
    authMethod?: 'social' | 'oidc' | 'sso'; // Social (Google/GitHub), OIDC (BuilderId), SSO (imported)
    provider?: string; // For distinguishing same email different providers
}

export interface KiroSubscription {
    type: KiroSubscriptionType;
    title?: string; // Display name like "Kiro Pro"
    expiresAt?: number;
    daysRemaining?: number;
    autoRenew?: boolean;
}

export interface KiroUsageBonus {
    amount: number;
    reason: string;
    expiresAt?: number;
}

export interface KiroUsage {
    current: number;
    limit: number;
    percentUsed: number;
    lastUpdated: number;
    // Detailed breakdown
    baseLimit?: number;
    baseCurrent?: number;
    freeTrialLimit?: number;
    freeTrialCurrent?: number;
    freeTrialExpiry?: string;
    bonuses?: KiroUsageBonus[];
    nextResetDate?: string;
    resourceDetail?: string; // e.g., "Conversation Turns"
}

export interface KiroAccount extends BaseAccount {
    platform: 'kiro';
    // Identity
    idp: KiroIdpType;
    userId?: string;
    // Credentials
    credentials: KiroCredentials;
    // Security
    machineId?: string; // Bound machine ID
    // Billing
    subscription: KiroSubscription;
    usage: KiroUsage;
    // Status
    status: KiroAccountStatus;
    lastError?: string;
    lastCheckedAt?: number;
    // Organization (optional)
    groupId?: string;
    tags?: string[];
}

// --- Claude Specifics ---
export interface ClaudeEnvConfig {
  env: {
    "ANTHROPIC_API_KEY"?: string
    "ANTHROPIC_AUTH_TOKEN"?: string
    "ANTHROPIC_BASE_URL"?: string
    "ANTHROPIC_MODEL"?: string
    "ANTHROPIC_DEFAULT_HAIKU_MODEL"?: string
    "ANTHROPIC_DEFAULT_SONNET_MODEL"?: string
    "ANTHROPIC_DEFAULT_OPUS_MODEL"?: string
    [key: string]: any
  }
}

export interface ClaudeAccount extends BaseAccount {
    platform: 'claude';
    providerId?: string;  // 关联的 Provider ID
    config: ClaudeEnvConfig;
}

// --- Codex Specifics ---
export interface AuthJson {
  OPENAI_API_KEY?: string
  [key: string]: any
}

export interface ConfigToml {
  model_provider?: string
  model?: string
  model_reasoning_effort?: string
  disable_response_storage?: boolean
  model_providers?: {
    [key: string]: {
      name?: string
      base_url?: string
      wire_api?: string
      requires_openai_auth?: boolean
      [key: string]: any
    }
  }
  [key: string]: any
}

export interface CodexConfig {
  auth: AuthJson
  config: ConfigToml
  [key: string]: any
}

export interface CodexAccount extends BaseAccount {
    platform: 'codex';
    providerId?: string;  // 关联的 Provider ID
    config: CodexConfig;
}

// --- Gemini Specifics ---
export interface EnvConfig {
  GOOGLE_GEMINI_BASE_URL?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  [key: string]: any
}

export interface ConfigJson {
  [key: string]: any
}

export interface SettingsJson {
  ide?: {
    enabled?: boolean
    [key: string]: any
  }
  security?: {
    auth?: {
      selectedType?: string
      [key: string]: any
    }
    [key: string]: any
  }
  [key: string]: any
}

export interface GeminiConfig {
  env?: EnvConfig
  config: ConfigJson
  settings: SettingsJson
  [key: string]: any
}

export interface GeminiAccount extends BaseAccount {
    platform: 'gemini';
    providerId?: string;  // 关联的 Provider ID
    config: GeminiConfig;
}

// --- Union Type ---
export type Account = AntigravityAccount | KiroAccount | ClaudeAccount | CodexAccount | GeminiAccount;
