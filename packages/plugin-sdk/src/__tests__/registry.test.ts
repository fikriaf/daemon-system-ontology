import { describe, expect, it, vi } from 'vitest';
import {
  PluginRegistry,
  SkillRegistry,
  analyticsPlugin,
  createDefaultPluginRegistry,
  createDefaultSkillRegistry,
  defaultPlugins,
  monitoringPlugin,
  ontologyCorePlugin,
  type PluginContext,
} from '../index.js';

function createMockContext(): PluginContext {
  const query = {
    filter: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue([]),
  };

  return {
    tenantId: 'tenant-test',
    engine: {
      objects: { getObject: vi.fn() },
      getRegistry: vi.fn().mockReturnValue({
        toSchema: vi.fn().mockReturnValue({ objectTypes: [], actionTypes: [] }),
        getActionType: vi.fn(),
        validateActionPayload: vi.fn().mockReturnValue([]),
      }),
    },
    client: {
      objects: vi.fn().mockReturnValue(query),
    },
    proposer: {
      propose: vi.fn(),
    },
    redis: {
      set: vi.fn(),
    },
    config: { actionAllowlist: ['transitionShipmentState'] },
  } as unknown as PluginContext;
}

describe('plugin-sdk public API', () => {
  it('exports the built-in plugins in defaultPlugins', () => {
    expect(defaultPlugins.map(plugin => plugin.id)).toEqual([
      'ontology/core',
      'analytics/core',
      'monitoring/core',
    ]);
    expect(ontologyCorePlugin.category).toBe('ontology');
    expect(analyticsPlugin.category).toBe('analytics');
    expect(monitoringPlugin.category).toBe('monitoring');
  });

  it('creates a default plugin registry with all built-in plugins', () => {
    const registry = createDefaultPluginRegistry();

    expect(registry).toBeInstanceOf(PluginRegistry);
    expect(registry.has('ontology/core')).toBe(true);
    expect(registry.has('analytics/core')).toBe(true);
    expect(registry.has('monitoring/core')).toBe(true);
  });

  it('activates selected plugins and builds their tools for a tenant context', async () => {
    const registry = createDefaultPluginRegistry();
    const active = await registry.activate(['ontology/core', 'analytics/core'], createMockContext());

    const toolNames = active.flatMap(plugin => plugin.tools.map(tool => tool.name));
    expect(toolNames).toContain('read_schema');
    expect(toolNames).toContain('read_objects');
    expect(toolNames).toContain('propose_action');
    expect(toolNames).toContain('aggregate_objects');
    expect(toolNames).toContain('generate_report');
    expect(toolNames).not.toContain('check_sla');
  });
});

describe('SkillRegistry defaults', () => {
  it('creates default skills that resolve to plugin ids and prompt text', () => {
    const registry = createDefaultSkillRegistry();

    expect(registry).toBeInstanceOf(SkillRegistry);

    const resolved = registry.resolve(['analytics']);
    expect(resolved.pluginIds).toEqual(['ontology/core', 'analytics/core']);
    expect(resolved.systemPrompt).toContain('analytics');
  });
});
