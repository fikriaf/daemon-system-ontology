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

  // ─── POST /actions/propose ────────────────────────────────────────────────

  it('POST /actions/propose returns 202 with proposal', async () => {
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
    expect(body.actionTypeId).toBe('transitionShipmentState');
    expect(body.createdAt).toBeDefined();
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
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('nonExistentAction');
  });

  it('POST /actions/propose requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      payload: { actionTypeId: 'transitionShipmentState', payload: {} },
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── GET /actions/proposals ───────────────────────────────────────────────

  it('GET /actions/proposals lists pending proposals', async () => {
    // Create a proposal first
    await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-LIST', newStatus: 'Delivered' },
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/actions/proposals',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);
  });

  it('GET /actions/proposals requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/actions/proposals' });
    expect(res.statusCode).toBe(401);
  });

  // ─── GET /actions/proposals/:id ───────────────────────────────────────────

  it('GET /actions/proposals/:id returns proposal by id', async () => {
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-GET', newStatus: 'Cancelled' },
      },
    });
    const { proposalId } = JSON.parse(proposeRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/actions/proposals/${proposalId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.proposalId).toBe(proposalId);
    expect(body.status).toBe('awaiting_approval');
  });

  it('GET /actions/proposals/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/actions/proposals/non-existent-id',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── POST /actions/:id/approve ────────────────────────────────────────────

  it('POST /actions/:id/approve executes action and returns status executed', async () => {
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

    const approveRes = await app.inject({
      method: 'POST',
      url: `/actions/${proposalId}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(approveRes.statusCode).toBe(200);
    const body = JSON.parse(approveRes.payload);
    expect(body.status).toBe('executed');
  });

  it('POST /actions/:id/approve returns 404 for unknown proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/non-existent-id/approve',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /actions/:id/approve deletes proposal after execution', async () => {
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-002', newStatus: 'Delivered' },
      },
    });
    const { proposalId } = JSON.parse(proposeRes.payload);

    // Approve
    await app.inject({
      method: 'POST',
      url: `/actions/${proposalId}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Proposal seharusnya sudah hilang dari Redis
    const getRes = await app.inject({
      method: 'GET',
      url: `/actions/proposals/${proposalId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  // ─── POST /actions/:id/reject ─────────────────────────────────────────────

  it('POST /actions/:id/reject deletes proposal and returns rejected status', async () => {
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-003', newStatus: 'Cancelled' },
      },
    });
    const { proposalId } = JSON.parse(proposeRes.payload);

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/actions/${proposalId}/reject`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(rejectRes.statusCode).toBe(200);
    const body = JSON.parse(rejectRes.payload);
    expect(body.status).toBe('rejected');
    expect(body.proposalId).toBe(proposalId);
    expect(body.rejectedBy).toBe('user-1');
    expect(body.rejectedAt).toBeDefined();
  });

  it('POST /actions/:id/reject returns 404 for unknown proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/non-existent-id/reject',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
