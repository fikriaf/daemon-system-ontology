import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HealthRepository } from './health.repository.js';
import { TenantRepository } from '../tenants/tenant.repository.js';

const HistoryQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
});

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/:id/health/:service — health check history
  fastify.get<{ Params: { id: string; service: string } }>(
    '/:id/health/:service',
    async (request, reply) => {
      const { id, service } = request.params;
      const query = HistoryQuerySchema.parse(request.query);

      const tenantRepo = new TenantRepository(fastify.db);
      const tenant = await tenantRepo.findById(id);
      if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

      const healthRepo = new HealthRepository(fastify.db);
      const history = await healthRepo.getHealthHistory(id, service, query.limit ?? 50);

      // Compute uptime % from history
      const total = history.length;
      const upCount = history.filter(h => h.status === 'up').length;
      const uptimePercent = total > 0 ? Math.round((upCount / total) * 100 * 10) / 10 : null;
      const avgResponseMs = history.length > 0
        ? Math.round(history.reduce((s, h) => s + (h.responseTimeMs ?? 0), 0) / history.length)
        : null;

      return reply.send({
        tenantId: id,
        service,
        uptimePercent,
        avgResponseMs,
        history,
      });
    }
  );

  // GET /tenants/:id/metrics — metrics history
  fastify.get<{ Params: { id: string } }>(
    '/:id/metrics',
    async (request, reply) => {
      const { id } = request.params;
      const query = HistoryQuerySchema.parse(request.query);

      const tenantRepo = new TenantRepository(fastify.db);
      const tenant = await tenantRepo.findById(id);
      if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

      const healthRepo = new HealthRepository(fastify.db);
      const history = await healthRepo.getMetricsHistory(id, query.limit ?? 24);

      return reply.send({ tenantId: id, history });
    }
  );

  // GET /tenants/:id/server-info — server system info history
  fastify.get<{ Params: { id: string } }>(
    '/:id/server-info',
    async (request, reply) => {
      const { id } = request.params;
      const query = HistoryQuerySchema.parse(request.query);

      const tenantRepo = new TenantRepository(fastify.db);
      const tenant = await tenantRepo.findById(id);
      if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

      const healthRepo = new HealthRepository(fastify.db);
      const history = await healthRepo.getServerInfoHistory(id, query.limit ?? 24);

      return reply.send({ tenantId: id, history });
    }
  );
};
