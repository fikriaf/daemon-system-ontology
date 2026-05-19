import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';

const ProposeBodySchema = z.object({
  actionTypeId: z.string().min(1),
  payload: z.record(z.unknown()),
});

export const actionsProposeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/propose', async (request, reply) => {
    const body = ProposeBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const { actionTypeId, payload } = body.data;

    // Validate action type exists in registry
    const registry = fastify.engine.getRegistry();
    const actionType = registry.getActionType(actionTypeId);
    if (!actionType) {
      return reply.code(400).send({ error: `Unknown action type: "${actionTypeId}"` });
    }

    // Validate payload parameters
    const validationErrors = registry.validateActionPayload(actionTypeId, payload);
    if (validationErrors.length > 0) {
      return reply.code(400).send({ error: 'Validation failed', details: validationErrors });
    }

    // Store proposal in Redis (reuse engine's redis config)
    const redisClient = createRedisClient({ host: 'localhost', port: 6381 });
    const proposer = new ActionProposer(redisClient, request.tenantId);
    const proposal = await proposer.propose(actionTypeId, payload);
    await redisClient.quit();

    return reply.code(202).send(proposal);
  });
};
