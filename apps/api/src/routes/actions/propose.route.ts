import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ActionProposer } from '@daemon/ontology-sdk';

const ProposeBodySchema = z.object({
  actionTypeId: z.string().min(1),
  payload: z.record(z.unknown()),
});

export const actionsProposeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/propose', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const body = ProposeBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const { actionTypeId, payload } = body.data;

    const registry = fastify.engine.getRegistry();
    const actionType = registry.getActionType(actionTypeId);
    if (!actionType) {
      return reply.code(400).send({ error: `Unknown action type: "${actionTypeId}"` });
    }

    const validationErrors = registry.validateActionPayload(actionTypeId, payload);
    if (validationErrors.length > 0) {
      return reply.code(400).send({ error: 'Validation failed', details: validationErrors });
    }

    const proposer = new ActionProposer(fastify.redis, request.tenantId);
    const proposal = await proposer.propose(actionTypeId, payload);

    await fastify.engine.audit.recordProposal(
      proposal.proposalId,
      actionTypeId,
      payload,
      request.userId,
      request.legalEntityId
    );

    return reply.code(202).send(proposal);
  });
};
