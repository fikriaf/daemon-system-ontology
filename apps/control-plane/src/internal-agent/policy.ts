export const INTERNAL_AGENT_TOOL_NAMES = [
  'list_tenants',
  'get_tenant',
  'get_tenant_health',
  'get_tenant_metrics',
  'query_tenant_logs',
  'summarize_tenant_incidents',
] as const;

export type InternalAgentToolName = (typeof INTERNAL_AGENT_TOOL_NAMES)[number];

export interface InternalAgentPolicy {
  profile: 'readonly-operator';
  allowedTools: readonly InternalAgentToolName[];
  tenantIds?: readonly string[];
  maxToolCalls: number;
}

export interface InternalAgentPolicyOverride {
  allowedTools?: string[];
  tenantIds?: string[];
  maxToolCalls?: number;
}

export const READONLY_OPERATOR_POLICY: InternalAgentPolicy = {
  profile: 'readonly-operator',
  allowedTools: INTERNAL_AGENT_TOOL_NAMES,
  maxToolCalls: 12,
};

const readonlyToolNames = new Set<string>(INTERNAL_AGENT_TOOL_NAMES);

function isInternalAgentToolName(toolName: string): toolName is InternalAgentToolName {
  return readonlyToolNames.has(toolName);
}

export function composeInternalAgentPolicy(
  override?: InternalAgentPolicyOverride
): InternalAgentPolicy {
  const requestedMaxToolCalls = override?.maxToolCalls ?? READONLY_OPERATOR_POLICY.maxToolCalls;

  return {
    profile: READONLY_OPERATOR_POLICY.profile,
    allowedTools: override?.allowedTools
      ? [...new Set(override.allowedTools.filter(isInternalAgentToolName))]
      : READONLY_OPERATOR_POLICY.allowedTools,
    tenantIds: override?.tenantIds ? [...new Set(override.tenantIds)] : undefined,
    maxToolCalls: Math.max(0, Math.min(READONLY_OPERATOR_POLICY.maxToolCalls, requestedMaxToolCalls)),
  };
}
