import type { FastifyPluginAsync } from 'fastify';

// Internal route — only callable by internal services, not public users
export const actionsExecuteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/actions/internal/')) return;
    const internalToken = request.headers['x-internal-token'];
    if (internalToken !== process.env.INTERNAL_TOKEN) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  fastify.post<{
    Body: {
      actionTypeId: string;
      payload: Record<string, unknown>;
      context: { userId: string; legalEntityId: string; roleId: string };
    };
  }>('/internal/execute', async (request, reply) => {
    const { actionTypeId, payload, context } = request.body;
    const result = await fastify.engine.actions.executeAction(actionTypeId, payload, context);
    return reply.send(result);
  });
};
