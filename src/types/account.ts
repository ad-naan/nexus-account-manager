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
export type KiroIdpType = 'Google' | 'Github' | 'BuilderId' | 'Enterprise';
export type KiroSubscriptionType = 'Free' | 'Pro' | 'Enterprise';

export interface KiroSubscription {
    type: KiroSubscriptionType;
    expiresAt?: number;
}

export interface KiroUsage {
    current: number;
    limit: number;
    percentUsed: number;
}

export interface KiroAccount extends BaseAccount {
    platform: 'kiro';
    // Identity
    idp: KiroIdpType;
    userId?: string;
    // Security
    machineId?: string; // Bound machine ID
    // Billing
    subscription: KiroSubscription;
    usage: KiroUsage;
}

// --- Claude Specifics ---
export interface ClaudeAccount extends BaseAccount {
    platform: 'claude';
    config: any;
}

// --- Codex Specifics ---
export interface CodexAccount extends BaseAccount {
    platform: 'codex';
    config: any;
}

// --- Gemini Specifics ---
export interface GeminiAccount extends BaseAccount {
    platform: 'gemini';
    config: any;
}

// --- Union Type ---
export type Account = AntigravityAccount | KiroAccount | ClaudeAccount | CodexAccount | GeminiAccount;
