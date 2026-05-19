# Plan 4: `apps/agent-service` (Deep Agents) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi `apps/agent-service` menggunakan `deepagents` SDK — root agent dengan subagents per domain (ops, finance, network), allowlisted tools, long-term memory per tenant, dan HITL wajib Wave 1 (propose-only, tidak ada execute langsung).

**Architecture:** `deepagents` SDK di atas LangGraph JS. Root agent meng-observe ontology via `OntologyClient`, memanggil deterministic functions via tool, dan meng-propose actions via `ActionProposer`. Setiap domain (ops, finance, network) memiliki subagent terpisah. HITL ditegakkan — agent hanya bisa call `propose_action`, tidak pernah `executeAction`. Memory persisten per tenant via LangGraph Memory Store.

**Tech Stack:** TypeScript, `deepagents` (npm), `@langchain/core`, LangGraph JS, `@daemon/ontology-sdk`, `ioredis`, `zod`, `vitest`.

**Prerequisite:** Plan 1, 2, 3 selesai. `@daemon/ontology-sdk` dan `@daemon/ontology-engine` sudah bisa di-import.

---

## File Map

```
apps/agent-service/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                         ← HTTP server entry (expose agent via REST)
    ├── server.ts                        ← Fastify server untuk agent invocation
    ├── agents/
    │   ├── root.agent.ts                ← Orchestrator — spawn subagents
    │   ├── ops.agent.ts                 ← Shipment, exception, branch domain
    │   ├── finance.agent.ts             ← Interco, transfer pricing domain
    │   └── network.agent.ts            ← LocalHero, hub, partner domain
    ├── tools/
    │   ├── ontology/
    │   │   ├── read-objects.tool.ts     ← Query objects via OntologyClient
    │   │   ├── get-object.tool.ts       ← Get single object by id
    │   │   └── read-schema.tool.ts      ← List object types dan action types
    │   └── actions/
    │       └── propose-action.tool.ts   ← Satu-satunya write tool
    ├── prompts/
    │   ├── root.prompt.ts               ← System prompt root agent
    │   ├── ops.prompt.ts                ← System prompt ops subagent
    │   ├── finance.prompt.ts            ← System prompt finance subagent
    │   └── network.prompt.ts            ← System prompt network subagent
    ├── memory/
    │   └── tenant.memory.ts             ← LangGraph Memory Store per tenant
    ├── permissions/
    │   └── action-allowlist.ts          ← Allowlisted action types per tenant
    └── __tests__/
        ├── tools.test.ts
        └── agent.test.ts
```

---

## Task 1: Scaffold `apps/agent-service`

**Files:**
- Create: `apps/agent-service/package.json`
- Create: `apps/agent-service/tsconfig.json`

- [ ] **Step 1: Buat direktori**

```bash
New-Item -ItemType Directory -Path "apps\agent-service\src\agents" -Force
New-Item -ItemType Directory -Path "apps\agent-service\src\tools\ontology" -Force
New-Item -ItemType Directory -Path "apps\agent-service\src\tools\actions" -Force
New-Item -ItemType Directory -Path "apps\agent-service\src\prompts" -Force
New-Item -ItemType Directory -Path "apps\agent-service\src\memory" -Force
New-Item -ItemType Directory -Path "apps\agent-service\src\permissions" -Force
New-Item -ItemType Directory -Path "apps\agent-service\src\__tests__" -Force
```

- [ ] **Step 2: Buat `apps/agent-service/package.json`**

```json
{
  "name": "@daemon/agent-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.ts",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@daemon/ontology-engine": "workspace:*",
    "@daemon/ontology-sdk": "workspace:*",
    "@daemon/ontology-language": "workspace:*",
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/openai": "^0.3.0",
    "deepagents": "^0.1.0",
    "fastify": "^5.0.0",
    "ioredis": "^5.3.2",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Buat `apps/agent-service/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/__tests__", "dist", "node_modules"]
}
```

- [ ] **Step 4: Install dependencies**

```bash
pnpm install --filter @daemon/agent-service
```

- [ ] **Step 5: Commit**

```bash
git add apps/agent-service/
git commit -m "chore: scaffold agent-service with deepagents"
```

---

## Task 2: Action Allowlist

**Files:**
- Create: `apps/agent-service/src/permissions/action-allowlist.ts`
- Create: `apps/agent-service/src/__tests__/tools.test.ts` (awal)

- [ ] **Step 1: Tulis failing test**

Buat `apps/agent-service/src/__tests__/tools.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isActionAllowed, getDefaultAllowlist } from '../permissions/action-allowlist.js';

describe('ActionAllowlist', () => {
  it('allows action in default allowlist', () => {
    expect(isActionAllowed('transitionShipmentState', getDefaultAllowlist())).toBe(true);
  });

  it('blocks action not in allowlist', () => {
    expect(isActionAllowed('dangerousAction', getDefaultAllowlist())).toBe(false);
  });

  it('allows custom allowlist override', () => {
    const customAllowlist = ['customAction', 'anotherAction'];
    expect(isActionAllowed('customAction', customAllowlist)).toBe(true);
    expect(isActionAllowed('transitionShipmentState', customAllowlist)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/agent-service test
```

Expected: FAIL — `action-allowlist` not found

- [ ] **Step 3: Implementasi `src/permissions/action-allowlist.ts`**

```typescript
// Default Wave 1 allowlist — ops domain core actions
// Diperluas setelah Object Catalog v0.2 selesai
const DEFAULT_WAVE1_ALLOWLIST: readonly string[] = [
  // Shipment
  'transitionShipmentState',
  'assignShipmentException',
  // Exception
  'assignExceptionOwner',
  'resolveException',
  'escalateException',
  // Interco (Wave 2 — listed untuk readiness)
  // 'markIntercoEliminated',
  // 'postIntercoAdjustment',
] as const;

export function getDefaultAllowlist(): string[] {
  return [...DEFAULT_WAVE1_ALLOWLIST];
}

export function isActionAllowed(actionTypeId: string, allowlist: string[]): boolean {
  return allowlist.includes(actionTypeId);
}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/agent-service test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agent-service/src/permissions/ apps/agent-service/src/__tests__/tools.test.ts
git commit -m "feat(agent-service): add action allowlist for Wave 1"
```

---

## Task 3: Ontology Read Tools

**Files:**
- Create: `apps/agent-service/src/tools/ontology/read-objects.tool.ts`
- Create: `apps/agent-service/src/tools/ontology/get-object.tool.ts`
- Create: `apps/agent-service/src/tools/ontology/read-schema.tool.ts`

- [ ] **Step 1: Tambah tests untuk read tools ke `tools.test.ts`**

Tambahkan ke `apps/agent-service/src/__tests__/tools.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { createReadSchemaTool } from '../tools/ontology/read-schema.tool.js';
import type { OntologyClient } from '@daemon/ontology-sdk';

describe('ReadObjectsTool', () => {
  const mockClient = {
    objects: vi.fn().mockReturnValue({
      filter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue([
        {
          id: 'obj-001',
          typeApiName: 'Shipment',
          properties: { shipmentId: 'SHP-001', status: 'InTransit', legalEntityId: 'ANT' },
        },
      ]),
    }),
  } as unknown as OntologyClient;

  it('creates a langchain tool with correct name', () => {
    const tool = createReadObjectsTool(mockClient);
    expect(tool.name).toBe('read_objects');
  });

  it('invokes tool and returns objects', async () => {
    const tool = createReadObjectsTool(mockClient);
    const result = await tool.invoke({
      objectType: 'Shipment',
      filters: { status: 'InTransit' },
      limit: 10,
    });
    expect(result).toContain('SHP-001');
  });
});

describe('ReadSchemaTool', () => {
  const mockEngine = {
    getRegistry: vi.fn().mockReturnValue({
      getObjectTypeNames: vi.fn().mockReturnValue(['Shipment', 'Customer']),
      getActionTypeNames: vi.fn().mockReturnValue(['transitionShipmentState']),
    }),
  };

  it('creates tool with name read_schema', () => {
    const tool = createReadSchemaTool(mockEngine as any);
    expect(tool.name).toBe('read_schema');
  });

  it('returns object and action type names', async () => {
    const tool = createReadSchemaTool(mockEngine as any);
    const result = await tool.invoke({ include: 'all' });
    expect(result).toContain('Shipment');
    expect(result).toContain('transitionShipmentState');
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/agent-service test
```

Expected: FAIL — tools not found

- [ ] **Step 3: Implementasi `src/tools/ontology/read-objects.tool.ts`**

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { OntologyClient } from '@daemon/ontology-sdk';

const ReadObjectsInputSchema = z.object({
  objectType: z.string().describe('The API name of the object type to query, e.g. "Shipment"'),
  filters: z
    .record(z.string())
    .optional()
    .describe('Key-value filters to apply, e.g. { "status": "InTransit" }'),
  limit: z.number().optional().default(20).describe('Maximum number of results to return'),
});

export function createReadObjectsTool(client: OntologyClient) {
  return tool(
    async ({ objectType, filters = {}, limit = 20 }) => {
      const results = await client
        .objects(objectType)
        .filter(filters)
        .limit(limit)
        .get();

      if (results.length === 0) {
        return `No ${objectType} objects found matching filters: ${JSON.stringify(filters)}`;
      }

      return JSON.stringify(results, null, 2);
    },
    {
      name: 'read_objects',
      description:
        'Query ontology objects by type with optional filters. Use this to observe the current state of shipments, customers, exceptions, etc.',
      schema: ReadObjectsInputSchema,
    }
  );
}
```

- [ ] **Step 4: Implementasi `src/tools/ontology/get-object.tool.ts`**

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';

const GetObjectInputSchema = z.object({
  id: z.string().describe('The UUID of the object to retrieve'),
});

export function createGetObjectTool(engine: OntologyEngine) {
  return tool(
    async ({ id }) => {
      const object = await engine.objects.getObject(id);
      if (!object) {
        return `Object with id "${id}" not found.`;
      }
      return JSON.stringify(object, null, 2);
    },
    {
      name: 'get_object',
      description: 'Get a single ontology object by its UUID. Use after read_objects to get full details.',
      schema: GetObjectInputSchema,
    }
  );
}
```

- [ ] **Step 5: Implementasi `src/tools/ontology/read-schema.tool.ts`**

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';

const ReadSchemaInputSchema = z.object({
  include: z
    .enum(['objectTypes', 'actionTypes', 'all'])
    .default('all')
    .describe('Which parts of the schema to return'),
});

export function createReadSchemaTool(engine: OntologyEngine) {
  return tool(
    async ({ include }) => {
      const registry = engine.getRegistry();
      const output: Record<string, string[]> = {};

      if (include === 'objectTypes' || include === 'all') {
        output.objectTypes = registry.getObjectTypeNames();
      }

      if (include === 'actionTypes' || include === 'all') {
        output.actionTypes = registry.getActionTypeNames();
      }

      return JSON.stringify(output, null, 2);
    },
    {
      name: 'read_schema',
      description:
        'Read the ontology schema — list available object types and action types. Use at the start of a session to understand what is available.',
      schema: ReadSchemaInputSchema,
    }
  );
}
```

- [ ] **Step 6: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/agent-service test
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/agent-service/src/tools/ontology/
git commit -m "feat(agent-service): add read-only ontology tools for agent"
```

---

## Task 4: Propose Action Tool (Satu-satunya Write Tool)

**Files:**
- Create: `apps/agent-service/src/tools/actions/propose-action.tool.ts`

- [ ] **Step 1: Tambah test ke `tools.test.ts`**

Tambahkan ke `apps/agent-service/src/__tests__/tools.test.ts`:

```typescript
import { createProposeActionTool } from '../tools/actions/propose-action.tool.js';
import type { OntologyEngine } from '@daemon/ontology-engine';

describe('ProposeActionTool', () => {
  const mockRegistry = {
    getActionType: vi.fn().mockReturnValue({
      apiName: 'transitionShipmentState',
      requiresApproval: true,
    }),
    validateActionPayload: vi.fn().mockReturnValue([]),
  };
  const mockEngine = {
    getRegistry: vi.fn().mockReturnValue(mockRegistry),
  } as unknown as OntologyEngine;

  const mockProposer = {
    propose: vi.fn().mockResolvedValue({
      proposalId: 'prop-001',
      actionTypeId: 'transitionShipmentState',
      payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
    }),
  };

  const allowlist = ['transitionShipmentState'];

  it('has name propose_action', () => {
    const tool = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    expect(tool.name).toBe('propose_action');
  });

  it('proposes action and returns proposal id', async () => {
    const tool = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    const result = await tool.invoke({
      actionTypeId: 'transitionShipmentState',
      payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      reasoning: 'Shipment has arrived at destination hub',
    });
    expect(result).toContain('prop-001');
    expect(result).toContain('awaiting_approval');
  });

  it('rejects action not in allowlist', async () => {
    const tool = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    const result = await tool.invoke({
      actionTypeId: 'notAllowedAction',
      payload: {},
      reasoning: 'test',
    });
    expect(result).toContain('not allowed');
  });

  it('rejects invalid payload', async () => {
    mockRegistry.validateActionPayload.mockReturnValueOnce(['Missing required: shipmentId']);
    const tool = createProposeActionTool(mockEngine, mockProposer as any, allowlist);
    const result = await tool.invoke({
      actionTypeId: 'transitionShipmentState',
      payload: {},
      reasoning: 'test',
    });
    expect(result).toContain('Validation failed');
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/agent-service test
```

Expected: FAIL — `propose-action.tool` not found

- [ ] **Step 3: Implementasi `src/tools/actions/propose-action.tool.ts`**

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { ActionProposer } from '@daemon/ontology-sdk';
import { isActionAllowed } from '../../permissions/action-allowlist.js';

const ProposeActionInputSchema = z.object({
  actionTypeId: z
    .string()
    .describe('The API name of the action type to propose, e.g. "transitionShipmentState"'),
  payload: z
    .record(z.unknown())
    .describe('The parameters for this action as defined in the action type schema'),
  reasoning: z
    .string()
    .describe('Brief explanation of why this action is being proposed — shown to the human approver'),
});

export function createProposeActionTool(
  engine: OntologyEngine,
  proposer: ActionProposer,
  allowlist: string[]
) {
  return tool(
    async ({ actionTypeId, payload, reasoning }) => {
      // 1. Check allowlist — agent cannot propose actions outside this list
      if (!isActionAllowed(actionTypeId, allowlist)) {
        return `Action "${actionTypeId}" is not allowed for this agent. Allowed actions: ${allowlist.join(', ')}`;
      }

      // 2. Validate action type exists
      const registry = engine.getRegistry();
      const actionType = registry.getActionType(actionTypeId);
      if (!actionType) {
        return `Unknown action type: "${actionTypeId}". Use read_schema to see available action types.`;
      }

      // 3. Validate payload
      const errors = registry.validateActionPayload(actionTypeId, payload);
      if (errors.length > 0) {
        return `Validation failed for "${actionTypeId}":\n${errors.join('\n')}\n\nPlease fix the payload and try again.`;
      }

      // 4. Create proposal — NO executeAction here
      const proposal = await proposer.propose(actionTypeId, {
        ...payload,
        _agentReasoning: reasoning, // attach reasoning for human approver
      });

      return [
        `Action proposed successfully.`,
        `Proposal ID: ${proposal.proposalId}`,
        `Status: ${proposal.status}`,
        `Action: ${actionTypeId}`,
        `Reasoning shown to approver: "${reasoning}"`,
        ``,
        `A human operator must approve this proposal before it executes.`,
      ].join('\n');
    },
    {
      name: 'propose_action',
      description:
        'Propose a governed action on the ontology. This does NOT execute the action — it creates a proposal that requires human approval. Always include clear reasoning for the approver.',
      schema: ProposeActionInputSchema,
    }
  );
}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/agent-service test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agent-service/src/tools/actions/
git commit -m "feat(agent-service): add propose_action tool — only write path for agent"
```

---

## Task 5: System Prompts

**Files:**
- Create: `apps/agent-service/src/prompts/root.prompt.ts`
- Create: `apps/agent-service/src/prompts/ops.prompt.ts`
- Create: `apps/agent-service/src/prompts/finance.prompt.ts`
- Create: `apps/agent-service/src/prompts/network.prompt.ts`

- [ ] **Step 1: Implementasi `src/prompts/root.prompt.ts`**

```typescript
export function buildRootSystemPrompt(tenantId: string, schemaContext: string): string {
  return `You are an ontology-aware operations assistant for tenant "${tenantId}".

You observe the state of the business through the ontology — objects, their properties, and relationships.
You propose governed actions when you identify issues or opportunities. You never execute actions directly.

## Your tools
- read_schema: Learn what object types and action types exist
- read_objects: Query current state of any object type
- get_object: Get details of a single object
- propose_action: Propose a governed action (requires human approval)
- task: Delegate complex sub-tasks to specialized subagents

## Your constraints (Wave 1)
1. NEVER execute actions directly — always use propose_action
2. NEVER bypass the human approval gate
3. ONLY propose actions in the allowed action list
4. ALWAYS provide clear reasoning in every proposal

## Business context
${schemaContext}

## Operating loop
1. OBSERVE: Read relevant objects using read_objects
2. INTERPRET: Identify issues, exceptions, or opportunities based on what you see
3. PROPOSE: Use propose_action to suggest corrective actions with clear reasoning
4. RECORD: Summarize what you observed and proposed for the operator

When a task is complex or spans multiple domains, use the task tool to delegate to ops_agent, finance_agent, or network_agent.`;
}
```

- [ ] **Step 2: Implementasi `src/prompts/ops.prompt.ts`**

```typescript
export function buildOpsSystemPrompt(tenantId: string): string {
  return `You are the Operations subagent for tenant "${tenantId}".

Your domain: shipments, exceptions, branch operations, delivery tracking.

## Focus areas
- Shipment lifecycle: monitor status transitions, flag stuck shipments
- Exception management: identify, classify, and assign exceptions
- SLA monitoring: detect breaches before they escalate
- Branch performance: hub throughput, delay patterns

## Key object types in your domain
- Shipment (status: Draft → InTransit → Delivered / Cancelled)
- Exception (severity: Low / Medium / High / Critical)
- Branch / HubRO

## Allowed actions for you
- transitionShipmentState: Move shipment to next lifecycle state
- assignExceptionOwner: Assign an exception to an owner for resolution
- resolveException: Mark an exception as resolved
- escalateException: Escalate a high-severity exception

## Rules
- Always check legalEntityId matches the operator's scope before proposing
- For Critical exceptions: always escalate, never just resolve
- Stuck shipments = status unchanged for >24h: flag immediately`;
}
```

- [ ] **Step 3: Implementasi `src/prompts/finance.prompt.ts`**

```typescript
export function buildFinanceSystemPrompt(tenantId: string): string {
  return `You are the Finance subagent for tenant "${tenantId}".

Your domain: intercompany transactions, transfer pricing, invoice governance, legal entity compliance.

## Focus areas
- Interco transaction pair validation (entity A ↔ entity B symmetry)
- Transfer pricing activity tagging
- Invoice status and elimination workflow
- legalEntityId attribution on all transactional objects

## Key object types in your domain
- IntercoTransaction (status: Pending → Eliminated → Reviewed)
- Invoice
- LegalEntity (ANT, ARA, HOLD, SPV-IPO)
- TransferPricingActivity

## Rules (Wave 2 — observe only for now)
- Do not propose finance actions until Object Catalog v0.2 is finalized
- Report anomalies and inconsistencies via observation summaries only
- Flag any transaction missing legalEntityId attribution`;
}
```

- [ ] **Step 4: Implementasi `src/prompts/network.prompt.ts`**

```typescript
export function buildNetworkSystemPrompt(tenantId: string): string {
  return `You are the Network subagent for tenant "${tenantId}".

Your domain: distribution network health, LocalHero partners, hub coverage, partner performance.

## Focus areas
- LocalHero engagement and utilization
- Hub route optimization opportunities
- Coverage gap identification
- Partner performance metrics

## Key object types in your domain
- LocalHero
- HubRO (6 profiles: JKT, SUB, UPG, etc.)
- Partner / Carrier

## Rules (Wave 4 — observe only for now)
- Network objects are not yet in Wave 1 scope
- Observe and report patterns; do not propose actions until Wave 4`;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/agent-service/src/prompts/
git commit -m "feat(agent-service): add system prompts for root and domain subagents"
```

---

## Task 6: Subagents (Ops, Finance, Network)

**Files:**
- Create: `apps/agent-service/src/agents/ops.agent.ts`
- Create: `apps/agent-service/src/agents/finance.agent.ts`
- Create: `apps/agent-service/src/agents/network.agent.ts`

- [ ] **Step 1: Implementasi `src/agents/ops.agent.ts`**

```typescript
import { createDeepAgent } from 'deepagents';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { createGetObjectTool } from '../tools/ontology/get-object.tool.js';
import { createProposeActionTool } from '../tools/actions/propose-action.tool.js';
import { buildOpsSystemPrompt } from '../prompts/ops.prompt.js';

const OPS_ALLOWLIST = [
  'transitionShipmentState',
  'assignExceptionOwner',
  'resolveException',
  'escalateException',
];

export function createOpsAgent(
  tenantId: string,
  engine: OntologyEngine,
  client: OntologyClient,
  proposer: ActionProposer
) {
  return createDeepAgent({
    name: 'ops_agent',
    description: 'Handles shipment lifecycle, exceptions, and branch operations',
    tools: [
      createReadObjectsTool(client),
      createGetObjectTool(engine),
      createProposeActionTool(engine, proposer, OPS_ALLOWLIST),
    ],
    systemPrompt: buildOpsSystemPrompt(tenantId),
  });
}
```

- [ ] **Step 2: Implementasi `src/agents/finance.agent.ts`**

```typescript
import { createDeepAgent } from 'deepagents';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient } from '@daemon/ontology-sdk';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { createGetObjectTool } from '../tools/ontology/get-object.tool.js';
import { buildFinanceSystemPrompt } from '../prompts/finance.prompt.js';

// Finance subagent — Wave 2, observe-only for now (no propose tool)
export function createFinanceAgent(
  tenantId: string,
  engine: OntologyEngine,
  client: OntologyClient
) {
  return createDeepAgent({
    name: 'finance_agent',
    description: 'Observes interco transactions, transfer pricing, and legal entity compliance',
    tools: [
      createReadObjectsTool(client),
      createGetObjectTool(engine),
      // Note: no propose_action — finance actions deferred to Wave 2
    ],
    systemPrompt: buildFinanceSystemPrompt(tenantId),
  });
}
```

- [ ] **Step 3: Implementasi `src/agents/network.agent.ts`**

```typescript
import { createDeepAgent } from 'deepagents';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient } from '@daemon/ontology-sdk';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { buildNetworkSystemPrompt } from '../prompts/network.prompt.js';

// Network subagent — Wave 4, observe-only
export function createNetworkAgent(
  tenantId: string,
  engine: OntologyEngine,
  client: OntologyClient
) {
  return createDeepAgent({
    name: 'network_agent',
    description: 'Observes distribution network health, LocalHero, and hub coverage',
    tools: [
      createReadObjectsTool(client),
    ],
    systemPrompt: buildNetworkSystemPrompt(tenantId),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/agent-service/src/agents/ops.agent.ts apps/agent-service/src/agents/finance.agent.ts apps/agent-service/src/agents/network.agent.ts
git commit -m "feat(agent-service): add domain subagents (ops, finance, network)"
```

---

## Task 7: Root Agent

**Files:**
- Create: `apps/agent-service/src/agents/root.agent.ts`
- Create: `apps/agent-service/src/memory/tenant.memory.ts`

- [ ] **Step 1: Implementasi `src/memory/tenant.memory.ts`**

```typescript
import { InMemoryStore } from '@langchain/langgraph';

// In-memory store per tenant (Wave 1)
// Wave 2+: ganti dengan Redis-backed persistent store
const stores = new Map<string, InMemoryStore>();

export function getTenantMemoryStore(tenantId: string): InMemoryStore {
  if (!stores.has(tenantId)) {
    stores.set(tenantId, new InMemoryStore());
  }
  return stores.get(tenantId)!;
}
```

- [ ] **Step 2: Implementasi `src/agents/root.agent.ts`**

```typescript
import { createDeepAgent } from 'deepagents';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { createReadObjectsTool } from '../tools/ontology/read-objects.tool.js';
import { createReadSchemaTool } from '../tools/ontology/read-schema.tool.js';
import { createProposeActionTool } from '../tools/actions/propose-action.tool.js';
import { createOpsAgent } from './ops.agent.js';
import { createFinanceAgent } from './finance.agent.js';
import { createNetworkAgent } from './network.agent.js';
import { buildRootSystemPrompt } from '../prompts/root.prompt.js';
import { getTenantMemoryStore } from '../memory/tenant.memory.js';
import { getDefaultAllowlist } from '../permissions/action-allowlist.js';

export interface RootAgentContext {
  tenantId: string;
  engine: OntologyEngine;
  client: OntologyClient;
  proposer: ActionProposer;
}

export function createRootAgent(ctx: RootAgentContext) {
  const { tenantId, engine, client, proposer } = ctx;

  // Build schema context for system prompt
  const registry = engine.getRegistry();
  const schemaContext = [
    `Object types: ${registry.getObjectTypeNames().join(', ')}`,
    `Action types: ${registry.getActionTypeNames().join(', ')}`,
  ].join('\n');

  // Subagent spawn tools
  const opsAgent = createOpsAgent(tenantId, engine, client, proposer);
  const financeAgent = createFinanceAgent(tenantId, engine, client);
  const networkAgent = createNetworkAgent(tenantId, engine, client);

  const delegateToOpsAgent = tool(
    async ({ task }: { task: string }) => {
      const result = await opsAgent.invoke({
        messages: [{ role: 'user', content: task }],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    },
    {
      name: 'ops_agent',
      description:
        'Delegate operations tasks (shipments, exceptions, branch ops) to the ops specialist subagent',
      schema: z.object({
        task: z.string().describe('The task to delegate to the ops agent'),
      }),
    }
  );

  const delegateToFinanceAgent = tool(
    async ({ task }: { task: string }) => {
      const result = await financeAgent.invoke({
        messages: [{ role: 'user', content: task }],
      });
      const lastMessage = result.messages[result.messages.length - 1];
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    },
    {
      name: 'finance_agent',
      description:
        'Delegate finance tasks (interco, transfer pricing, legal entity) to the finance specialist subagent',
      schema: z.object({
        task: z.string().describe('The task to delegate to the finance agent'),
      }),
    }
  );

  return createDeepAgent({
    name: 'root_agent',
    tools: [
      createReadSchemaTool(engine),
      createReadObjectsTool(client),
      createProposeActionTool(engine, proposer, getDefaultAllowlist()),
      delegateToOpsAgent,
      delegateToFinanceAgent,
    ],
    systemPrompt: buildRootSystemPrompt(tenantId, schemaContext),
    store: getTenantMemoryStore(tenantId),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/agent-service/src/agents/root.agent.ts apps/agent-service/src/memory/
git commit -m "feat(agent-service): add root agent with subagent delegation and tenant memory"
```

---

## Task 8: HTTP Server + Entry Point

**Files:**
- Create: `apps/agent-service/src/server.ts`
- Create: `apps/agent-service/src/index.ts`

- [ ] **Step 1: Implementasi `src/server.ts`**

```typescript
import Fastify from 'fastify';
import { OntologyEngine } from '@daemon/ontology-engine';
import { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';
import { createRootAgent } from './agents/root.agent.js';

export interface AgentServerConfig {
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  redisHost: string;
  redisPort: number;
  schemaDir: string;
  defaultTenantId: string;
}

export async function buildAgentServer(config: AgentServerConfig) {
  const app = Fastify({ logger: true });

  // Setup engine + clients
  const engine = await OntologyEngine.create({
    db: {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    },
    redis: { host: config.redisHost, port: config.redisPort },
    tenantId: config.defaultTenantId,
    schemaDir: config.schemaDir,
  });

  const redis = createRedisClient({ host: config.redisHost, port: config.redisPort });

  // POST /agent/invoke — invoke root agent
  app.post<{
    Body: { tenantId: string; message: string };
  }>('/agent/invoke', async (request, reply) => {
    const { tenantId, message } = request.body;

    const client = new OntologyClient(engine, redis, tenantId);
    const proposer = new ActionProposer(redis, tenantId);

    const agent = createRootAgent({ tenantId, engine, client, proposer });

    const result = await agent.invoke({
      messages: [{ role: 'user', content: message }],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const content =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    return reply.send({ response: content, tenantId });
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 2: Implementasi `src/index.ts`**

```typescript
import { buildAgentServer } from './server.js';

const config = {
  port: Number(process.env.AGENT_PORT ?? '3001'),
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? '5433'),
  dbUser: process.env.DB_USER ?? 'daemon',
  dbPassword: process.env.DB_PASSWORD ?? 'daemon_test',
  dbName: process.env.DB_NAME ?? 'daemon_test',
  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: Number(process.env.REDIS_PORT ?? '6380'),
  schemaDir: process.env.SCHEMA_DIR ?? './schemas',
  defaultTenantId: process.env.TENANT_ID ?? 'default',
};

const app = await buildAgentServer(config);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Agent service running on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @daemon/agent-service build
```

Expected: build sukses

- [ ] **Step 4: Run all tests dari root**

```bash
pnpm test
```

Expected: semua tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/agent-service/src/server.ts apps/agent-service/src/index.ts
git commit -m "feat(agent-service): add HTTP server entry point for agent invocation"
```

---

## Verification Checklist

- [ ] `pnpm test` dari root: semua tests pass
- [ ] `pnpm build` dari root: semua packages dan apps build
- [ ] `propose_action` tool menolak action di luar allowlist
- [ ] `propose_action` tool menolak payload invalid
- [ ] `propose_action` tidak memanggil `executeAction` langsung
- [ ] Root agent bisa delegate ke `ops_agent` via tool
- [ ] `POST /agent/invoke` returns agent response
- [ ] Finance dan network subagents tidak punya `propose_action` tool (Wave 4)
- [ ] Memory store dibuat per `tenantId` — tidak shared antar tenant

---

## Summary — Semua 4 Plans

| Plan | Output | Dependency |
|------|--------|------------|
| Plan 1 | `@daemon/ontology-language` — parse + validate YAML schema | Tidak ada |
| Plan 2 | `@daemon/ontology-engine` — registry, executeAction, audit, Redis | Plan 1 |
| Plan 3 | `@daemon/ontology-sdk` + `apps/api` — HTTP gateway + HITL flow | Plan 1, 2 |
| Plan 4 | `apps/agent-service` — deepagents, subagents, propose-only | Plan 1, 2, 3 |

Urutan implementasi yang benar: **Plan 1 → Plan 2 → Plan 3 → Plan 4**.
