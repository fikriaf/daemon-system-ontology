import type { FastifyPluginAsync } from 'fastify';

export const schemaReadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/object-types', async (_request, reply) => {
    const registry = fastify.engine.getRegistry();
    const names = registry.getObjectTypeNames();
    return reply.send({ data: names });
  });

  fastify.get('/action-types', async (_request, reply) => {
    const registry = fastify.engine.getRegistry();
    const names = registry.getActionTypeNames();
    return reply.send({ data: names });
  });
};
