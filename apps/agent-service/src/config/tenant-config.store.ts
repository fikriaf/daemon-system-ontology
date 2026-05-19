import type { Redis } from 'ioredis';

export interface TenantAgentConfig {
  /** Model string, format "provider:model-name". Fallback ke AGENT_MODEL env jika tidak diset. */
  agentModel?: string;
  /** Temperature override. Fallback ke AGENT_TEMPERATURE env jika tidak diset. */
  temperature?: number;
  /** System prompt prefix yang di-prepend ke default root prompt */
  systemPromptPrefix?: string;
  /** Action types yang diizinkan untuk tenant ini (Wave 1 ops allowlist) */
  actionAllowlist?: string[];
  /** Skill IDs yang aktif untuk tenant ini */
  activeSkills?: string[];
  /** Plugin IDs tambahan yang aktif untuk tenant ini */
  activePlugins?: string[];
  /** Konfigurasi spesifik plugin */
  pluginConfig?: Record<string, Record<string, unknown>>;
  /** Metadata bebas untuk keperluan bisnis */
  metadata?: Record<string, unknown>;
}

const CONFIG_TTL_SECONDS = 0; // No expiry — persist indefinitely
const KEY_PREFIX = 'tenant:config:';

export class TenantConfigStore {
  constructor(private redis: Redis) {}

  private key(tenantId: string): string {
    return `${KEY_PREFIX}${tenantId}`;
  }

  async get(tenantId: string): Promise<TenantAgentConfig | null> {
    const raw = await this.redis.get(this.key(tenantId));
    if (!raw) return null;
    return JSON.parse(raw) as TenantAgentConfig;
  }

  async set(tenantId: string, config: TenantAgentConfig): Promise<void> {
    if (CONFIG_TTL_SECONDS > 0) {
      await this.redis.set(this.key(tenantId), JSON.stringify(config), 'EX', CONFIG_TTL_SECONDS);
    } else {
      await this.redis.set(this.key(tenantId), JSON.stringify(config));
    }
  }

  async patch(tenantId: string, partial: Partial<TenantAgentConfig>): Promise<TenantAgentConfig> {
    const existing = (await this.get(tenantId)) ?? {};
    const merged = { ...existing, ...partial };
    await this.set(tenantId, merged);
    return merged;
  }

  async delete(tenantId: string): Promise<void> {
    await this.redis.del(this.key(tenantId));
  }
}
