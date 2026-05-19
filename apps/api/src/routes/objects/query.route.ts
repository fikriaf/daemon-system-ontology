import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const QueryStringSchema = z.object({
  legalEntityId: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

export const objectsQueryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { type: string };
    Querystring: Record<string, string>;
  }>('/:type', {
    preHandler: fastify.requireRole('viewer'),
  }, async (request, reply) => {
    const { type } = request.params;
    const query = QueryStringSchema.parse(request.query);

    const filters: Record<string, unknown> = {};
    if (query.legalEntityId) {
      filters['legalEntityId'] = query.legalEntityId;
    }

    const results = await fastify.engine.objects.queryObjects(type, filters);
    const limited = query.limit ? results.slice(0, query.limit) : results;

    return reply.send({ data: limited, total: limited.length });
  });
};
