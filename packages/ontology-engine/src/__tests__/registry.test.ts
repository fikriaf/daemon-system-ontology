import { describe, it, expect, beforeEach } from 'vitest';
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
        { name: 'status', type: 'enum', values: ['Draft', 'InTransit'], required: true },
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

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry(testSchema);
  });

  it('finds object type by apiName', () => {
    const objectType = registry.getObjectType('Shipment');
    expect(objectType).toBeDefined();
    expect(objectType?.displayName).toBe('Shipment');
  });

  it('returns undefined for unknown object type', () => {
    const objectType = registry.getObjectType('NonExistent');
    expect(objectType).toBeUndefined();
  });

  it('finds action type by apiName', () => {
    const action = registry.getActionType('transitionShipmentState');
    expect(action).toBeDefined();
    expect(action?.targetObjectType).toBe('Shipment');
  });

  it('returns all object type names', () => {
    const names = registry.getObjectTypeNames();
    expect(names).toContain('Shipment');
  });

  it('validates action payload against schema', () => {
    const errors = registry.validateActionPayload('transitionShipmentState', {
      shipmentId: 'SHP-001',
      newStatus: 'InTransit',
    });
    expect(errors).toHaveLength(0);
  });

  it('returns errors for invalid action payload', () => {
    const errors = registry.validateActionPayload('transitionShipmentState', {
      // missing required shipmentId
      newStatus: 'InTransit',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('throws for unknown action type', () => {
    expect(() =>
      registry.validateActionPayload('unknownAction', {})
    ).toThrow('Unknown action type');
  });
});
