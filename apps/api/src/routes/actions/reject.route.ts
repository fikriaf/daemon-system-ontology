import type { FastifyPluginAsync } from 'fastify';
import { ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';

export const actionsRejectRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { proposalId: string } }>(
    '/:proposalId/reject',
    async (request, reply) => {
      const { proposalId } = request.params;

      const redisClient = createRedisClient({ host: 'localhost', port: 6381 });
      const proposer = new ActionProposer(redisClient, request.tenantId);
      const proposal = await proposer.getProposal(proposalId);

      if (!proposal) {
        await redisClient.quit();
        return reply.code(404).send({ error: 'Proposal not found or expired' });
      }

      await proposer.deleteProposal(proposalId);
      await redisClient.quit();

      return reply.send({
        proposalId,
        status: 'rejected',
        rejectedBy: request.userId,
        rejectedAt: new Date().toISOString(),
      });
    }
  );
};
