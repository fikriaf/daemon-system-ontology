import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthPoller } from '../health/health.poller.js';
import type { DbClient } from '../db/client.js';

// Minimal stubs — HealthPoller takes DbClient and instantiates repos internally
// We test behavior via fetch mock and by checking no exceptions are thrown

describe('HealthPoller — unit', () => {
  const mockDb = {} as DbClient;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('stop() clears the interval without error', () => {
    vi.useFakeTimers();
    const poller = new HealthPoller(mockDb, { intervalMs: 5000, timeoutMs: 1000 });
    // Just calling stop without start should not throw
    expect(() => poller.stop()).not.toThrow();
  });

  it('poll() handles empty tenant list gracefully', async () => {
    // Override TenantRepository inside poller via prototype spy
    const findAllSpy = vi.fn().mockResolvedValue([]);
    const { TenantRepository } = await import('../tenants/tenant.repository.js');
    vi.spyOn(TenantRepository.prototype, 'findAll').mockImplementation(findAllSpy);

    const poller = new HealthPoller(mockDb, { intervalMs: 60000, timeoutMs: 1000 });
    await expect(poller.poll()).resolves.toBeUndefined();
    expect(findAllSpy).toHaveBeenCalled();
  });

  it('poll() records "up" when API health returns 200', async () => {
    const { TenantRepository } = await import('../tenants/tenant.repository.js');
    vi.spyOn(TenantRepository.prototype, 'findAll').mockResolvedValue([
      { id: 'tenant-1', apiUrl: 'http://acme.daemon.com', agentUrl: null } as any,
    ]);

    const { HealthRepository } = await import('../health/health.repository.js');
    const recordHealthSpy = vi.fn().mockResolvedValue(undefined);
    const recordMetricsSpy = vi.fn().mockResolvedValue(undefined);
    const recordServerInfoSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HealthRepository.prototype, 'recordHealth').mockImplementation(recordHealthSpy);
    vi.spyOn(HealthRepository.prototype, 'recordMetrics').mockImplementation(recordMetricsSpy);
    vi.spyOn(HealthRepository.prototype, 'recordServerInfo').mockImplementation(recordServerInfoSpy);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        service: 'api',
        uptime: 3600,
        usage: { objectsTotal: 10, proposalsCreated: 5, proposalsApproved: 3, proposalsRejected: 1 },
        schema: { objectTypes: 2, actionTypes: 1 },
        system: { nodeVersion: 'v20.0.0', memUsedMb: 128, memTotalMb: 1024, loadAvg: [0.5] },
      }),
    }));

    const poller = new HealthPoller(mockDb, { intervalMs: 60000, timeoutMs: 1000 });
    await poller.poll();

    expect(recordHealthSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', service: 'api', status: 'up' })
    );
  });

  it('poll() records "down" when health endpoint fails', async () => {
    const { TenantRepository } = await import('../tenants/tenant.repository.js');
    vi.spyOn(TenantRepository.prototype, 'findAll').mockResolvedValue([
      { id: 'tenant-down', apiUrl: 'http://down.daemon.com', agentUrl: null } as any,
    ]);

    const { HealthRepository } = await import('../health/health.repository.js');
    const recordHealthSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HealthRepository.prototype, 'recordHealth').mockImplementation(recordHealthSpy);
    vi.spyOn(HealthRepository.prototype, 'recordMetrics').mockResolvedValue(undefined);
    vi.spyOn(HealthRepository.prototype, 'recordServerInfo').mockResolvedValue(undefined);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const poller = new HealthPoller(mockDb, { intervalMs: 60000, timeoutMs: 1000 });
    await expect(poller.poll()).resolves.toBeUndefined();

    expect(recordHealthSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-down', status: 'down' })
    );
  });

  it('poll() records "degraded" when health returns non-200', async () => {
    const { TenantRepository } = await import('../tenants/tenant.repository.js');
    vi.spyOn(TenantRepository.prototype, 'findAll').mockResolvedValue([
      { id: 'tenant-degraded', apiUrl: 'http://slow.daemon.com', agentUrl: null } as any,
    ]);

    const { HealthRepository } = await import('../health/health.repository.js');
    const recordHealthSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HealthRepository.prototype, 'recordHealth').mockImplementation(recordHealthSpy);
    vi.spyOn(HealthRepository.prototype, 'recordMetrics').mockResolvedValue(undefined);
    vi.spyOn(HealthRepository.prototype, 'recordServerInfo').mockResolvedValue(undefined);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));

    const poller = new HealthPoller(mockDb, { intervalMs: 60000, timeoutMs: 1000 });
    await poller.poll();

    expect(recordHealthSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded', httpStatus: 503 })
    );
  });
});
