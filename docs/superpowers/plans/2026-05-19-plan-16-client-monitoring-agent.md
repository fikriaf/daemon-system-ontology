# Client Monitoring Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scheduled client-side monitoring agent in `apps/agent-service` that runs the dynamic `monitoring` skill, stores latest run status in Redis, and pushes monitoring logs to the control plane.

**Architecture:** Implement a focused `MonitoringScheduler` that owns scheduling and `runOnce()` orchestration. Keep control-plane log pushing in a separate `ControlPlaneLogClient`. Wire both into `buildAgentServer()` with manual run/status routes and environment config.

**Tech Stack:** TypeScript, Fastify, Vitest, ioredis, deepagents via existing `createRootAgent`, `@daemon/plugin-sdk` dynamic skills, WSL `/usr/bin/pnpm` for verification.

---

## File Structure

- Create: `apps/agent-service/src/monitoring/control-plane-log.client.ts`
  - Best-effort HTTP client for `POST /logs/receive`.
- Create: `apps/agent-service/src/monitoring/monitoring.scheduler.ts`
  - Scheduler state, `start()`, `stop()`, `runOnce()`, Redis persistence, control-plane log calls.
- Create: `apps/agent-service/src/__tests__/monitoring-scheduler.test.ts`
  - Unit tests for scheduler and log client behavior with mocked dependencies.
- Create: `apps/agent-service/src/__tests__/monitoring-routes.test.ts`
  - Server-level tests for `POST /agent/monitor/run` and `GET /agent/monitor/status` using injected scheduler factories.
- Modify: `apps/agent-service/src/server.ts`
  - Add monitoring config, instantiate scheduler, add lifecycle hooks and routes.
- Modify: `apps/agent-service/src/index.ts`
  - Read env vars into monitoring config.
- Modify: `apps/agent-service/.env.example`
  - Document monitoring env vars.

---

### Task 1: Add ControlPlaneLogClient

**Files:**
- Create: `apps/agent-service/src/monitoring/control-plane-log.client.ts`
- Test: `apps/agent-service/src/__tests__/monitoring-scheduler.test.ts`

- [x] **Step 1: Write the failing tests**

Add this test file skeleton and the first two tests:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPlaneLogClient } from '../monitoring/control-plane-log.client.js';

describe('ControlPlaneLogClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('posts monitoring logs to the control plane receive endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ControlPlaneLogClient({
      controlPlaneUrl: 'http://control-plane:4000',
      controlPlaneSecret: 'secret',
      tenantId: 'tenant-1',
    });

    await client.push({
      level: 'info',
      message: 'monitoring pass completed',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://control-plane:4000/logs/receive',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret',
        },
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      tenantId: 'tenant-1',
      service: 'agent',
      level: 'info',
      message: 'monitoring pass completed',
      path: '/agent/monitor/run',
    });
  });

  it('does nothing when control plane config is missing', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ControlPlaneLogClient({ tenantId: 'tenant-1' });
    await client.push({ level: 'warn', message: 'not sent' });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service test -- src/__tests__/monitoring-scheduler.test.ts"
```

Expected: FAIL because `../monitoring/control-plane-log.client.js` does not exist.

- [x] **Step 3: Implement minimal ControlPlaneLogClient**

Create `apps/agent-service/src/monitoring/control-plane-log.client.ts`:

```typescript
export interface ControlPlaneLogClientConfig {
  tenantId: string;
  controlPlaneUrl?: string;
  controlPlaneSecret?: string;
}

export interface MonitoringLogPayload {
  level: 'info' | 'warn' | 'error';
  message: string;
}

export class ControlPlaneLogClient {
  constructor(private readonly config: ControlPlaneLogClientConfig) {}

  async push(payload: MonitoringLogPayload): Promise<void> {
    const { controlPlaneUrl, controlPlaneSecret, tenantId } = this.config;
    if (!controlPlaneUrl || !controlPlaneSecret) return;

    try {
      await fetch(`${controlPlaneUrl}/logs/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${controlPlaneSecret}`,
        },
        body: JSON.stringify({
          tenantId,
          service: 'agent',
          level: payload.level,
          path: '/agent/monitor/run',
          message: payload.message,
          loggedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Control-plane logging is best-effort and must not fail monitoring.
    }
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

Run the same command from Step 2.

Expected: PASS for `ControlPlaneLogClient` tests.

---

### Task 2: Add MonitoringScheduler Core Run Logic

**Files:**
- Modify: `apps/agent-service/src/__tests__/monitoring-scheduler.test.ts`
- Create: `apps/agent-service/src/monitoring/monitoring.scheduler.ts`

- [x] **Step 1: Write failing scheduler tests**

Append these tests to `monitoring-scheduler.test.ts`:

```typescript
import { MonitoringScheduler } from '../monitoring/monitoring.scheduler.js';

describe('MonitoringScheduler', () => {
  function createDeps(overrides: Record<string, unknown> = {}) {
    const agent = {
      invoke: vi.fn().mockResolvedValue({
        messages: [{ content: 'monitoring summary' }],
      }),
    };

    const redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn(),
    };

    return {
      tenantId: 'tenant-1',
      redis: redis as any,
      configStore: {
        get: vi.fn().mockResolvedValue({ activeSkills: ['analytics'] }),
      },
      modelFactory: vi.fn().mockReturnValue({}),
      createAgent: vi.fn().mockResolvedValue(agent),
      createClient: vi.fn().mockReturnValue({}),
      createProposer: vi.fn().mockReturnValue({}),
      logClient: {
        push: vi.fn().mockResolvedValue(undefined),
      },
      engine: {},
      modelConfig: { agentModel: 'openai:gpt-4o' },
      intervalMs: 300000,
      ...overrides,
    };
  }

  it('runOnce creates a root agent with the monitoring skill active', async () => {
    const deps = createDeps();
    const scheduler = new MonitoringScheduler(deps as any);

    await scheduler.runOnce();

    expect(deps.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSkills: ['analytics', 'monitoring'],
      })
    );
  });

  it('runOnce stores the latest result in Redis and status memory', async () => {
    const deps = createDeps();
    const scheduler = new MonitoringScheduler(deps as any);

    const result = await scheduler.runOnce();

    expect(result.status).toBe('success');
    expect(deps.redis.set).toHaveBeenCalledWith(
      'monitor:last-run:tenant-1',
      expect.stringContaining('monitoring summary')
    );
    expect(scheduler.getStatus().lastResult?.status).toBe('success');
  });

  it('runOnce pushes success logs to control plane', async () => {
    const deps = createDeps();
    const scheduler = new MonitoringScheduler(deps as any);

    await scheduler.runOnce();

    expect(deps.logClient.push).toHaveBeenCalledWith({
      level: 'info',
      message: expect.stringContaining('Monitoring run completed'),
    });
  });

  it('runOnce records lastError and pushes error log when agent fails', async () => {
    const deps = createDeps({
      createAgent: vi.fn().mockResolvedValue({
        invoke: vi.fn().mockRejectedValue(new Error('model unavailable')),
      }),
    });
    const scheduler = new MonitoringScheduler(deps as any);

    const result = await scheduler.runOnce();

    expect(result.status).toBe('error');
    expect(result.error).toContain('model unavailable');
    expect(scheduler.getStatus().lastError).toContain('model unavailable');
    expect(deps.logClient.push).toHaveBeenCalledWith({
      level: 'error',
      message: expect.stringContaining('model unavailable'),
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service test -- src/__tests__/monitoring-scheduler.test.ts"
```

Expected: FAIL because `MonitoringScheduler` does not exist.

- [x] **Step 3: Implement scheduler runOnce**

Create `apps/agent-service/src/monitoring/monitoring.scheduler.ts`:

```typescript
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import type { Redis } from 'ioredis';
import type { TenantAgentConfig, TenantConfigStore } from '../config/tenant-config.store.js';
import type { ModelConfig } from '../model/model.factory.js';
import type { RootAgent, RootAgentContext } from '../agents/root.agent.js';
import type { ControlPlaneLogClient } from './control-plane-log.client.js';

const MONITORING_PROMPT = `Run a monitoring pass for this tenant.
Use read_schema first to discover object and action types.
Check for SLA breaches, anomalous status distributions, and worsening trends.
If you find a critical issue, call send_alert with severity warning or critical.
Do not execute actions directly. If an operational action is needed, only propose it and explain why.
Return a concise JSON-like summary with findings, alertsSent, and recommendedFollowUp.`;

export interface MonitoringRunResult {
  status: 'success' | 'error';
  tenantId: string;
  startedAt: string;
  finishedAt: string;
  summary?: string;
  error?: string;
}

export interface MonitoringSchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastResult: MonitoringRunResult | null;
  lastError: string | null;
}

export interface MonitoringSchedulerDeps {
  tenantId: string;
  enabled?: boolean;
  intervalMs: number;
  redis: Redis;
  engine: OntologyEngine;
  modelConfig: ModelConfig;
  configStore: TenantConfigStore;
  logClient: ControlPlaneLogClient;
  modelFactory(config: TenantAgentConfig | null, envConfig: ModelConfig): BaseChatModel;
  createClient(engine: OntologyEngine, redis: Redis, tenantId: string): OntologyClient;
  createProposer(redis: Redis, tenantId: string): ActionProposer;
  createAgent(ctx: RootAgentContext): Promise<RootAgent>;
}

export class MonitoringScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastRunAt: string | null = null;
  private lastResult: MonitoringRunResult | null = null;
  private lastError: string | null = null;

  constructor(private readonly deps: MonitoringSchedulerDeps) {}

  start(): void {
    if (!this.deps.enabled || this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.deps.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  getStatus(): MonitoringSchedulerStatus {
    return {
      enabled: Boolean(this.deps.enabled),
      running: this.running,
      intervalMs: this.deps.intervalMs,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
    };
  }

  async runOnce(): Promise<MonitoringRunResult> {
    const startedAt = new Date().toISOString();
    this.running = true;
    this.lastRunAt = startedAt;

    try {
      const tenantConfig = await this.deps.configStore.get(this.deps.tenantId);
      const activeSkills = Array.from(new Set([...(tenantConfig?.activeSkills ?? []), 'monitoring']));
      const model = this.deps.modelFactory(tenantConfig, this.deps.modelConfig);
      const client = this.deps.createClient(this.deps.engine, this.deps.redis, this.deps.tenantId);
      const proposer = this.deps.createProposer(this.deps.redis, this.deps.tenantId);

      const agent = await this.deps.createAgent({
        tenantId: this.deps.tenantId,
        model,
        engine: this.deps.engine,
        client,
        proposer,
        redis: this.deps.redis,
        systemPromptPrefix: tenantConfig?.systemPromptPrefix,
        actionAllowlist: tenantConfig?.actionAllowlist,
        activeSkills,
        activePlugins: tenantConfig?.activePlugins,
        pluginConfig: tenantConfig?.pluginConfig,
      });

      const response = await agent.invoke({
        messages: [{ role: 'user', content: MONITORING_PROMPT }],
      });

      const messages = response.messages ?? [];
      const lastMessage = messages[messages.length - 1];
      const summary = typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? null);

      const result: MonitoringRunResult = {
        status: 'success',
        tenantId: this.deps.tenantId,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary,
      };

      this.lastResult = result;
      this.lastError = null;
      await this.deps.redis.set(`monitor:last-run:${this.deps.tenantId}`, JSON.stringify(result));
      await this.deps.logClient.push({
        level: 'info',
        message: `Monitoring run completed for ${this.deps.tenantId}: ${summary}`,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: MonitoringRunResult = {
        status: 'error',
        tenantId: this.deps.tenantId,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: message,
      };

      this.lastResult = result;
      this.lastError = message;
      await this.deps.redis.set(`monitor:last-run:${this.deps.tenantId}`, JSON.stringify(result));
      await this.deps.logClient.push({
        level: 'error',
        message: `Monitoring run failed for ${this.deps.tenantId}: ${message}`,
      });
      return result;
    } finally {
      this.running = false;
    }
  }
}
```

- [x] **Step 4: Run scheduler tests**

Run the same command from Step 2.

Expected: PASS for scheduler tests.

---

### Task 3: Test And Implement Scheduler start/stop

**Files:**
- Modify: `apps/agent-service/src/__tests__/monitoring-scheduler.test.ts`
- Modify: `apps/agent-service/src/monitoring/monitoring.scheduler.ts`

- [x] **Step 1: Add failing start/stop tests**

Append inside `describe('MonitoringScheduler', ...)`:

```typescript
  it('start schedules interval when enabled and stop clears it', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const deps = createDeps({ enabled: true, intervalMs: 12345 });
    const scheduler = new MonitoringScheduler(deps as any);

    scheduler.start();
    scheduler.stop();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 12345);
    expect(clearIntervalSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('start does not schedule interval when disabled', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const deps = createDeps({ enabled: false });
    const scheduler = new MonitoringScheduler(deps as any);

    scheduler.start();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
```

- [x] **Step 2: Run tests to verify behavior**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service test -- src/__tests__/monitoring-scheduler.test.ts"
```

Expected: PASS if Task 2 implementation already covered this. If it fails, fix only `start()`/`stop()` to match the tests.

---

### Task 4: Wire MonitoringScheduler Into Agent Server

**Files:**
- Create: `apps/agent-service/src/__tests__/monitoring-routes.test.ts`
- Modify: `apps/agent-service/src/server.ts`

- [x] **Step 1: Write failing route tests**

Create `apps/agent-service/src/__tests__/monitoring-routes.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { buildAgentServer } from '../server.js';

describe('agent monitoring routes', () => {
  async function buildServerWithScheduler() {
    const scheduler = {
      start: vi.fn(),
      stop: vi.fn(),
      runOnce: vi.fn().mockResolvedValue({
        status: 'success',
        tenantId: 'tenant-test',
        startedAt: '2026-05-19T00:00:00.000Z',
        finishedAt: '2026-05-19T00:00:01.000Z',
        summary: 'ok',
      }),
      getStatus: vi.fn().mockReturnValue({
        enabled: true,
        running: false,
        intervalMs: 300000,
        lastRunAt: null,
        lastResult: null,
        lastError: null,
      }),
    };

    const app = await buildAgentServer({
      port: 0,
      modelConfig: { agentModel: 'openai:gpt-4o' },
      dbHost: 'localhost',
      dbPort: 5433,
      dbUser: 'daemon',
      dbPassword: 'daemon_test',
      dbName: 'daemon_test',
      redisHost: 'localhost',
      redisPort: 6381,
      schemaDir: './schemas',
      defaultTenantId: 'tenant-test',
      monitoringEnabled: true,
      monitoringIntervalMs: 300000,
      createMonitoringScheduler: () => scheduler as any,
    });

    return { app, scheduler };
  }

  it('GET /agent/monitor/status returns scheduler status', async () => {
    const { app, scheduler } = await buildServerWithScheduler();

    const res = await app.inject({ method: 'GET', url: '/agent/monitor/status' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enabled: true, intervalMs: 300000 });
    expect(scheduler.getStatus).toHaveBeenCalled();
    await app.close();
  });

  it('POST /agent/monitor/run triggers one monitoring run', async () => {
    const { app, scheduler } = await buildServerWithScheduler();

    const res = await app.inject({ method: 'POST', url: '/agent/monitor/run' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'success', tenantId: 'tenant-test' });
    expect(scheduler.runOnce).toHaveBeenCalled();
    await app.close();
  });

  it('starts scheduler on ready and stops scheduler on close', async () => {
    const { app, scheduler } = await buildServerWithScheduler();

    await app.ready();
    await app.close();

    expect(scheduler.start).toHaveBeenCalled();
    expect(scheduler.stop).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run route tests to verify they fail**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service test -- src/__tests__/monitoring-routes.test.ts"
```

Expected: FAIL because `AgentServerConfig` and routes do not support monitoring yet.

- [x] **Step 3: Modify server config and routes**

Modify `apps/agent-service/src/server.ts`:

```typescript
import { MonitoringScheduler } from './monitoring/monitoring.scheduler.js';
import { ControlPlaneLogClient } from './monitoring/control-plane-log.client.js';
```

Extend `AgentServerConfig`:

```typescript
  monitoringEnabled?: boolean;
  monitoringIntervalMs?: number;
  controlPlaneUrl?: string;
  controlPlaneSecret?: string;
  createMonitoringScheduler?: (deps: ConstructorParameters<typeof MonitoringScheduler>[0]) => MonitoringScheduler;
```

After `const configStore = new TenantConfigStore(redis);`, add:

```typescript
  const logClient = new ControlPlaneLogClient({
    tenantId: config.defaultTenantId,
    controlPlaneUrl: config.controlPlaneUrl,
    controlPlaneSecret: config.controlPlaneSecret,
  });

  const schedulerFactory = config.createMonitoringScheduler ?? ((deps) => new MonitoringScheduler(deps));
  const monitoringScheduler = schedulerFactory({
    tenantId: config.defaultTenantId,
    enabled: config.monitoringEnabled ?? false,
    intervalMs: config.monitoringIntervalMs ?? 300000,
    redis,
    engine,
    modelConfig: config.modelConfig,
    configStore,
    logClient,
    modelFactory: createModelFromConfig,
    createClient: (engineArg, redisArg, tenantIdArg) => new OntologyClient(engineArg, redisArg, tenantIdArg),
    createProposer: (redisArg, tenantIdArg) => new ActionProposer(redisArg, tenantIdArg),
    createAgent: createRootAgent,
  });

  app.addHook('onReady', async () => {
    monitoringScheduler.start();
  });

  app.addHook('onClose', async () => {
    monitoringScheduler.stop();
  });
```

Add routes before health:

```typescript
  app.post('/agent/monitor/run', async (_request, reply) => {
    const result = await monitoringScheduler.runOnce();
    return reply.send(result);
  });

  app.get('/agent/monitor/status', async (_request, reply) => {
    return reply.send(monitoringScheduler.getStatus());
  });
```

- [x] **Step 4: Run route tests**

Run the same command from Step 2.

Expected: PASS for route tests.

---

### Task 5: Wire Environment Config

**Files:**
- Modify: `apps/agent-service/src/index.ts`
- Modify: `apps/agent-service/.env.example`

- [x] **Step 1: Update runtime config in index.ts**

Modify `apps/agent-service/src/index.ts` config object to include:

```typescript
  monitoringEnabled: process.env.MONITORING_ENABLED === 'true',
  monitoringIntervalMs: Number(process.env.MONITORING_INTERVAL_MS ?? '300000'),
  controlPlaneUrl: process.env.CONTROL_PLANE_URL,
  controlPlaneSecret: process.env.CONTROL_PLANE_SECRET,
```

- [x] **Step 2: Update env example**

Append to `apps/agent-service/.env.example`:

```dotenv
# Client monitoring agent
MONITORING_ENABLED=false
MONITORING_INTERVAL_MS=300000
CONTROL_PLANE_URL=http://localhost:4000
CONTROL_PLANE_SECRET=change-me
```

- [x] **Step 3: Typecheck agent-service**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service lint"
```

Expected: PASS.

---

### Task 6: Verification

**Files:**
- No new files.

- [x] **Step 1: Run agent-service tests**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service test"
```

Expected: all agent-service tests pass, including monitoring tests.

- [x] **Step 2: Run agent-service build**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm --filter @daemon/agent-service build"
```

Expected: PASS.

- [x] **Step 3: Run full Turbo suite**

Run:

```bash
wsl -d Ubuntu -e bash -c "cd /mnt/d/script/Agentic/daemon-system-ontology && /usr/bin/pnpm test"
```

Expected: all workspace tests pass. Before Plan 16 the suite had 150 tests passing; after Plan 16 it should be higher.

---

## Self-Review

Spec coverage:

- Scheduled scheduler: Task 2 and Task 3.
- Manual run/status endpoints: Task 4.
- Redis latest result persistence: Task 2.
- Control-plane logs: Task 1 and Task 2.
- Env config: Task 5.
- Safety/HITL: Task 2 uses existing `createRootAgent` with monitoring skill and does not introduce action execution.

Placeholder scan:

- No TBD/TODO placeholders remain.
- All new files and commands are explicit.

Type consistency:

- `MonitoringSchedulerDeps` is referenced by server via `ConstructorParameters<typeof MonitoringScheduler>[0]`.
- `RootAgent` and `RootAgentContext` already exist from Plan 15 in `root.agent.ts`.
- `TenantAgentConfig` already includes `activeSkills`, `activePlugins`, and `pluginConfig`.
