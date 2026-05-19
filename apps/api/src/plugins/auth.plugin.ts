import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    roleId: string;
    legalEntityId: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Skip auth on health check
    if (request.url === '/health') return;

    try {
      await request.jwtVerify();
      const payload = request.user as {
        tenantId: string;
        userId: string;
        roleId: string;
        legalEntityId: string;
      };

      request.tenantId = payload.tenantId;
      request.userId = payload.userId;
      request.roleId = payload.roleId;
      request.legalEntityId = payload.legalEntityId;
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(authPlugin);
export { authPlugin };
