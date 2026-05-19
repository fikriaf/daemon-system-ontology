import type { FastifyPluginAsync } from 'fastify';
import { ActionProposer } from '@daemon/ontology-sdk';

export const actionsProposalsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/proposals', {
    preHandler: fastify.requireRole('viewer'),
  }, async (request, reply) => {
    const proposer = new ActionProposer(fastify.redis, request.tenantId);
    const proposals = await proposer.listByTenant();
    return reply.send({ data: proposals, count: proposals.length });
  });

  fastify.get<{ Params: { proposalId: string } }>('/proposals/:proposalId', {
    preHandler: fastify.requireRole('viewer'),
  }, async (request, reply) => {
    const { proposalId } = request.params;
    const proposer = new ActionProposer(fastify.redis, request.tenantId);
    const proposal = await proposer.getProposal(proposalId);
    if (!proposal) {
      return reply.code(404).send({ error: 'Proposal not found or expired' });
    }
    return reply.send(proposal);
  });
};
