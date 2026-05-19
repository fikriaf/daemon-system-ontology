import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

const CUSTOMER_YAML = `objectType:
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

const SHIPMENT_YAML = `objectType:
  apiName: Shipment
  displayName: Shipment
  primaryKey: shipmentId
  titleProperty: shipmentId
  properties:
    - name: shipmentId
      type: string
      required: true
    - name: status
      type: enum
      values: [Draft, InTransit, Delivered, Cancelled]
      required: true
    - name: legalEntityId
      type: string
      required: true`;

const ACTION_YAML = `actionType:
  apiName: transitionShipmentState
  displayName: Transition Shipment State
  targetObjectType: Shipment
  requiresApproval: true
  parameters:
    - name: shipmentId
      type: string
      required: true
    - name: newStatus
      type: enum
      values: [InTransit, Delivered, Cancelled]
      required: true`;

describe('Schema routes', () => {
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
      userId: 'admin-user',
      roleId: 'admin',
      legalEntityId: 'ANT',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── GET /schema ──────────────────────────────────────────────────────────

  it('GET /schema returns full schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/schema',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.objectTypes).toBeDefined();
    expect(body.data.linkTypes).toBeDefined();
    expect(body.data.actionTypes).toBeDefined();
    expect(Array.isArray(body.data.objectTypes)).toBe(true);
  });

  it('GET /schema/object-types returns list of names', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/schema/object-types',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toContain('Customer');
    expect(body.data).toContain('Shipment');
  });

  it('GET /schema/action-types returns list of names', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/schema/action-types',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toContain('transitionShipmentState');
  });

  // ─── POST /schema/upload ──────────────────────────────────────────────────

  it('POST /schema/upload reloads engine with new schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        files: [CUSTOMER_YAML, SHIPMENT_YAML, ACTION_YAML],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('reloaded');
    expect(body.objectTypes).toBe(2);
    expect(body.actionTypes).toBe(1);
    expect(body.uploadedBy).toBe('admin-user');
  });

  it('POST /schema/upload rejects invalid YAML', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        files: ['this is not valid schema yaml: :::'],
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('POST /schema/upload rejects empty files array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { files: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /schema/upload requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/schema/upload',
      payload: { files: [CUSTOMER_YAML] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /schema/upload persists schema — GET /schema reflects new types', async () => {
    // Upload schema with only Customer
    await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { files: [CUSTOMER_YAML] },
    });

    // Verify new schema active
    const res = await app.inject({
      method: 'GET',
      url: '/schema/object-types',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.payload);
    expect(body.data).toContain('Customer');
    // Restore full schema
    await app.inject({
      method: 'POST',
      url: '/schema/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { files: [CUSTOMER_YAML, SHIPMENT_YAML, ACTION_YAML] },
    });
  });
});
