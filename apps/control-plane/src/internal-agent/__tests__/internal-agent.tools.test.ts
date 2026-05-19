import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  list_tenants,
  get_tenant,
  get_tenant_health,
  get_tenant_metrics,
  query_tenant_logs,
  summarize_tenant_incidents,
  type InternalAgentToolsContext,
} from '../tools.js';

describe('internal-agent tools', () => {
  let mockTenantRepository: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    getLatestMetrics: ReturnType<typeof vi.fn>;
  };
  let mockHealthRepository: {
    getHealthHistory: ReturnType<typeof vi.fn>;
  };
  let mockLogRepository: {
    query: ReturnType<typeof vi.fn>;
  };
  let mockGovernance: {
    recordEvidence: ReturnType<typeof vi.fn>;
  };
  let ctx: InternalAgentToolsContext;

  beforeEach(() => {
    mockTenantRepository = {
      findAll: vi.fn().mockResolvedValue([
        { id: 'tenant-1', displayName: 'Tenant 1', status: 'active', onboardedAt: new Date('2024-01-01') },
        { id: 'tenant-2', displayName: 'Tenant 2', status: 'suspended', onboardedAt: new Date('2024-02-01') },
      ]),
      findById: vi.fn(),
      getLatestMetrics: vi.fn(),
    };
    mockHealthRepository = {
      getHealthHistory: vi.fn(),
    };
    mockLogRepository = {
      query: vi.fn(),
    };
    mockGovernance = {
      recordEvidence: vi.fn(),
    };
    ctx = {
      tenantRepository: mockTenantRepository as any,
      healthRepository: mockHealthRepository as any,
      logRepository: mockLogRepository as any,
      governance: mockGovernance as any,
    };
  });

  describe('list_tenants', () => {
    it('returns simplified tenant id list', async () => {
      const result = await list_tenants(ctx);

      expect(result).toEqual({
        tenants: [{ id: 'tenant-1' }, { id: 'tenant-2' }],
      });
    });

    it('returns error on repository failure', async () => {
      mockTenantRepository.findAll.mockRejectedValue(new Error('DB error'));

      const result = await list_tenants(ctx);

      expect(result).toEqual({ error: 'DB error' });
    });
  });

  describe('get_tenant', () => {
    it('returns tenant object with id, name, status, createdAt', async () => {
      mockTenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        displayName: 'Test Tenant',
        status: 'active',
        onboardedAt: new Date('2024-01-15'),
      });

      const result = await get_tenant('tenant-1', ctx);

      expect(result).toEqual({
        id: 'tenant-1',
        name: 'Test Tenant',
        status: 'active',
        createdAt: new Date('2024-01-15'),
      });
    });

    it('returns error when tenantId is missing', async () => {
      const result = await get_tenant('', ctx);

      expect(result).toEqual({ error: 'tenantId is required' });
    });

    it('returns error when tenant not found', async () => {
      mockTenantRepository.findById.mockResolvedValue(null);

      const result = await get_tenant('nonexistent', ctx);

      expect(result).toEqual({ error: 'Tenant nonexistent not found' });
    });

    it('returns error on repository failure', async () => {
      mockTenantRepository.findById.mockRejectedValue(new Error('Connection refused'));

      const result = await get_tenant('tenant-1', ctx);

      expect(result).toEqual({ error: 'Connection refused' });
    });
  });

  describe('get_tenant_health', () => {
    it('returns health summary with status, lastCheck, components', async () => {
      mockHealthRepository.getHealthHistory
        .mockResolvedValueOnce([
          {
            id: 'health-1',
            service: 'api',
            status: 'up',
            checkedAt: new Date('2024-01-15T10:00:00Z'),
            errorMessage: null,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await get_tenant_health('tenant-1', ctx);

      expect(result).not.toHaveProperty('error');
      if ('status' in result) {
        expect(result.status).toBe('up');
        expect(result.lastCheck).toEqual(new Date('2024-01-15T10:00:00Z'));
        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(expect.objectContaining({ name: 'api', status: 'up' }));
      }
    });

    it('includes error messages in component details', async () => {
      mockHealthRepository.getHealthHistory
        .mockResolvedValueOnce([
          {
            id: 'health-1',
            service: 'api',
            status: 'down',
            checkedAt: new Date('2024-01-15T10:00:00Z'),
            errorMessage: 'Connection timeout',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await get_tenant_health('tenant-1', ctx);

      expect(result).not.toHaveProperty('error');
      if ('status' in result) {
        expect(result.status).toBe('down');
        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(expect.objectContaining({ name: 'api', status: 'down', message: 'Connection timeout' }));
      }
    });

    it('returns error when tenantId is missing', async () => {
      const result = await get_tenant_health('', ctx);

      expect(result).toEqual({ error: 'tenantId is required' });
    });
  });

  describe('get_tenant_metrics', () => {
    it('returns metrics object from repository', async () => {
      mockTenantRepository.getLatestMetrics.mockResolvedValue({
        apiRequestsTotal: 1000,
        apiRequestsError: 5,
        apiAvgResponseMs: 150.5,
        objectsTotal: 500,
        proposalsCreated: 50,
        proposalsApproved: 45,
        proposalsRejected: 5,
        agentInvocations: 200,
        schemaObjectTypes: 20,
        schemaActionTypes: 30,
        snapshotAt: new Date('2024-01-15T10:00:00Z'),
      });

      const result = await get_tenant_metrics('tenant-1', ctx);

      expect(result).toEqual({
        apiRequestsTotal: 1000,
        apiRequestsError: 5,
        apiAvgResponseMs: 150.5,
        objectsTotal: 500,
        proposalsCreated: 50,
        proposalsApproved: 45,
        proposalsRejected: 5,
        agentInvocations: 200,
        schemaObjectTypes: 20,
        schemaActionTypes: 30,
        snapshotAt: new Date('2024-01-15T10:00:00Z'),
      });
    });

    it('returns error when no metrics found', async () => {
      mockTenantRepository.getLatestMetrics.mockResolvedValue(null);

      const result = await get_tenant_metrics('tenant-1', ctx);

      expect(result).toEqual({ error: 'No metrics found for tenant tenant-1' });
    });

    it('returns error when tenantId is missing', async () => {
      const result = await get_tenant_metrics('', ctx);

      expect(result).toEqual({ error: 'tenantId is required' });
    });
  });

  describe('query_tenant_logs', () => {
    it('returns log entries with timestamp, level, message', async () => {
      mockLogRepository.query.mockResolvedValue([
        { loggedAt: new Date('2024-01-15T10:00:00Z'), level: 'info', message: 'Request started' },
        { loggedAt: new Date('2024-01-15T10:01:00Z'), level: 'error', message: 'Request failed' },
      ]);

      const result = await query_tenant_logs('tenant-1', ctx);

      expect(result).toEqual({
        entries: [
          { timestamp: new Date('2024-01-15T10:00:00Z'), level: 'info', message: 'Request started' },
          { timestamp: new Date('2024-01-15T10:01:00Z'), level: 'error', message: 'Request failed' },
        ],
      });
    });

    it('passes query and limit to repository', async () => {
      mockLogRepository.query.mockResolvedValue([]);

      await query_tenant_logs('tenant-1', ctx, 'api', 25);

      expect(mockLogRepository.query).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        service: 'api',
        limit: 25,
      });
    });

    it('returns error when tenantId is missing', async () => {
      const result = await query_tenant_logs('', ctx);

      expect(result).toEqual({ error: 'tenantId is required' });
    });
  });

  describe('summarize_tenant_incidents', () => {
    it('returns incidents from health check failures', async () => {
      mockHealthRepository.getHealthHistory
        .mockResolvedValueOnce([
          {
            id: 'health-1',
            service: 'api',
            status: 'down',
            checkedAt: new Date('2024-01-15T10:00:00Z'),
            errorMessage: 'Connection refused',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'health-2',
            service: 'agent',
            status: 'up',
            checkedAt: new Date('2024-01-15T10:00:00Z'),
            errorMessage: null,
          },
        ]);

      const result = await summarize_tenant_incidents('tenant-1', ctx);

      expect(result).toEqual({
        incidents: [
          {
            id: 'health-1',
            severity: 'critical',
            summary: 'api health check failed: Connection refused',
            createdAt: new Date('2024-01-15T10:00:00Z'),
          },
        ],
      });
    });

    it('includes degraded status as warning incidents', async () => {
      mockHealthRepository.getHealthHistory
        .mockResolvedValueOnce([
          {
            id: 'health-1',
            service: 'api',
            status: 'degraded',
            checkedAt: new Date('2024-01-15T10:00:00Z'),
            errorMessage: 'High latency',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await summarize_tenant_incidents('tenant-1', ctx);

      expect(result).toEqual({
        incidents: [
          {
            id: 'health-1',
            severity: 'warning',
            summary: 'api health check degraded: High latency',
            createdAt: new Date('2024-01-15T10:00:00Z'),
          },
        ],
      });
    });

    it('returns empty incidents when no failures', async () => {
      mockHealthRepository.getHealthHistory
        .mockResolvedValueOnce([
          { id: 'health-1', service: 'api', status: 'up', checkedAt: new Date(), errorMessage: null },
        ])
        .mockResolvedValueOnce([
          { id: 'health-2', service: 'agent', status: 'up', checkedAt: new Date(), errorMessage: null },
        ]);

      const result = await summarize_tenant_incidents('tenant-1', ctx);

      expect(result).toEqual({ incidents: [] });
    });

    it('returns error when tenantId is missing', async () => {
      const result = await summarize_tenant_incidents('', ctx);

      expect(result).toEqual({ error: 'tenantId is required' });
    });
  });
});