import { eq, desc, and, gte } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { serverLogs } from '../db/schema.js';

export type LogRow = typeof serverLogs.$inferSelect;

export interface LogFilter {
  tenantId: string;
  service?: string;
  level?: string;
  since?: Date;
  limit?: number;
}

export class LogRepository {
  constructor(private db: DbClient) {}

  async insert(data: {
    tenantId: string;
    service: string;
    level: string;
    method?: string | null;
    path?: string | null;
    statusCode?: number | null;
    responseTimeMs?: number | null;
    message?: string | null;
    loggedAt?: Date;
  }): Promise<LogRow> {
    const [row] = await this.db
      .insert(serverLogs)
      .values({
        ...data,
        loggedAt: data.loggedAt ?? new Date(),
      })
      .returning();
    return row;
  }

  async query(filter: LogFilter): Promise<LogRow[]> {
    const conditions = [eq(serverLogs.tenantId, filter.tenantId)];

    if (filter.service) conditions.push(eq(serverLogs.service, filter.service));
    if (filter.level) conditions.push(eq(serverLogs.level, filter.level));
    if (filter.since) conditions.push(gte(serverLogs.loggedAt, filter.since));

    return this.db
      .select()
      .from(serverLogs)
      .where(and(...conditions))
      .orderBy(desc(serverLogs.loggedAt))
      .limit(filter.limit ?? 200);
  }

  // Cleanup logs older than N days
  async cleanup(olderThanDays = 7): Promise<void> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    await this.db.delete(serverLogs).where(gte(serverLogs.loggedAt, cutoff));
  }
}
