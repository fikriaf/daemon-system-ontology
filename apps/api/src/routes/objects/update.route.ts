import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const UpdateBodySchema = z.object({
  properties: z.record(z.unknown()),
});

export const objectsUpdateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.put<{ Params: { type: string; id: string } }>('/:type/:id', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const { type, id } = request.params;
    const body = UpdateBodySchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    try {
      const object = await fastify.engine.objects.updateObject(id, type, body.data.properties);
      return reply.send({ data: object });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        return reply.code(404).send({ error: message });
      }
      if (message.includes('Unknown object type') || message.includes('Validation failed')) {
        return reply.code(422).send({ error: message });
      }
      throw err;
    }
  });
};
