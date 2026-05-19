import type { DbClient } from '../db/client.js';
import { actionAuditLog } from '../db/schema.js';
import type { ExecutionContext } from './action.validator.js';

export interface AuditRecord {
  id: string;
  actionTypeId: string;
  status: string;
}

export class ActionAuditService {
  constructor(private db: DbClient) {}

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
}
