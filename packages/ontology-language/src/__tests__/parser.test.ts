import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { ObjectTypeSchema } from '../types/object-type.js';
import { ActionTypeSchema } from '../types/action-type.js';
import { parseObjectTypeFile, parseLinkTypeFile, parseActionTypeFile } from '../parser/ontology.parser.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');

describe('ObjectTypeSchema', () => {
  it('validates a valid object type definition', () => {
    const input = {
      objectType: {
        apiName: 'Shipment',
        displayName: 'Shipment',
        primaryKey: 'shipmentId',
        titleProperty: 'shipmentId',
        properties: [
          { name: 'shipmentId', type: 'string', required: true },
          {
            name: 'status',
            type: 'enum',
            values: ['Draft', 'InTransit', 'Delivered', 'Cancelled'],
            required: true,
          },
          { name: 'legalEntityId', type: 'string', required: true },
        ],
      },
    };

    const result = ObjectTypeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects object type without apiName', () => {
    const input = {
      objectType: {
        displayName: 'Shipment',
        primaryKey: 'shipmentId',
        titleProperty: 'shipmentId',
        properties: [],
      },
    };

    const result = ObjectTypeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects enum property without values array', () => {
    const input = {
      objectType: {
        apiName: 'Shipment',
        displayName: 'Shipment',
        primaryKey: 'shipmentId',
        titleProperty: 'shipmentId',
        properties: [
          { name: 'status', type: 'enum', required: true },
          // missing values array
        ],
      },
    };

    const result = ObjectTypeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('parseObjectTypeFile', () => {
  it('parses a valid object type YAML file', async () => {
    const result = await parseObjectTypeFile(
      join(fixturesDir, 'shipment.object-type.yaml')
    );
    expect(result.apiName).toBe('Shipment');
    expect(result.primaryKey).toBe('shipmentId');
    expect(result.properties).toHaveLength(5);
    const statusProp = result.properties.find(p => p.name === 'status');
    expect(statusProp?.type).toBe('enum');
  });

  it('throws on nonexistent file', async () => {
    await expect(
      parseObjectTypeFile(join(fixturesDir, 'nonexistent.yaml'))
    ).rejects.toThrow();
  });
});

describe('parseLinkTypeFile', () => {
  it('parses a valid link type YAML file', async () => {
    const result = await parseLinkTypeFile(
      join(fixturesDir, 'shipment-customer.link-type.yaml')
    );
    expect(result.apiName).toBe('shipment_customer');
    expect(result.fromObjectType).toBe('Shipment');
    expect(result.toObjectType).toBe('Customer');
    expect(result.cardinality).toBe('MANY_TO_ONE');
  });
});

describe('ActionTypeSchema', () => {
  it('rejects enum parameter without values array', () => {
    const input = {
      actionType: {
        apiName: 'testAction',
        displayName: 'Test Action',
        targetObjectType: 'Shipment',
        parameters: [
          { name: 'status', type: 'enum', required: true },
          // missing values
        ],
      },
    };
    const result = ActionTypeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('parseActionTypeFile', () => {
  it('parses a valid action type YAML file', async () => {
    const result = await parseActionTypeFile(
      join(fixturesDir, 'transition-shipment-state.action-type.yaml')
    );
    expect(result.apiName).toBe('transitionShipmentState');
    expect(result.targetObjectType).toBe('Shipment');
    expect(result.requiresApproval).toBe(true);
    expect(result.parameters).toHaveLength(3);
  });
});
