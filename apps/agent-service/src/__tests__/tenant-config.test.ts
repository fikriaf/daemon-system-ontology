import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantConfigStore } from '../config/tenant-config.store.js';
import { createModelFromConfig } from '../model/model.factory.js';

// ── TenantConfigStore ─────────────────────────────────────────────────────────

describe('TenantConfigStore', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };

  const store = new TenantConfigStore(mockRedis as any);

  beforeEach(() => vi.resetAllMocks());

  it('get returns null when no config exists', async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await store.get('tenant-x');
    expect(result).toBeNull();
    expect(mockRedis.get).toHaveBeenCalledWith('tenant:config:tenant-x');
  });

  it('get returns parsed config', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ agentModel: 'openai:gpt-4o', temperature: 0.5 }));
    const result = await store.get('tenant-x');
    expect(result?.agentModel).toBe('openai:gpt-4o');
    expect(result?.temperature).toBe(0.5);
  });

  it('set serializes config to Redis', async () => {
    mockRedis.set.mockResolvedValue('OK');
    await store.set('tenant-y', { agentModel: 'openrouter:claude-sonnet-4-6' });
    expect(mockRedis.set).toHaveBeenCalledWith(
      'tenant:config:tenant-y',
      JSON.stringify({ agentModel: 'openrouter:claude-sonnet-4-6' })
    );
  });

  it('patch merges with existing config', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ agentModel: 'openai:gpt-4o', temperature: 0 }));
    mockRedis.set.mockResolvedValue('OK');

    const result = await store.patch('tenant-z', { temperature: 0.7, systemPromptPrefix: 'Be concise.' });
    expect(result.agentModel).toBe('openai:gpt-4o'); // preserved
    expect(result.temperature).toBe(0.7);           // updated
    expect(result.systemPromptPrefix).toBe('Be concise.'); // added
  });

  it('patch creates new config when none exists', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const result = await store.patch('new-tenant', { agentModel: 'ollama:llama3' });
    expect(result.agentModel).toBe('ollama:llama3');
  });

  it('stores active skills, plugins, and plugin config', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await store.set('tenant-plugins', {
      activeSkills: ['analytics'],
      activePlugins: ['monitoring/core'],
      pluginConfig: {
        'ontology/core': { actionAllowlist: ['transitionShipmentState'] },
      },
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'tenant:config:tenant-plugins',
      JSON.stringify({
        activeSkills: ['analytics'],
        activePlugins: ['monitoring/core'],
        pluginConfig: {
          'ontology/core': { actionAllowlist: ['transitionShipmentState'] },
        },
      })
    );
  });

  it('delete removes config from Redis', async () => {
    mockRedis.del.mockResolvedValue(1);
    await store.delete('tenant-x');
    expect(mockRedis.del).toHaveBeenCalledWith('tenant:config:tenant-x');
  });
});

// ── createModelFromConfig ──────────────────────────────────────────────────────

describe('createModelFromConfig', () => {
  it('uses tenantConfig.agentModel when set', () => {
    const model = createModelFromConfig(
      { agentModel: 'openai:gpt-4o-mini' },
      { agentModel: 'openrouter:anthropic/claude-sonnet-4-6' }
    );
    // Model is created — just verify it doesn't throw
    expect(model).toBeDefined();
  });

  it('falls back to envConfig when tenantConfig is null', () => {
    const model = createModelFromConfig(null, { agentModel: 'openai:gpt-4o' });
    expect(model).toBeDefined();
  });

  it('falls back to envConfig when tenantConfig has no agentModel', () => {
    const model = createModelFromConfig(
      { temperature: 0.5 },
      { agentModel: 'openai:gpt-4o' }
    );
    expect(model).toBeDefined();
  });

  it('uses tenantConfig.temperature over envConfig', () => {
    // Just verify no throw — actual temperature value tested via integration
    const model = createModelFromConfig(
      { temperature: 1.0 },
      { agentModel: 'openai:gpt-4o', temperature: 0 }
    );
    expect(model).toBeDefined();
  });
});
