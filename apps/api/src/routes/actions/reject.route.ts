import type { FastifyPluginAsync } from 'fastify';
import { ActionProposer } from '@daemon/ontology-sdk';

export const actionsRejectRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { proposalId: string } }>('/:proposalId/reject', {
    preHandler: fastify.requireRole('operator'),
  }, async (request, reply) => {
    const { proposalId } = request.params;

    const proposer = new ActionProposer(fastify.redis, request.tenantId);
    const proposal = await proposer.getProposal(proposalId);

    if (!proposal) {
      return reply.code(404).send({ error: 'Proposal not found or expired' });
    }

    await proposer.deleteProposal(proposalId);
    await fastify.engine.audit.recordDecision(proposalId, 'rejected', request.userId);

    return reply.send({
      proposalId,
      status: 'rejected',
      rejectedBy: request.userId,
      rejectedAt: new Date().toISOString(),
    });
  });
};
