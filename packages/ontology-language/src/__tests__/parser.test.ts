import { describe, it, expect } from 'vitest';
import { ObjectTypeSchema } from '../types/object-type.js';

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
