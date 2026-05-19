import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ActionExecutor } from '../action/action.executor.js';
import { SchemaRegistry } from '../registry/schema.registry.js';
import type { OntologySchema } from '@daemon/ontology-language';

const testSchema: OntologySchema = {
  objectTypes: [
    {
      apiName: 'Shipment',
      displayName: 'Shipment',
      primaryKey: 'shipmentId',
      titleProperty: 'shipmentId',
      properties: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'status', type: 'enum', values: ['Draft', 'InTransit', 'Delivered'], required: true },
        { name: 'legalEntityId', type: 'string', required: true },
      ],
    },
  ],
  linkTypes: [],
  actionTypes: [
    {
      apiName: 'transitionShipmentState',
      displayName: 'Transition Shipment State',
      targetObjectType: 'Shipment',
      requiresApproval: true,
      parameters: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'newStatus', type: 'enum', values: ['InTransit', 'Delivered'], required: true },
      ],
    },
  ],
};

describe('ActionExecutor', () => {
  let executor: ActionExecutor;

  const mockObjectRepo = {
    findById: vi.fn(),
    create: vi.fn(),
    findByType: vi.fn(),
    softDelete: vi.fn(),
  };
  const mockAuditRepo = {
    record: vi.fn().mockResolvedValue({ id: 'audit-001', actionTypeId: 'transitionShipmentState', status: 'executed' }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
  const mockEventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    const registry = new SchemaRegistry(testSchema);
    executor = new ActionExecutor(
      registry,
      mockObjectRepo as any,
      mockAuditRepo as any,
      mockEventPublisher as any
    );
  });

  it('rejects unknown action type', async () => {
    await expect(
      executor.executeAction('unknownAction', {}, {
        userId: 'user-1',
        legalEntityId: 'ANT',
        roleId: 'operator',
      })
    ).rejects.toThrow('Unknown action type');
  });

  it('rejects invalid payload — missing required param', async () => {
    await expect(
      executor.executeAction(
        'transitionShipmentState',
        { shipmentId: 'SHP-001' }, // missing newStatus
        { userId: 'user-1', legalEntityId: 'ANT', roleId: 'operator' }
      )
    ).rejects.toThrow('Validation failed');
  });

  it('executes valid action and records audit', async () => {
    mockObjectRepo.findByType.mockResolvedValue([{
      id: 'obj-001',
      typeApiName: 'Shipment',
      properties: { shipmentId: 'SHP-001', status: 'Draft', legalEntityId: 'ANT' },
    }]);

    const result = await executor.executeAction(
      'transitionShipmentState',
      { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      { userId: 'user-1', legalEntityId: 'ANT', roleId: 'operator' }
    );

    expect(result.actionTypeId).toBe('transitionShipmentState');
    expect(result.status).toBe('executed');
    expect(mockAuditRepo.record).toHaveBeenCalled();
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'transitionShipmentState.executed',
      expect.objectContaining({ actionTypeId: 'transitionShipmentState' })
    );
  });
});
