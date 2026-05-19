import { describe, expect, it, vi } from 'vitest';
import { buildAgentServer } from '../server.js';

vi.mock('@daemon/ontology-engine', async () => {
  const actual = await vi.importActual<typeof import('@daemon/ontology-engine')>('@daemon/ontology-engine');
  return {
    ...actual,
    OntologyEngine: {
      create: vi.fn().mockResolvedValue({}),
    },
    createRedisClient: vi.fn().mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      quit: vi.fn(),
    }),
  };
});

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
