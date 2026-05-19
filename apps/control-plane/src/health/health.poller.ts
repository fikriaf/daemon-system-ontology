import type { DbClient } from '../db/client.js';
import { TenantRepository } from '../tenants/tenant.repository.js';
import { HealthRepository } from './health.repository.js';

export interface PollerConfig {
  intervalMs: number; // default 30000 (30s)
  timeoutMs: number;  // default 5000 (5s)
}

export class HealthPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tenantRepo: TenantRepository;
  private healthRepo: HealthRepository;

  constructor(
    private db: DbClient,
    private config: PollerConfig = { intervalMs: 30000, timeoutMs: 5000 }
  ) {
    this.tenantRepo = new TenantRepository(db);
    this.healthRepo = new HealthRepository(db);
  }

  start(): void {
    console.log(`[health-poller] starting — interval ${this.config.intervalMs}ms`);
    this.timer = setInterval(() => this.poll(), this.config.intervalMs);
    // Run immediately on start
    void this.poll();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[health-poller] stopped');
  }

  async poll(): Promise<void> {
    const tenants = await this.tenantRepo.findAll();
    await Promise.allSettled(tenants.map(t => this.checkTenant(t)));
  }

  private async checkTenant(tenant: { id: string; apiUrl: string; agentUrl: string | null }): Promise<void> {
    await Promise.allSettled([
      this.checkService(tenant.id, 'api', `${tenant.apiUrl}/health`),
      tenant.agentUrl
        ? this.checkService(tenant.id, 'agent', `${tenant.agentUrl}/health`)
        : Promise.resolve(),
      this.collectMetrics(tenant.id, tenant.apiUrl),
    ]);
  }

  private async checkService(
    tenantId: string,
    service: string,
    url: string
  ): Promise<void> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const responseTimeMs = Date.now() - start;

      await this.healthRepo.recordHealth({
        tenantId,
        service,
        status: res.ok ? 'up' : 'degraded',
        responseTimeMs,
        httpStatus: res.status,
      });
    } catch (err: unknown) {
      const responseTimeMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      await this.healthRepo.recordHealth({
        tenantId,
        service,
        status: 'down',
        responseTimeMs,
        errorMessage: message.slice(0, 255),
      });
    }
  }

  private async collectMetrics(tenantId: string, apiUrl: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const res = await fetch(`${apiUrl}/metrics`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;

      const data = await res.json() as Record<string, unknown>;
      const usage = data.usage as Record<string, number> | undefined;
      const system = data.system as Record<string, unknown> | undefined;
      const schema = data.schema as Record<string, number> | undefined;

      // Record usage metrics
      await this.healthRepo.recordMetrics({
        tenantId,
        objectsTotal: usage?.objectsTotal,
        proposalsCreated: usage?.proposalsCreated,
        proposalsApproved: usage?.proposalsApproved,
        proposalsRejected: usage?.proposalsRejected,
        schemaObjectTypes: schema?.objectTypes,
        schemaActionTypes: schema?.actionTypes,
      });

      // Record system info
      if (system) {
        await this.healthRepo.recordServerInfo({
          tenantId,
          nodeVersion: system.nodeVersion as string,
          platform: undefined,
          uptimeSeconds: data.uptime as number,
          memUsedMb: system.memUsedMb as number,
          memTotalMb: system.memTotalMb as number,
          cpuUsagePercent: (system.loadAvg as number[])?.[0],
        });
      }
    } catch {
      // Metrics collection failure is non-critical — silently skip
    }
  }
}
