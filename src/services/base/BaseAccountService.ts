import { logInfo } from '@/lib/logger'
import { BaseAccount } from '@/types/platform'

/**
 * 基础账号服务接口
 * 所有平台服务必须实现此接口
 */
export interface IAccountService {
  // 必须实现的方法
  validateAccount(account: Partial<BaseAccount>): Promise<boolean>
  
  // 可选实现的方法（有默认实现）
  refreshToken?(account: BaseAccount): Promise<BaseAccount>
  getQuota?(account: BaseAccount): Promise<{ used: number; total: number }>
  switchAccount?(account: BaseAccount): Promise<void>
}

/**
 * 基础账号服务抽象类
 * 提供通用功能的默认实现
 */
export abstract class BaseAccountService implements IAccountService {
  protected platformId: string

  constructor(platformId: string) {
    this.platformId = platformId
  }

  // 抽象方法：子类必须实现
  abstract validateAccount(account: Partial<BaseAccount>): Promise<boolean>

  // 通用方法：默认实现，子类可覆盖
  async refreshToken(account: BaseAccount): Promise<BaseAccount> {
    logInfo(`[${this.platformId}] Default refresh token implementation`)
    return account
  }

  async getQuota(_account: BaseAccount): Promise<{ used: number; total: number }> {
    logInfo(`[${this.platformId}] Default quota implementation`)
    return { used: 0, total: 100 }
  }

  async switchAccount(account: BaseAccount): Promise<void> {
    logInfo(`[${this.platformId}] Switching to account: ${account.name}`)
  }
}
