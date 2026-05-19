import { describe, it, expect, vi } from 'vitest';
import { isActionAllowed, getDefaultAllowlist } from '../permissions/action-allowlist.js';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { createReadSchemaTool } from '../tools/ontology/read-schema.tool.js';
import { createProposeActionTool } from '../tools/actions/propose-action.tool.js';
import type { OntologyClient } from '@daemon/ontology-sdk';
import type { OntologyEngine } from '@daemon/ontology-engine';

// ── ActionAllowlist ─────────────────────────────────────────────────────────

describe('ActionAllowlist', () => {
  it('allows action in default allowlist', () => {
    expect(isActionAllowed('transitionShipmentState', getDefaultAllowlist())).toBe(true);
  });

  it('blocks action not in allowlist', () => {
    expect(isActionAllowed('dangerousAction', getDefaultAllowlist())).toBe(false);
  });

  it('allows custom allowlist override', () => {
    const customAllowlist = ['customAction', 'anotherAction'];
    expect(isActionAllowed('customAction', customAllowlist)).toBe(true);
    expect(isActionAllowed('transitionShipmentState', customAllowlist)).toBe(false);
  });
});

// ── ReadObjectsTool ─────────────────────────────────────────────────────────

describe('ReadObjectsTool', () => {
  const mockClient = {
    objects: vi.fn().mockReturnValue({
      filter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue([
        {
          id: 'obj-001',
          typeApiName: 'Shipment',
          properties: { shipmentId: 'SHP-001', status: 'InTransit', legalEntityId: 'ANT' },
        },
      ]),
    }),
  } as unknown as OntologyClient;

  it('creates a langchain tool with correct name', () => {
    const t = createReadObjectsTool(mockClient);
    expect(t.name).toBe('read_objects');
  });

  it('invokes tool and returns objects', async () => {
    const t = createReadObjectsTool(mockClient);
    const result = await t.invoke({
      objectType: 'Shipment',
      filters: { status: 'InTransit' },
      limit: 10,
    });
    expect(result).toContain('SHP-001');
  });

  it('returns helpful message when no results', async () => {
    const emptyClient = {
      objects: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as OntologyClient;
    const t = createReadObjectsTool(emptyClient);
    const result = await t.invoke({ objectType: 'Shipment', filters: {}, limit: 20 });
    expect(result).toContain('No Shipment objects found');
  });
});

// ── ReadSchemaTool ──────────────────────────────────────────────────────────

describe('ReadSchemaTool', () => {
  const mockEngine = {
    getRegistry: vi.fn().mockReturnValue({
      getObjectTypeNames: vi.fn().mockReturnValue(['Shipment', 'Customer']),
      getActionTypeNames: vi.fn().mockReturnValue(['transitionShipmentState']),
    }),
  } as unknown as OntologyEngine;

  it('creates tool with name read_schema', () => {
    const t = createReadSchemaTool(mockEngine);
    expect(t.name).toBe('read_schema');
  });

  it('returns object and action type names', async () => {
    const t = createReadSchemaTool(mockEngine);
    const result = await t.invoke({ include: 'all' });
    expect(result).toContain('Shipment');
    expect(result).toContain('transitionShipmentState');
  });

  it('returns only objectTypes when requested', async () => {
    const t = createReadSchemaTool(mockEngine);
    const result = await t.invoke({ include: 'objectTypes' });
    const parsed = JSON.parse(result);
    expect(parsed.objectTypes).toBeDefined();
    expect(parsed.actionTypes).toBeUndefined();
  });
});

// ── ProposeActionTool ───────────────────────────────────────────────────────

describe('ProposeActionTool', () => {
  const mockRegistry = {
    getActionType: vi.fn().mockReturnValue({
      apiName: 'transitionShipmentState',
      requiresApproval: true,
    }),
    validateActionPayload: vi.fn().mockReturnValue([]),
  };
  const mockEngine = {
    getRegistry: vi.fn().mockReturnValue(mockRegistry),
  } as unknown as OntologyEngine;

  const mockProposer = {
    propose: vi.fn().mockResolvedValue({
      proposalId: 'prop-001',
      actionTypeId: 'transitionShipmentState',
      payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
    }),
  };

  const allowlist = ['transitionShipmentState'];

  it('has name propose_action', () => {
    const t = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    expect(t.name).toBe('propose_action');
  });

  it('proposes action and returns proposal id', async () => {
    const t = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    const result = await t.invoke({
      actionTypeId: 'transitionShipmentState',
      payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      reasoning: 'Shipment has arrived at destination hub',
    });
    expect(result).toContain('prop-001');
    expect(result).toContain('awaiting_approval');
  });

  it('rejects action not in allowlist', async () => {
    const t = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    const result = await t.invoke({
      actionTypeId: 'notAllowedAction',
      payload: {},
      reasoning: 'test',
    });
    expect(result).toContain('not allowed');
  });

  it('rejects invalid payload', async () => {
    mockRegistry.validateActionPayload.mockReturnValueOnce(['Missing required: shipmentId']);
    const t = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    const result = await t.invoke({
      actionTypeId: 'transitionShipmentState',
      payload: {},
      reasoning: 'test',
    });
    expect(result).toContain('Validation failed');
  });

  it('does not call executeAction', async () => {
    const mockEngineWithExecute = {
      getRegistry: vi.fn().mockReturnValue(mockRegistry),
      actions: {
        executeAction: vi.fn(),
      },
    } as unknown as OntologyEngine;

    const t = createProposeActionTool(mockEngineWithExecute, mockProposer as any, allowlist);
    await t.invoke({
      actionTypeId: 'transitionShipmentState',
      payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      reasoning: 'test',
    });

    expect((mockEngineWithExecute as any).actions.executeAction).not.toHaveBeenCalled();
  });
});
