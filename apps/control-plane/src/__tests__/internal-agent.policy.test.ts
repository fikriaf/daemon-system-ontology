import { describe, expect, it } from 'vitest';
import { InternalAgentGovernance } from '../internal-agent/governance.js';
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

describe('Internal agent governance', () => {
  it('allows tools in policy, returns allowed true/value, records toolsCalled and allowed audit', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['get_tenant'], tenantIds: ['tenant-a'] })
    );

    const result = await governance.runTool('get_tenant', { tenantId: 'tenant-a' }, async () => ({
      id: 'tenant-a',
    }));

    expect(result).toEqual({ allowed: true, value: { id: 'tenant-a' } });
    expect(governance.getEvidence().toolsCalled).toEqual(['get_tenant']);
    expect(governance.getAudit()).toEqual([{ tool: 'get_tenant', action: 'allowed' }]);
  });

  it('denies tools outside policy and records denied audit', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['get_tenant'] })
    );

    const result = await governance.runTool('query_tenant_logs', {}, async () => 'logs');

    expect(result).toEqual({
      allowed: false,
      denial: 'Tool query_tenant_logs is not allowed by policy.',
    });
    expect(governance.getAudit()).toEqual([
      {
        tool: 'query_tenant_logs',
        action: 'denied',
        reason: 'Tool query_tenant_logs is not allowed by policy.',
      },
    ]);
  });

  it('denies tenant scoped calls outside policy', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['get_tenant'], tenantIds: ['tenant-a'] })
    );

    const result = await governance.runTool('get_tenant', { tenantId: 'tenant-b' }, async () => ({
      id: 'tenant-b',
    }));

    expect(result).toEqual({
      allowed: false,
      denial: 'Tenant tenant-b is outside the allowed internal-agent scope.',
    });
    expect(governance.getAudit()).toEqual([
      {
        tool: 'get_tenant',
        action: 'denied',
        reason: 'Tenant tenant-b is outside the allowed internal-agent scope.',
      },
    ]);
  });

  it('denies tenant scoped tools with missing tenantId under scoped policy and does not run executor', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['get_tenant'], tenantIds: ['tenant-a'] })
    );
    let executorCalled = false;

    const result = await governance.runTool('get_tenant', {}, async () => {
      executorCalled = true;
      return { id: 'tenant-a' };
    });

    expect(result).toEqual({
      allowed: false,
      denial: 'Tool get_tenant requires tenantId under the current internal-agent tenant scope.',
    });
    expect(executorCalled).toBe(false);
    expect(governance.getEvidence().toolsCalled).toEqual([]);
    expect(governance.getAudit()).toEqual([
      {
        tool: 'get_tenant',
        action: 'denied',
        reason: 'Tool get_tenant requires tenantId under the current internal-agent tenant scope.',
      },
    ]);
  });

  it('denies calls above maxToolCalls', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['get_tenant'], maxToolCalls: 1 })
    );

    await governance.runTool('get_tenant', {}, async () => ({ id: 'tenant-a' }));
    const result = await governance.runTool('get_tenant', {}, async () => ({ id: 'tenant-b' }));

    expect(result).toEqual({
      allowed: false,
      denial: 'Internal-agent max tool calls exceeded.',
    });
    expect(governance.getEvidence().toolsCalled).toEqual(['get_tenant']);
    expect(governance.getAudit()).toEqual([
      { tool: 'get_tenant', action: 'allowed' },
      {
        tool: 'get_tenant',
        action: 'denied',
        reason: 'Internal-agent max tool calls exceeded.',
      },
    ]);
  });

  it('records execute errors in audit with reason and rethrows', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['get_tenant'], tenantIds: ['tenant-a'] })
    );

    await expect(
      governance.runTool('get_tenant', { tenantId: 'tenant-a' }, async () => {
        throw new Error('tenant backend unavailable');
      })
    ).rejects.toThrow('tenant backend unavailable');

    expect(governance.getAudit()).toEqual([
      { tool: 'get_tenant', action: 'allowed' },
      { tool: 'get_tenant', action: 'error', reason: 'tenant backend unavailable' },
    ]);
  });

  it('recordEvidence merges tenantIds uniquely, accumulates logs/metrics counts, preserves timeWindowHours', () => {
    const governance = new InternalAgentGovernance(composeInternalAgentPolicy());

    governance.recordEvidence({
      tenantIds: ['tenant-a', 'tenant-b'],
      timeWindowHours: 24,
      records: { logs: 2, metrics: 1 },
    });
    governance.recordEvidence({
      tenantIds: ['tenant-b', 'tenant-c'],
      records: { logs: 3, metrics: 4 },
    });

    expect(governance.getEvidence()).toEqual({
      toolsCalled: [],
      tenantIds: ['tenant-a', 'tenant-b', 'tenant-c'],
      timeWindowHours: 24,
      recordsInspected: { tenants: 0, healthChecks: 0, logs: 5, metrics: 5 },
    });
  });

  it('getEvidence is copy-on-read', async () => {
    const governance = new InternalAgentGovernance(composeInternalAgentPolicy());

    await governance.runTool('list_tenants', {}, async () => ['tenant-a']);
    governance.recordEvidence({
      tenantIds: ['tenant-a'],
      timeWindowHours: 12,
      records: { tenants: 1 },
    });

    const evidence = governance.getEvidence();
    evidence.toolsCalled.push('get_tenant');
    evidence.tenantIds.push('tenant-b');
    evidence.recordsInspected.tenants = 99;
    evidence.timeWindowHours = 24;

    expect(governance.getEvidence()).toEqual({
      toolsCalled: ['list_tenants'],
      tenantIds: ['tenant-a'],
      timeWindowHours: 12,
      recordsInspected: { tenants: 1, healthChecks: 0, logs: 0, metrics: 0 },
    });
  });
});
