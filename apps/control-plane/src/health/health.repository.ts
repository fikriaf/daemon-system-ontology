import { eq, desc, and } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { healthChecks, metricsSnapshots, serverInfoSnapshots } from '../db/schema.js';

export class HealthRepository {
  constructor(private db: DbClient) {}

  async recordHealth(data: {
    tenantId: string;
    service: string;
    status: string;
    responseTimeMs?: number;
    httpStatus?: number;
    errorMessage?: string;
  }): Promise<void> {
    await this.db.insert(healthChecks).values(data);
  }

  async recordMetrics(data: {
    tenantId: string;
    apiRequestsTotal?: number;
    apiRequestsError?: number;
    apiAvgResponseMs?: number;
    objectsTotal?: number;
    proposalsCreated?: number;
    proposalsApproved?: number;
    proposalsRejected?: number;
    agentInvocations?: number;
    schemaObjectTypes?: number;
    schemaActionTypes?: number;
  }): Promise<void> {
    await this.db.insert(metricsSnapshots).values(data);
  }

  async recordServerInfo(data: {
    tenantId: string;
    osName?: string;
    nodeVersion?: string;
    uptimeSeconds?: number;
    cpuUsagePercent?: number;
    memUsedMb?: number;
    memTotalMb?: number;
    diskUsedGb?: number;
    diskTotalGb?: number;
    networkRxMbPerSec?: number;
    networkTxMbPerSec?: number;
  }): Promise<void> {
    await this.db.insert(serverInfoSnapshots).values(data);
  }

  async getHealthHistory(tenantId: string, service: string, limit = 50) {
    return this.db
      .select()
      .from(healthChecks)
      .where(and(eq(healthChecks.tenantId, tenantId), eq(healthChecks.service, service)))
      .orderBy(desc(healthChecks.checkedAt))
      .limit(limit);
  }

  async getMetricsHistory(tenantId: string, limit = 24) {
    return this.db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.tenantId, tenantId))
      .orderBy(desc(metricsSnapshots.snapshotAt))
      .limit(limit);
  }

  async getServerInfoHistory(tenantId: string, limit = 24) {
    return this.db
      .select()
      .from(serverInfoSnapshots)
      .where(eq(serverInfoSnapshots.tenantId, tenantId))
      .orderBy(desc(serverInfoSnapshots.snapshotAt))
      .limit(limit);
  }

  // Cleanup old records — keep 7 days health, 30 days metrics
  async cleanup(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await this.db
      .delete(healthChecks)
      .where(eq(healthChecks.checkedAt, sevenDaysAgo));

    await this.db
      .delete(metricsSnapshots)
      .where(eq(metricsSnapshots.snapshotAt, thirtyDaysAgo));
  }
}
