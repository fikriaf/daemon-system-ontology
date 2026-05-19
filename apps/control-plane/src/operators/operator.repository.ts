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
