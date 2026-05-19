import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

export type Role = 'admin' | 'operator' | 'viewer';

// Role hierarchy: higher index = more permissions
const ROLE_HIERARCHY: Role[] = ['viewer', 'operator', 'admin'];

function roleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as Role);
  return idx === -1 ? -1 : idx;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    roleId: string;
    legalEntityId: string;
  }
  interface FastifyInstance {
    requireRole(minRole: Role): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // JWT verification on every request except health
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
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
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Decorator: creates a preHandler that enforces minimum role
  fastify.decorate(
    'requireRole',
    (minRole: Role) =>
      async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (roleLevel(request.roleId) < roleLevel(minRole)) {
          reply.code(403).send({
            error: 'Forbidden',
            required: minRole,
            current: request.roleId,
          });
        }
      }
  );
};

export default fp(authPlugin);
export { authPlugin };
