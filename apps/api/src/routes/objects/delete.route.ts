import type { FastifyPluginAsync } from 'fastify';

export const objectsDeleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Params: { type: string; id: string } }>('/:type/:id', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      await fastify.engine.objects.deleteObject(id);
      return reply.code(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        return reply.code(404).send({ error: message });
      }
      throw err;
    }
  });
};
