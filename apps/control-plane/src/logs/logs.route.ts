import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LogRepository } from './log.repository.js';
import type { WsBroadcaster } from '../ws/ws.broadcaster.js';

const LogEntrySchema = z.object({
  tenantId: z.string(),
  service: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  method: z.string().optional().nullable(),
  path: z.string().optional().nullable(),
  statusCode: z.number().optional().nullable(),
  responseTimeMs: z.number().optional().nullable(),
  message: z.string().optional().nullable(),
  loggedAt: z.string().optional(),
});

const QuerySchema = z.object({
  service: z.string().optional(),
  level: z.string().optional(),
  since: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

// Route for receiving log pushes from client instances: POST /logs/receive
export const logReceiveRoute: FastifyPluginAsync<{ broadcaster: WsBroadcaster }> = async (
  fastify,
  opts
) => {
  fastify.post('/receive', async (request, reply) => {
    const body = LogEntrySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid log entry', details: body.error.errors });
    }

    const repo = new LogRepository(fastify.db);
    const loggedAt = body.data.loggedAt ? new Date(body.data.loggedAt) : new Date();

    await repo.insert({ ...body.data, loggedAt });

    opts.broadcaster.broadcast({ ...body.data, loggedAt: loggedAt.toISOString() });

    return reply.code(202).send({ status: 'received' });
  });
};

// Route for querying logs per tenant: GET /tenants/:id/logs
export const logQueryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/:id/logs', async (request, reply) => {
    const { id: tenantId } = request.params;
    const query = QuerySchema.parse(request.query);

    const repo = new LogRepository(fastify.db);
    const logs = await repo.query({
      tenantId,
      service: query.service,
      level: query.level,
      since: query.since ? new Date(query.since) : undefined,
      limit: query.limit ?? 200,
    });

    return reply.send({ tenantId, data: logs, count: logs.length });
  });
};
