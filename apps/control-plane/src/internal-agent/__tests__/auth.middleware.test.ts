import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { operatorAuth } from '../auth.middleware.js';
import crypto from 'crypto';

describe('Auth Middleware', () => {
  it('rejects without header', async () => {
    const app = Fastify();
    app.route({ method: 'GET', url: '/', preHandler: operatorAuth, handler: async () => 'ok' });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts valid token and populates req.operator', async () => {
    const app = Fastify();
    const token = 'test-token';
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    app.decorate('db', {});
    vi.mock('../../operators/operator.repository.js', () => ({
      OperatorRepository: vi.fn().mockImplementation(() => ({
        findByApiKeyHash: vi.fn().mockResolvedValue({
          id: 'op-1',
          role: 'admin',
          status: 'active',
          tenantIds: []
        })
      }))
    }));

    app.route({
      method: 'GET',
      url: '/',
      preHandler: operatorAuth,
      handler: async (req) => req.operator
    });

    const res = await app.inject({ method: 'GET', url: '/', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe('op-1');
  });
});
