import { describe, expect, it } from 'vitest';
import {
  composeInternalAgentPolicy,
  INTERNAL_AGENT_TOOL_NAMES,
  READONLY_OPERATOR_POLICY,
} from '../internal-agent/policy.js';

describe('Internal agent policy composition', () => {
  it('uses the readonly operator default policy', () => {
    const policy = composeInternalAgentPolicy();

    expect(policy.profile).toBe('readonly-operator');
    expect(policy.allowedTools).toEqual([...INTERNAL_AGENT_TOOL_NAMES]);
    expect(policy.allowedTools).toEqual([...READONLY_OPERATOR_POLICY.allowedTools]);
    expect(policy.maxToolCalls).toBe(12);
    expect(policy.tenantIds).toBeUndefined();
  });

  it('intersects requested tools with known read-only tools', () => {
    const policy = composeInternalAgentPolicy({
      allowedTools: ['list_tenants', 'suspend_tenant', 'get_tenant_metrics', 'update_tenant'],
    });

    expect(policy.allowedTools).toEqual(['list_tenants', 'get_tenant_metrics']);
  });

  it('narrows tenant scope to requested tenant ids', () => {
    const policy = composeInternalAgentPolicy({
      tenantIds: ['tenant-a', 'tenant-b'],
    });

    expect(policy.tenantIds).toEqual(['tenant-a', 'tenant-b']);
  });

  it('uses the lower maxToolCalls value and never exceeds 12', () => {
    expect(composeInternalAgentPolicy({ maxToolCalls: 5 }).maxToolCalls).toBe(5);
    expect(composeInternalAgentPolicy({ maxToolCalls: 42 }).maxToolCalls).toBe(12);
    expect(composeInternalAgentPolicy({ maxToolCalls: -3 }).maxToolCalls).toBe(0);
  });

  it('deduplicates requested tools and tenant ids', () => {
    const policy = composeInternalAgentPolicy({
      allowedTools: ['get_tenant', 'get_tenant', 'query_tenant_logs', 'get_tenant'],
      tenantIds: ['tenant-a', 'tenant-b', 'tenant-a'],
    });

    expect(policy.allowedTools).toEqual(['get_tenant', 'query_tenant_logs']);
    expect(policy.tenantIds).toEqual(['tenant-a', 'tenant-b']);
  });

  it('exports exactly the read-only internal agent tool names', () => {
    expect([...INTERNAL_AGENT_TOOL_NAMES]).toEqual([
      'list_tenants',
      'get_tenant',
      'get_tenant_health',
      'get_tenant_metrics',
      'query_tenant_logs',
      'summarize_tenant_incidents',
    ]);
  });
});
