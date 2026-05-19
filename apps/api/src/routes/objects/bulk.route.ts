import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const BulkBodySchema = z.object({
  objects: z.array(z.record(z.unknown())).min(1).max(1000),
});

export const objectsBulkRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { type: string } }>('/:type/bulk', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const { type } = request.params;
    const body = BulkBodySchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const results: { index: number; status: 'created' | 'error'; data?: unknown; error?: string }[] = [];

    for (let i = 0; i < body.data.objects.length; i++) {
      try {
        const object = await fastify.engine.objects.createObject(type, body.data.objects[i]);
        results.push({ index: i, status: 'created', data: object });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ index: i, status: 'error', error: message });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const failed = results.filter(r => r.status === 'error').length;

    return reply.code(207).send({ created, failed, results });
  });
};
