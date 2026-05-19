import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Objects routes', () => {
  let app: FastifyInstance;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /objects/:type requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/objects/Shipment',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /objects/:type returns objects for authenticated user', async () => {
    const token = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'user-1',
      roleId: 'operator',
      legalEntityId: 'ANT',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/objects/Shipment',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /health returns ok without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
  });
});
