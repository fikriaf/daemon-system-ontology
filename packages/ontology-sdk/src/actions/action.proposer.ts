import type Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface Proposal {
  proposalId: string;
  actionTypeId: string;
  payload: Record<string, unknown>;
  status: 'awaiting_approval';
  createdAt: string;
}

const PROPOSAL_TTL_SECONDS = 86400; // 24 hours

export class ActionProposer {
  constructor(
    private redis: Redis,
    private tenantId: string
  ) {}

  async propose(
    actionTypeId: string,
    payload: Record<string, unknown>
  ): Promise<Proposal> {
    const proposalId = randomUUID();
    const proposal: Proposal = {
      proposalId,
      actionTypeId,
      payload,
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
    };

    await this.redis.set(
      `proposal:${this.tenantId}:${proposalId}`,
      JSON.stringify(proposal),
      'EX',
      PROPOSAL_TTL_SECONDS
    );

    return proposal;
  }

  async getProposal(proposalId: string): Promise<Proposal | null> {
    const raw = await this.redis.get(`proposal:${this.tenantId}:${proposalId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Proposal;
  }

  async deleteProposal(proposalId: string): Promise<void> {
    await this.redis.del(`proposal:${this.tenantId}:${proposalId}`);
  }
}
