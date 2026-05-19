# Plan 18 Secure Internal Agent Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the `/internal-agent/invoke` endpoint using a database-backed operator registry with Auth, RBAC, strict tenant scoping, and audit attribution.

**Architecture:** We will add `operators` and `operator_tenant_access` tables. A Fastify middleware will authenticate requests via API Key hashes, appending the resolved identity to `request.operator`. The route will enforce RBAC by overriding the governance `tenantIds` for non-admin operators. Finally, the governance system will tag all audit entries with the `operatorId`.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, Vitest, Node `crypto`.

---

## File Structure

- **Modify:** `apps/control-plane/src/db/schema.ts` (Add new tables)
- **Create:** `apps/control-plane/src/operators/operator.repository.ts` (DB queries for operators)
- **Create:** `apps/control-plane/src/internal-agent/auth.middleware.ts` (Fastify hook)
- **Modify:** `apps/control-plane/src/internal-agent/governance.ts` (Add operatorId to audit)
- **Modify:** `apps/control-plane/src/internal-agent/runner.ts` (Pass operatorId down)
- **Modify:** `apps/control-plane/src/internal-agent/internal-agent.route.ts` (Apply auth and RBAC)

---

### Task 1: Database Schema Update

**Files:**
- Modify: `apps/control-plane/src/db/schema.ts`
- Create: `apps/control-plane/src/db/__tests__/schema-operator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/control-plane/src/db/__tests__/schema-operator.test.ts
import { describe, it, expect } from 'vitest';
import { operators, operatorTenantAccess } from '../schema.js';

describe('Operator Schema', () => {
  it('exports operators and operatorTenantAccess tables', () => {
    expect(operators).toBeDefined();
    expect(operatorTenantAccess).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/db/__tests__/schema-operator.test.ts"`
Expected: FAIL (operators is not defined)

- [ ] **Step 3: Write minimal implementation**

Edit `apps/control-plane/src/db/schema.ts` to add imports and tables at the bottom:
```typescript
import { primaryKey } from 'drizzle-orm/pg-core'; // Add this to imports at the top if missing

// ... existing code ...

// ─── Operators ────────────────────────────────────────────────────────────────
export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(), // 'admin' | 'operator'
  apiKeyHash: text('api_key_hash').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const operatorTenantAccess = pgTable('operator_tenant_access', {
  operatorId: uuid('operator_id').notNull().references(() => operators.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.operatorId, t.tenantId] }),
}));
```
*(Make sure `primaryKey` is imported from `drizzle-orm/pg-core` at the top of the file)*

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/db/__tests__/schema-operator.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/control-plane/src/db/schema.ts apps/control-plane/src/db/__tests__/schema-operator.test.ts
git commit -m "feat(control-plane): add operator schema for internal agent auth"
```

---

### Task 2: Operator Repository

**Files:**
- Create: `apps/control-plane/src/operators/operator.repository.ts`
- Create: `apps/control-plane/src/operators/__tests__/operator.repository.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/control-plane/src/operators/__tests__/operator.repository.test.ts
import { describe, it, expect, vi } from 'vitest';
import { OperatorRepository } from '../operator.repository.js';
import type { DbClient } from '../../db/client.js';

describe('OperatorRepository', () => {
  it('finds operator by apiKeyHash and aggregates tenantIds', async () => {
    const mockRows = [
      {
        operators: { id: 'op-1', email: 'test@daem.on', role: 'operator', apiKeyHash: 'hash1', status: 'active', createdAt: new Date(), updatedAt: new Date() },
        operator_tenant_access: { operatorId: 'op-1', tenantId: 't-1' }
      },
      {
        operators: { id: 'op-1', email: 'test@daem.on', role: 'operator', apiKeyHash: 'hash1', status: 'active', createdAt: new Date(), updatedAt: new Date() },
        operator_tenant_access: { operatorId: 'op-1', tenantId: 't-2' }
      }
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockRows),
    } as unknown as DbClient;

    const repo = new OperatorRepository(mockDb);
    const result = await repo.findByApiKeyHash('hash1');

    expect(result).toBeDefined();
    expect(result?.id).toBe('op-1');
    expect(result?.tenantIds).toEqual(['t-1', 't-2']);
  });

  it('returns null if not found', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as unknown as DbClient;

    const repo = new OperatorRepository(mockDb);
    const result = await repo.findByApiKeyHash('hash-none');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/operators/__tests__/operator.repository.test.ts"`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/control-plane/src/operators/operator.repository.ts
import { eq } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { operators, operatorTenantAccess } from '../db/schema.js';

export interface OperatorWithTenants {
  id: string;
  email: string;
  role: 'admin' | 'operator';
  status: 'active' | 'suspended';
  apiKeyHash: string;
  tenantIds: string[];
}

export class OperatorRepository {
  constructor(private db: DbClient) {}

  async findByApiKeyHash(hash: string): Promise<OperatorWithTenants | null> {
    const rows = await this.db
      .select()
      .from(operators)
      .leftJoin(operatorTenantAccess, eq(operators.id, operatorTenantAccess.operatorId))
      .where(eq(operators.apiKeyHash, hash));

    if (rows.length === 0) return null;

    const op = rows[0].operators;
    const tenantIds = rows
      .map((r) => r.operator_tenant_access?.tenantId)
      .filter((id): id is string => id !== null && id !== undefined);

    return {
      id: op.id,
      email: op.email,
      role: op.role as 'admin' | 'operator',
      status: op.status as 'active' | 'suspended',
      apiKeyHash: op.apiKeyHash,
      tenantIds,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/operators/__tests__/operator.repository.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/control-plane/src/operators/operator.repository.ts apps/control-plane/src/operators/__tests__/operator.repository.test.ts
git commit -m "feat(control-plane): implement operator repository"
```

---

### Task 3: Audit Logging and Governance Updates

**Files:**
- Modify: `apps/control-plane/src/internal-agent/governance.ts`
- Modify: `apps/control-plane/src/internal-agent/runner.ts`
- Modify: `apps/control-plane/src/__tests__/internal-agent.policy.test.ts` (governance test)

- [ ] **Step 1: Write the failing test**

Edit `apps/control-plane/src/__tests__/internal-agent.policy.test.ts` to expect operatorId in audit:
```typescript
// Add inside describe('governance wrapping')
it('includes operatorId in audit logs if provided', async () => {
  const governance = new InternalAgentGovernance(READONLY_OPERATOR_POLICY, 'op-123');
  await governance.runTool('list_tenants', {}, async () => ({ tenants: [] }));
  
  const audit = governance.getAudit();
  expect(audit[0].operatorId).toBe('op-123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/__tests__/internal-agent.policy.test.ts"`
Expected: FAIL (property operatorId does not exist on audit entry, constructor doesn't take 2nd arg)

- [ ] **Step 3: Write minimal implementation**

Edit `apps/control-plane/src/internal-agent/governance.ts`:
```typescript
// Update InternalAgentAuditEntry interface
export interface InternalAgentAuditEntry {
  tool: string;
  action: 'allowed' | 'denied' | 'error';
  reason?: string;
  operatorId?: string; // Add this line
}

// Update class InternalAgentGovernance
export class InternalAgentGovernance {
  // ... existing private fields ...
  constructor(
    private readonly policy: InternalAgentPolicy,
    private readonly operatorId?: string // Add parameter
  ) {
    this.allowedTools = new Set(policy.allowedTools);
    this.allowedTenantIds = policy.tenantIds ? new Set(policy.tenantIds) : undefined;
  }

  // Update audit pushes in runTool:
  // this.audit.push({ tool: toolName, action: 'allowed', operatorId: this.operatorId });
  // this.audit.push({ tool: toolName, action: 'error', reason: getErrorReason(error), operatorId: this.operatorId });
  
  // Update private deny method:
  private deny(tool: string, reason: string): GovernedToolResult<never> {
    this.audit.push({ tool, action: 'denied', reason, operatorId: this.operatorId });
    return { allowed: false, denial: reason };
  }
// ... rest remains same ...
```

Edit `apps/control-plane/src/internal-agent/runner.ts`:
```typescript
// Update factory parameters and creation
  static create(
    policy: InternalAgentPolicy,
    override: InternalAgentPolicyOverride | undefined,
    repositories: {
      tenantRepository: TenantRepository;
      healthRepository: HealthRepository;
      logRepository: LogRepository;
    },
    model: BaseChatModel,
    operatorId?: string // Add parameter
  ): InternalAgentRunner {
    const effectivePolicy = composeInternalAgentPolicy(override);
    const governance = new InternalAgentGovernance(effectivePolicy, operatorId); // Pass here
    // ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/__tests__/internal-agent.policy.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/control-plane/src/internal-agent/governance.ts apps/control-plane/src/internal-agent/runner.ts apps/control-plane/src/__tests__/internal-agent.policy.test.ts
git commit -m "feat(control-plane): attach operatorId to internal agent audit logs"
```

---

### Task 4: Auth Middleware & Route Integration

**Files:**
- Create: `apps/control-plane/src/internal-agent/auth.middleware.ts`
- Create: `apps/control-plane/src/internal-agent/__tests__/auth.middleware.test.ts`
- Modify: `apps/control-plane/src/internal-agent/internal-agent.route.ts`
- Modify: `apps/control-plane/src/internal-agent/__tests__/internal-agent.route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/control-plane/src/internal-agent/__tests__/auth.middleware.test.ts
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { operatorAuth } from '../auth.middleware.js';
import crypto from 'crypto';

describe('Auth Middleware', () => {
  it('rejects without header', async () => {
    const app = Fastify();
    app.route({ method: 'GET', url: '/', preHandler: operatorAuth, handler: async () => 'ok' });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts valid token and populates req.operator', async () => {
    const app = Fastify();
    const token = 'test-token';
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    app.decorate('db', {});
    vi.mock('../../operators/operator.repository.js', () => ({
      OperatorRepository: vi.fn().mockImplementation(() => ({
        findByApiKeyHash: vi.fn().mockResolvedValue({
          id: 'op-1',
          role: 'admin',
          status: 'active',
          tenantIds: []
        })
      }))
    }));

    app.route({
      method: 'GET',
      url: '/',
      preHandler: operatorAuth,
      handler: async (req) => req.operator
    });

    const res = await app.inject({ method: 'GET', url: '/', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe('op-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/internal-agent/__tests__/auth.middleware.test.ts"`
Expected: FAIL (auth.middleware.ts not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/control-plane/src/internal-agent/auth.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { OperatorRepository } from '../operators/operator.repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    operator?: {
      id: string;
      email: string;
      role: 'admin' | 'operator';
      tenantIds: string[];
    };
  }
}

export async function operatorAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const repo = new OperatorRepository(request.server.db as any);
  const op = await repo.findByApiKeyHash(hash);

  if (!op || op.status !== 'active') {
    return reply.code(401).send({ error: 'Invalid or suspended operator token' });
  }

  request.operator = {
    id: op.id,
    email: op.email,
    role: op.role,
    tenantIds: op.tenantIds,
  };
}
```

Edit `apps/control-plane/src/internal-agent/internal-agent.route.ts`:
```typescript
import { operatorAuth } from './auth.middleware.js'; // Add import
// Add operatorId param to InternalAgentRunnerFactory type
export type InternalAgentRunnerFactory = (
  policy: InternalAgentPolicy,
  governance: InternalAgentGovernanceType,
  repositories: any,
  model: any,
  operatorId?: string
) => InternalAgentRunner;

// Update fastify.post options inside internalAgentRoute:
  fastify.post<{ Body: z.infer<typeof InvokeRequestSchema> }>(
    '/invoke',
    { preHandler: [operatorAuth] }, // ADD PREHANDLER
    async (request, reply) => {
      const op = request.operator;
      if (!op) return reply.code(401).send({ error: 'Unauthorized' });

      // ... safeParse ...
      const { question, tenantIds, toolNames } = parseResult.data;
      
      try {
        // ... getModelConfigFromEnv, createModel ...

        const policyOverride: { allowedTools?: string[]; tenantIds?: string[] } = {};
        if (toolNames) policyOverride.allowedTools = toolNames;
        
        // RBAC Enforcement:
        if (op.role === 'admin') {
          if (tenantIds) policyOverride.tenantIds = tenantIds;
        } else {
          // Force operator tenant scope
          policyOverride.tenantIds = op.tenantIds;
        }

        const effectivePolicy = composeInternalAgentPolicy(
          Object.keys(policyOverride).length > 0 ? policyOverride : undefined
        );

        const governance = new InternalAgentGovernance(effectivePolicy, op.id); // PASS operatorId

        // ... tenantRepo, healthRepo, logRepo ...
        // Update createRunner to pass op.id
        const runner =
          createRunner?.(effectivePolicy, governance, { tenantRepository: tenantRepo, healthRepository: healthRepo, logRepository: logRepo }, model, op.id) ??
          new InternalAgentRunner(effectivePolicy, governance, {
            // ... tools mapping ...
          }, model, undefined, undefined, op.id); // Assuming runner constructor takes op.id

        // ... rest of route ...
```

Edit `apps/control-plane/src/internal-agent/runner.ts`:
```typescript
// Update InternalAgentRunner constructor to optionally take operatorId
  constructor(
    private readonly policy: InternalAgentPolicy,
    private readonly governance: InternalAgentGovernance,
    private readonly tools: Record<string, any>,
    private readonly model: BaseChatModel,
    private readonly systemPrompt: string = INTERNAL_AGENT_SYSTEM_PROMPT,
    toolDefinitions: ToolDefinition[] = TOOL_DEFINITIONS,
    private readonly operatorId?: string // ADD THIS
  ) {
```

Edit `apps/control-plane/src/internal-agent/__tests__/internal-agent.route.test.ts` to mock `auth.middleware.ts` so route tests pass without DB:
```typescript
vi.mock('../auth.middleware.js', () => ({
  operatorAuth: async (req: any) => {
    req.operator = { id: 'admin-1', role: 'admin', tenantIds: [] };
  }
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology/apps/control-plane && /usr/bin/pnpm exec vitest run src/internal-agent/__tests__/"`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/control-plane/src/internal-agent/auth.middleware.ts apps/control-plane/src/internal-agent/__tests__/auth.middleware.test.ts apps/control-plane/src/internal-agent/internal-agent.route.ts apps/control-plane/src/internal-agent/__tests__/internal-agent.route.test.ts apps/control-plane/src/internal-agent/runner.ts
git commit -m "feat(control-plane): add operator auth middleware and RBAC enforcement to route"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-plan-18-secure-internal-agent-access.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**