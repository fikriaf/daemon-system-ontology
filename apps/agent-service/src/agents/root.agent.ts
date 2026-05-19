import { createDeepAgent, type SubAgent } from 'deepagents';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { createGetObjectTool } from '../tools/ontology/get-object.tool.js';
import { createReadSchemaTool } from '../tools/ontology/read-schema.tool.js';
import { createProposeActionTool } from '../tools/actions/propose-action.tool.js';
import { buildRootSystemPrompt } from '../prompts/root.prompt.js';
import { buildOpsSystemPrompt } from '../prompts/ops.prompt.js';
import { buildFinanceSystemPrompt } from '../prompts/finance.prompt.js';
import { getTenantMemoryStore } from '../memory/tenant.memory.js';
import { getDefaultAllowlist } from '../permissions/action-allowlist.js';

const OPS_ALLOWLIST = [
  'transitionShipmentState',
  'assignExceptionOwner',
  'resolveException',
  'escalateException',
];

export interface RootAgentContext {
  tenantId: string;
  model: string; // e.g. "openai:gpt-4o"
  engine: OntologyEngine;
  client: OntologyClient;
  proposer: ActionProposer;
}

export function createRootAgent(ctx: RootAgentContext) {
  const { tenantId, model, engine, client, proposer } = ctx;

  // Build schema context for system prompt
  const registry = engine.getRegistry();
  const schemaContext = [
    `Object types: ${registry.getObjectTypeNames().join(', ')}`,
    `Action types: ${registry.getActionTypeNames().join(', ')}`,
  ].join('\n');

  // Root-level tools
  const rootTools = [
    createReadSchemaTool(engine),
    createReadObjectsTool(client),
    createProposeActionTool(engine, proposer, getDefaultAllowlist()),
  ];

  // Ops subagent — has propose_action with ops-specific allowlist
  const opsSubagent: SubAgent = {
    name: 'ops-agent',
    description:
      'Handles shipment lifecycle, exception management, and branch operations. Delegate ops-domain tasks here.',
    systemPrompt: buildOpsSystemPrompt(tenantId),
    tools: [
      createReadObjectsTool(client),
      createGetObjectTool(engine),
      createProposeActionTool(engine, proposer, OPS_ALLOWLIST),
    ] as any,
  };

  // Finance subagent — observe-only (Wave 2)
  const financeSubagent: SubAgent = {
    name: 'finance-agent',
    description:
      'Observes intercompany transactions, transfer pricing, and legal entity compliance. Observe-only in Wave 1.',
    systemPrompt: buildFinanceSystemPrompt(tenantId),
    tools: [
      createReadObjectsTool(client),
      createGetObjectTool(engine),
    ] as any,
  };

  return createDeepAgent({
    model,
    tools: rootTools as any,
    systemPrompt: buildRootSystemPrompt(tenantId, schemaContext),
    subagents: [opsSubagent, financeSubagent],
    store: getTenantMemoryStore(tenantId),
  });
}
