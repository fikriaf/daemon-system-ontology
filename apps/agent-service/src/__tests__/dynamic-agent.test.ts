import { describe, expect, it, vi } from 'vitest';

vi.mock('deepagents', () => ({
  createDeepAgent: vi.fn((config) => ({ config })),
}));

import { createDeepAgent } from 'deepagents';
import { createRootAgent } from '../agents/root.agent.js';

function createQuery(results: unknown[] = []) {
  return {
    filter: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(results),
  };
}

function createAgentContext(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-test',
    model: {} as any,
    engine: {
      objects: { getObject: vi.fn() },
      getRegistry: vi.fn().mockReturnValue({
        getObjectTypeNames: vi.fn().mockReturnValue(['Shipment']),
        getActionTypeNames: vi.fn().mockReturnValue(['transitionShipmentState']),
        toSchema: vi.fn().mockReturnValue({
          objectTypes: [{ apiName: 'Shipment', displayName: 'Shipment', properties: [] }],
          actionTypes: [{ apiName: 'transitionShipmentState', displayName: 'Transition', parameters: [], requiresApproval: true }],
        }),
        getActionType: vi.fn().mockReturnValue({ apiName: 'transitionShipmentState' }),
        validateActionPayload: vi.fn().mockReturnValue([]),
      }),
    } as any,
    client: {
      objects: vi.fn().mockReturnValue(createQuery()),
    } as any,
    proposer: {
      propose: vi.fn(),
    } as any,
    actionAllowlist: ['transitionShipmentState'],
    ...overrides,
  };
}

describe('createRootAgent dynamic plugins', () => {
  it('activates requested plugins and injects their tools into the root agent', async () => {
    await createRootAgent(createAgentContext({ activePlugins: ['analytics/core'] }) as any);

    const call = vi.mocked(createDeepAgent).mock.calls.at(-1)?.[0] as any;
    const toolNames = call.tools.map((tool: { name: string }) => tool.name);

    expect(toolNames).toContain('read_schema');
    expect(toolNames).toContain('read_objects');
    expect(toolNames).toContain('propose_action');
    expect(toolNames).toContain('aggregate_objects');
    expect(call.systemPrompt).toContain('Analytics Tools Available');
  });

  it('resolves skills into plugins and system prompt extensions', async () => {
    await createRootAgent(createAgentContext({ activeSkills: ['monitoring'] }) as any);

    const call = vi.mocked(createDeepAgent).mock.calls.at(-1)?.[0] as any;
    const toolNames = call.tools.map((tool: { name: string }) => tool.name);

    expect(toolNames).toContain('check_sla');
    expect(toolNames).toContain('detect_anomaly');
    expect(call.systemPrompt).toContain('Monitoring Tools Available');
  });
});
