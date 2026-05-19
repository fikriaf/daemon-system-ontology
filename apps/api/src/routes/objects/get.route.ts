import type { FastifyPluginAsync } from 'fastify';

export const objectsGetRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { type: string; id: string };
  }>('/:type/:id', {
    preHandler: fastify.requireRole('viewer'),
  }, async (request, reply) => {
    const { id } = request.params;
    const object = await fastify.engine.objects.getObject(id);
    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }
    return reply.send({ data: object });
  });
};
