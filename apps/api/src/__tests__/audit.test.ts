import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Audit log routes', () => {
  let app: FastifyInstance;
  let token: string;
  let proposalId: string;

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
      userId: 'operator-1',
      roleId: 'operator',
      legalEntityId: 'ANT',
    });

    // Create a proposal to generate audit records
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-AUDIT-001', newStatus: 'InTransit' },
      },
    });
    proposalId = JSON.parse(proposeRes.payload).proposalId;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── GET /audit/log ───────────────────────────────────────────────────────

  it('GET /audit/log returns list of records', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit/log',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);
  });

  it('GET /audit/log?status=proposed returns only proposed records', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit/log?status=proposed',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.every((r: { status: string }) => r.status === 'proposed')).toBe(true);
  });

  it('GET /audit/log?actionTypeId=transitionShipmentState filters by action', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit/log?actionTypeId=transitionShipmentState',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      body.data.every((r: { actionTypeId: string }) => r.actionTypeId === 'transitionShipmentState')
    ).toBe(true);
  });

  it('GET /audit/log?limit=1 respects limit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit/log?limit=1',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  it('GET /audit/log requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit/log' });
    expect(res.statusCode).toBe(401);
  });

  // ─── GET /audit/log/:id ───────────────────────────────────────────────────

  it('GET /audit/log/:id returns specific audit record', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/audit/log/${proposalId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.id).toBe(proposalId);
    expect(body.data.actionTypeId).toBe('transitionShipmentState');
    expect(body.data.status).toBe('proposed');
  });

  it('GET /audit/log/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit/log/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Full lifecycle audit trail ───────────────────────────────────────────

  it('full lifecycle: propose → approve → audit shows executed', async () => {
    // Propose
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-LIFECYCLE', newStatus: 'Delivered' },
      },
    });
    const { proposalId: pid } = JSON.parse(proposeRes.payload);

    // Verify proposed in audit
    const proposedAudit = await app.inject({
      method: 'GET',
      url: `/audit/log/${pid}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(JSON.parse(proposedAudit.payload).data.status).toBe('proposed');

    // Approve
    await app.inject({
      method: 'POST',
      url: `/actions/${pid}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Verify executed in audit
    const executedAudit = await app.inject({
      method: 'GET',
      url: `/audit/log/${pid}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(JSON.parse(executedAudit.payload).data.status).toBe('executed');
    expect(JSON.parse(executedAudit.payload).data.decidedBy).toBe('operator-1');
  });

  it('full lifecycle: propose → reject → audit shows rejected', async () => {
    // Propose
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-REJECTED', newStatus: 'Cancelled' },
      },
    });
    const { proposalId: pid } = JSON.parse(proposeRes.payload);

    // Reject
    await app.inject({
      method: 'POST',
      url: `/actions/${pid}/reject`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Verify rejected in audit
    const rejectedAudit = await app.inject({
      method: 'GET',
      url: `/audit/log/${pid}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const auditData = JSON.parse(rejectedAudit.payload).data;
    expect(auditData.status).toBe('rejected');
    expect(auditData.decidedBy).toBe('operator-1');
  });
});
