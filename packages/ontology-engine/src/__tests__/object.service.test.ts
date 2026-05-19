import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDbClient } from '../db/client.js';
import { ObjectRepository } from '../object/object.repository.js';
import { ObjectService } from '../object/object.service.js';
import { SchemaRegistry } from '../registry/schema.registry.js';
import type { OntologySchema } from '@daemon/ontology-language';

const testDbConfig = {
  host: 'localhost',
  port: 5433,
  user: 'daemon',
  password: 'daemon_test',
  database: 'daemon_test',
};

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
  actionTypes: [],
};

describe('ObjectService (integration)', () => {
  let db: ReturnType<typeof createDbClient>;
  let service: ObjectService;

  beforeAll(async () => {
    db = createDbClient(testDbConfig);
    const repo = new ObjectRepository(db);
    const registry = new SchemaRegistry(testSchema);
    service = new ObjectService(repo, registry);
  });

  afterAll(async () => {
    // cleanup test data — delete objects created in these tests
    const { objects } = await import('../db/schema.js');
    await db.delete(objects);
  });

  it('creates a new object', async () => {
    const result = await service.createObject('Shipment', {
      shipmentId: 'SHP-TEST-001',
      status: 'Draft',
      legalEntityId: 'ANT',
    });

    expect(result.id).toBeDefined();
    expect(result.typeApiName).toBe('Shipment');
  });

  it('queries objects by type', async () => {
    const results = await service.queryObjects('Shipment', {});
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('queries objects with filter', async () => {
    const results = await service.queryObjects('Shipment', {
      legalEntityId: 'ANT',
    });
    expect(results.every(r => (r.properties as Record<string, unknown>)['legalEntityId'] === 'ANT')).toBe(true);
  });

  it('rejects unknown object type', async () => {
    await expect(
      service.createObject('NonExistent', { id: '1' })
    ).rejects.toThrow('Unknown object type');
  });
});
