import { count, eq, isNull, and } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { objects, actionAuditLog } from '../db/schema.js';

export interface ApiMetrics {
  objectsTotal: number;
  proposalsCreated: number;
  proposalsApproved: number;
  proposalsRejected: number;
  actionsExecuted: number;
  schemaObjectTypes: number;
  schemaActionTypes: number;
}

export class MetricsService {
  constructor(private db: DbClient) {}

  async collect(schemaObjectTypes: number, schemaActionTypes: number): Promise<ApiMetrics> {
    // Count objects (non-deleted)
    const [objCount] = await this.db
      .select({ value: count() })
      .from(objects)
      .where(isNull(objects.deletedAt));

    // Count audit log by status
    const [proposed] = await this.db
      .select({ value: count() })
      .from(actionAuditLog)
      .where(eq(actionAuditLog.status, 'proposed'));

    const [approved] = await this.db
      .select({ value: count() })
      .from(actionAuditLog)
      .where(eq(actionAuditLog.status, 'approved'));

    const [rejected] = await this.db
      .select({ value: count() })
      .from(actionAuditLog)
      .where(eq(actionAuditLog.status, 'rejected'));

    const [executed] = await this.db
      .select({ value: count() })
      .from(actionAuditLog)
      .where(eq(actionAuditLog.status, 'executed'));

    return {
      objectsTotal: Number(objCount?.value ?? 0),
      proposalsCreated: Number(proposed?.value ?? 0),
      proposalsApproved: Number(approved?.value ?? 0),
      proposalsRejected: Number(rejected?.value ?? 0),
      actionsExecuted: Number(executed?.value ?? 0),
      schemaObjectTypes,
      schemaActionTypes,
    };
  }
}
