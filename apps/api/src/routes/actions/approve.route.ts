import type { FastifyPluginAsync } from 'fastify';
import { ActionProposer } from '@daemon/ontology-sdk';

export const actionsApproveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { proposalId: string } }>('/:proposalId/approve', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const { proposalId } = request.params;

    const proposer = new ActionProposer(fastify.redis, request.tenantId);
    const proposal = await proposer.getProposal(proposalId);

    if (!proposal) {
      return reply.code(404).send({ error: 'Proposal not found or expired' });
    }

    const result = await fastify.engine.actions.executeAction(
      proposal.actionTypeId,
      proposal.payload,
      {
        userId: request.userId,
        legalEntityId: request.legalEntityId,
        roleId: request.roleId,
      }
    );

    await fastify.engine.audit.recordDecision(proposalId, 'approved', request.userId);
    await fastify.engine.audit.recordExecution(proposalId);

    await proposer.deleteProposal(proposalId);

    return reply.send(result);
  });
};
