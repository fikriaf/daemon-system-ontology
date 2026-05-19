import type Redis from 'ioredis';
import type { OntologyEngine } from '@daemon/ontology-engine';
import { ObjectQueryBuilder } from '../objects/object.query-builder.js';
import { ActionProposer, type Proposal } from '../actions/action.proposer.js';

export class OntologyClient {
  private proposer?: ActionProposer;

  constructor(
    private engine: OntologyEngine,
    redis?: Redis,
    tenantId?: string
  ) {
    if (redis && tenantId) {
      this.proposer = new ActionProposer(redis, tenantId);
    }
  }

  objects(typeApiName: string): ObjectQueryBuilder {
    return new ObjectQueryBuilder(this.engine, typeApiName);
  }

  get actions() {
    return {
      propose: async (
        actionTypeId: string,
        payload: Record<string, unknown>
      ): Promise<Proposal> => {
        if (!this.proposer) {
          throw new Error('Redis and tenantId required for action proposals');
        }
        return this.proposer.propose(actionTypeId, payload);
      },

      getProposal: async (proposalId: string): Promise<Proposal | null> => {
        if (!this.proposer) return null;
        return this.proposer.getProposal(proposalId);
      },
    };
  }
}
