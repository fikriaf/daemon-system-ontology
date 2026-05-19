# Plan 3: `ontology-sdk` + `apps/api` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi `ontology-sdk` sebagai typed client untuk apps dan agent, serta `apps/api` sebagai Fastify HTTP gateway yang mengekspos ontology engine via REST — termasuk auth JWT, proposal HITL flow, dan real-time Pub/Sub.

**Architecture:** `ontology-sdk` adalah thin typed wrapper di atas `OntologyEngine` untuk digunakan oleh frontend apps dan agent. `apps/api` adalah Fastify server yang meng-instantiate engine per request menggunakan registry cache Redis, expose route untuk query objects, propose/approve/reject actions, dan schema management.

**Tech Stack:** TypeScript, Fastify, `@fastify/jwt`, `@fastify/rate-limit`, `zod`, `vitest`, `supertest` untuk integration tests.

**Prerequisite:** Plan 1 dan Plan 2 selesai.

---

## File Map

```
packages/ontology-sdk/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── client/
    │   └── ontology.client.ts           ← Entry point untuk consumers
    ├── objects/
    │   └── object.query-builder.ts      ← Chainable query builder
    └── actions/
        └── action.proposer.ts           ← propose() — tidak execute langsung

apps/api/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                         ← Server entry point
    ├── app.ts                           ← Fastify app factory
    ├── plugins/
    │   ├── auth.plugin.ts               ← JWT verify + tenant resolve
    │   ├── rate-limit.plugin.ts         ← Redis-based per tenant
    │   └── engine.plugin.ts             ← OntologyEngine per request
    ├── routes/
    │   ├── objects/
    │   │   ├── query.route.ts           ← GET /objects/:type
    │   │   └── get.route.ts             ← GET /objects/:type/:id
    │   ├── actions/
    │   │   ├── propose.route.ts         ← POST /actions/propose
    │   │   ├── approve.route.ts         ← POST /actions/:proposalId/approve
    │   │   ├── reject.route.ts          ← POST /actions/:proposalId/reject
    │   │   └── execute.route.ts         ← POST /actions/:proposalId/execute (internal)
    │   ├── schema/
    │   │   ├── read.route.ts            ← GET /schema/object-types
    │   │   └── override.route.ts        ← POST /schema/overrides
    │   └── audit/
    │       └── log.route.ts             ← GET /audit/log
    ├── middleware/
    │   ├── legal-entity.guard.ts        ← legalEntityId scoping
    │   └── rbac.guard.ts               ← Role check per action type
    └── __tests__/
        ├── objects.test.ts
        └── actions.test.ts
```

---

## Task 1: Scaffold `ontology-sdk`

**Files:**
- Create: `packages/ontology-sdk/package.json`
- Create: `packages/ontology-sdk/tsconfig.json`
- Create: `packages/ontology-sdk/src/index.ts`

- [ ] **Step 1: Buat direktori**

```bash
New-Item -ItemType Directory -Path "packages\ontology-sdk\src\client" -Force
New-Item -ItemType Directory -Path "packages\ontology-sdk\src\objects" -Force
New-Item -ItemType Directory -Path "packages\ontology-sdk\src\actions" -Force
New-Item -ItemType Directory -Path "packages\ontology-sdk\src\__tests__" -Force
```

- [ ] **Step 2: Buat `packages/ontology-sdk/package.json`**

```json
{
  "name": "@daemon/ontology-sdk",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@daemon/ontology-engine": "workspace:*",
    "@daemon/ontology-language": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Buat `packages/ontology-sdk/tsconfig.json`**

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
pnpm install --filter @daemon/ontology-sdk
```

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-sdk/
git commit -m "chore: scaffold ontology-sdk package"
```

---

## Task 2: Implementasi `ontology-sdk` — Query Builder + Proposer

**Files:**
- Create: `packages/ontology-sdk/src/objects/object.query-builder.ts`
- Create: `packages/ontology-sdk/src/actions/action.proposer.ts`
- Create: `packages/ontology-sdk/src/client/ontology.client.ts`
- Create: `packages/ontology-sdk/src/__tests__/client.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `packages/ontology-sdk/src/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OntologyClient } from '../client/ontology.client.js';
import type { OntologyEngine } from '@daemon/ontology-engine';

describe('OntologyClient', () => {
  let client: OntologyClient;
  const mockEngine = {
    objects: {
      queryObjects: vi.fn().mockResolvedValue([
        {
          id: 'obj-001',
          typeApiName: 'Shipment',
          properties: { shipmentId: 'SHP-001', status: 'Draft', legalEntityId: 'ANT' },
        },
      ]),
      getObject: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OntologyClient(mockEngine as unknown as OntologyEngine);
  });

  describe('objects()', () => {
    it('returns query builder for type', () => {
      const builder = client.objects('Shipment');
      expect(builder).toBeDefined();
      expect(typeof builder.filter).toBe('function');
      expect(typeof builder.limit).toBe('function');
      expect(typeof builder.get).toBe('function');
    });

    it('executes query via engine', async () => {
      const results = await client.objects('Shipment').get();
      expect(mockEngine.objects.queryObjects).toHaveBeenCalledWith('Shipment', {});
      expect(results).toHaveLength(1);
    });

    it('applies filter correctly', async () => {
      await client
        .objects('Shipment')
        .filter({ status: 'InTransit', legalEntityId: 'ANT' })
        .get();

      expect(mockEngine.objects.queryObjects).toHaveBeenCalledWith('Shipment', {
        status: 'InTransit',
        legalEntityId: 'ANT',
      });
    });
  });

  describe('actions.propose()', () => {
    it('returns proposal id and status', async () => {
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'),
      };
      const clientWithRedis = new OntologyClient(
        mockEngine as unknown as OntologyEngine,
        mockRedis as any,
        'abc-express'
      );

      const result = await clientWithRedis.actions.propose(
        'transitionShipmentState',
        { shipmentId: 'SHP-001', newStatus: 'InTransit' }
      );

      expect(result.status).toBe('awaiting_approval');
      expect(result.proposalId).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-sdk test
```

Expected: FAIL — `OntologyClient` not found

- [ ] **Step 3: Implementasi `src/objects/object.query-builder.ts`**

```typescript
import type { OntologyEngine } from '@daemon/ontology-engine';

export type ObjectRow = {
  id: string;
  typeApiName: string;
  properties: Record<string, unknown>;
  legalEntityId: string | null;
};

export class ObjectQueryBuilder {
  private filters: Record<string, unknown> = {};
  private limitValue?: number;

  constructor(
    private engine: OntologyEngine,
    private typeApiName: string
  ) {}

  filter(filters: Record<string, unknown>): this {
    this.filters = { ...this.filters, ...filters };
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  async get(): Promise<ObjectRow[]> {
    const results = await this.engine.objects.queryObjects(
      this.typeApiName,
      this.filters
    );

    if (this.limitValue !== undefined) {
      return results.slice(0, this.limitValue) as ObjectRow[];
    }

    return results as ObjectRow[];
  }
}
```

- [ ] **Step 4: Implementasi `src/actions/action.proposer.ts`**

```typescript
import type Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface Proposal {
  proposalId: string;
  actionTypeId: string;
  payload: Record<string, unknown>;
  status: 'awaiting_approval';
  createdAt: string;
}

const PROPOSAL_TTL_SECONDS = 86400; // 24 jam

export class ActionProposer {
  constructor(
    private redis: Redis,
    private tenantId: string
  ) {}

  async propose(
    actionTypeId: string,
    payload: Record<string, unknown>
  ): Promise<Proposal> {
    const proposalId = randomUUID();
    const proposal: Proposal = {
      proposalId,
      actionTypeId,
      payload,
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
    };

    await this.redis.set(
      `proposal:${this.tenantId}:${proposalId}`,
      JSON.stringify(proposal),
      'EX',
      PROPOSAL_TTL_SECONDS
    );

    return proposal;
  }

  async getProposal(proposalId: string): Promise<Proposal | null> {
    const raw = await this.redis.get(`proposal:${this.tenantId}:${proposalId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Proposal;
  }

  async deleteProposal(proposalId: string): Promise<void> {
    await this.redis.del(`proposal:${this.tenantId}:${proposalId}`);
  }
}
```

- [ ] **Step 5: Implementasi `src/client/ontology.client.ts`**

```typescript
import type Redis from 'ioredis';
import type { OntologyEngine } from '@daemon/ontology-engine';
import { ObjectQueryBuilder } from '../objects/object.query-builder.js';
import { ActionProposer, type Proposal } from '../actions/action.proposer.js';

export class OntologyClient {
  private proposer?: ActionProposer;

  constructor(
    private engine: OntologyEngine,
    redis?: Redis,
    tenantId?: string
  ) {
    if (redis && tenantId) {
      this.proposer = new ActionProposer(redis, tenantId);
    }
  }

  objects(typeApiName: string): ObjectQueryBuilder {
    return new ObjectQueryBuilder(this.engine, typeApiName);
  }

  get actions() {
    return {
      propose: async (
        actionTypeId: string,
        payload: Record<string, unknown>
      ): Promise<Proposal> => {
        if (!this.proposer) {
          throw new Error('Redis and tenantId required for action proposals');
        }
        return this.proposer.propose(actionTypeId, payload);
      },

      getProposal: async (proposalId: string): Promise<Proposal | null> => {
        if (!this.proposer) return null;
        return this.proposer.getProposal(proposalId);
      },
    };
  }
}
```

- [ ] **Step 6: Buat `src/index.ts`**

```typescript
export { OntologyClient } from './client/ontology.client.js';
export { ObjectQueryBuilder } from './objects/object.query-builder.js';
export { ActionProposer } from './actions/action.proposer.js';
export type { Proposal } from './actions/action.proposer.js';
export type { ObjectRow } from './objects/object.query-builder.js';
```

- [ ] **Step 7: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-sdk test
```

Expected: PASS

- [ ] **Step 8: Build**

```bash
pnpm --filter @daemon/ontology-sdk build
```

Expected: sukses

- [ ] **Step 9: Commit**

```bash
git add packages/ontology-sdk/
git commit -m "feat(ontology-sdk): add OntologyClient with query builder and action proposer"
```

---

## Task 3: Scaffold `apps/api`

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Buat direktori**

```bash
New-Item -ItemType Directory -Path "apps\api\src\plugins" -Force
New-Item -ItemType Directory -Path "apps\api\src\routes\objects" -Force
New-Item -ItemType Directory -Path "apps\api\src\routes\actions" -Force
New-Item -ItemType Directory -Path "apps\api\src\routes\schema" -Force
New-Item -ItemType Directory -Path "apps\api\src\routes\audit" -Force
New-Item -ItemType Directory -Path "apps\api\src\middleware" -Force
New-Item -ItemType Directory -Path "apps\api\src\__tests__" -Force
```

- [ ] **Step 2: Buat `apps/api/package.json`**

```json
{
  "name": "@daemon/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@daemon/ontology-engine": "workspace:*",
    "@daemon/ontology-sdk": "workspace:*",
    "@daemon/ontology-language": "workspace:*",
    "@fastify/jwt": "^9.0.0",
    "@fastify/rate-limit": "^10.0.0",
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

- [ ] **Step 3: Buat `apps/api/tsconfig.json`**

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

- [ ] **Step 4: Buat `src/app.ts`**

```typescript
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { authPlugin } from './plugins/auth.plugin.js';
import { enginePlugin } from './plugins/engine.plugin.js';
import { objectsQueryRoute } from './routes/objects/query.route.js';
import { objectsGetRoute } from './routes/objects/get.route.js';
import { actionsProposeRoute } from './routes/actions/propose.route.js';
import { actionsApproveRoute } from './routes/actions/approve.route.js';
import { actionsRejectRoute } from './routes/actions/reject.route.js';
import { actionsExecuteRoute } from './routes/actions/execute.route.js';
import { schemaReadRoute } from './routes/schema/read.route.js';
import { auditLogRoute } from './routes/audit/log.route.js';

export interface AppConfig {
  jwtSecret: string;
  redisUrl: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  schemaDir: string;
}

export async function buildApp(config: AppConfig) {
  const app = Fastify({ logger: true });

  // Plugins
  await app.register(fastifyJwt, { secret: config.jwtSecret });
  await app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(authPlugin);
  await app.register(enginePlugin, { config });

  // Routes
  await app.register(objectsQueryRoute, { prefix: '/objects' });
  await app.register(objectsGetRoute, { prefix: '/objects' });
  await app.register(actionsProposeRoute, { prefix: '/actions' });
  await app.register(actionsApproveRoute, { prefix: '/actions' });
  await app.register(actionsRejectRoute, { prefix: '/actions' });
  await app.register(actionsExecuteRoute, { prefix: '/actions' });
  await app.register(schemaReadRoute, { prefix: '/schema' });
  await app.register(auditLogRoute, { prefix: '/audit' });

  return app;
}
```

- [ ] **Step 5: Buat `src/index.ts`**

```typescript
import { buildApp } from './app.js';

const config = {
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? '5433'),
  dbUser: process.env.DB_USER ?? 'daemon',
  dbPassword: process.env.DB_PASSWORD ?? 'daemon_test',
  dbName: process.env.DB_NAME ?? 'daemon_test',
  schemaDir: process.env.SCHEMA_DIR ?? './schemas',
};

const app = await buildApp(config);

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('API server running on port 3000');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install --filter @daemon/api
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/
git commit -m "chore: scaffold apps/api with Fastify"
```

---

## Task 4: Plugins — Auth + Engine

**Files:**
- Create: `apps/api/src/plugins/auth.plugin.ts`
- Create: `apps/api/src/plugins/engine.plugin.ts`

- [ ] **Step 1: Implementasi `src/plugins/auth.plugin.ts`**

```typescript
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    roleId: string;
    legalEntityId: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Skip auth pada health check
    if (request.url === '/health') return;

    try {
      await request.jwtVerify();
      const payload = request.user as {
        tenantId: string;
        userId: string;
        roleId: string;
        legalEntityId: string;
      };

      request.tenantId = payload.tenantId;
      request.userId = payload.userId;
      request.roleId = payload.roleId;
      request.legalEntityId = payload.legalEntityId;
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(authPlugin);
export { authPlugin };
```

- [ ] **Step 2: Install fastify-plugin**

```bash
pnpm add fastify-plugin --filter @daemon/api
```

- [ ] **Step 3: Implementasi `src/plugins/engine.plugin.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { OntologyEngine } from '@daemon/ontology-engine';
import type { AppConfig } from '../app.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine: OntologyEngine;
  }
}

interface EnginePluginOptions {
  config: AppConfig;
}

const enginePlugin: FastifyPluginAsync<EnginePluginOptions> = async (fastify, opts) => {
  const engine = await OntologyEngine.create({
    db: {
      host: opts.config.dbHost,
      port: opts.config.dbPort,
      user: opts.config.dbUser,
      password: opts.config.dbPassword,
      database: opts.config.dbName,
    },
    redis: {
      host: new URL(opts.config.redisUrl).hostname,
      port: Number(new URL(opts.config.redisUrl).port),
    },
    tenantId: 'default', // overridden per-request via JWT
    schemaDir: opts.config.schemaDir,
  });

  fastify.decorate('engine', engine);
};

export default fp(enginePlugin);
export { enginePlugin };
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/plugins/
git commit -m "feat(api): add auth and engine plugins"
```

---

## Task 5: Routes — Objects

**Files:**
- Create: `apps/api/src/routes/objects/query.route.ts`
- Create: `apps/api/src/routes/objects/get.route.ts`
- Create: `apps/api/src/__tests__/objects.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `apps/api/src/__tests__/objects.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Objects routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      jwtSecret: 'test-secret',
      redisUrl: 'redis://localhost:6380',
      dbHost: 'localhost',
      dbPort: 5433,
      dbUser: 'daemon',
      dbPassword: 'daemon_test',
      dbName: 'daemon_test',
      schemaDir: '../../packages/ontology-language/src/__tests__/fixtures',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /objects/:type requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/objects/Shipment',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /objects/:type returns objects for authenticated user', async () => {
    // Generate test JWT
    const token = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'user-1',
      roleId: 'operator',
      legalEntityId: 'ANT',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/objects/Shipment',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/api test
```

Expected: FAIL — routes not found

- [ ] **Step 3: Implementasi `src/routes/objects/query.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const QueryStringSchema = z.object({
  legalEntityId: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

export const objectsQueryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { type: string };
    Querystring: Record<string, string>;
  }>('/:type', async (request, reply) => {
    const { type } = request.params;
    const query = QueryStringSchema.parse(request.query);

    const filters: Record<string, unknown> = {};
    if (query.legalEntityId) {
      filters['legalEntityId'] = query.legalEntityId;
    }

    const results = await fastify.engine.objects.queryObjects(type, filters);

    const limited = query.limit ? results.slice(0, query.limit) : results;

    return reply.send({ data: limited, total: limited.length });
  });
};
```

- [ ] **Step 4: Implementasi `src/routes/objects/get.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';

export const objectsGetRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { type: string; id: string };
  }>('/:type/:id', async (request, reply) => {
    const { id } = request.params;

    const object = await fastify.engine.objects.getObject(id);

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    return reply.send({ data: object });
  });
};
```

- [ ] **Step 5: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/api test
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/objects/ apps/api/src/__tests__/objects.test.ts
git commit -m "feat(api): add objects query and get routes"
```

---

## Task 6: Routes — Actions (Propose / Approve / Reject / Execute)

**Files:**
- Create: `apps/api/src/routes/actions/propose.route.ts`
- Create: `apps/api/src/routes/actions/approve.route.ts`
- Create: `apps/api/src/routes/actions/reject.route.ts`
- Create: `apps/api/src/routes/actions/execute.route.ts`
- Create: `apps/api/src/__tests__/actions.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `apps/api/src/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Actions routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp({
      jwtSecret: 'test-secret',
      redisUrl: 'redis://localhost:6380',
      dbHost: 'localhost',
      dbPort: 5433,
      dbUser: 'daemon',
      dbPassword: 'daemon_test',
      dbName: 'daemon_test',
      schemaDir: '../../packages/ontology-language/src/__tests__/fixtures',
    });

    token = app.jwt.sign({
      tenantId: 'test-tenant',
      userId: 'user-1',
      roleId: 'operator',
      legalEntityId: 'ANT',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /actions/propose returns proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.proposalId).toBeDefined();
    expect(body.status).toBe('awaiting_approval');
  });

  it('POST /actions/propose rejects unknown action type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'nonExistentAction',
        payload: {},
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /actions/:proposalId/approve executes action', async () => {
    // First propose
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/actions/propose',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actionTypeId: 'transitionShipmentState',
        payload: { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      },
    });
    const { proposalId } = JSON.parse(proposeRes.payload);

    // Then approve
    const approveRes = await app.inject({
      method: 'POST',
      url: `/actions/${proposalId}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(approveRes.statusCode).toBe(200);
    const body = JSON.parse(approveRes.payload);
    expect(body.status).toBe('executed');
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/api test
```

Expected: FAIL — action routes not found

- [ ] **Step 3: Implementasi `src/routes/actions/propose.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';

const ProposeBodySchema = z.object({
  actionTypeId: z.string().min(1),
  payload: z.record(z.unknown()),
});

export const actionsProposeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/propose', async (request, reply) => {
    const body = ProposeBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const { actionTypeId, payload } = body.data;

    // Validate action type exists in registry
    const registry = fastify.engine.getRegistry();
    const actionType = registry.getActionType(actionTypeId);
    if (!actionType) {
      return reply.code(400).send({ error: `Unknown action type: "${actionTypeId}"` });
    }

    // Validate payload
    const validationErrors = registry.validateActionPayload(actionTypeId, payload);
    if (validationErrors.length > 0) {
      return reply.code(400).send({ error: 'Validation failed', details: validationErrors });
    }

    // Store proposal in Redis
    const redisClient = createRedisClient({
      host: 'localhost',
      port: 6380,
    });
    const proposer = new ActionProposer(redisClient, request.tenantId);
    const proposal = await proposer.propose(actionTypeId, payload);

    return reply.code(202).send(proposal);
  });
};
```

- [ ] **Step 4: Implementasi `src/routes/actions/approve.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';

export const actionsApproveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { proposalId: string } }>(
    '/:proposalId/approve',
    async (request, reply) => {
      const { proposalId } = request.params;

      const redisClient = createRedisClient({ host: 'localhost', port: 6380 });
      const proposer = new ActionProposer(redisClient, request.tenantId);
      const proposal = await proposer.getProposal(proposalId);

      if (!proposal) {
        return reply.code(404).send({ error: 'Proposal not found or expired' });
      }

      // Execute the action
      const result = await fastify.engine.actions.executeAction(
        proposal.actionTypeId,
        proposal.payload,
        {
          userId: request.userId,
          legalEntityId: request.legalEntityId,
          roleId: request.roleId,
        }
      );

      // Delete proposal dari Redis setelah executed
      await proposer.deleteProposal(proposalId);

      return reply.send(result);
    }
  );
};
```

- [ ] **Step 5: Implementasi `src/routes/actions/reject.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';

export const actionsRejectRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { proposalId: string } }>(
    '/:proposalId/reject',
    async (request, reply) => {
      const { proposalId } = request.params;

      const redisClient = createRedisClient({ host: 'localhost', port: 6380 });
      const proposer = new ActionProposer(redisClient, request.tenantId);
      const proposal = await proposer.getProposal(proposalId);

      if (!proposal) {
        return reply.code(404).send({ error: 'Proposal not found or expired' });
      }

      await proposer.deleteProposal(proposalId);

      return reply.send({
        proposalId,
        status: 'rejected',
        rejectedBy: request.userId,
        rejectedAt: new Date().toISOString(),
      });
    }
  );
};
```

- [ ] **Step 6: Implementasi `src/routes/actions/execute.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';

// Internal route — hanya bisa dipanggil oleh service internal (bukan user langsung)
// Diprotect dengan internal token, bukan JWT user
export const actionsExecuteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/actions/internal/')) return;
    const internalToken = request.headers['x-internal-token'];
    if (internalToken !== process.env.INTERNAL_TOKEN) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  // Internal execute endpoint — tidak exposed ke publik
  fastify.post<{
    Body: { actionTypeId: string; payload: Record<string, unknown>; context: { userId: string; legalEntityId: string; roleId: string } }
  }>('/internal/execute', async (request, reply) => {
    const { actionTypeId, payload, context } = request.body;
    const result = await fastify.engine.actions.executeAction(actionTypeId, payload, context);
    return reply.send(result);
  });
};
```

- [ ] **Step 7: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/api test
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/actions/ apps/api/src/__tests__/actions.test.ts
git commit -m "feat(api): add actions propose, approve, reject routes with HITL flow"
```

---

## Task 7: Routes — Schema + Audit + Health

**Files:**
- Create: `apps/api/src/routes/schema/read.route.ts`
- Create: `apps/api/src/routes/audit/log.route.ts`

- [ ] **Step 1: Implementasi `src/routes/schema/read.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';

export const schemaReadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/object-types', async (request, reply) => {
    const registry = fastify.engine.getRegistry();
    const names = registry.getObjectTypeNames();
    return reply.send({ data: names });
  });

  fastify.get('/action-types', async (request, reply) => {
    const registry = fastify.engine.getRegistry();
    const names = registry.getActionTypeNames();
    return reply.send({ data: names });
  });
};
```

- [ ] **Step 2: Implementasi `src/routes/audit/log.route.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';

export const auditLogRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/log', async (request, reply) => {
    // Audit log query — simple implementation
    // Full implementation akan pakai Drizzle query ke action_audit_log
    return reply.send({
      data: [],
      message: 'Audit log endpoint — full implementation in Wave 2',
    });
  });
};
```

- [ ] **Step 3: Tambah health check di `app.ts`**

Tambahkan sebelum routes lain di `buildApp()` dalam `src/app.ts`:

```typescript
// Health check — no auth
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
```

- [ ] **Step 4: Build semua**

```bash
pnpm build
```

Expected: semua packages dan apps build sukses

- [ ] **Step 5: Run semua tests**

```bash
pnpm test
```

Expected: semua tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/schema/ apps/api/src/routes/audit/
git commit -m "feat(api): add schema read, audit log, and health check routes"
```

---

## Verification Checklist

- [ ] `pnpm build` dari root: semua packages build sukses
- [ ] `pnpm test` dari root: semua tests pass
- [ ] `GET /health` returns `{ status: 'ok' }`
- [ ] `GET /objects/:type` tanpa auth returns 401
- [ ] `GET /objects/:type` dengan JWT returns 200 + array
- [ ] `POST /actions/propose` dengan action valid returns 202 + proposalId
- [ ] `POST /actions/propose` dengan unknown action type returns 400
- [ ] `POST /actions/:proposalId/approve` executes action dan returns executed status
- [ ] `POST /actions/:proposalId/reject` deletes proposal dan returns rejected status
- [ ] `GET /schema/object-types` returns list of registered type names

---

## Catatan untuk Plan 4

Plan 4 (`apps/agent-service`) akan:
- Import `@daemon/ontology-sdk` dan menggunakan `OntologyClient` untuk read
- Menggunakan `deepagents` SDK dengan tool list yang allowlisted
- Propose actions via `ActionProposer` — tidak ada `executeAction` langsung
- HITL via LangGraph interrupt + `/actions/:proposalId/approve` endpoint
