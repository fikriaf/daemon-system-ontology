# Backend Design — Daemon System Ontology

**Date:** 2026-05-19  
**Status:** Approved  
**Scope:** Technical design backend platform B2B (Opsi 3: Monorepo Turborepo, single-tenant per client)

---

## Context

Daemon System Ontology adalah **platform B2B** yang dijual ke banyak client — mirip cara kerja Palantir Foundry. Setiap client mendapat stack terpisah (single-tenant) dengan ontology mereka sendiri (object types, link types, action types berbeda), tapi engine-nya sama.

Seluruh design mengikuti 5 prinsip inti dari dokumentasi:
1. Ontology first, applications second
2. Single source of truth, many faces
3. Two-way sync, bukan one-way ETL
4. Logic as a separate asset
5. Actions as first-class citizens

---

## Decisions

| Keputusan | Pilihan | Alasan |
|-----------|---------|--------|
| Monorepo strategy | Turborepo | Package boundaries sudah terdefinisi di docs (ontology-language, engine, sdk) |
| Deployment model | Single-tenant per client | Isolasi sempurna, maintenance lebih mudah, sesuai Palantir model |
| Schema management | Hybrid (YAML base + API override) | Version controlled via YAML, fleksibel via API untuk minor customization |
| HTTP framework | Fastify | Performa, native TypeScript, plugin ecosystem |
| Database | PostgreSQL + Apache AGE | Relational + graph traversal untuk link types |
| Cache / Events | Redis | Schema cache, proposal store, Pub/Sub real-time |
| Agent framework | `deepagents` (LangGraph JS SDK) | TypeScript-native, HITL built-in, subagent spawning, memory |
| Language | TypeScript (full stack) | Satu bahasa, tidak ada Python bridge |
| Container | Docker + Kubernetes | Cloud-agnostic, per-client namespace |

---

## Monorepo Structure

```
daemon-system-ontology/
├── packages/
│   ├── ontology-language/        # YAML parser + Zod validator + TS types
│   ├── ontology-engine/          # Runtime core
│   ├── ontology-sdk/             # Typed client untuk apps & agent
│   └── shared/                   # Shared types, errors, utils
├── apps/
│   ├── api/                      # Fastify HTTP API gateway
│   ├── agent-service/            # deepagents — root + subagents per domain
│   └── worker/                   # BullMQ async jobs (Wave 2)
├── infra/
│   ├── docker/                   # Dockerfile per app
│   └── k8s/                      # Kubernetes manifests (per-client namespace template)
├── tools/
│   └── cli/                      # CLI untuk onboard client baru
├── turbo.json
└── package.json
```

---

## Package Internals

### `packages/ontology-language`

Tanggung jawab: parse dan validasi schema YAML → TypeScript types.

```
ontology-language/
├── src/
│   ├── parser/
│   │   ├── object-type.parser.ts
│   │   ├── link-type.parser.ts
│   │   ├── action-type.parser.ts
│   │   └── interface.parser.ts
│   ├── validator/
│   │   └── schema.validator.ts    # Zod-based validation
│   ├── types/
│   │   ├── object-type.ts
│   │   ├── link-type.ts
│   │   ├── action-type.ts
│   │   └── interface.ts
│   └── index.ts
└── schemas/                       # JSON Schema / Zod untuk validasi YAML
```

**Contoh YAML schema (base config per client):**

```yaml
objectType:
  apiName: Shipment
  displayName: Shipment
  primaryKey: shipmentId
  properties:
    - name: shipmentId
      type: string
      required: true
    - name: status
      type: enum
      values: [Draft, InTransit, Delivered, Cancelled]
      required: true
    - name: legalEntityId
      type: string
      required: true
  titleProperty: shipmentId
```

---

### `packages/ontology-engine`

Tanggung jawab: runtime validation, functions, action executor, audit.

```
ontology-engine/
├── src/
│   ├── registry/
│   │   ├── object-type.registry.ts
│   │   ├── action-type.registry.ts
│   │   └── link-type.registry.ts
│   ├── object/
│   │   ├── object.service.ts
│   │   └── object.repository.ts       # PostgreSQL + AGE queries
│   ├── action/
│   │   ├── action.executor.ts         # executeAction() — satu-satunya write path
│   │   ├── action.validator.ts
│   │   └── action.audit.ts
│   ├── function/
│   │   └── function.runner.ts         # Deterministic rule execution
│   ├── link/
│   │   └── link.service.ts            # Graph traversal via AGE
│   ├── cache/
│   │   └── schema.cache.ts            # Redis schema cache
│   ├── events/
│   │   └── event.publisher.ts         # Redis Pub/Sub setelah executeAction
│   └── policy/
│       └── policy.engine.ts           # legalEntityId scoping, RBAC
```

**Aturan kritis — satu-satunya write path:**

```typescript
// action.executor.ts
async executeAction(
  actionTypeId: string,
  payload: unknown,
  context: ExecutionContext  // userId, roleId, legalEntityId
): Promise<ActionResult> {
  await this.validator.validate(actionTypeId, payload, context);
  const result = await this.applyMutation(actionTypeId, payload);
  await this.audit.record(actionTypeId, payload, context, result);
  await this.events.publish(`${actionTypeId}.executed`, result);
  return result;
}
```

Tidak ada path lain untuk write. Apps dan agent hanya bisa memanggil `executeAction`.

---

### `packages/ontology-sdk`

Tanggung jawab: typed client untuk apps dan agent — read + propose actions.

```
ontology-sdk/
├── src/
│   ├── client/
│   │   └── ontology.client.ts
│   ├── objects/
│   │   └── object.query-builder.ts    # Chainable queries
│   ├── actions/
│   │   └── action.proposer.ts         # propose() — bukan execute langsung
│   └── types/
│       └── generated/                 # Auto-generated dari schema YAML
```

**Cara pakai:**

```typescript
const sdk = new OntologyClient({ tenantId: 'abc-express' });

// Read
const shipments = await sdk.objects('Shipment')
  .filter({ status: 'InTransit', legalEntityId: 'ANT' })
  .limit(50)
  .get();

// Propose (Wave 1 — tidak execute langsung)
const proposal = await sdk.actions.propose('transitionShipmentState', {
  shipmentId: 'SHP-001',
  newStatus: 'Delivered'
});
// → { proposalId: '...', status: 'awaiting_approval' }
```

---

## Database Schema

### PostgreSQL

```sql
-- Semua objects (EAV via JSONB)
CREATE TABLE objects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_api_name   TEXT NOT NULL,
  properties      JSONB NOT NULL,
  legal_entity_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- Audit log — immutable, append-only
CREATE TABLE action_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id  TEXT NOT NULL,
  object_id       UUID REFERENCES objects(id),
  payload         JSONB NOT NULL,
  performed_by    TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  status          TEXT NOT NULL,   -- proposed | approved | executed | rejected
  proposed_at     TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  decided_by      TEXT,
  executed_at     TIMESTAMPTZ
);

-- Schema customization per client (hybrid: YAML base + API override)
CREATE TABLE schema_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type   TEXT NOT NULL,
  override_type TEXT NOT NULL,     -- property_add | label_change
  payload       JSONB NOT NULL,
  applied_at    TIMESTAMPTZ DEFAULT now()
);
```

### Apache AGE (graph layer)

```sql
-- Link traversal via Cypher
SELECT * FROM cypher('ontology_graph', $$
  MATCH (s:Shipment {id: $shipmentId})-[:shipment_customer]->(c:Customer)
  RETURN c
$$, $1) AS (customer agtype);
```

### Redis

| Key pattern | Isi | TTL |
|-------------|-----|-----|
| `schema:{tenantId}` | Schema registry cache | Until invalidated |
| `proposal:{tenantId}:{proposalId}` | Pending action proposal | 24 jam |
| `session:{userId}` | JWT session | Per token expiry |
| Pub/Sub channel: `{tenantId}.events` | Action executed events | — |

---

## API Gateway (`apps/api`)

```
apps/api/
├── src/
│   ├── plugins/
│   │   ├── auth.plugin.ts          # JWT verification + tenant resolution
│   │   ├── rate-limit.plugin.ts    # Redis-based per tenant
│   │   └── schema.plugin.ts        # Load ontology schema saat startup
│   ├── routes/
│   │   ├── objects/
│   │   │   ├── query.route.ts      # GET /objects/:type
│   │   │   └── get.route.ts        # GET /objects/:type/:id
│   │   ├── actions/
│   │   │   ├── propose.route.ts    # POST /actions/propose
│   │   │   ├── approve.route.ts    # POST /actions/:proposalId/approve
│   │   │   ├── reject.route.ts     # POST /actions/:proposalId/reject
│   │   │   └── execute.route.ts    # POST /actions/:proposalId/execute (internal)
│   │   ├── schema/
│   │   │   ├── read.route.ts       # GET /schema/object-types
│   │   │   └── override.route.ts   # POST /schema/overrides (admin only)
│   │   └── audit/
│   │       └── log.route.ts        # GET /audit/log
│   └── middleware/
│       ├── legal-entity.guard.ts   # Enforce legalEntityId scoping
│       └── rbac.guard.ts           # Role-based access per action type
```

**Request flow — operator approve shipment transition:**

```
POST /actions/propose
  → auth: verify JWT, resolve tenantId
  → rbac: cek role boleh propose?
  → engine: validate payload vs schema
  → Redis: simpan proposal TTL 24 jam
  → return { proposalId, status: 'pending' }

POST /actions/:proposalId/approve
  → engine: executeAction()
  → PostgreSQL: tulis mutation
  → AGE: update graph edge
  → audit_log: record executed
  → Redis Pub/Sub: publish event
  → Apps: UI refresh real-time
```

---

## Agent Service (`apps/agent-service`)

Menggunakan **`deepagents`** SDK (TypeScript, built on LangGraph).

```
apps/agent-service/
├── src/
│   ├── agents/
│   │   ├── root.agent.ts          # Orchestrator — spawn subagents
│   │   ├── ops.agent.ts           # Shipment, exception, branch
│   │   ├── finance.agent.ts       # Interco, transfer pricing
│   │   └── network.agent.ts       # LocalHero, hub, partner
│   ├── tools/
│   │   ├── ontology/
│   │   │   ├── read.tool.ts       # Query objects via ontology-sdk
│   │   │   ├── link.tool.ts       # Traverse graph links
│   │   │   └── function.tool.ts   # Call deterministic functions
│   │   └── actions/
│   │       └── propose.tool.ts    # Satu-satunya write tool
│   ├── permissions/
│   │   └── action-allowlist.ts    # Per tenant: action types yang boleh diakses
│   ├── memory/
│   │   └── tenant.memory.ts       # LangGraph Memory Store per tenant
│   └── backends/
│       └── ontology.backend.ts    # Custom filesystem backend → ontology objects
```

**Root agent:**

```typescript
export const createRootAgent = (tenantId: string) =>
  createDeepAgent({
    tools: [
      readOntologyTool(tenantId),
      spawnOpsAgent(tenantId),
      spawnFinanceAgent(tenantId),
      proposeActionTool(tenantId),   // satu-satunya write path
    ],
    systemPrompt: buildSystemPrompt(tenantId),
    memory: tenantMemoryStore(tenantId),
  });
```

**Wave 1 constraint — propose only:**

```typescript
// tools/actions/propose.tool.ts
const proposeActionTool = tool(
  async ({ actionTypeId, payload }) => {
    // Tidak ada executeAction langsung
    const proposal = await redis.set(
      `proposal:${tenantId}:${uuid()}`,
      { actionTypeId, payload, status: 'pending' },
      { ttl: 86400 }
    );
    return { proposalId: proposal.id, status: 'awaiting_approval' };
  },
  {
    name: 'propose_action',
    description: 'Propose an action for human approval. Never executes directly.',
    schema: z.object({
      actionTypeId: z.string(),
      payload: z.record(z.unknown()),
    }),
  }
);
```

**Deep Agents capabilities yang dipakai:**

| Capability | Penggunaan di Daemon |
|-----------|---------------------|
| `write_todos` (planning) | Agent breakdown task kompleks |
| Subagent spawning | ops-agent, finance-agent, network-agent terpisah |
| HITL (built-in) | Wajib Wave 1 — setiap action butuh human approve |
| Long-term memory | Agent ingat keputusan operator sebelumnya per tenant |
| Permission rules | Batasi agent ke action types yang di-allowlist |
| Provider agnostic | GPT-4, Claude, Gemini — bisa per client preference |
| LangSmith tracing | Observability agent per tenant |

---

## Per-Client Deployment

### Kubernetes — per client namespace

```
daemon-abc-express/          # namespace Kubernetes
  ├── api (Fastify)
  ├── agent-service (deepagents)
  ├── PostgreSQL + AGE (StatefulSet)
  └── Redis

daemon-xyz-logistics/        # namespace terpisah, stack identik
  ├── api
  ├── agent-service
  ├── PostgreSQL + AGE
  └── Redis
```

```yaml
# infra/k8s/client-template/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: daemon-{{ client_id }}
```

### CLI onboard client baru

```bash
daemon client:create --id abc-express --schema ./schemas/abc/
# → create namespace
# → apply schema YAML ke ConfigMap
# → deploy stack
# → seed database
# → return API endpoint + credentials
```

### Startup flow per instance

```
1. api starts
   → load schema YAML dari ConfigMap
   → validate via Zod (ontology-language)
   → push ke schema registry (ontology-engine)
   → cache ke Redis
   → buka HTTP server

2. Request masuk
   → engine baca schema dari Redis cache
   → proses request

3. Schema override via API
   → POST /schema/overrides
   → engine merge override + base YAML
   → invalidate Redis cache
   → reload registry
```

---

## Tech Stack (Final)

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (full stack) |
| HTTP | Fastify |
| ORM / Query | Drizzle ORM + raw SQL untuk AGE |
| Database | PostgreSQL + Apache AGE |
| Cache / Events | Redis (Pub/Sub + cache + proposal store) |
| Agent framework | `deepagents` (JS SDK di atas LangGraph) |
| Agent memory | LangGraph Memory Store per tenant |
| Agent observability | LangSmith |
| Monorepo | Turborepo |
| Schema validation | Zod |
| Auth | JWT per tenant |
| Container | Docker + Kubernetes |
| Async jobs | BullMQ (Wave 2) |

---

## Wave Alignment

| Wave | Periode | Backend deliverable |
|------|---------|---------------------|
| **1** | Jul–Sep 2026 | ontology-engine, ontology-sdk, api, agent-service (suggest-only), 6 MVP screens |
| **2** | Oct–Dec 2026 | worker (BullMQ), finance modules, interco console |
| **3** | Jan–Mar 2027 | Commercial workspace, autonomous agent actions (post-HITL review) |
| **4** | Apr–Jun 2027 | Network/LocalHero modules, multi-region deployment |

---

## Out of Scope (dokumen ini)

- Frontend aplikasi (Ops Control Tower, Financial Governance)
- LangGraph graph definitions (TBD dengan agent-service implementation)
- Full 41-object property catalog (menunggu Object Catalog v0.2)
- `ontology-engine` API OpenAPI spec (menunggu implementasi)
- Multi-region / global deployment strategy

---

## Related Documentation

| Topik | Path |
|-------|------|
| Ontology concepts | `documentation/01-concepts/` |
| Action types | `documentation/02-ontology-language/action-types.md` |
| Functions vs agents | `documentation/02-ontology-language/functions-vs-agents.md` |
| Agent operating loop | `documentation/04-product/agent-operating-loop.md` |
| Security governance | `documentation/03-architecture/security-agent-governance.md` |
| ADR 001 — Ontology before apps | `documentation/06-adrs/001-ontology-before-apps.md` |
| ADR 002 — Wave 1 suggest-only | `documentation/06-adrs/002-wave1-suggest-only-agent.md` |
| ADR 003 — Single execute-action | `documentation/06-adrs/003-single-execute-action.md` |
