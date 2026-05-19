import type { FastifyPluginAsync } from 'fastify';

export const schemaReadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: fastify.requireRole('viewer'),
  }, async (_request, reply) => {
    const registry = fastify.engine.getRegistry();
    return reply.send({ data: registry.toSchema() });
  });

  fastify.get('/object-types', {
    preHandler: fastify.requireRole('viewer'),
  }, async (_request, reply) => {
    const registry = fastify.engine.getRegistry();
    return reply.send({ data: registry.getObjectTypeNames() });
  });

  fastify.get('/action-types', {
    preHandler: fastify.requireRole('viewer'),
  }, async (_request, reply) => {
    const registry = fastify.engine.getRegistry();
    return reply.send({ data: registry.getActionTypeNames() });
  });
};
