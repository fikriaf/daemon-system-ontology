import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const CreateBodySchema = z.object({
  properties: z.record(z.unknown()),
});

export const objectsCreateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { type: string } }>('/:type', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const { type } = request.params;
    const body = CreateBodySchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    try {
      const object = await fastify.engine.objects.createObject(type, body.data.properties);
      return reply.code(201).send({ data: object });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Unknown object type')) {
        return reply.code(400).send({ error: message });
      }
      if (message.includes('Validation failed')) {
        return reply.code(422).send({ error: message });
      }
      throw err;
    }
  });
};
