import type { InternalAgentPolicy } from './policy.js';

export interface InternalAgentEvidence {
  toolsCalled: string[];
  tenantIds: string[];
  timeWindowHours?: number;
  recordsInspected: {
    tenants: number;
    healthChecks: number;
    logs: number;
    metrics: number;
  };
}

export interface InternalAgentAuditEntry {
  tool: string;
  action: 'allowed' | 'denied' | 'error';
  reason?: string;
}

export interface EvidenceUpdate {
  tenantIds?: string[];
  timeWindowHours?: number;
  records?: Partial<InternalAgentEvidence['recordsInspected']>;
}

export type GovernedToolResult<T> =
  | { allowed: true; value: T }
  | { allowed: false; denial: string };

const TENANT_SCOPED_TOOL_NAMES = new Set<string>([
  'get_tenant',
  'get_tenant_health',
  'get_tenant_metrics',
  'query_tenant_logs',
  'summarize_tenant_incidents',
]);

export class InternalAgentGovernance {
  private readonly allowedTools: Set<string>;
  private readonly allowedTenantIds?: Set<string>;
  private readonly audit: InternalAgentAuditEntry[] = [];
  private readonly tenantIds = new Set<string>();
  private readonly toolsCalled = new Set<string>();
  private callCount = 0;
  private evidence: InternalAgentEvidence = {
    toolsCalled: [],
    tenantIds: [],
    recordsInspected: {
      tenants: 0,
      healthChecks: 0,
      logs: 0,
      metrics: 0,
    },
  };

  constructor(private readonly policy: InternalAgentPolicy) {
    this.allowedTools = new Set(policy.allowedTools);
    this.allowedTenantIds = policy.tenantIds ? new Set(policy.tenantIds) : undefined;
  }

  async runTool<T>(
    toolName: string,
    input: { tenantId?: string },
    execute: () => Promise<T>
  ): Promise<GovernedToolResult<T>> {
    if (!this.allowedTools.has(toolName)) {
      return this.deny(toolName, `Tool ${toolName} is not allowed by policy.`);
    }

    if (this.callCount >= this.policy.maxToolCalls) {
      return this.deny(toolName, 'Internal-agent max tool calls exceeded.');
    }

    if (this.allowedTenantIds && TENANT_SCOPED_TOOL_NAMES.has(toolName) && !input.tenantId) {
      return this.deny(
        toolName,
        `Tool ${toolName} requires tenantId under the current internal-agent tenant scope.`
      );
    }

    if (input.tenantId && this.allowedTenantIds && !this.allowedTenantIds.has(input.tenantId)) {
      return this.deny(
        toolName,
        `Tenant ${input.tenantId} is outside the allowed internal-agent scope.`
      );
    }

    this.callCount += 1;
    this.toolsCalled.add(toolName);
    this.evidence.toolsCalled = [...this.toolsCalled];
    this.audit.push({ tool: toolName, action: 'allowed' });

    try {
      return { allowed: true, value: await execute() };
    } catch (error) {
      this.audit.push({ tool: toolName, action: 'error', reason: getErrorReason(error) });
      throw error;
    }
  }

  recordEvidence(update: EvidenceUpdate): void {
    for (const tenantId of update.tenantIds ?? []) {
      this.tenantIds.add(tenantId);
    }

    this.evidence.tenantIds = [...this.tenantIds];

    if (update.timeWindowHours !== undefined) {
      this.evidence.timeWindowHours = update.timeWindowHours;
    }

    for (const [recordType, count] of Object.entries(update.records ?? {})) {
      this.evidence.recordsInspected[recordType as keyof InternalAgentEvidence['recordsInspected']] +=
        count ?? 0;
    }
  }

  getEvidence(): InternalAgentEvidence {
    return {
      toolsCalled: [...this.evidence.toolsCalled],
      tenantIds: [...this.evidence.tenantIds],
      timeWindowHours: this.evidence.timeWindowHours,
      recordsInspected: { ...this.evidence.recordsInspected },
    };
  }

  getAudit(): InternalAgentAuditEntry[] {
    return this.audit.map((entry) => ({ ...entry }));
  }

  private deny(tool: string, reason: string): GovernedToolResult<never> {
    this.audit.push({ tool, action: 'denied', reason });
    return { allowed: false, denial: reason };
  }
}

function getErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
