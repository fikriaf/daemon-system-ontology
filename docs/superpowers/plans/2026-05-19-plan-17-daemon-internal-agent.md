# Daemon Internal Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an embedded chat-style, read-only, policy-governed internal agent to `apps/control-plane` for Daemon operator diagnostics across tenants, health, metrics, and logs.

**Architecture:** `apps/control-plane` exposes `POST /internal-agent/invoke`, composes a built-in `readonly-operator` policy with a request-scoped narrowing override, and invokes a `deepagents` runner with only governed read-only tools. Tools record deterministic evidence and audit metadata server-side; model output only supplies the natural-language answer.

**Tech Stack:** TypeScript, Fastify, Zod, Drizzle repositories, Vitest, LangChain tools, `deepagents`, OpenAI-compatible `@langchain/openai` model configuration for OpenRouter MiniMax M2.7.

---

## File Structure

- Create: `apps/control-plane/src/internal-agent/policy.ts`
  Defines tool names, the default `readonly-operator` profile, request override types, and most-restrictive-wins policy composition.
- Create: `apps/control-plane/src/internal-agent/governance.ts`
  Enforces allowed tools, max tool calls, tenant scope, and records deterministic evidence and audit entries.
- Create: `apps/control-plane/src/internal-agent/tools.ts`
  Builds read-only LangChain tools over `TenantRepository`, `HealthRepository`, and `LogRepository`.
- Create: `apps/control-plane/src/internal-agent/prompt.ts`
  Contains the strict read-only operator assistant prompt.
- Create: `apps/control-plane/src/internal-agent/model.factory.ts`
  Creates an OpenAI-compatible chat model locally in control-plane, without importing tenant-side agent-service code.
- Create: `apps/control-plane/src/internal-agent/internal-agent.runner.ts`
  Creates and invokes the `deepagents` agent. Exposes a small runner interface that tests can fake.
- Create: `apps/control-plane/src/internal-agent/internal-agent.route.ts`
  Registers `POST /internal-agent/invoke`, validates body, composes policy, creates governance, invokes runner, and returns `answer`, `evidence`, and `audit`.
- Create: `apps/control-plane/src/__tests__/internal-agent.policy.test.ts`
  Unit tests for policy composition and governance denial/recording behavior.
- Create: `apps/control-plane/src/__tests__/internal-agent.tools.test.ts`
  Unit tests for tool calls using repository prototype spies.
- Create: `apps/control-plane/src/__tests__/internal-agent.route.test.ts`
  Route tests with an injected fake runner.
- Modify: `apps/control-plane/src/app.ts`
  Extend config and register `internalAgentRoute` under `/internal-agent`.
- Modify: `apps/control-plane/src/index.ts`
  Read internal-agent model env vars.
- Modify: `apps/control-plane/.env.example`
  Document internal-agent model env vars.
- Modify: `apps/control-plane/package.json`
  Add agent/model dependencies.

---

### Task 1: Add Control-Plane Agent Dependencies And Config

**Files:**
- Modify: `apps/control-plane/package.json`
- Modify: `apps/control-plane/src/app.ts`
- Modify: `apps/control-plane/src/index.ts`
- Modify: `apps/control-plane/.env.example`

- [ ] **Step 1: Add dependencies to `apps/control-plane/package.json`**

Add these entries to the existing `dependencies` object:

```json
"@langchain/core": "^1.1.0",
"@langchain/openai": "^0.5.0",
"deepagents": "^1.10.0",
"langchain": "^1.4.0"
```

Keep the existing dependency entries. The relevant block should look like this after the edit:

```json
"dependencies": {
  "@fastify/jwt": "^9.0.0",
  "@fastify/rate-limit": "^10.0.0",
  "@fastify/websocket": "^11.0.0",
  "@langchain/core": "^1.1.0",
  "@langchain/openai": "^0.5.0",
  "deepagents": "^1.10.0",
  "drizzle-orm": "^0.30.0",
  "fastify": "^5.0.0",
  "fastify-plugin": "^5.0.0",
  "langchain": "^1.4.0",
  "node-cron": "^3.0.0",
  "postgres": "^3.4.3",
  "zod": "^3.23.0"
}
```

- [ ] **Step 2: Install dependencies and update lockfile**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm install"
```

Expected: command exits `0` and `pnpm-lock.yaml` changes.

- [ ] **Step 3: Add route config types to `apps/control-plane/src/app.ts`**

Add this import with the other route imports:

```typescript
import {
  internalAgentRoute,
  type InternalAgentRunnerFactory,
} from './internal-agent/internal-agent.route.js';
```

Extend `ControlPlaneConfig` exactly as follows:

```typescript
export interface ControlPlaneConfig {
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  internalSecret: string;
  pollIntervalMs?: number;
  internalAgentModel?: string;
  internalAgentTemperature?: number;
  createInternalAgentRunner?: InternalAgentRunnerFactory;
}
```

- [ ] **Step 4: Register the internal-agent route in `apps/control-plane/src/app.ts`**

Register the route after `logQueryRoute` and before `wsRoute`:

```typescript
  await app.register(logReceiveRoute, { broadcaster, prefix: '/logs' });
  await app.register(logQueryRoute, { prefix: '/tenants' });
  await app.register(internalAgentRoute, {
    prefix: '/internal-agent',
    modelConfig: {
      agentModel: config.internalAgentModel ?? 'openrouter:minimax/minimax-m2.7',
      temperature: config.internalAgentTemperature,
    },
    createRunner: config.createInternalAgentRunner,
  });
  await app.register(wsRoute, { broadcaster });
```

The existing auth hook already protects every route except `/health` and `/ws/`, so do not add a custom auth bypass for `/internal-agent/invoke`.

- [ ] **Step 5: Read model env vars in `apps/control-plane/src/index.ts`**

Update the config object to include:

```typescript
  internalAgentModel: process.env.INTERNAL_AGENT_MODEL ?? 'openrouter:minimax/minimax-m2.7',
  internalAgentTemperature: Number(process.env.INTERNAL_AGENT_TEMPERATURE ?? '0.2'),
```

The final config object should be:

```typescript
const config = {
  port: Number(process.env.PORT ?? '4000'),
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? '5432'),
  dbUser: process.env.DB_USER ?? 'daemon',
  dbPassword: process.env.DB_PASSWORD ?? '',
  dbName: process.env.DB_NAME ?? 'daemon_control',
  internalSecret: process.env.INTERNAL_SECRET ?? 'change-me-in-production',
  internalAgentModel: process.env.INTERNAL_AGENT_MODEL ?? 'openrouter:minimax/minimax-m2.7',
  internalAgentTemperature: Number(process.env.INTERNAL_AGENT_TEMPERATURE ?? '0.2'),
};
```

- [ ] **Step 6: Document env vars in `apps/control-plane/.env.example`**

Append this section:

```dotenv
# Internal operator agent
INTERNAL_AGENT_MODEL=openrouter:minimax/minimax-m2.7
INTERNAL_AGENT_TEMPERATURE=0.2
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

- [ ] **Step 7: Run TypeScript to verify expected missing files**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane build"
```

Expected: build fails because `./internal-agent/internal-agent.route.js` does not exist yet. This is the expected red state for this task.

---

### Task 2: Implement Policy Composition

**Files:**
- Create: `apps/control-plane/src/internal-agent/policy.ts`
- Create: `apps/control-plane/src/__tests__/internal-agent.policy.test.ts`

- [ ] **Step 1: Write policy tests in `apps/control-plane/src/__tests__/internal-agent.policy.test.ts`**

Create the file with this content:

```typescript
import { describe, expect, it } from 'vitest';
import {
  READONLY_OPERATOR_POLICY,
  composeInternalAgentPolicy,
  INTERNAL_AGENT_TOOL_NAMES,
} from '../internal-agent/policy.js';

describe('internal agent policy', () => {
  it('uses the readonly operator defaults when no override is provided', () => {
    const policy = composeInternalAgentPolicy();

    expect(policy.profile).toBe('readonly-operator');
    expect(policy.allowedTools).toEqual(READONLY_OPERATOR_POLICY.allowedTools);
    expect(policy.maxToolCalls).toBe(12);
    expect(policy.tenantIds).toBeUndefined();
  });

  it('intersects request allowedTools with the default profile', () => {
    const policy = composeInternalAgentPolicy({
      allowedTools: ['list_tenants', 'query_tenant_logs', 'suspend_tenant'],
    });

    expect(policy.allowedTools).toEqual(['list_tenants', 'query_tenant_logs']);
  });

  it('narrows tenant scope when tenantIds are supplied', () => {
    const policy = composeInternalAgentPolicy({
      tenantIds: ['tenant-a', 'tenant-b'],
    });

    expect(policy.tenantIds).toEqual(['tenant-a', 'tenant-b']);
  });

  it('caps maxToolCalls at the lower value', () => {
    expect(composeInternalAgentPolicy({ maxToolCalls: 4 }).maxToolCalls).toBe(4);
    expect(composeInternalAgentPolicy({ maxToolCalls: 999 }).maxToolCalls).toBe(12);
  });

  it('deduplicates request tools and tenant ids', () => {
    const policy = composeInternalAgentPolicy({
      allowedTools: ['list_tenants', 'list_tenants', 'get_tenant'],
      tenantIds: ['tenant-a', 'tenant-a'],
    });

    expect(policy.allowedTools).toEqual(['list_tenants', 'get_tenant']);
    expect(policy.tenantIds).toEqual(['tenant-a']);
  });

  it('exports only read-only tool names', () => {
    expect(INTERNAL_AGENT_TOOL_NAMES).toEqual([
      'list_tenants',
      'get_tenant',
      'get_tenant_health',
      'get_tenant_metrics',
      'query_tenant_logs',
      'summarize_tenant_incidents',
    ]);
  });
});
```

- [ ] **Step 2: Run the failing policy test**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.policy.test.ts"
```

Expected: fails because `../internal-agent/policy.js` does not exist.

- [ ] **Step 3: Implement `apps/control-plane/src/internal-agent/policy.ts`**

Create the file with this content:

```typescript
export const INTERNAL_AGENT_TOOL_NAMES = [
  'list_tenants',
  'get_tenant',
  'get_tenant_health',
  'get_tenant_metrics',
  'query_tenant_logs',
  'summarize_tenant_incidents',
] as const;

export type InternalAgentToolName = typeof INTERNAL_AGENT_TOOL_NAMES[number];

export interface InternalAgentPolicy {
  profile: 'readonly-operator';
  allowedTools: InternalAgentToolName[];
  tenantIds?: string[];
  maxToolCalls: number;
}

export interface InternalAgentPolicyOverride {
  allowedTools?: string[];
  tenantIds?: string[];
  maxToolCalls?: number;
}

export const READONLY_OPERATOR_POLICY: InternalAgentPolicy = {
  profile: 'readonly-operator',
  allowedTools: [...INTERNAL_AGENT_TOOL_NAMES],
  maxToolCalls: 12,
};

const TOOL_NAME_SET = new Set<string>(INTERNAL_AGENT_TOOL_NAMES);

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isInternalAgentToolName(value: string): value is InternalAgentToolName {
  return TOOL_NAME_SET.has(value);
}

export function composeInternalAgentPolicy(
  override?: InternalAgentPolicyOverride
): InternalAgentPolicy {
  const requestedTools = override?.allowedTools
    ? unique(override.allowedTools).filter(isInternalAgentToolName)
    : READONLY_OPERATOR_POLICY.allowedTools;

  const allowedTools = requestedTools.filter((toolName) =>
    READONLY_OPERATOR_POLICY.allowedTools.includes(toolName)
  );

  const requestedMaxToolCalls = override?.maxToolCalls ?? READONLY_OPERATOR_POLICY.maxToolCalls;
  const maxToolCalls = Math.max(
    0,
    Math.min(READONLY_OPERATOR_POLICY.maxToolCalls, requestedMaxToolCalls)
  );

  return {
    profile: READONLY_OPERATOR_POLICY.profile,
    allowedTools,
    tenantIds: override?.tenantIds ? unique(override.tenantIds) : undefined,
    maxToolCalls,
  };
}
```

- [ ] **Step 4: Run policy tests again**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.policy.test.ts"
```

Expected: all tests in `internal-agent.policy.test.ts` pass.

- [ ] **Step 5: Commit policy task**

Run:

```bash
git add apps/control-plane/src/internal-agent/policy.ts apps/control-plane/src/__tests__/internal-agent.policy.test.ts apps/control-plane/package.json apps/control-plane/src/app.ts apps/control-plane/src/index.ts apps/control-plane/.env.example pnpm-lock.yaml
git commit -m "feat(control-plane): add internal agent policy surface"
```

If `pnpm-lock.yaml` did not change because compatible dependencies were already installed, omit it from `git add`.

---

### Task 3: Implement Governance Evidence And Audit

**Files:**
- Create: `apps/control-plane/src/internal-agent/governance.ts`
- Modify: `apps/control-plane/src/__tests__/internal-agent.policy.test.ts`

- [ ] **Step 1: Add governance tests to `internal-agent.policy.test.ts`**

Add this import with the existing imports at the top of the file:

```typescript
import { InternalAgentGovernance } from '../internal-agent/governance.js';
```

Then append these tests to the existing file:

```typescript

describe('internal agent governance', () => {
  it('allows tools that are in policy and records evidence', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['list_tenants'], maxToolCalls: 2 })
    );

    const result = await governance.runTool('list_tenants', {}, async () => ({ count: 2 }));

    expect(result.allowed).toBe(true);
    expect(result.value).toEqual({ count: 2 });
    expect(governance.getEvidence().toolsCalled).toEqual(['list_tenants']);
    expect(governance.getEvidence().recordsInspected.tenants).toBe(0);
    expect(governance.getAudit()).toEqual([{ tool: 'list_tenants', action: 'allowed' }]);
  });

  it('denies tools that are outside policy', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['list_tenants'] })
    );

    const result = await governance.runTool('query_tenant_logs', { tenantId: 'tenant-a' }, async () => []);

    expect(result.allowed).toBe(false);
    expect(result.denial).toBe('Tool query_tenant_logs is not allowed by policy.');
    expect(governance.getAudit()).toEqual([{ tool: 'query_tenant_logs', action: 'denied' }]);
  });

  it('denies tenant scoped calls outside policy', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ tenantIds: ['tenant-a'] })
    );

    const result = await governance.runTool('get_tenant', { tenantId: 'tenant-b' }, async () => ({ id: 'tenant-b' }));

    expect(result.allowed).toBe(false);
    expect(result.denial).toBe('Tenant tenant-b is outside the allowed internal-agent scope.');
  });

  it('denies calls above maxToolCalls', async () => {
    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ allowedTools: ['list_tenants'], maxToolCalls: 1 })
    );

    await governance.runTool('list_tenants', {}, async () => []);
    const result = await governance.runTool('list_tenants', {}, async () => []);

    expect(result.allowed).toBe(false);
    expect(result.denial).toBe('Internal-agent max tool calls exceeded.');
  });

  it('records record counts and tenant ids deterministically', async () => {
    const governance = new InternalAgentGovernance(composeInternalAgentPolicy());

    governance.recordEvidence({ tenantIds: ['tenant-a'], records: { logs: 3 }, timeWindowHours: 24 });
    governance.recordEvidence({ tenantIds: ['tenant-a', 'tenant-b'], records: { logs: 2, metrics: 1 } });

    expect(governance.getEvidence()).toEqual({
      toolsCalled: [],
      tenantIds: ['tenant-a', 'tenant-b'],
      timeWindowHours: 24,
      recordsInspected: {
        tenants: 0,
        healthChecks: 0,
        logs: 5,
        metrics: 1,
      },
    });
  });
});
```

- [ ] **Step 2: Run the failing governance tests**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.policy.test.ts"
```

Expected: fails because `../internal-agent/governance.js` does not exist.

- [ ] **Step 3: Implement `apps/control-plane/src/internal-agent/governance.ts`**

Create the file with this content:

```typescript
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

export class InternalAgentGovernance {
  private toolCalls = 0;
  private readonly toolsCalled = new Set<string>();
  private readonly tenantIds = new Set<string>();
  private readonly audit: InternalAgentAuditEntry[] = [];
  private timeWindowHours: number | undefined;
  private readonly recordsInspected = {
    tenants: 0,
    healthChecks: 0,
    logs: 0,
    metrics: 0,
  };

  constructor(private readonly policy: InternalAgentPolicy) {}

  async runTool<T>(
    toolName: string,
    input: { tenantId?: string },
    execute: () => Promise<T>
  ): Promise<GovernedToolResult<T>> {
    const denial = this.getDenialReason(toolName, input.tenantId);
    if (denial) {
      this.audit.push({ tool: toolName, action: 'denied' });
      return { allowed: false, denial };
    }

    this.toolCalls += 1;
    this.toolsCalled.add(toolName);
    this.audit.push({ tool: toolName, action: 'allowed' });

    try {
      return { allowed: true, value: await execute() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown internal-agent tool error';
      this.audit.push({ tool: toolName, action: 'error', reason: message });
      throw error;
    }
  }

  recordEvidence(update: EvidenceUpdate): void {
    for (const tenantId of update.tenantIds ?? []) {
      this.tenantIds.add(tenantId);
    }

    if (update.timeWindowHours !== undefined) {
      this.timeWindowHours = update.timeWindowHours;
    }

    for (const [key, value] of Object.entries(update.records ?? {})) {
      const recordKey = key as keyof InternalAgentEvidence['recordsInspected'];
      this.recordsInspected[recordKey] += value ?? 0;
    }
  }

  getEvidence(): InternalAgentEvidence {
    return {
      toolsCalled: [...this.toolsCalled],
      tenantIds: [...this.tenantIds],
      timeWindowHours: this.timeWindowHours,
      recordsInspected: { ...this.recordsInspected },
    };
  }

  getAudit(): InternalAgentAuditEntry[] {
    return [...this.audit];
  }

  private getDenialReason(toolName: string, tenantId?: string): string | null {
    if (!this.policy.allowedTools.includes(toolName as never)) {
      return `Tool ${toolName} is not allowed by policy.`;
    }

    if (this.toolCalls >= this.policy.maxToolCalls) {
      return 'Internal-agent max tool calls exceeded.';
    }

    if (tenantId && this.policy.tenantIds && !this.policy.tenantIds.includes(tenantId)) {
      return `Tenant ${tenantId} is outside the allowed internal-agent scope.`;
    }

    return null;
  }
}
```

- [ ] **Step 4: Run policy and governance tests again**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.policy.test.ts"
```

Expected: all policy and governance tests pass.

- [ ] **Step 5: Commit governance task**

Run:

```bash
git add apps/control-plane/src/internal-agent/governance.ts apps/control-plane/src/__tests__/internal-agent.policy.test.ts
git commit -m "feat(control-plane): enforce internal agent governance"
```

---

### Task 4: Implement Read-Only Internal Tools

**Files:**
- Create: `apps/control-plane/src/internal-agent/tools.ts`
- Create: `apps/control-plane/src/__tests__/internal-agent.tools.test.ts`

- [ ] **Step 1: Write tool tests in `apps/control-plane/src/__tests__/internal-agent.tools.test.ts`**

Create the file with this content:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InternalAgentGovernance } from '../internal-agent/governance.js';
import { composeInternalAgentPolicy } from '../internal-agent/policy.js';
import { buildInternalAgentTools } from '../internal-agent/tools.js';
import { HealthRepository } from '../health/health.repository.js';
import { LogRepository } from '../logs/log.repository.js';
import { TenantRepository } from '../tenants/tenant.repository.js';

const db = {} as never;

async function callTool(toolName: string, input: Record<string, unknown>, governance: InternalAgentGovernance) {
  const tool = buildInternalAgentTools({ db, governance }).find((item) => item.name === toolName);
  if (!tool) throw new Error(`Missing tool ${toolName}`);
  return tool.invoke(input);
}

describe('internal agent tools', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('list_tenants reads TenantRepository.findWithStatus', async () => {
    vi.spyOn(TenantRepository.prototype, 'findWithStatus').mockResolvedValue([
      {
        id: 'tenant-a',
        slug: 'acme',
        displayName: 'ACME',
        plan: 'enterprise',
        status: 'active',
        apiUrl: 'https://acme.example',
        agentUrl: 'https://agent.acme.example',
        vpsProvider: null,
        vpsRegion: null,
        vpsManagedByDaemon: true,
        adminEmail: 'admin@example.com',
        notes: 'priority',
        onboardedAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        offboardedAt: null,
        lastApiHealth: 'up',
        lastAgentHealth: 'degraded',
        lastCheckedAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ]);

    const governance = new InternalAgentGovernance(composeInternalAgentPolicy());
    const result = JSON.parse(await callTool('list_tenants', {}, governance));

    expect(result.tenants).toEqual([
      {
        id: 'tenant-a',
        slug: 'acme',
        displayName: 'ACME',
        plan: 'enterprise',
        status: 'active',
        lastApiHealth: 'up',
        lastAgentHealth: 'degraded',
        lastCheckedAt: '2026-01-03T00:00:00.000Z',
      },
    ]);
    expect(governance.getEvidence().recordsInspected.tenants).toBe(1);
  });

  it('query_tenant_logs respects tenant scope and caps limit at 200', async () => {
    const query = vi.spyOn(LogRepository.prototype, 'query').mockResolvedValue([
      {
        id: 'log-a',
        tenantId: 'tenant-a',
        service: 'agent',
        level: 'error',
        method: null,
        path: null,
        statusCode: null,
        responseTimeMs: null,
        message: 'Agent failed',
        loggedAt: new Date('2026-01-04T00:00:00.000Z'),
      },
    ]);

    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ tenantIds: ['tenant-a'] })
    );
    const result = JSON.parse(await callTool(
      'query_tenant_logs',
      { tenantId: 'tenant-a', service: 'agent', level: 'error', limit: 999 },
      governance
    ));

    expect(query).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      service: 'agent',
      level: 'error',
      limit: 200,
    });
    expect(result.logs[0].message).toBe('Agent failed');
    expect(governance.getEvidence().recordsInspected.logs).toBe(1);
  });

  it('query_tenant_logs denies out-of-scope tenants', async () => {
    const query = vi.spyOn(LogRepository.prototype, 'query').mockResolvedValue([]);

    const governance = new InternalAgentGovernance(
      composeInternalAgentPolicy({ tenantIds: ['tenant-a'] })
    );
    const result = await callTool('query_tenant_logs', { tenantId: 'tenant-b' }, governance);

    expect(result).toBe('Tenant tenant-b is outside the allowed internal-agent scope.');
    expect(query).not.toHaveBeenCalled();
  });

  it('get_tenant_health restricts service to api or agent', async () => {
    const getHealthHistory = vi.spyOn(HealthRepository.prototype, 'getHealthHistory').mockResolvedValue([]);

    const governance = new InternalAgentGovernance(composeInternalAgentPolicy());
    const result = await callTool(
      'get_tenant_health',
      { tenantId: 'tenant-a', service: 'worker' },
      governance
    );

    expect(result).toBe('Invalid service worker. Expected api or agent.');
    expect(getHealthHistory).not.toHaveBeenCalled();
  });

  it('summarize_tenant_incidents combines latest tenant, health, logs, and metrics', async () => {
    vi.spyOn(TenantRepository.prototype, 'findById').mockResolvedValue({
      id: 'tenant-a',
      slug: 'acme',
      displayName: 'ACME',
      plan: 'enterprise',
      status: 'active',
      apiUrl: 'https://acme.example',
      agentUrl: 'https://agent.acme.example',
      vpsProvider: null,
      vpsRegion: null,
      vpsManagedByDaemon: true,
      adminEmail: 'admin@example.com',
      notes: null,
      onboardedAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      offboardedAt: null,
    });
    vi.spyOn(TenantRepository.prototype, 'getLatestMetrics').mockResolvedValue({
      id: 'metrics-a',
      tenantId: 'tenant-a',
      snapshotAt: new Date('2026-01-04T00:00:00.000Z'),
      windowHours: 1,
      apiRequestsTotal: 100,
      apiRequestsError: 5,
      apiAvgResponseMs: 120,
      objectsTotal: 10,
      proposalsCreated: 3,
      proposalsApproved: 1,
      proposalsRejected: 1,
      agentInvocations: 7,
      schemaObjectTypes: 4,
      schemaActionTypes: 2,
    });
    vi.spyOn(HealthRepository.prototype, 'getHealthHistory').mockResolvedValue([
      {
        id: 'health-a',
        tenantId: 'tenant-a',
        service: 'api',
        status: 'down',
        responseTimeMs: 5000,
        httpStatus: 503,
        errorMessage: 'Service unavailable',
        checkedAt: new Date('2026-01-04T01:00:00.000Z'),
      },
    ]);
    vi.spyOn(LogRepository.prototype, 'query').mockResolvedValue([
      {
        id: 'log-a',
        tenantId: 'tenant-a',
        service: 'api',
        level: 'error',
        method: 'GET',
        path: '/health',
        statusCode: 503,
        responseTimeMs: 5000,
        message: 'Health check failed',
        loggedAt: new Date('2026-01-04T01:01:00.000Z'),
      },
    ]);

    const governance = new InternalAgentGovernance(composeInternalAgentPolicy());
    const result = JSON.parse(await callTool(
      'summarize_tenant_incidents',
      { tenantId: 'tenant-a', windowHours: 24 },
      governance
    ));

    expect(result.tenant.id).toBe('tenant-a');
    expect(result.unhealthyServices).toEqual([{ service: 'api', status: 'down' }]);
    expect(result.errorLogCount).toBe(1);
    expect(result.latestMetrics.apiRequestsError).toBe(5);
    expect(governance.getEvidence().timeWindowHours).toBe(24);
  });
});
```

- [ ] **Step 2: Run the failing tool tests**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.tools.test.ts"
```

Expected: fails because `../internal-agent/tools.js` does not exist.

- [ ] **Step 3: Implement `apps/control-plane/src/internal-agent/tools.ts`**

Create the file with this content:

```typescript
import { tool } from 'langchain';
import { z } from 'zod';
import type { DbClient } from '../db/client.js';
import { HealthRepository } from '../health/health.repository.js';
import { LogRepository } from '../logs/log.repository.js';
import { TenantRepository } from '../tenants/tenant.repository.js';
import type { InternalAgentGovernance } from './governance.js';

export interface InternalAgentToolContext {
  db: DbClient;
  governance: InternalAgentGovernance;
}

function serializeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function capLimit(limit: number | undefined, fallback: number, max: number): number {
  return Math.min(Math.max(limit ?? fallback, 1), max);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function guardedJson<T>(
  governance: InternalAgentGovernance,
  toolName: string,
  input: { tenantId?: string },
  execute: () => Promise<T>
): Promise<string> {
  const result = await governance.runTool(toolName, input, execute);
  if (!result.allowed) return result.denial;
  return safeJson(result.value);
}

export function buildInternalAgentTools(ctx: InternalAgentToolContext) {
  const tenants = new TenantRepository(ctx.db);
  const health = new HealthRepository(ctx.db);
  const logs = new LogRepository(ctx.db);

  return [
    tool(
      async () => guardedJson(ctx.governance, 'list_tenants', {}, async () => {
        const rows = await tenants.findWithStatus();
        ctx.governance.recordEvidence({ records: { tenants: rows.length }, tenantIds: rows.map((row) => row.id) });

        return {
          tenants: rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            displayName: row.displayName,
            plan: row.plan,
            status: row.status,
            lastApiHealth: row.lastApiHealth,
            lastAgentHealth: row.lastAgentHealth,
            lastCheckedAt: serializeDate(row.lastCheckedAt),
          })),
        };
      }),
      {
        name: 'list_tenants',
        description: 'List active tenants with latest API and agent health summary.',
        schema: z.object({}),
      }
    ),

    tool(
      async ({ tenantId }: { tenantId: string }) => guardedJson(ctx.governance, 'get_tenant', { tenantId }, async () => {
        const tenant = await tenants.findById(tenantId);
        if (!tenant || tenant.offboardedAt) {
          return { tenant: null, message: `Tenant ${tenantId} not found in active scope.` };
        }

        const latestMetrics = await tenants.getLatestMetrics(tenantId);
        ctx.governance.recordEvidence({ tenantIds: [tenantId], records: { tenants: 1, metrics: latestMetrics ? 1 : 0 } });

        return {
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            displayName: tenant.displayName,
            plan: tenant.plan,
            status: tenant.status,
            apiUrl: tenant.apiUrl,
            agentUrl: tenant.agentUrl,
            vpsProvider: tenant.vpsProvider,
            vpsRegion: tenant.vpsRegion,
            vpsManagedByDaemon: tenant.vpsManagedByDaemon,
            adminEmail: tenant.adminEmail,
            onboardedAt: serializeDate(tenant.onboardedAt),
            updatedAt: serializeDate(tenant.updatedAt),
          },
          latestMetrics,
        };
      }),
      {
        name: 'get_tenant',
        description: 'Inspect one tenant metadata record and its latest metrics snapshot.',
        schema: z.object({ tenantId: z.string() }),
      }
    ),

    tool(
      async ({ tenantId, service, limit }: { tenantId: string; service: string; limit?: number }) => {
        if (service !== 'api' && service !== 'agent') {
          return `Invalid service ${service}. Expected api or agent.`;
        }

        return guardedJson(ctx.governance, 'get_tenant_health', { tenantId }, async () => {
          const cappedLimit = capLimit(limit, 50, 200);
          const rows = await health.getHealthHistory(tenantId, service, cappedLimit);
          ctx.governance.recordEvidence({ tenantIds: [tenantId], records: { healthChecks: rows.length } });
          return { healthChecks: rows };
        });
      },
      {
        name: 'get_tenant_health',
        description: 'Inspect API or agent health history for one tenant.',
        schema: z.object({
          tenantId: z.string(),
          service: z.string(),
          limit: z.number().optional(),
        }),
      }
    ),

    tool(
      async ({ tenantId, limit }: { tenantId: string; limit?: number }) => guardedJson(ctx.governance, 'get_tenant_metrics', { tenantId }, async () => {
        const cappedLimit = capLimit(limit, 24, 200);
        const rows = await health.getMetricsHistory(tenantId, cappedLimit);
        ctx.governance.recordEvidence({ tenantIds: [tenantId], records: { metrics: rows.length } });
        return { metrics: rows };
      }),
      {
        name: 'get_tenant_metrics',
        description: 'Inspect recent metrics snapshots for one tenant.',
        schema: z.object({
          tenantId: z.string(),
          limit: z.number().optional(),
        }),
      }
    ),

    tool(
      async ({
        tenantId,
        service,
        level,
        limit,
      }: {
        tenantId: string;
        service?: string;
        level?: string;
        limit?: number;
      }) => guardedJson(ctx.governance, 'query_tenant_logs', { tenantId }, async () => {
        const rows = await logs.query({
          tenantId,
          service,
          level,
          limit: capLimit(limit, 50, 200),
        });
        ctx.governance.recordEvidence({ tenantIds: [tenantId], records: { logs: rows.length } });
        return { logs: rows };
      }),
      {
        name: 'query_tenant_logs',
        description: 'Inspect recent pushed logs for one tenant, optionally filtered by service and level.',
        schema: z.object({
          tenantId: z.string(),
          service: z.string().optional(),
          level: z.string().optional(),
          limit: z.number().optional(),
        }),
      }
    ),

    tool(
      async ({ tenantId, windowHours }: { tenantId: string; windowHours?: number }) => guardedJson(
        ctx.governance,
        'summarize_tenant_incidents',
        { tenantId },
        async () => {
          const cappedWindowHours = Math.min(Math.max(windowHours ?? 24, 1), 168);
          const since = new Date(Date.now() - cappedWindowHours * 60 * 60 * 1000);
          const tenant = await tenants.findById(tenantId);
          if (!tenant || tenant.offboardedAt) {
            return { tenant: null, message: `Tenant ${tenantId} not found in active scope.` };
          }

          const [apiHealth, agentHealth, errorLogs, latestMetrics] = await Promise.all([
            health.getHealthHistory(tenantId, 'api', 1),
            health.getHealthHistory(tenantId, 'agent', 1),
            logs.query({ tenantId, level: 'error', since, limit: 200 }),
            tenants.getLatestMetrics(tenantId),
          ]);

          const latestHealth = [...apiHealth, ...agentHealth];
          const unhealthyServices = latestHealth
            .filter((row) => row.status !== 'up')
            .map((row) => ({ service: row.service, status: row.status }));

          ctx.governance.recordEvidence({
            tenantIds: [tenantId],
            timeWindowHours: cappedWindowHours,
            records: {
              tenants: 1,
              healthChecks: latestHealth.length,
              logs: errorLogs.length,
              metrics: latestMetrics ? 1 : 0,
            },
          });

          return {
            tenant: {
              id: tenant.id,
              slug: tenant.slug,
              displayName: tenant.displayName,
              status: tenant.status,
            },
            windowHours: cappedWindowHours,
            unhealthyServices,
            errorLogCount: errorLogs.length,
            recentErrors: errorLogs.slice(0, 10),
            latestMetrics,
          };
        }
      ),
      {
        name: 'summarize_tenant_incidents',
        description: 'Summarize recent health, error logs, and latest metrics for one tenant without creating incidents.',
        schema: z.object({
          tenantId: z.string(),
          windowHours: z.number().optional(),
        }),
      }
    ),
  ];
}
```

- [ ] **Step 4: Run tool tests again**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.tools.test.ts"
```

Expected: all tests in `internal-agent.tools.test.ts` pass.

- [ ] **Step 5: Commit tools task**

Run:

```bash
git add apps/control-plane/src/internal-agent/tools.ts apps/control-plane/src/__tests__/internal-agent.tools.test.ts
git commit -m "feat(control-plane): add internal agent diagnostic tools"
```

---

### Task 5: Implement Prompt, Model Factory, And Runner

**Files:**
- Create: `apps/control-plane/src/internal-agent/prompt.ts`
- Create: `apps/control-plane/src/internal-agent/model.factory.ts`
- Create: `apps/control-plane/src/internal-agent/internal-agent.runner.ts`

- [ ] **Step 1: Create `apps/control-plane/src/internal-agent/prompt.ts`**

Create the file with this content:

```typescript
export const INTERNAL_AGENT_SYSTEM_PROMPT = `
You are Daemon Internal Agent, an operator assistant for the Daemon control plane.
You diagnose tenant health, metrics, and logs using only the tools provided.
You are read-only in this phase. Do not claim to suspend, activate, offboard, mutate, or remediate tenants.
When answering, cite the tools and records you used. If evidence is insufficient, say so.
Never reveal secrets, internal bearer tokens, environment variables, or raw credentials.
Return concise operational guidance with recommended follow-up steps.
`.trim();
```

- [ ] **Step 2: Create `apps/control-plane/src/internal-agent/model.factory.ts`**

Create the file with this content:

```typescript
import { ChatOpenAI } from '@langchain/openai';

export interface InternalAgentModelConfig {
  agentModel: string;
  temperature?: number;
}

function resolveModelConfig(agentModel: string): { model: string; apiKey?: string; baseURL?: string } {
  if (agentModel.startsWith('openrouter:')) {
    return {
      model: agentModel.slice('openrouter:'.length),
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    };
  }

  return {
    model: agentModel,
    apiKey: process.env.OPENAI_API_KEY,
  };
}

export function createInternalAgentModel(config: InternalAgentModelConfig) {
  const resolved = resolveModelConfig(config.agentModel);

  return new ChatOpenAI({
    model: resolved.model,
    apiKey: resolved.apiKey,
    configuration: resolved.baseURL ? { baseURL: resolved.baseURL } : undefined,
    temperature: config.temperature ?? 0.2,
  });
}
```

- [ ] **Step 3: Create `apps/control-plane/src/internal-agent/internal-agent.runner.ts`**

Create the file with this content:

```typescript
import { createDeepAgent } from 'deepagents';
import type { DbClient } from '../db/client.js';
import type { InternalAgentEvidence, InternalAgentAuditEntry, InternalAgentGovernance } from './governance.js';
import type { InternalAgentModelConfig } from './model.factory.js';
import { createInternalAgentModel } from './model.factory.js';
import { INTERNAL_AGENT_SYSTEM_PROMPT } from './prompt.js';
import { buildInternalAgentTools } from './tools.js';

export interface InternalAgentRunnerInput {
  message: string;
  db: DbClient;
  governance: InternalAgentGovernance;
}

export interface InternalAgentRunnerResult {
  answer: string;
  evidence: InternalAgentEvidence;
  audit: InternalAgentAuditEntry[];
}

export interface InternalAgentRunner {
  invoke(input: InternalAgentRunnerInput): Promise<InternalAgentRunnerResult>;
}

function extractAnswer(result: unknown): string {
  if (typeof result === 'string') return result;

  if (result && typeof result === 'object' && 'messages' in result) {
    const messages = (result as { messages?: Array<{ content?: unknown }> }).messages ?? [];
    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage?.content === 'string') return lastMessage.content;
    if (Array.isArray(lastMessage?.content)) return JSON.stringify(lastMessage.content);
  }

  return JSON.stringify(result);
}

export class DeepAgentsInternalAgentRunner implements InternalAgentRunner {
  constructor(private readonly modelConfig: InternalAgentModelConfig) {}

  async invoke(input: InternalAgentRunnerInput): Promise<InternalAgentRunnerResult> {
    const agent = createDeepAgent({
      model: createInternalAgentModel(this.modelConfig),
      tools: buildInternalAgentTools({ db: input.db, governance: input.governance }),
      systemPrompt: INTERNAL_AGENT_SYSTEM_PROMPT,
    });

    const result = await agent.invoke({
      messages: [{ role: 'user', content: input.message }],
    });

    return {
      answer: extractAnswer(result),
      evidence: input.governance.getEvidence(),
      audit: input.governance.getAudit(),
    };
  }
}
```

- [ ] **Step 4: Run build and expect only route-related missing file errors**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane build"
```

Expected: build may still fail because `internal-agent.route.ts` has not been created and imported from `app.ts`. It should not fail due to the new prompt, model factory, or runner files.

- [ ] **Step 5: Commit runner task**

Run:

```bash
git add apps/control-plane/src/internal-agent/prompt.ts apps/control-plane/src/internal-agent/model.factory.ts apps/control-plane/src/internal-agent/internal-agent.runner.ts
git commit -m "feat(control-plane): add internal agent runner"
```

---

### Task 6: Implement `/internal-agent/invoke` Route

**Files:**
- Create: `apps/control-plane/src/internal-agent/internal-agent.route.ts`
- Create: `apps/control-plane/src/__tests__/internal-agent.route.test.ts`
- Modify: `apps/control-plane/src/app.ts`

- [ ] **Step 1: Write route tests in `apps/control-plane/src/__tests__/internal-agent.route.test.ts`**

Create the file with this content:

```typescript
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildControlPlane } from '../app.js';
import type { InternalAgentRunnerFactory } from '../internal-agent/internal-agent.route.js';

const AUTH = 'Bearer test-internal-secret';

describe('Control Plane — Internal Agent', () => {
  let app: FastifyInstance;
  const invoke = vi.fn();

  beforeAll(async () => {
    const createRunner: InternalAgentRunnerFactory = () => ({ invoke });

    app = await buildControlPlane({
      port: 4002,
      dbHost: 'localhost',
      dbPort: 5433,
      dbUser: 'daemon',
      dbPassword: 'daemon_test',
      dbName: 'daemon_control',
      internalSecret: 'test-internal-secret',
      pollIntervalMs: 999999,
      createInternalAgentRunner: createRunner,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /internal-agent/invoke requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      payload: { message: 'Which tenants are unhealthy?' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('POST /internal-agent/invoke validates request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      headers: { authorization: AUTH },
      payload: { message: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /internal-agent/invoke returns answer, evidence, and audit', async () => {
    invoke.mockResolvedValueOnce({
      answer: 'ACME has degraded agent health.',
      evidence: {
        toolsCalled: ['list_tenants'],
        tenantIds: ['tenant-a'],
        recordsInspected: {
          tenants: 1,
          healthChecks: 0,
          logs: 0,
          metrics: 0,
        },
      },
      audit: [{ tool: 'list_tenants', action: 'allowed' }],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      headers: { authorization: AUTH },
      payload: {
        message: 'Which tenants are unhealthy?',
        policy: {
          allowedTools: ['list_tenants', 'suspend_tenant'],
          tenantIds: ['tenant-a'],
          maxToolCalls: 5,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.answer).toBe('ACME has degraded agent health.');
    expect(body.evidence.toolsCalled).toEqual(['list_tenants']);
    expect(body.audit).toEqual([{ tool: 'list_tenants', action: 'allowed' }]);
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Which tenants are unhealthy?',
      db: app.db,
    }));
  });

  it('POST /internal-agent/invoke returns 502 for runner failures without stack traces', async () => {
    invoke.mockRejectedValueOnce(new Error('provider secret leaked in stack should not appear'));

    const res = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      headers: { authorization: AUTH },
      payload: { message: 'Summarize incidents' },
    });

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.payload)).toEqual({ error: 'Internal agent failed to produce a response' });
    expect(res.payload).not.toContain('provider secret');
  });
});
```

- [ ] **Step 2: Run the failing route tests**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.route.test.ts"
```

Expected: fails because `../internal-agent/internal-agent.route.js` does not exist.

- [ ] **Step 3: Implement `apps/control-plane/src/internal-agent/internal-agent.route.ts`**

Create the file with this content:

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InternalAgentGovernance } from './governance.js';
import { DeepAgentsInternalAgentRunner, type InternalAgentRunner } from './internal-agent.runner.js';
import type { InternalAgentModelConfig } from './model.factory.js';
import { composeInternalAgentPolicy } from './policy.js';

const invokeBodySchema = z.object({
  message: z.string().min(1),
  policy: z.object({
    allowedTools: z.array(z.string()).optional(),
    tenantIds: z.array(z.string()).optional(),
    maxToolCalls: z.number().int().nonnegative().optional(),
  }).optional(),
});

export type InternalAgentRunnerFactory = (config: InternalAgentModelConfig) => InternalAgentRunner;

export interface InternalAgentRouteOptions {
  modelConfig: InternalAgentModelConfig;
  createRunner?: InternalAgentRunnerFactory;
}

export async function internalAgentRoute(
  app: FastifyInstance,
  options: InternalAgentRouteOptions
) {
  const createRunner = options.createRunner ?? ((config) => new DeepAgentsInternalAgentRunner(config));

  app.post('/invoke', async (request, reply) => {
    const parsed = invokeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid internal-agent request body' });
    }

    const policy = composeInternalAgentPolicy(parsed.data.policy);
    const governance = new InternalAgentGovernance(policy);
    const runner = createRunner(options.modelConfig);

    try {
      const result = await runner.invoke({
        message: parsed.data.message,
        db: app.db,
        governance,
      });

      return reply.send(result);
    } catch (error) {
      request.log.error({ err: error }, 'Internal agent invocation failed');
      return reply.code(502).send({ error: 'Internal agent failed to produce a response' });
    }
  });
}
```

- [ ] **Step 4: Ensure `apps/control-plane/src/app.ts` imports and registers the route**

If Task 1 only partially edited `app.ts`, make sure the final route section is exactly:

```typescript
  await app.register(tenantsRoute, { prefix: '/tenants' });
  await app.register(healthRoute, { prefix: '/tenants' });
  await app.register(logReceiveRoute, { broadcaster, prefix: '/logs' });
  await app.register(logQueryRoute, { prefix: '/tenants' });
  await app.register(internalAgentRoute, {
    prefix: '/internal-agent',
    modelConfig: {
      agentModel: config.internalAgentModel ?? 'openrouter:minimax/minimax-m2.7',
      temperature: config.internalAgentTemperature,
    },
    createRunner: config.createInternalAgentRunner,
  });
  await app.register(wsRoute, { broadcaster });
```

- [ ] **Step 5: Run route tests again**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test -- src/__tests__/internal-agent.route.test.ts"
```

Expected: all route tests pass.

- [ ] **Step 6: Commit route task**

Run:

```bash
git add apps/control-plane/src/internal-agent/internal-agent.route.ts apps/control-plane/src/__tests__/internal-agent.route.test.ts apps/control-plane/src/app.ts
git commit -m "feat(control-plane): expose internal agent invoke route"
```

---

### Task 7: Verify Plan 17 End-To-End

**Files:**
- All files changed by Tasks 1-6

- [ ] **Step 1: Run targeted control-plane tests**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane test"
```

Expected: all control-plane tests pass.

- [ ] **Step 2: Build control-plane**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/control-plane build"
```

Expected: TypeScript build exits `0`.

- [ ] **Step 3: Run full workspace test suite**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm test"
```

Expected: all Turbo tasks pass.

- [ ] **Step 4: Run diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only Plan 17 files, control-plane config files, and lockfile changes are present.

- [ ] **Step 6: Final commit**

If previous tasks were committed individually, skip this step. If work is still uncommitted, run:

```bash
git add apps/control-plane pnpm-lock.yaml
git commit -m "feat(control-plane): add read-only internal agent"
```

---

## Implementation Notes

- Keep Plan 17 read-only. Do not add tools named `suspend_tenant`, `activate_tenant`, `offboard_tenant`, `execute_action`, or `propose_action`.
- Do not create a database table for profiles, incidents, or conversation history in Plan 17.
- The model-generated answer is not evidence. Evidence and audit must come from `InternalAgentGovernance`.
- If the request narrows `allowedTools` to an empty array, the agent still runs but every tool call is denied.
- `tenantIds` omitted means all active, non-offboarded tenants are eligible, enforced indirectly by repository reads and direct tenant-scope checks when a tool receives a `tenantId`.
- The route must rely on existing control-plane bearer auth. Do not add a `/internal-agent` auth exception.
- Tool results intentionally exclude business object payloads and request bodies; control-plane does not store tenant business data.

## Self-Review

- Spec coverage: endpoint, auth, policy composition, read-only tools, model config, prompt, evidence, audit, and failure handling are covered by Tasks 1-7.
- Placeholder scan: no steps rely on unspecified validation, unnamed tests, or future work.
- Type consistency: `InternalAgentRunnerFactory`, `InternalAgentModelConfig`, `InternalAgentGovernance`, and policy types are introduced before route registration uses them.
