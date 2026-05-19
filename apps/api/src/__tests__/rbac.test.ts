import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Role-based access control', () => {
  let app: FastifyInstance;
  let viewerToken: string;
  let operatorToken: string;
  let adminToken: string;

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

    viewerToken = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'viewer-1',
      roleId: 'viewer',
      legalEntityId: 'ANT',
    });

    operatorToken = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'operator-1',
      roleId: 'operator',
      legalEntityId: 'ANT',
    });

    adminToken = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'admin-1',
      roleId: 'admin',
      legalEntityId: 'ANT',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Objects read — viewer can ────────────────────────────────────────────

  it('viewer can GET /objects/:type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/objects/Shipment',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('viewer can GET /schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/schema',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('viewer can GET /audit/log', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit/log',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  // ─── Objects write — viewer cannot ───────────────────────────────────────

  it('viewer cannot POST /objects/:type (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { properties: { customerId: 'X', name: 'X', legalEntityId: 'ANT' } },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).required).toBe('operator');
  });

  it('viewer cannot DELETE /objects/:type/:id (403)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/objects/Customer/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ─── Actions — viewer cannot propose/approve/reject ───────────────────────

  it('viewer cannot POST /actions/propose (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'X', newStatus: 'InTransit' },
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('viewer cannot POST /actions/:id/approve (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/some-id/approve',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ─── Schema upload — operator cannot ─────────────────────────────────────

  it('operator cannot POST /schema/upload (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { files: ['objectType:\n  apiName: Test\n  primaryKey: id\n  displayName: Test'] },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).required).toBe('admin');
  });

  // ─── Operator can do everything except schema upload ──────────────────────

  it('operator can POST /objects/:type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        properties: { customerId: 'RBAC-001', name: 'RBAC Test', legalEntityId: 'ANT' },
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('operator can POST /actions/propose', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-RBAC', newStatus: 'InTransit' },
      },
    });
    expect(res.statusCode).toBe(202);
  });

  // ─── Admin can upload schema ──────────────────────────────────────────────

  it('admin can POST /schema/upload', async () => {
    const yaml = `objectType:
  apiName: Customer
  displayName: Customer
  primaryKey: customerId
  titleProperty: customerId
  properties:
    - name: customerId
      type: string
      required: true
    - name: name
      type: string
      required: true
    - name: legalEntityId
      type: string
      required: true`;

    const res = await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { files: [yaml] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).status).toBe('reloaded');
  });

  // ─── Invalid/missing role ─────────────────────────────────────────────────

  it('unknown role treated as lowest privilege (403 on write)', async () => {
    const unknownToken = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'stranger',
      roleId: 'unknown-role',
      legalEntityId: 'ANT',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/objects/Customer',
      headers: { authorization: `Bearer ${unknownToken}` },
      payload: { properties: {} },
    });
    expect(res.statusCode).toBe(403);
  });
});
