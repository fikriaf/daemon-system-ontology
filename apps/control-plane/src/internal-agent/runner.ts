import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { InternalAgentPolicy, InternalAgentPolicyOverride } from './policy.js';
import { composeInternalAgentPolicy } from './policy.js';
import { InternalAgentGovernance } from './governance.js';
import { INTERNAL_AGENT_SYSTEM_PROMPT, createUserPrompt } from './prompt.js';
import type { InternalAgentToolsContext, ListTenantsResult, GetTenantResult, GetTenantHealthResult, GetTenantMetricsResult, QueryTenantLogsResult, SummarizeTenantIncidentsResult } from './tools.js';
import type { TenantRepository } from '../tenants/tenant.repository.js';
import type { HealthRepository } from '../health/health.repository.js';
import type { LogRepository } from '../logs/log.repository.js';

export interface InternalAgentRequest {
  question: string;
  tenantIds?: string[];
  toolNames?: string[];
}

export interface InternalAgentToolResult {
  toolName: string;
  result: unknown;
}

export interface InternalAgentResponse {
  answer: string;
  toolResults: Record<string, unknown>;
  evidence: {
    toolsCalled: string[];
    tenantIds: string[];
    recordsInspected: {
      tenants: number;
      healthChecks: number;
      logs: number;
      metrics: number;
    };
  };
  audit: {
    tool: string;
    action: 'allowed' | 'denied' | 'error';
    reason?: string;
  }[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
  };
}

export class InternalAgentRunner {
  private readonly tenantRepository: TenantRepository;
  private readonly healthRepository: HealthRepository;
  private readonly logRepository: LogRepository;
  private readonly toolDefinitions: ToolDefinition[];

  constructor(
    private readonly policy: InternalAgentPolicy,
    private readonly governance: InternalAgentGovernance,
    private readonly tools: Record<string, (ctx: InternalAgentToolsContext, args: Record<string, unknown>) => Promise<unknown>>,
    private readonly model: BaseChatModel,
    private readonly systemPrompt: string = INTERNAL_AGENT_SYSTEM_PROMPT,
    toolDefinitions: ToolDefinition[] = TOOL_DEFINITIONS
  ) {
    this.tenantRepository = {} as TenantRepository;
    this.healthRepository = {} as HealthRepository;
    this.logRepository = {} as LogRepository;
    this.toolDefinitions = toolDefinitions;
  }

  static create(
    policy: InternalAgentPolicy,
    override: InternalAgentPolicyOverride | undefined,
    repositories: {
      tenantRepository: TenantRepository;
      healthRepository: HealthRepository;
      logRepository: LogRepository;
    },
    model: BaseChatModel
  ): InternalAgentRunner {
    const effectivePolicy = composeInternalAgentPolicy(override);
    const governance = new InternalAgentGovernance(effectivePolicy);

    return new InternalAgentRunner(
      effectivePolicy,
      governance,
      TOOL_IMPLEMENTATIONS,
      model,
      INTERNAL_AGENT_SYSTEM_PROMPT,
      TOOL_DEFINITIONS
    );
  }

  async run(request: InternalAgentRequest): Promise<InternalAgentResponse> {
    const allowedToolNames = request.toolNames ?? [...this.policy.allowedTools];
    const filteredToolDefs = this.toolDefinitions.filter((t) => allowedToolNames.includes(t.name));

    const toolDescriptions = filteredToolDefs
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    const toolSchema = filteredToolDefs
      .map((t) => `### ${t.name}\n${t.description}\nParameters: ${JSON.stringify(t.parameters)}`)
      .join('\n\n');

    const toolResults: Record<string, unknown> = {};
    let callCount = 0;
    const maxIterations = Math.min(this.policy.maxToolCalls, 5);

    const initialPrompt = createUserPrompt({
      question: request.question,
      tenantScope: request.tenantIds ?? [...(this.policy.tenantIds ?? [])],
      availableTools: allowedToolNames,
    });

    let currentPrompt = `${this.systemPrompt}\n\n## Available Tool Definitions\n\n${toolSchema}\n\n## User Request\n${initialPrompt}\n\nWhen you need to use a tool, respond with:\n<tool_call>\n<tool_name>tool_name</tool_name>\n<arguments>{"param": "value"}</arguments>\n</tool_call>\n\nIf you don't need any tools, just provide your answer directly.`;

    try {
      for (let i = 0; i < maxIterations; i++) {
        const response = await this.model.invoke([
          { role: 'user', content: currentPrompt },
        ]);

        const content = typeof response === 'string' ? response : (response.content as string);
        const toolCalls = this.parseToolCalls(content);

        if (toolCalls.length === 0) {
          return {
            answer: content,
            toolResults,
            evidence: this.governance.getEvidence(),
            audit: this.governance.getAudit(),
          };
        }

        for (const call of toolCalls) {
          if (callCount >= this.policy.maxToolCalls) break;

          const result = await this.executeTool(call.name, call.args);
          toolResults[call.name] = result;
          callCount++;
        }

        const resultsText = Object.entries(toolResults)
          .map(([name, result]) => `### ${name} Result\n${JSON.stringify(result, null, 2)}`)
          .join('\n\n');

        currentPrompt = `Previous tool results:\n${resultsText}\n\nPlease provide your final answer based on the tool results above.`;
      }

      const finalResponse = await this.model.invoke([
        { role: 'user', content: currentPrompt },
      ]);

      const finalContent = typeof finalResponse === 'string' ? finalResponse : (finalResponse.content as string);

      return {
        answer: finalContent,
        toolResults,
        evidence: this.governance.getEvidence(),
        audit: this.governance.getAudit(),
      };
    } catch (error) {
      return {
        answer: `Error during internal agent execution: ${error instanceof Error ? error.message : String(error)}`,
        toolResults,
        evidence: this.governance.getEvidence(),
        audit: this.governance.getAudit(),
      };
    }
  }

  private parseToolCalls(content: string): { name: string; args: Record<string, unknown> }[] {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const regex = /<tool_call>\s*<tool_name>([\w_]+)<\/tool_name>\s*<arguments>(.*?)<\/arguments>\s*<\/tool_call>/gs;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      try {
        const args = match[2].trim() ? JSON.parse(match[2]) : {};
        calls.push({ name, args });
      } catch {
        const argMatch = match[2].match(/(\w+)\s*:\s*"?([^",}]+)"?/);
        if (argMatch) {
          const key = argMatch[1];
          const value = argMatch[2];
          const args: Record<string, unknown> = {};
          if (key === 'tenantId' || key === 'query') {
            args[key] = value;
          } else if (key === 'limit') {
            args[key] = parseInt(value, 10);
          }
          calls.push({ name, args });
        }
      }
    }

    return calls;
  }

  private async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools[toolName];
    if (!tool) {
      return { error: `Tool ${toolName} not found` };
    }

    const governed = await this.governance.runTool(
      toolName,
      { tenantId: args.tenantId as string | undefined },
      async () => {
        const ctx: InternalAgentToolsContext = {
          tenantId: args.tenantId as string | undefined,
          governance: this.governance,
          tenantRepository: this.tenantRepository,
          healthRepository: this.healthRepository,
          logRepository: this.logRepository,
        };

        return tool(ctx, args);
      }
    );

    if (governed.allowed) {
      return governed.value;
    } else {
      return { error: governed.denial };
    }
  }

  async runTool<T>(toolName: string, tenantId?: string): Promise<{ allowed: boolean; value?: T; denial?: string }> {
    return this.governance.runTool(toolName, { tenantId }, async () => {
      const tool = this.tools[toolName];
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      const ctx: InternalAgentToolsContext = {
        tenantId,
        governance: this.governance,
        tenantRepository: this.tenantRepository,
        healthRepository: this.healthRepository,
        logRepository: this.logRepository,
      };

      return tool(ctx, {}) as Promise<T>;
    });
  }
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_tenants',
    description: 'List all tenants in the system. Returns simplified tenant objects with only ID.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_tenant',
    description: 'Get detailed information about a specific tenant by ID.',
    parameters: { type: 'object', properties: { tenantId: { type: 'string', description: 'The tenant ID' } }, required: ['tenantId'] },
  },
  {
    name: 'get_tenant_health',
    description: 'Get current health status for a tenant including API and agent components.',
    parameters: { type: 'object', properties: { tenantId: { type: 'string', description: 'The tenant ID' } }, required: ['tenantId'] },
  },
  {
    name: 'get_tenant_metrics',
    description: 'Get latest metrics for a tenant including API requests, objects, proposals, and agent invocations.',
    parameters: { type: 'object', properties: { tenantId: { type: 'string', description: 'The tenant ID' } }, required: ['tenantId'] },
  },
  {
    name: 'query_tenant_logs',
    description: 'Query logs for a specific tenant with optional service filter and limit.',
    parameters: { type: 'object', properties: { tenantId: { type: 'string', description: 'The tenant ID' }, query: { type: 'string', description: 'Optional service filter' }, limit: { type: 'number', description: 'Max entries (default 50)' } }, required: ['tenantId'] },
  },
  {
    name: 'summarize_tenant_incidents',
    description: 'Summarize recent incidents for a tenant based on health check failures.',
    parameters: { type: 'object', properties: { tenantId: { type: 'string', description: 'The tenant ID' } }, required: ['tenantId'] },
  },
];

const TOOL_IMPLEMENTATIONS: Record<string, (ctx: InternalAgentToolsContext, args: Record<string, unknown>) => Promise<unknown>> = {
  list_tenants: async (ctx) => {
    if (!ctx.tenantRepository) return { error: 'Tenant repository not configured' };
    const result = await ctx.tenantRepository.findAll(false);
    ctx.governance?.recordEvidence({ tenantIds: result.map((t) => t.id), records: { tenants: result.length } });
    return { tenants: result.map((t) => ({ id: t.id })) };
  },
  get_tenant: async (ctx, args) => {
    if (!ctx.tenantRepository) return { error: 'Tenant repository not configured' };
    const tenantId = args.tenantId as string;
    if (!tenantId) return { error: 'tenantId is required' };
    const tenant = await ctx.tenantRepository.findById(tenantId);
    if (!tenant) return { error: `Tenant ${tenantId} not found` };
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { tenants: 1 } });
    return { id: tenant.id, name: tenant.displayName, status: tenant.status, createdAt: tenant.onboardedAt };
  },
  get_tenant_health: async (ctx, args) => {
    if (!ctx.healthRepository || !ctx.tenantRepository) return { error: 'Repositories not configured' };
    const tenantId = args.tenantId as string;
    if (!tenantId) return { error: 'tenantId is required' };
    const [apiHealth, agentHealth] = await Promise.all([
      ctx.healthRepository.getHealthHistory(tenantId, 'api', 1),
      ctx.healthRepository.getHealthHistory(tenantId, 'agent', 1),
    ]);
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { healthChecks: 2 } });
    const components = [...apiHealth, ...agentHealth].map((h) => ({ name: h.service, status: h.status, message: h.errorMessage ?? undefined }));
    const latestCheck = [...apiHealth, ...agentHealth][0];
    return { status: latestCheck?.status ?? 'unknown', lastCheck: latestCheck?.checkedAt ?? new Date(), components };
  },
  get_tenant_metrics: async (ctx, args) => {
    if (!ctx.tenantRepository) return { error: 'Tenant repository not configured' };
    const tenantId = args.tenantId as string;
    if (!tenantId) return { error: 'tenantId is required' };
    const metrics = await ctx.tenantRepository.getLatestMetrics(tenantId);
    if (!metrics) return { error: `No metrics found for tenant ${tenantId}` };
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { metrics: 1 } });
    return { apiRequestsTotal: metrics.apiRequestsTotal, apiRequestsError: metrics.apiRequestsError, apiAvgResponseMs: metrics.apiAvgResponseMs, objectsTotal: metrics.objectsTotal, proposalsCreated: metrics.proposalsCreated, proposalsApproved: metrics.proposalsApproved, proposalsRejected: metrics.proposalsRejected, agentInvocations: metrics.agentInvocations, schemaObjectTypes: metrics.schemaObjectTypes, schemaActionTypes: metrics.schemaActionTypes, snapshotAt: metrics.snapshotAt };
  },
  query_tenant_logs: async (ctx, args) => {
    if (!ctx.logRepository) return { error: 'Log repository not configured' };
    const tenantId = args.tenantId as string;
    if (!tenantId) return { error: 'tenantId is required' };
    const logs = await ctx.logRepository.query({ tenantId, service: args.query as string | undefined, limit: (args.limit as number) ?? 50 });
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { logs: logs.length } });
    return { entries: logs.map((l) => ({ timestamp: l.loggedAt, level: l.level, message: l.message ?? '' })) };
  },
  summarize_tenant_incidents: async (ctx, args) => {
    if (!ctx.healthRepository) return { error: 'Health repository not configured' };
    const tenantId = args.tenantId as string;
    if (!tenantId) return { error: 'tenantId is required' };
    const [apiHealth, agentHealth] = await Promise.all([
      ctx.healthRepository.getHealthHistory(tenantId, 'api', 20),
      ctx.healthRepository.getHealthHistory(tenantId, 'agent', 20),
    ]);
    ctx.governance?.recordEvidence({ tenantIds: [tenantId], records: { healthChecks: apiHealth.length + agentHealth.length } });
    const incidents = [...apiHealth, ...agentHealth]
      .filter((h) => h.status === 'down' || h.status === 'degraded')
      .map((h) => ({
        id: h.id,
        severity: h.status === 'down' ? 'critical' : 'warning',
        summary: `${h.service} health check ${h.status}: ${h.errorMessage ?? 'unknown error'}`,
        createdAt: h.checkedAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
    return { incidents };
  },
};