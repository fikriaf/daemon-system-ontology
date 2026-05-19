import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AuditStatus } from '@daemon/ontology-engine';

const QuerySchema = z.object({
  actionTypeId: z.string().optional(),
  status: z.enum(['proposed', 'approved', 'rejected', 'executed']).optional(),
  legalEntityId: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

export const auditLogRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/log', {
    preHandler: fastify.requireRole('viewer'),
  }, async (request, reply) => {
    const query = QuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: 'Invalid query params', details: query.error.errors });
    }

    const records = await fastify.engine.audit.query({
      actionTypeId: query.data.actionTypeId,
      status: query.data.status as AuditStatus | undefined,
      legalEntityId: query.data.legalEntityId ?? request.legalEntityId,
      limit: query.data.limit,
    });

    return reply.send({ data: records, count: records.length });
  });

  fastify.get<{ Params: { id: string } }>('/log/:id', {
    preHandler: fastify.requireRole('viewer'),
  }, async (request, reply) => {
    const record = await fastify.engine.audit.getById(request.params.id);
    if (!record) {
      return reply.code(404).send({ error: 'Audit record not found' });
    }
    return reply.send({ data: record });
  });
};
