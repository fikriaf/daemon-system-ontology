import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildControlPlane } from '../app.js';
import type { FastifyInstance } from 'fastify';

const AUTH = 'Bearer test-internal-secret';
const TEST_SLUG = `acme-corp-${Date.now()}`;

describe('Control Plane — Tenant Registry', () => {
  let app: FastifyInstance;
  let createdTenantId: string;

  beforeAll(async () => {
    app = await buildControlPlane({
      port: 4000,
      dbHost: 'localhost',
      dbPort: 5433,
      dbUser: 'daemon',
      dbPassword: 'daemon_test',
      dbName: 'daemon_control',
      internalSecret: 'test-internal-secret',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ───────────────────────────────────────────────────────────────

  it('GET /health returns ok without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).service).toBe('control-plane');
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  it('GET /tenants returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/tenants' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /tenants returns 401 with wrong secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── POST /tenants ────────────────────────────────────────────────────────

  it('POST /tenants creates a new tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: AUTH },
      payload: {
        slug: TEST_SLUG,
        displayName: 'PT ACME Corp (Test)',
        plan: 'enterprise',
        apiUrl: 'https://acme-test.daemon.com',
        agentUrl: 'https://acme-test-agent.daemon.com',
        vpsProvider: 'aws',
        vpsRegion: 'ap-southeast-1',
        vpsManagedByDaemon: true,
        adminEmail: 'admin@acme.com',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.slug).toBe(TEST_SLUG);
    expect(body.data.status).toBe('active');
    expect(body.data.plan).toBe('enterprise');
    createdTenantId = body.data.id;
  });

  it('POST /tenants returns 409 for duplicate slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: AUTH },
      payload: {
        slug: TEST_SLUG,
        displayName: 'Duplicate',
        apiUrl: 'https://other.daemon.com',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /tenants returns 400 for invalid slug format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: AUTH },
      payload: {
        slug: 'Invalid Slug!',
        displayName: 'Bad',
        apiUrl: 'https://bad.daemon.com',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // ─── GET /tenants ─────────────────────────────────────────────────────────

  it('GET /tenants returns list of active tenants', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: { authorization: AUTH },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);
    // Each tenant has health status fields
    expect(body.data[0]).toHaveProperty('lastApiHealth');
    expect(body.data[0]).toHaveProperty('lastAgentHealth');
  });

  // ─── GET /tenants/:id ─────────────────────────────────────────────────────

  it('GET /tenants/:id returns tenant with metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${createdTenantId}`,
      headers: { authorization: AUTH },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.id).toBe(createdTenantId);
    expect(body.data.slug).toBe(TEST_SLUG);
    expect(body.data).toHaveProperty('latestMetrics');
  });

  it('GET /tenants/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants/00000000-0000-0000-0000-000000000000',
      headers: { authorization: AUTH },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── PUT /tenants/:id ─────────────────────────────────────────────────────

  it('PUT /tenants/:id updates tenant metadata', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/tenants/${createdTenantId}`,
      headers: { authorization: AUTH },
      payload: {
        displayName: 'PT ACME Corp (Updated)',
        notes: 'Enterprise client, priority support',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.displayName).toBe('PT ACME Corp (Updated)');
    expect(body.data.notes).toBe('Enterprise client, priority support');
  });

  // ─── Suspend / Activate ───────────────────────────────────────────────────

  it('POST /tenants/:id/suspend suspends tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${createdTenantId}/suspend`,
      headers: { authorization: AUTH },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).data.status).toBe('suspended');
  });

  it('POST /tenants/:id/activate re-activates tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${createdTenantId}/activate`,
      headers: { authorization: AUTH },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).data.status).toBe('active');
  });

  // ─── DELETE /tenants/:id ─────────────────────────────────────────────────

  it('DELETE /tenants/:id offboards tenant (soft)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/tenants/${createdTenantId}`,
      headers: { authorization: AUTH },
    });
    expect(res.statusCode).toBe(204);
  });

  it('GET /tenants does not include offboarded tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: { authorization: AUTH },
    });

    const body = JSON.parse(res.payload);
    const found = body.data.find((t: { id: string }) => t.id === createdTenantId);
    expect(found).toBeUndefined();
  });

  it('GET /tenants/all includes offboarded tenant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants/all',
      headers: { authorization: AUTH },
    });

    const body = JSON.parse(res.payload);
    const found = body.data.find((t: { id: string }) => t.id === createdTenantId);
    expect(found).toBeDefined();
    expect(found.status).toBe('offboarded');
  });
});
