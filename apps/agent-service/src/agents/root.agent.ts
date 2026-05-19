import { createDeepAgent, type SubAgent } from 'deepagents';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { DynamicAgentBuilder } from '@daemon/plugin-sdk';
import type { Redis } from 'ioredis';
import { buildRootSystemPrompt } from '../prompts/root.prompt.js';
import { buildOpsSystemPrompt } from '../prompts/ops.prompt.js';
import { buildFinanceSystemPrompt } from '../prompts/finance.prompt.js';
import { getTenantMemoryStore } from '../memory/tenant.memory.js';
import { getDefaultAllowlist } from '../permissions/action-allowlist.js';

type AgentInvokeInput = {
  messages: Array<{ role: string; content: string }>;
};

type AgentInvokeResult = {
  messages?: Array<{ content?: unknown }>;
};

export interface RootAgent {
  invoke(input: AgentInvokeInput): Promise<AgentInvokeResult>;
}

export interface RootAgentContext {
  tenantId: string;
  /** Resolved model instance dari createModelFromEnv() */
  model: BaseChatModel;
  engine: OntologyEngine;
  client: OntologyClient;
  proposer: ActionProposer;
  redis?: Redis;
  /** Optional: per-tenant system prompt prefix */
  systemPromptPrefix?: string;
  /** Optional: per-tenant action allowlist — overrides default */
  actionAllowlist?: string[];
  activeSkills?: string[];
  activePlugins?: string[];
  pluginConfig?: Record<string, Record<string, unknown>>;
}

export async function createRootAgent(ctx: RootAgentContext): Promise<RootAgent> {
  const { tenantId, model, engine, client, proposer } = ctx;

  // Per-tenant allowlist overrides default
  const allowlist = ctx.actionAllowlist ?? getDefaultAllowlist();

  // Build schema context for system prompt
  const registry = engine.getRegistry();
  const schemaContext = [
    `Object types: ${registry.getObjectTypeNames().join(', ')}`,
    `Action types: ${registry.getActionTypeNames().join(', ')}`,
  ].join('\n');

  // Prepend per-tenant system prompt if configured
  let rootPrompt = buildRootSystemPrompt(tenantId, schemaContext);
  if (ctx.systemPromptPrefix) {
    rootPrompt = `${ctx.systemPromptPrefix}\n\n${rootPrompt}`;
  }

  const dynamicAgent = await new DynamicAgentBuilder().build(
    {
      tenantId,
      engine,
      client,
      proposer,
      redis: ctx.redis,
      config: { actionAllowlist: allowlist },
    },
    {
      activeSkills: ctx.activeSkills,
      activePlugins: ctx.activePlugins,
      pluginConfig: ctx.pluginConfig,
    }
  );

  if (dynamicAgent.systemPromptExtension) {
    rootPrompt = `${dynamicAgent.systemPromptExtension}\n\n${rootPrompt}`;
  }

  const readObjectsTool = dynamicAgent.tools.find((tool: StructuredToolInterface) => tool.name === 'read_objects');
  const getObjectTool = dynamicAgent.tools.find((tool: StructuredToolInterface) => tool.name === 'get_object');
  const proposeActionTool = dynamicAgent.tools.find((tool: StructuredToolInterface) => tool.name === 'propose_action');

  // Ops subagent — has propose_action with ops-specific allowlist
  const opsSubagent: SubAgent = {
    name: 'ops-agent',
    description:
      'Handles shipment lifecycle, exception management, and branch operations. Delegate ops-domain tasks here.',
    systemPrompt: buildOpsSystemPrompt(tenantId),
    tools: [readObjectsTool, getObjectTool, proposeActionTool].filter(Boolean) as never,
  };

  // Finance subagent — observe-only (Wave 2)
  const financeSubagent: SubAgent = {
    name: 'finance-agent',
    description:
      'Observes intercompany transactions, transfer pricing, and legal entity compliance. Observe-only in Wave 1.',
    systemPrompt: buildFinanceSystemPrompt(tenantId),
    tools: [readObjectsTool, getObjectTool].filter(Boolean) as never,
  };

  return createDeepAgent({
    model,
    tools: dynamicAgent.tools as never,
    systemPrompt: rootPrompt,
    subagents: [opsSubagent, financeSubagent, ...dynamicAgent.subagents],
    store: getTenantMemoryStore(tenantId),
  }) as RootAgent;
}
