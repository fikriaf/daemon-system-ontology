# Plan 2: `ontology-engine` + Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi `ontology-engine` — schema registry, object service, `executeAction()` sebagai satu-satunya write path, audit log, Redis cache, dan Redis Pub/Sub.

**Architecture:** Package `@daemon/ontology-engine` menerima `OntologySchema` (dari `@daemon/ontology-language`) saat startup, membangun in-memory registry, lalu mengekspos services untuk CRUD objects, execute actions, dan traverse links. Database: PostgreSQL + Apache AGE. Cache: Redis. Semua mutasi wajib lewat `executeAction()`.

**Tech Stack:** TypeScript, Drizzle ORM, `pg` (node-postgres), `ioredis`, Apache AGE, `vitest`, Docker Compose (untuk test database lokal)

**Prerequisite:** Plan 1 selesai. `@daemon/ontology-language` sudah bisa di-import.

---

## File Map

```
packages/ontology-engine/
├── package.json
├── tsconfig.json
├── drizzle.config.ts                    ← Drizzle config
├── src/
│   ├── index.ts                         ← public API exports
│   ├── db/
│   │   ├── client.ts                    ← PostgreSQL connection pool
│   │   ├── redis.client.ts              ← Redis connection
│   │   ├── schema.ts                    ← Drizzle table definitions
│   │   └── migrations/                  ← SQL migration files
│   │       └── 0001_initial.sql
│   ├── registry/
│   │   ├── schema.registry.ts           ← In-memory registry dari OntologySchema
│   │   └── schema.cache.ts              ← Redis cache wrapper untuk registry
│   ├── object/
│   │   ├── object.service.ts            ← Query objects
│   │   └── object.repository.ts        ← PostgreSQL queries
│   ├── action/
│   │   ├── action.executor.ts           ← executeAction() — satu-satunya write path
│   │   ├── action.validator.ts          ← Validate payload vs schema
│   │   └── action.audit.ts             ← Tulis ke action_audit_log
│   ├── link/
│   │   └── link.service.ts             ← Graph traversal via AGE Cypher
│   ├── events/
│   │   └── event.publisher.ts          ← Redis Pub/Sub publish setelah execute
│   └── policy/
│       └── policy.engine.ts            ← legalEntityId scoping, RBAC check
└── src/__tests__/
    ├── registry.test.ts
    ├── action.executor.test.ts
    └── object.service.test.ts
```

---

## Task 1: Scaffold Package + Docker Compose untuk Test

**Files:**
- Create: `packages/ontology-engine/package.json`
- Create: `packages/ontology-engine/tsconfig.json`
- Create: `docker-compose.test.yml` (root level)

- [ ] **Step 1: Buat direktori struktur**

```bash
New-Item -ItemType Directory -Path "packages\ontology-engine\src\db\migrations" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\registry" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\object" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\action" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\link" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\events" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\policy" -Force
New-Item -ItemType Directory -Path "packages\ontology-engine\src\__tests__" -Force
```

- [ ] **Step 2: Buat `packages/ontology-engine/package.json`**

```json
{
  "name": "@daemon/ontology-engine",
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
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "db:migrate": "node dist/db/migrate.js"
  },
  "dependencies": {
    "@daemon/ontology-language": "workspace:*",
    "drizzle-orm": "^0.31.0",
    "ioredis": "^5.3.2",
    "pg": "^8.11.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.22.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Buat `packages/ontology-engine/tsconfig.json`**

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

- [ ] **Step 4: Buat `docker-compose.test.yml` di root repo**

```yaml
version: '3.8'
services:
  postgres-test:
    image: apache/age:PG16_latest
    environment:
      POSTGRES_USER: daemon
      POSTGRES_PASSWORD: daemon_test
      POSTGRES_DB: daemon_test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U daemon -d daemon_test"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

- [ ] **Step 5: Install dependencies**

```bash
pnpm install --filter @daemon/ontology-engine
```

- [ ] **Step 6: Commit**

```bash
git add packages/ontology-engine/ docker-compose.test.yml
git commit -m "chore: scaffold ontology-engine package with docker-compose test setup"
```

---

## Task 2: Database Schema (Drizzle + Migration)

**Files:**
- Create: `packages/ontology-engine/src/db/schema.ts`
- Create: `packages/ontology-engine/src/db/migrations/0001_initial.sql`
- Create: `packages/ontology-engine/src/db/client.ts`
- Create: `packages/ontology-engine/drizzle.config.ts`

- [ ] **Step 1: Buat `src/db/schema.ts`**

```typescript
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const objects = pgTable('objects', {
  id: uuid('id').primaryKey().defaultRandom(),
  typeApiName: text('type_api_name').notNull(),
  properties: jsonb('properties').notNull(),
  legalEntityId: text('legal_entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const actionAuditLog = pgTable('action_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionTypeId: text('action_type_id').notNull(),
  objectId: uuid('object_id').references(() => objects.id),
  payload: jsonb('payload').notNull(),
  performedBy: text('performed_by').notNull(),
  legalEntityId: text('legal_entity_id').notNull(),
  status: text('status').notNull(), // proposed | approved | executed | rejected
  proposedAt: timestamp('proposed_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: text('decided_by'),
  executedAt: timestamp('executed_at', { withTimezone: true }),
});

export const schemaOverrides = pgTable('schema_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  objectType: text('object_type').notNull(),
  overrideType: text('override_type').notNull(), // property_add | label_change
  payload: jsonb('payload').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Buat `src/db/migrations/0001_initial.sql`**

```sql
-- Enable Apache AGE extension
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Objects table
CREATE TABLE IF NOT EXISTS objects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_api_name   TEXT NOT NULL,
  properties      JSONB NOT NULL,
  legal_entity_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_objects_type ON objects (type_api_name);
CREATE INDEX IF NOT EXISTS idx_objects_legal_entity ON objects (legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_objects_properties ON objects USING GIN (properties);

-- Audit log — immutable, append-only
CREATE TABLE IF NOT EXISTS action_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id  TEXT NOT NULL,
  object_id       UUID REFERENCES objects(id),
  payload         JSONB NOT NULL,
  performed_by    TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'executed', 'rejected')),
  proposed_at     TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  decided_by      TEXT,
  executed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_action_type ON action_audit_log (action_type_id);
CREATE INDEX IF NOT EXISTS idx_audit_object_id ON action_audit_log (object_id);
CREATE INDEX IF NOT EXISTS idx_audit_status ON action_audit_log (status);

-- Schema overrides
CREATE TABLE IF NOT EXISTS schema_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type   TEXT NOT NULL,
  override_type TEXT NOT NULL,
  payload       JSONB NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AGE graph untuk link types
SELECT create_graph('ontology_graph');
```

- [ ] **Step 3: Buat `src/db/client.ts`**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function createDbClient(config: DbConfig) {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 10,
  });

  return drizzle(pool, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
```

- [ ] **Step 4: Buat `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://daemon:daemon_test@localhost:5433/daemon_test',
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-engine/src/db/ packages/ontology-engine/drizzle.config.ts
git commit -m "feat(ontology-engine): add database schema and drizzle client"
```

---

## Task 3: Schema Registry + Redis Cache

**Files:**
- Create: `packages/ontology-engine/src/db/redis.client.ts`
- Create: `packages/ontology-engine/src/registry/schema.registry.ts`
- Create: `packages/ontology-engine/src/registry/schema.cache.ts`
- Create: `packages/ontology-engine/src/__tests__/registry.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `packages/ontology-engine/src/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from '../registry/schema.registry.js';
import type { OntologySchema } from '@daemon/ontology-language';

const testSchema: OntologySchema = {
  objectTypes: [
    {
      apiName: 'Shipment',
      displayName: 'Shipment',
      primaryKey: 'shipmentId',
      titleProperty: 'shipmentId',
      properties: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'status', type: 'enum', values: ['Draft', 'InTransit'], required: true },
        { name: 'legalEntityId', type: 'string', required: true },
      ],
    },
  ],
  linkTypes: [],
  actionTypes: [
    {
      apiName: 'transitionShipmentState',
      displayName: 'Transition Shipment State',
      targetObjectType: 'Shipment',
      requiresApproval: true,
      parameters: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'newStatus', type: 'enum', values: ['InTransit', 'Delivered'], required: true },
      ],
    },
  ],
};

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry(testSchema);
  });

  it('finds object type by apiName', () => {
    const objectType = registry.getObjectType('Shipment');
    expect(objectType).toBeDefined();
    expect(objectType?.displayName).toBe('Shipment');
  });

  it('returns undefined for unknown object type', () => {
    const objectType = registry.getObjectType('NonExistent');
    expect(objectType).toBeUndefined();
  });

  it('finds action type by apiName', () => {
    const action = registry.getActionType('transitionShipmentState');
    expect(action).toBeDefined();
    expect(action?.targetObjectType).toBe('Shipment');
  });

  it('returns all object type names', () => {
    const names = registry.getObjectTypeNames();
    expect(names).toContain('Shipment');
  });

  it('validates action payload against schema', () => {
    const errors = registry.validateActionPayload('transitionShipmentState', {
      shipmentId: 'SHP-001',
      newStatus: 'InTransit',
    });
    expect(errors).toHaveLength(0);
  });

  it('returns errors for invalid action payload', () => {
    const errors = registry.validateActionPayload('transitionShipmentState', {
      // missing required shipmentId
      newStatus: 'InTransit',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('throws for unknown action type', () => {
    expect(() =>
      registry.validateActionPayload('unknownAction', {})
    ).toThrow('Unknown action type');
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: FAIL — `SchemaRegistry` not found

- [ ] **Step 3: Implementasi `src/registry/schema.registry.ts`**

```typescript
import type {
  OntologySchema,
  ObjectTypeDefinition,
  LinkTypeDefinition,
  ActionTypeDefinition,
} from '@daemon/ontology-language';

export class SchemaRegistry {
  private objectTypes: Map<string, ObjectTypeDefinition>;
  private linkTypes: Map<string, LinkTypeDefinition>;
  private actionTypes: Map<string, ActionTypeDefinition>;

  constructor(schema: OntologySchema) {
    this.objectTypes = new Map(schema.objectTypes.map(o => [o.apiName, o]));
    this.linkTypes = new Map(schema.linkTypes.map(l => [l.apiName, l]));
    this.actionTypes = new Map(schema.actionTypes.map(a => [a.apiName, a]));
  }

  getObjectType(apiName: string): ObjectTypeDefinition | undefined {
    return this.objectTypes.get(apiName);
  }

  getLinkType(apiName: string): LinkTypeDefinition | undefined {
    return this.linkTypes.get(apiName);
  }

  getActionType(apiName: string): ActionTypeDefinition | undefined {
    return this.actionTypes.get(apiName);
  }

  getObjectTypeNames(): string[] {
    return Array.from(this.objectTypes.keys());
  }

  getActionTypeNames(): string[] {
    return Array.from(this.actionTypes.keys());
  }

  validateActionPayload(actionTypeId: string, payload: Record<string, unknown>): string[] {
    const actionType = this.actionTypes.get(actionTypeId);
    if (!actionType) {
      throw new Error(`Unknown action type: "${actionTypeId}"`);
    }

    const errors: string[] = [];

    for (const param of actionType.parameters) {
      if (param.required && !(param.name in payload)) {
        errors.push(`Missing required parameter: "${param.name}"`);
        continue;
      }

      if (param.name in payload && param.type === 'enum' && param.values) {
        const value = payload[param.name];
        if (!param.values.includes(String(value))) {
          errors.push(
            `Parameter "${param.name}" must be one of: ${param.values.join(', ')}. Got: "${value}"`
          );
        }
      }
    }

    return errors;
  }
}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: PASS

- [ ] **Step 5: Buat `src/db/redis.client.ts`**

```typescript
import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export function createRedisClient(config: RedisConfig): Redis {
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    lazyConnect: true,
  });
}
```

- [ ] **Step 6: Buat `src/registry/schema.cache.ts`**

```typescript
import type Redis from 'ioredis';
import type { OntologySchema } from '@daemon/ontology-language';
import { SchemaRegistry } from './schema.registry.js';

const CACHE_KEY_PREFIX = 'schema:';
const CACHE_TTL_SECONDS = 3600; // 1 jam

export class SchemaCacheService {
  constructor(private redis: Redis) {}

  private cacheKey(tenantId: string): string {
    return `${CACHE_KEY_PREFIX}${tenantId}`;
  }

  async getRegistry(tenantId: string): Promise<SchemaRegistry | null> {
    const cached = await this.redis.get(this.cacheKey(tenantId));
    if (!cached) return null;
    const schema: OntologySchema = JSON.parse(cached);
    return new SchemaRegistry(schema);
  }

  async setRegistry(tenantId: string, schema: OntologySchema): Promise<void> {
    await this.redis.set(
      this.cacheKey(tenantId),
      JSON.stringify(schema),
      'EX',
      CACHE_TTL_SECONDS
    );
  }

  async invalidate(tenantId: string): Promise<void> {
    await this.redis.del(this.cacheKey(tenantId));
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-engine/src/registry/ packages/ontology-engine/src/db/redis.client.ts packages/ontology-engine/src/__tests__/registry.test.ts
git commit -m "feat(ontology-engine): add schema registry and redis cache"
```

---

## Task 4: Object Service + Repository

**Files:**
- Create: `packages/ontology-engine/src/object/object.repository.ts`
- Create: `packages/ontology-engine/src/object/object.service.ts`
- Create: `packages/ontology-engine/src/__tests__/object.service.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `packages/ontology-engine/src/__tests__/object.service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDbClient } from '../db/client.js';
import { ObjectRepository } from '../object/object.repository.js';
import { ObjectService } from '../object/object.service.js';
import { SchemaRegistry } from '../registry/schema.registry.js';
import type { OntologySchema } from '@daemon/ontology-language';

// Gunakan test database dari docker-compose.test.yml
const testDbConfig = {
  host: 'localhost',
  port: 5433,
  user: 'daemon',
  password: 'daemon_test',
  database: 'daemon_test',
};

const testSchema: OntologySchema = {
  objectTypes: [
    {
      apiName: 'Shipment',
      displayName: 'Shipment',
      primaryKey: 'shipmentId',
      titleProperty: 'shipmentId',
      properties: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'status', type: 'enum', values: ['Draft', 'InTransit'], required: true },
        { name: 'legalEntityId', type: 'string', required: true },
      ],
    },
  ],
  linkTypes: [],
  actionTypes: [],
};

describe('ObjectService (integration)', () => {
  let db: ReturnType<typeof createDbClient>;
  let service: ObjectService;

  beforeAll(async () => {
    db = createDbClient(testDbConfig);
    const repo = new ObjectRepository(db);
    const registry = new SchemaRegistry(testSchema);
    service = new ObjectService(repo, registry);
  });

  afterAll(async () => {
    // cleanup — hapus test data
    await db.delete(require('../db/schema.js').objects);
  });

  it('creates a new object', async () => {
    const result = await service.createObject('Shipment', {
      shipmentId: 'SHP-TEST-001',
      status: 'Draft',
      legalEntityId: 'ANT',
    });

    expect(result.id).toBeDefined();
    expect(result.typeApiName).toBe('Shipment');
  });

  it('queries objects by type', async () => {
    const results = await service.queryObjects('Shipment', {});
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('queries objects with filter', async () => {
    const results = await service.queryObjects('Shipment', {
      legalEntityId: 'ANT',
    });
    expect(results.every(r => (r.properties as any).legalEntityId === 'ANT')).toBe(true);
  });

  it('rejects unknown object type', async () => {
    await expect(
      service.createObject('NonExistent', { id: '1' })
    ).rejects.toThrow('Unknown object type');
  });
});
```

- [ ] **Step 2: Start test database**

```bash
docker compose -f docker-compose.test.yml up -d
# Tunggu healthy:
docker compose -f docker-compose.test.yml ps
```

Expected: postgres-test dan redis-test status `healthy`

- [ ] **Step 3: Jalankan migration**

```bash
# Apply migration manual ke test DB
$env:DATABASE_URL="postgresql://daemon:daemon_test@localhost:5433/daemon_test"
pnpm --filter @daemon/ontology-engine db:migrate
```

Atau run SQL langsung:

```bash
docker exec -i $(docker compose -f docker-compose.test.yml ps -q postgres-test) psql -U daemon -d daemon_test < packages/ontology-engine/src/db/migrations/0001_initial.sql
```

- [ ] **Step 4: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: FAIL — `ObjectRepository` not found

- [ ] **Step 5: Implementasi `src/object/object.repository.ts`**

```typescript
import { eq, and, isNull } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { objects } from '../db/schema.js';

export type ObjectRow = typeof objects.$inferSelect;
export type NewObjectRow = typeof objects.$inferInsert;

export class ObjectRepository {
  constructor(private db: DbClient) {}

  async create(data: Omit<NewObjectRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<ObjectRow> {
    const [row] = await this.db.insert(objects).values(data).returning();
    return row;
  }

  async findById(id: string): Promise<ObjectRow | undefined> {
    const [row] = await this.db
      .select()
      .from(objects)
      .where(and(eq(objects.id, id), isNull(objects.deletedAt)));
    return row;
  }

  async findByType(
    typeApiName: string,
    filters: Record<string, unknown> = {}
  ): Promise<ObjectRow[]> {
    const rows = await this.db
      .select()
      .from(objects)
      .where(and(eq(objects.typeApiName, typeApiName), isNull(objects.deletedAt)));

    // Filter by properties (in-memory untuk simplicity di awal)
    return rows.filter(row => {
      const props = row.properties as Record<string, unknown>;
      return Object.entries(filters).every(([key, val]) => props[key] === val);
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(objects)
      .set({ deletedAt: new Date() })
      .where(eq(objects.id, id));
  }
}
```

- [ ] **Step 6: Implementasi `src/object/object.service.ts`**

```typescript
import type { SchemaRegistry } from '../registry/schema.registry.js';
import type { ObjectRepository, ObjectRow } from './object.repository.js';

export class ObjectService {
  constructor(
    private repo: ObjectRepository,
    private registry: SchemaRegistry
  ) {}

  async createObject(
    typeApiName: string,
    properties: Record<string, unknown>
  ): Promise<ObjectRow> {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) {
      throw new Error(`Unknown object type: "${typeApiName}"`);
    }

    return this.repo.create({
      typeApiName,
      properties,
      legalEntityId: properties['legalEntityId'] as string | undefined ?? null,
    });
  }

  async queryObjects(
    typeApiName: string,
    filters: Record<string, unknown>
  ): Promise<ObjectRow[]> {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) {
      throw new Error(`Unknown object type: "${typeApiName}"`);
    }
    return this.repo.findByType(typeApiName, filters);
  }

  async getObject(id: string): Promise<ObjectRow | undefined> {
    return this.repo.findById(id);
  }
}
```

- [ ] **Step 7: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: PASS — integration tests pass terhadap test database

- [ ] **Step 8: Commit**

```bash
git add packages/ontology-engine/src/object/ packages/ontology-engine/src/__tests__/object.service.test.ts
git commit -m "feat(ontology-engine): add object repository and service"
```

---

## Task 5: `executeAction()` — Satu-satunya Write Path

**Files:**
- Create: `packages/ontology-engine/src/action/action.validator.ts`
- Create: `packages/ontology-engine/src/action/action.audit.ts`
- Create: `packages/ontology-engine/src/action/action.executor.ts`
- Create: `packages/ontology-engine/src/events/event.publisher.ts`
- Create: `packages/ontology-engine/src/__tests__/action.executor.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `packages/ontology-engine/src/__tests__/action.executor.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ActionExecutor } from '../action/action.executor.js';
import { SchemaRegistry } from '../registry/schema.registry.js';
import type { OntologySchema } from '@daemon/ontology-language';

const testSchema: OntologySchema = {
  objectTypes: [
    {
      apiName: 'Shipment',
      displayName: 'Shipment',
      primaryKey: 'shipmentId',
      titleProperty: 'shipmentId',
      properties: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'status', type: 'enum', values: ['Draft', 'InTransit', 'Delivered'], required: true },
        { name: 'legalEntityId', type: 'string', required: true },
      ],
    },
  ],
  linkTypes: [],
  actionTypes: [
    {
      apiName: 'transitionShipmentState',
      displayName: 'Transition Shipment State',
      targetObjectType: 'Shipment',
      requiresApproval: true,
      parameters: [
        { name: 'shipmentId', type: 'string', required: true },
        { name: 'newStatus', type: 'enum', values: ['InTransit', 'Delivered'], required: true },
      ],
    },
  ],
};

describe('ActionExecutor', () => {
  let executor: ActionExecutor;
  const mockObjectRepo = {
    findById: vi.fn(),
    create: vi.fn(),
    findByType: vi.fn(),
    softDelete: vi.fn(),
  };
  const mockAuditRepo = {
    record: vi.fn().mockResolvedValue({ id: 'audit-001' }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
  const mockEventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    const registry = new SchemaRegistry(testSchema);
    executor = new ActionExecutor(
      registry,
      mockObjectRepo as any,
      mockAuditRepo as any,
      mockEventPublisher as any
    );
  });

  it('rejects unknown action type', async () => {
    await expect(
      executor.executeAction('unknownAction', {}, {
        userId: 'user-1',
        legalEntityId: 'ANT',
        roleId: 'operator',
      })
    ).rejects.toThrow('Unknown action type');
  });

  it('rejects invalid payload — missing required param', async () => {
    await expect(
      executor.executeAction(
        'transitionShipmentState',
        { shipmentId: 'SHP-001' }, // missing newStatus
        { userId: 'user-1', legalEntityId: 'ANT', roleId: 'operator' }
      )
    ).rejects.toThrow('Validation failed');
  });

  it('executes valid action and records audit', async () => {
    mockObjectRepo.findById.mockResolvedValue({
      id: 'obj-001',
      typeApiName: 'Shipment',
      properties: { shipmentId: 'SHP-001', status: 'Draft', legalEntityId: 'ANT' },
    });

    const result = await executor.executeAction(
      'transitionShipmentState',
      { shipmentId: 'SHP-001', newStatus: 'InTransit' },
      { userId: 'user-1', legalEntityId: 'ANT', roleId: 'operator' }
    );

    expect(result.actionTypeId).toBe('transitionShipmentState');
    expect(result.status).toBe('executed');
    expect(mockAuditRepo.record).toHaveBeenCalled();
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'transitionShipmentState.executed',
      expect.objectContaining({ actionTypeId: 'transitionShipmentState' })
    );
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: FAIL — `ActionExecutor` not found

- [ ] **Step 3: Implementasi `src/action/action.validator.ts`**

```typescript
import type { SchemaRegistry } from '../registry/schema.registry.js';

export interface ExecutionContext {
  userId: string;
  legalEntityId: string;
  roleId: string;
}

export class ActionValidator {
  constructor(private registry: SchemaRegistry) {}

  validate(
    actionTypeId: string,
    payload: Record<string, unknown>,
    context: ExecutionContext
  ): void {
    const errors = this.registry.validateActionPayload(actionTypeId, payload);
    if (errors.length > 0) {
      throw new Error(`Validation failed for action "${actionTypeId}":\n${errors.join('\n')}`);
    }
  }
}
```

- [ ] **Step 4: Implementasi `src/action/action.audit.ts`**

```typescript
import type { DbClient } from '../db/client.js';
import { actionAuditLog } from '../db/schema.js';
import type { ExecutionContext } from './action.validator.js';

export interface AuditRecord {
  id: string;
  actionTypeId: string;
  status: string;
}

export class ActionAuditService {
  constructor(private db: DbClient) {}

  async record(
    actionTypeId: string,
    payload: Record<string, unknown>,
    context: ExecutionContext,
    objectId?: string
  ): Promise<AuditRecord> {
    const [row] = await this.db
      .insert(actionAuditLog)
      .values({
        actionTypeId,
        payload,
        performedBy: context.userId,
        legalEntityId: context.legalEntityId,
        objectId: objectId ?? null,
        status: 'executed',
        executedAt: new Date(),
        proposedAt: new Date(),
      })
      .returning({ id: actionAuditLog.id, actionTypeId: actionAuditLog.actionTypeId, status: actionAuditLog.status });

    return row;
  }
}
```

- [ ] **Step 5: Implementasi `src/events/event.publisher.ts`**

```typescript
import type Redis from 'ioredis';

export class EventPublisher {
  constructor(private redis: Redis) {}

  async publish(eventName: string, payload: unknown): Promise<void> {
    const channel = `events:${eventName}`;
    await this.redis.publish(channel, JSON.stringify(payload));
  }
}
```

- [ ] **Step 6: Implementasi `src/action/action.executor.ts`**

```typescript
import type { SchemaRegistry } from '../registry/schema.registry.js';
import type { ObjectRepository } from '../object/object.repository.js';
import { ActionValidator, type ExecutionContext } from './action.validator.js';
import type { ActionAuditService } from './action.audit.js';
import type { EventPublisher } from '../events/event.publisher.js';

export interface ActionResult {
  actionTypeId: string;
  status: 'executed';
  auditId: string;
  executedAt: Date;
}

export class ActionExecutor {
  private validator: ActionValidator;

  constructor(
    private registry: SchemaRegistry,
    private objectRepo: ObjectRepository,
    private audit: ActionAuditService,
    private events: EventPublisher
  ) {
    this.validator = new ActionValidator(registry);
  }

  async executeAction(
    actionTypeId: string,
    payload: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ActionResult> {
    // 1. Validate action exists and payload is valid
    this.validator.validate(actionTypeId, payload, context);

    // 2. Apply mutation (resolving objectId from payload)
    const objectId = await this.applyMutation(actionTypeId, payload);

    // 3. Record audit
    const auditRecord = await this.audit.record(
      actionTypeId,
      payload,
      context,
      objectId
    );

    const result: ActionResult = {
      actionTypeId,
      status: 'executed',
      auditId: auditRecord.id,
      executedAt: new Date(),
    };

    // 4. Publish event
    await this.events.publish(`${actionTypeId}.executed`, result);

    return result;
  }

  private async applyMutation(
    actionTypeId: string,
    payload: Record<string, unknown>
  ): Promise<string | undefined> {
    const actionType = this.registry.getActionType(actionTypeId);
    if (!actionType) {
      throw new Error(`Unknown action type: "${actionTypeId}"`);
    }

    // Cari object yang menjadi target
    // Konvensi: payload harus mengandung primaryKey dari targetObjectType
    const targetObjectTypeDef = this.registry.getObjectType(actionType.targetObjectType);
    if (!targetObjectTypeDef) return undefined;

    const primaryKeyValue = payload[targetObjectTypeDef.primaryKey];
    if (!primaryKeyValue) return undefined;

    // Temukan object by primaryKey (via properties JSONB query)
    const rows = await this.objectRepo.findByType(actionType.targetObjectType, {
      [targetObjectTypeDef.primaryKey]: primaryKeyValue,
    });

    return rows[0]?.id;
  }
}
```

- [ ] **Step 7: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: PASS — semua tests pass (unit test dengan mocks)

- [ ] **Step 8: Commit**

```bash
git add packages/ontology-engine/src/action/ packages/ontology-engine/src/events/ packages/ontology-engine/src/__tests__/action.executor.test.ts
git commit -m "feat(ontology-engine): add executeAction — single write path with audit and events"
```

---

## Task 6: Public API + `OntologyEngine` Facade

**Files:**
- Create: `packages/ontology-engine/src/engine.ts`
- Modify: `packages/ontology-engine/src/index.ts`

- [ ] **Step 1: Buat `src/engine.ts` — facade untuk consumers**

```typescript
import { loadOntologyFromDirectory, validateOntologySchema } from '@daemon/ontology-language';
import type { OntologySchema } from '@daemon/ontology-language';
import { createDbClient, type DbConfig } from './db/client.js';
import { createRedisClient, type RedisConfig } from './db/redis.client.js';
import { SchemaRegistry } from './registry/schema.registry.js';
import { SchemaCacheService } from './registry/schema.cache.js';
import { ObjectRepository } from './object/object.repository.js';
import { ObjectService } from './object/object.service.js';
import { ActionExecutor } from './action/action.executor.js';
import { ActionAuditService } from './action/action.audit.js';
import { EventPublisher } from './events/event.publisher.js';

export interface EngineConfig {
  db: DbConfig;
  redis: RedisConfig;
  tenantId: string;
  schemaDir?: string;
  schema?: OntologySchema;
}

export class OntologyEngine {
  private registry!: SchemaRegistry;
  readonly objects!: ObjectService;
  readonly actions!: ActionExecutor;

  private constructor(
    registry: SchemaRegistry,
    objects: ObjectService,
    actions: ActionExecutor
  ) {
    this.registry = registry;
    this.objects = objects;
    this.actions = actions;
  }

  static async create(config: EngineConfig): Promise<OntologyEngine> {
    // 1. Load schema
    let schema: OntologySchema;
    if (config.schema) {
      schema = config.schema;
    } else if (config.schemaDir) {
      schema = await loadOntologyFromDirectory(config.schemaDir);
      const errors = validateOntologySchema(schema);
      if (errors.length > 0) {
        throw new Error(`Invalid ontology schema:\n${errors.join('\n')}`);
      }
    } else {
      throw new Error('Either schema or schemaDir must be provided');
    }

    // 2. Create clients
    const db = createDbClient(config.db);
    const redis = createRedisClient(config.redis);

    // 3. Setup registry with cache
    const registry = new SchemaRegistry(schema);
    const cache = new SchemaCacheService(redis);
    await cache.setRegistry(config.tenantId, schema);

    // 4. Wire services
    const objectRepo = new ObjectRepository(db);
    const objectService = new ObjectService(objectRepo, registry);
    const auditService = new ActionAuditService(db);
    const eventPublisher = new EventPublisher(redis);
    const actionExecutor = new ActionExecutor(registry, objectRepo, auditService, eventPublisher);

    return new OntologyEngine(registry, objectService, actionExecutor);
  }

  getRegistry(): SchemaRegistry {
    return this.registry;
  }
}
```

- [ ] **Step 2: Buat `src/index.ts`**

```typescript
// Public API
export { OntologyEngine } from './engine.js';
export type { EngineConfig } from './engine.js';
export { SchemaRegistry } from './registry/schema.registry.js';
export { ObjectService } from './object/object.service.js';
export { ActionExecutor } from './action/action.executor.js';
export type { ActionResult } from './action/action.executor.js';
export type { ExecutionContext } from './action/action.validator.js';
export { EventPublisher } from './events/event.publisher.js';
```

- [ ] **Step 3: Build**

```bash
pnpm --filter @daemon/ontology-engine build
```

Expected: sukses

- [ ] **Step 4: Run semua tests**

```bash
pnpm --filter @daemon/ontology-engine test
```

Expected: semua pass

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-engine/src/engine.ts packages/ontology-engine/src/index.ts
git commit -m "feat(ontology-engine): add OntologyEngine facade and public API"
```

---

## Verification Checklist

- [ ] `pnpm test` dari root: semua tests pass
- [ ] `pnpm build` dari root: build berhasil
- [ ] Test database (Docker): objects bisa di-create dan di-query
- [ ] `executeAction()` menolak unknown action type
- [ ] `executeAction()` menolak invalid payload
- [ ] `executeAction()` merekam ke `action_audit_log`
- [ ] `executeAction()` mempublish event via Redis Pub/Sub
- [ ] `OntologyEngine.create()` bisa load schema dari directory

---

## Catatan untuk Plan 3

Plan 3 (`ontology-sdk` + `apps/api`) akan:
- Import `@daemon/ontology-engine` dan menggunakan `OntologyEngine` sebagai core
- `ontology-sdk` = typed wrapper di atas engine untuk app consumers
- `apps/api` = Fastify HTTP gateway yang expose engine via REST
