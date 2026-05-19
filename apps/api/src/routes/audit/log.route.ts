import type { FastifyPluginAsync } from 'fastify';

export const auditLogRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/log', async (_request, reply) => {
    return reply.send({
      data: [],
      message: 'Audit log endpoint — full implementation in Wave 2',
    });
  });
};
