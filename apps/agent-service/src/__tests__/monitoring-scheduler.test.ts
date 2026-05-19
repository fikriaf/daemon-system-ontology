import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPlaneLogClient } from '../monitoring/control-plane-log.client.js';
import { MonitoringScheduler } from '../monitoring/monitoring.scheduler.js';

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
});
