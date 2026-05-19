import type { TenantRepository } from '../tenants/tenant.repository.js';
import type { HealthRepository } from '../health/health.repository.js';
import type { LogRepository } from '../logs/log.repository.js';
import type { InternalAgentGovernance } from './governance.js';

export interface InternalAgentToolsContext {
  tenantId?: string;
  governance?: InternalAgentGovernance;
  tenantRepository: TenantRepository;
  healthRepository: HealthRepository;
  logRepository: LogRepository;
}

export type ListTenantsResult = { tenants: { id: string }[] } | { error: string };

export interface GetTenantData {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
}
export type GetTenantResult = GetTenantData | { error: string };

export interface GetTenantHealthData {
  status: string;
  lastCheck: Date;
  components: { name: string; status: string; message?: string }[];
}
export type GetTenantHealthResult = GetTenantHealthData | { error: string };

export interface GetTenantMetricsData {
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
  snapshotAt?: Date;
}
export type GetTenantMetricsResult = GetTenantMetricsData | { error: string };

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
}

export interface QueryTenantLogsData {
  entries: LogEntry[];
}
export type QueryTenantLogsResult = QueryTenantLogsData | { error: string };

export interface Incident {
  id: string;
  severity: string;
  summary: string;
  createdAt: Date;
}

export interface SummarizeTenantIncidentsData {
  incidents: Incident[];
}
export type SummarizeTenantIncidentsResult = SummarizeTenantIncidentsData | { error: string };

export async function list_tenants(ctx: InternalAgentToolsContext): Promise<ListTenantsResult> {
  try {
    const tenants = await ctx.tenantRepository.findAll(false);
    ctx.governance?.recordEvidence({ tenantIds: tenants.map((t) => t.id), records: { tenants: tenants.length } });
    return { tenants: tenants.map((t) => ({ id: t.id })) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function get_tenant(
  tenantId: string,
  ctx: InternalAgentToolsContext
): Promise<GetTenantResult | { error: string }> {
  if (!tenantId) {
    return { error: 'tenantId is required' };
  }
  try {
    const tenant = await ctx.tenantRepository.findById(tenantId);
    if (!tenant) {
      return { error: `Tenant ${tenantId} not found` };
    }
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { tenants: 1 } });
    return {
      id: tenant.id,
      name: tenant.displayName,
      status: tenant.status,
      createdAt: tenant.onboardedAt,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function get_tenant_health(
  tenantId: string,
  ctx: InternalAgentToolsContext
): Promise<GetTenantHealthResult | { error: string }> {
  if (!tenantId) {
    return { error: 'tenantId is required' };
  }
  try {
    const [apiHealth, agentHealth] = await Promise.all([
      ctx.healthRepository.getHealthHistory(tenantId, 'api', 1),
      ctx.healthRepository.getHealthHistory(tenantId, 'agent', 1),
    ]);
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { healthChecks: 2 } });
    const api = apiHealth[0];
    const agent = agentHealth[0];
    const components: { name: string; status: string; message?: string }[] = [];
    if (api) {
      components.push({
        name: 'api',
        status: api.status,
        message: api.errorMessage ?? undefined,
      });
    }
    if (agent) {
      components.push({
        name: 'agent',
        status: agent.status,
        message: agent.errorMessage ?? undefined,
      });
    }
    const latestCheck = api ?? agent;
    return {
      status: latestCheck?.status ?? 'unknown',
      lastCheck: latestCheck?.checkedAt ?? new Date(),
      components,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function get_tenant_metrics(
  tenantId: string,
  ctx: InternalAgentToolsContext
): Promise<GetTenantMetricsResult | { error: string }> {
  if (!tenantId) {
    return { error: 'tenantId is required' };
  }
  try {
    const metrics = await ctx.tenantRepository.getLatestMetrics(tenantId);
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { metrics: 1 } });
    if (!metrics) {
      return { error: `No metrics found for tenant ${tenantId}` };
    }
    return {
      apiRequestsTotal: metrics.apiRequestsTotal ?? undefined,
      apiRequestsError: metrics.apiRequestsError ?? undefined,
      apiAvgResponseMs: metrics.apiAvgResponseMs ?? undefined,
      objectsTotal: metrics.objectsTotal ?? undefined,
      proposalsCreated: metrics.proposalsCreated ?? undefined,
      proposalsApproved: metrics.proposalsApproved ?? undefined,
      proposalsRejected: metrics.proposalsRejected ?? undefined,
      agentInvocations: metrics.agentInvocations ?? undefined,
      schemaObjectTypes: metrics.schemaObjectTypes ?? undefined,
      schemaActionTypes: metrics.schemaActionTypes ?? undefined,
      snapshotAt: metrics.snapshotAt ?? undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function query_tenant_logs(
  tenantId: string,
  ctx: InternalAgentToolsContext,
  query?: string,
  limit = 50
): Promise<QueryTenantLogsResult | { error: string }> {
  if (!tenantId) {
    return { error: 'tenantId is required' };
  }
  try {
    const logs = await ctx.logRepository.query({
      tenantId,
      service: query,
      limit,
    });
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { logs: logs.length } });
    return {
      entries: logs.map((log) => ({
        timestamp: log.loggedAt,
        level: log.level,
        message: log.message ?? '',
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function summarize_tenant_incidents(
  tenantId: string,
  ctx: InternalAgentToolsContext
): Promise<SummarizeTenantIncidentsResult | { error: string }> {
  if (!tenantId) {
    return { error: 'tenantId is required' };
  }
  try {
    const [apiHealth, agentHealth] = await Promise.all([
      ctx.healthRepository.getHealthHistory(tenantId, 'api', 20),
      ctx.healthRepository.getHealthHistory(tenantId, 'agent', 20),
    ]);
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { healthChecks: apiHealth.length + agentHealth.length } });
    const incidents: Incident[] = [];
    for (const health of [...apiHealth, ...agentHealth]) {
      if (health.status === 'down') {
        incidents.push({
          id: health.id,
          severity: 'critical',
          summary: `${health.service} health check failed: ${health.errorMessage ?? 'unknown error'}`,
          createdAt: health.checkedAt,
        });
      } else if (health.status === 'degraded') {
        incidents.push({
          id: health.id,
          severity: 'warning',
          summary: `${health.service} health check degraded: ${health.errorMessage ?? 'response time issue'}`,
          createdAt: health.checkedAt,
        });
      }
    }
    incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { incidents: incidents.slice(0, 10) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}