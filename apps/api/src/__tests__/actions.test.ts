import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Actions routes', () => {
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

  it('POST /actions/propose returns proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.proposalId).toBeDefined();
    expect(body.status).toBe('awaiting_approval');
  });

  it('POST /actions/propose rejects unknown action type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'nonExistentAction',
        payload: {},
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /actions/:proposalId/approve executes action', async () => {
    // First propose
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      },
    });
    const { proposalId } = JSON.parse(proposeRes.payload);

    // Then approve
    const approveRes = await app.inject({
      method: 'POST',
      url: `/actions/${proposalId}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(approveRes.statusCode).toBe(200);
    const body = JSON.parse(approveRes.payload);
    expect(body.status).toBe('executed');
  });
});
