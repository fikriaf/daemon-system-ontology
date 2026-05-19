import { eq, desc, and } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { actionAuditLog } from '../db/schema.js';
import type { ExecutionContext } from './action.validator.js';

export interface AuditRecord {
  id: string;
  actionTypeId: string;
  status: string;
}

export type AuditStatus = 'proposed' | 'approved' | 'rejected' | 'executed';

export class ActionAuditService {
  constructor(private db: DbClient) {}

  // Called when agent proposes an action
  async recordProposal(
    proposalId: string,
    actionTypeId: string,
    payload: Record<string, unknown>,
    proposedBy: string,
    legalEntityId: string
  ): Promise<AuditRecord> {
    const [row] = await this.db
      .insert(actionAuditLog)
      .values({
        id: proposalId,
        actionTypeId,
        payload,
        performedBy: proposedBy,
        legalEntityId,
        status: 'proposed',
        proposedAt: new Date(),
      })
      .returning({
        id: actionAuditLog.id,
        actionTypeId: actionAuditLog.actionTypeId,
        status: actionAuditLog.status,
      });
    return row;
  }

  // Called when operator approves or rejects
  async recordDecision(
    proposalId: string,
    decision: 'approved' | 'rejected',
    decidedBy: string
  ): Promise<void> {
    await this.db
      .update(actionAuditLog)
      .set({
        status: decision,
        decidedAt: new Date(),
        decidedBy,
      })
      .where(eq(actionAuditLog.id, proposalId));
  }

  // Called after successful execution
  async recordExecution(
    proposalId: string,
    objectId?: string
  ): Promise<void> {
    await this.db
      .update(actionAuditLog)
      .set({
        status: 'executed',
        executedAt: new Date(),
        objectId: objectId ?? null,
      })
      .where(eq(actionAuditLog.id, proposalId));
  }

  // Legacy: direct execution without proposal (no HITL)
  async record(
    actionTypeId: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
    objectId?: string
  ): Promise<AuditRecord> {
    const [row] = await this.db
      .insert(actionAuditLog)
      .values({
        actionTypeId,
        payload,
        performedBy: context.userId,
        legalEntityId: context.legalEntityId,
        objectId: objectId ?? null,
        status: 'executed',
        executedAt: new Date(),
        proposedAt: new Date(),
      })
      .returning({
        id: actionAuditLog.id,
        actionTypeId: actionAuditLog.actionTypeId,
        status: actionAuditLog.status,
      });
    return row;
  }

  async query(filters: {
    actionTypeId?: string;
    status?: AuditStatus;
    legalEntityId?: string;
    limit?: number;
  }): Promise<typeof actionAuditLog.$inferSelect[]> {
    const conditions = [];
    if (filters.actionTypeId) {
      conditions.push(eq(actionAuditLog.actionTypeId, filters.actionTypeId));
    }
    if (filters.status) {
      conditions.push(eq(actionAuditLog.status, filters.status));
    }
    if (filters.legalEntityId) {
      conditions.push(eq(actionAuditLog.legalEntityId, filters.legalEntityId));
    }

    const rows = await this.db
      .select()
      .from(actionAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(actionAuditLog.proposedAt))
      .limit(filters.limit ?? 100);

    return rows;
  }

  async getById(id: string): Promise<typeof actionAuditLog.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(actionAuditLog)
      .where(eq(actionAuditLog.id, id));
    return row ?? null;
  }
}
