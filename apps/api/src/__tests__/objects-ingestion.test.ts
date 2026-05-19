import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Objects ingestion routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp({
      jwtSecret: 'test-secret',
      redisUrl: 'redis://localhost:6381',
      dbHost: 'localhost',
      dbPort: 5433,
      dbUser: 'daemon',
      dbPassword: 'daemon_test',
      dbName: 'daemon_test',
      schemaDir: '../../packages/ontology-language/src/__tests__/fixtures',
    });

    token = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'user-1',
      roleId: 'operator',
      legalEntityId: 'ANT',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /objects/:type ──────────────────────────────────────────────────

  it('POST /objects/:type creates a new object and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        properties: {
          customerId: 'CUST-001',
          name: 'PT Maju Jaya',
          legalEntityId: 'ANT',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.id).toBeDefined();
    expect(body.data.typeApiName).toBe('Customer');
    expect((body.data.properties as Record<string, unknown>).customerId).toBe('CUST-001');
  });

  it('POST /objects/:type returns 400 for unknown type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/UnknownType',
      headers: { authorization: `Bearer ${token}` },
      payload: { properties: { foo: 'bar' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /objects/:type returns 422 for missing required property', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        properties: {
          customerId: 'CUST-002',
          // name missing — required
          legalEntityId: 'ANT',
        },
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('POST /objects/:type requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      payload: { properties: {} },
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── PUT /objects/:type/:id ───────────────────────────────────────────────

  it('PUT /objects/:type/:id updates an existing object', async () => {
    // Create first
    const createRes = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        properties: {
          customerId: 'CUST-UPDATE',
          name: 'Old Name',
          legalEntityId: 'ANT',
        },
      },
    });
    const { data: created } = JSON.parse(createRes.payload);

    // Update
    const res = await app.inject({
      method: 'PUT',
      url: `/objects/Customer/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        properties: {
          customerId: 'CUST-UPDATE',
          name: 'New Name',
          legalEntityId: 'ANT',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect((body.data.properties as Record<string, unknown>).name).toBe('New Name');
  });

  it('PUT /objects/:type/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/objects/Customer/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        properties: { customerId: 'X', name: 'X', legalEntityId: 'ANT' },
      },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── DELETE /objects/:type/:id ────────────────────────────────────────────

  it('DELETE /objects/:type/:id soft-deletes object and returns 204', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        properties: {
          customerId: 'CUST-DELETE',
          name: 'To Be Deleted',
          legalEntityId: 'ANT',
        },
      },
    });
    const { data: created } = JSON.parse(createRes.payload);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/objects/Customer/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    // Should not be findable anymore
    const getRes = await app.inject({
      method: 'GET',
      url: `/objects/Customer/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /objects/:type/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/objects/Customer/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── POST /objects/:type/bulk ─────────────────────────────────────────────

  it('POST /objects/:type/bulk creates multiple objects and returns 207', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer/bulk',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        objects: [
          { customerId: 'BULK-001', name: 'Bulk Customer 1', legalEntityId: 'ANT' },
          { customerId: 'BULK-002', name: 'Bulk Customer 2', legalEntityId: 'ANT' },
          { customerId: 'BULK-003', name: 'Bulk Customer 3', legalEntityId: 'ANT' },
        ],
      },
    });

    expect(res.statusCode).toBe(207);
    const body = JSON.parse(res.payload);
    expect(body.created).toBe(3);
    expect(body.failed).toBe(0);
    expect(body.results).toHaveLength(3);
  });

  it('POST /objects/:type/bulk handles partial failures', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer/bulk',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        objects: [
          { customerId: 'BULK-OK', name: 'Valid', legalEntityId: 'ANT' },
          { customerId: 'BULK-FAIL' }, // missing name + legalEntityId
        ],
      },
    });

    expect(res.statusCode).toBe(207);
    const body = JSON.parse(res.payload);
    expect(body.created).toBe(1);
    expect(body.failed).toBe(1);
  });
});
