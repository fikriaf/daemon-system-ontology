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
