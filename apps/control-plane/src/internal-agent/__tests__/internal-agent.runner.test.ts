import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { InternalAgentRunner, type ToolDefinition } from '../runner.js';
import { READONLY_OPERATOR_POLICY, composeInternalAgentPolicy, type InternalAgentPolicy, type InternalAgentPolicyOverride } from '../policy.js';
import { InternalAgentGovernance, type InternalAgentAuditEntry } from '../governance.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { TenantRepository } from '../../tenants/tenant.repository.js';
import type { HealthRepository } from '../../health/health.repository.js';
import type { LogRepository } from '../../logs/log.repository.js';

describe('internal-agent runner', () => {
  let mockPolicy: InternalAgentPolicy;
  let mockGovernance: InternalAgentGovernance;
  let mockModel: BaseChatModel;
  let mockTools: Record<string, (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>>;
  let mockTenantRepository: TenantRepository;
  let mockHealthRepository: HealthRepository;
  let mockLogRepository: LogRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPolicy = { ...READONLY_OPERATOR_POLICY };
    mockGovernance = new InternalAgentGovernance(mockPolicy);

    mockModel = {
      invoke: vi.fn().mockResolvedValue({
        content: 'Test answer from mock model',
      }),
    } as unknown as BaseChatModel;

    mockTools = {
      list_tenants: vi.fn().mockResolvedValue({ tenants: [{ id: 'tenant-1' }] }),
      get_tenant: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'Test Tenant', status: 'active' }),
      get_tenant_health: vi.fn().mockResolvedValue({ status: 'up', lastCheck: new Date(), components: [] }),
      get_tenant_metrics: vi.fn().mockResolvedValue({ apiRequestsTotal: 100 }),
      query_tenant_logs: vi.fn().mockResolvedValue({ entries: [] }),
      summarize_tenant_incidents: vi.fn().mockResolvedValue({ incidents: [] }),
    };

    mockTenantRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      getLatestMetrics: vi.fn(),
    } as unknown as TenantRepository;

    mockHealthRepository = {
      getHealthHistory: vi.fn().mockResolvedValue([]),
    } as unknown as HealthRepository;

    mockLogRepository = {
      query: vi.fn().mockResolvedValue([]),
    } as unknown as LogRepository;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('policy override application', () => {
    it('applies tool filter from override', () => {
      const override: InternalAgentPolicyOverride = {
        allowedTools: ['list_tenants', 'get_tenant'],
        maxToolCalls: 5,
      };

      const effectivePolicy = composeInternalAgentPolicy(override);

      expect(effectivePolicy.allowedTools).toEqual(['list_tenants', 'get_tenant']);
      expect(effectivePolicy.maxToolCalls).toEqual(5);
      expect(effectivePolicy.profile).toBe('readonly-operator');
    });

    it('applies tenant scope from override', () => {
      const override: InternalAgentPolicyOverride = {
        tenantIds: ['tenant-1', 'tenant-2'],
      };

      const effectivePolicy = composeInternalAgentPolicy(override);

      expect(effectivePolicy.tenantIds).toEqual(['tenant-1', 'tenant-2']);
    });

    it('defaults to readonly operator policy when no override', () => {
      const effectivePolicy = composeInternalAgentPolicy(undefined);

      expect(effectivePolicy.profile).toBe('readonly-operator');
      expect(effectivePolicy.allowedTools).toEqual(READONLY_OPERATOR_POLICY.allowedTools);
      expect(effectivePolicy.maxToolCalls).toBe(READONLY_OPERATOR_POLICY.maxToolCalls);
    });

    it('clamps maxToolCalls to policy limits', () => {
      const overrideHigh: InternalAgentPolicyOverride = { maxToolCalls: 100 };
      const effectivePolicyHigh = composeInternalAgentPolicy(overrideHigh);
      expect(effectivePolicyHigh.maxToolCalls).toBe(12);

      const overrideNegative: InternalAgentPolicyOverride = { maxToolCalls: -5 };
      const effectivePolicyNegative = composeInternalAgentPolicy(overrideNegative);
      expect(effectivePolicyNegative.maxToolCalls).toBe(0);
    });
  });

  describe('governance wrapping', () => {
    it('denies tool calls not in allowed tools', async () => {
      const restrictedPolicy = composeInternalAgentPolicy({ allowedTools: ['list_tenants'] });
      const governance = new InternalAgentGovernance(restrictedPolicy);

      const result = await governance.runTool('get_tenant', { tenantId: 't1' }, async () => ({ id: 't1' }));

      expect(result).toMatchObject({
        allowed: false,
        denial: expect.stringContaining('not allowed by policy'),
      });
    });

    it('denies tenant-scoped tools without tenantId', async () => {
      const limitedTenantPolicy = composeInternalAgentPolicy({ tenantIds: ['tenant-1'] });
      const governance = new InternalAgentGovernance(limitedTenantPolicy);

      const result = await governance.runTool('get_tenant_health', {}, async () => ({ status: 'up' }));

      expect(result).toMatchObject({
        allowed: false,
        denial: expect.stringContaining('requires tenantId'),
      });
    });

    it('denies tools for tenants outside scope', async () => {
      const limitedTenantPolicy = composeInternalAgentPolicy({ tenantIds: ['tenant-1'] });
      const governance = new InternalAgentGovernance(limitedTenantPolicy);

      const result = await governance.runTool('get_tenant', { tenantId: 'tenant-2' }, async () => ({ id: 'tenant-2' }));

      expect(result).toMatchObject({
        allowed: false,
        denial: expect.stringContaining('outside the allowed'),
      });
    });

    it('allows tool calls within policy', async () => {
      const governance = new InternalAgentGovernance(READONLY_OPERATOR_POLICY);

      const result = await governance.runTool('list_tenants', {}, async () => ({ tenants: [] }));

      expect(result).toEqual({ allowed: true, value: { tenants: [] } });
    });

    it('tracks tools called in audit', async () => {
      const governance = new InternalAgentGovernance(READONLY_OPERATOR_POLICY);

      await governance.runTool('list_tenants', {}, async () => ({ tenants: [] }));
      await governance.runTool('get_tenant', { tenantId: 't1' }, async () => ({ id: 't1' }));

      const audit = governance.getAudit();

      expect(audit).toHaveLength(2);
      expect(audit[0]).toEqual({ tool: 'list_tenants', action: 'allowed' });
      expect(audit[1]).toEqual({ tool: 'get_tenant', action: 'allowed' });
    });

    it('records evidence on tool execution', async () => {
      const governance = new InternalAgentGovernance(READONLY_OPERATOR_POLICY);

      await governance.runTool('list_tenants', {}, async () => {
        governance.recordEvidence({ tenantIds: ['t1'], records: { tenants: 1 } });
        return { tenants: [{ id: 't1' }] };
      });

      const evidence = governance.getEvidence();

      expect(evidence.toolsCalled).toContain('list_tenants');
      expect(evidence.tenantIds).toContain('t1');
      expect(evidence.recordsInspected.tenants).toBe(1);
    });
  });

  describe('runner executes tools and populates toolResults', () => {
    it('populates toolResults when model returns tool call', async () => {
      const modelWithToolCall = {
        invoke: vi.fn()
          .mockResolvedValueOnce({
            content: 'Here are the results from the tool call:\n<tool_call>\n<tool_name>list_tenants</tool_name>\n<arguments>{}</arguments>\n</tool_call>',
          })
          .mockResolvedValueOnce({
            content: 'The system has 1 tenant: tenant-1',
          }),
      } as unknown as BaseChatModel;

      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        modelWithToolCall
      );

      const result = await runner.run({
        question: 'List all tenants',
        toolNames: ['list_tenants'],
      });

      expect(Object.keys(result.toolResults)).toContain('list_tenants');
    });

    it('executes multiple tool calls and collects results', async () => {
      const modelWithMultipleToolCalls = {
        invoke: vi.fn()
          .mockResolvedValueOnce({
            content: '<tool_call>\n<tool_name>get_tenant</tool_name>\n<arguments>{"tenantId": "tenant-1"}</arguments>\n</tool_call>',
          })
          .mockResolvedValueOnce({
            content: 'Tenant tenant-1 is active',
          }),
      } as unknown as BaseChatModel;

      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        modelWithMultipleToolCalls
      );

      const result = await runner.run({
        question: 'Get tenant details for tenant-1',
        tenantIds: ['tenant-1'],
        toolNames: ['get_tenant'],
      });

      expect(result.toolResults).toHaveProperty('get_tenant');
    });

    it('returns empty toolResults when no tool calls in response', async () => {
      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        mockModel
      );

      const result = await runner.run({
        question: 'What is the status?',
        toolNames: ['list_tenants'],
      });

      expect(result.toolResults).toEqual({});
    });

    it('tracks audit entries for executed tools', async () => {
      const modelWithToolCall = {
        invoke: vi.fn()
          .mockResolvedValueOnce({
            content: '<tool_call>\n<tool_name>list_tenants</tool_name>\n<arguments>{}</arguments>\n</tool_call>',
          })
          .mockResolvedValueOnce({ content: 'Done' }),
      } as unknown as BaseChatModel;

      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        modelWithToolCall
      );

      const result = await runner.run({ question: 'List tenants' });

      expect(result.audit.some((e) => e.tool === 'list_tenants')).toBe(true);
    });
  });

  describe('runner returns typed response', () => {
    it('returns response with answer, toolResults, evidence, and audit', async () => {
      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        mockModel,
        'You are a test assistant.'
      );

      const result = await runner.run({
        question: 'What is the status?',
        tenantIds: ['tenant-1'],
        toolNames: ['list_tenants'],
      });

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('toolResults');
      expect(result).toHaveProperty('evidence');
      expect(result).toHaveProperty('audit');

      expect(typeof result.answer).toBe('string');
      expect(result.evidence).toHaveProperty('toolsCalled');
      expect(result.evidence).toHaveProperty('tenantIds');
      expect(result.evidence).toHaveProperty('recordsInspected');
      expect(Array.isArray(result.audit)).toBe(true);
    });

    it('returns typed evidence structure', async () => {
      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        mockModel
      );

      const result = await runner.run({ question: 'Test?' });

      expect(result.evidence.recordsInspected).toHaveProperty('tenants');
      expect(result.evidence.recordsInspected).toHaveProperty('healthChecks');
      expect(result.evidence.recordsInspected).toHaveProperty('logs');
      expect(result.evidence.recordsInspected).toHaveProperty('metrics');
    });

    it('returns typed audit entries', async () => {
      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        mockModel
      );

      const result = await runner.run({ question: 'Test?' });

      for (const entry of result.audit) {
        expect(entry).toHaveProperty('tool');
        expect(entry).toHaveProperty('action');
        expect(['allowed', 'denied', 'error']).toContain(entry.action);
      }
    });

    it('handles model errors gracefully', async () => {
      const errorModel = {
        invoke: vi.fn().mockRejectedValue(new Error('Model API error')),
      } as unknown as BaseChatModel;

      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        errorModel
      );

      const result = await runner.run({ question: 'Test?' });

      expect(result.answer).toContain('Error');
      expect(result.answer).toContain('Model API error');
    });
  });

  describe('runTool method wraps governance', () => {
    it('uses governance.runTool to execute tools', async () => {
      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        mockModel
      );

      const result = await runner.runTool('list_tenants');

      expect(result.allowed).toBe(true);
    });

    it('passes tenantId to governance', async () => {
      const runner = new InternalAgentRunner(
        mockPolicy,
        mockGovernance,
        mockTools,
        mockModel
      );

      const result = await runner.runTool('get_tenant', 'tenant-1');

      expect(result.allowed).toBe(true);
    });
  });
});
