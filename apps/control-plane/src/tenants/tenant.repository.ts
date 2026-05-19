import { eq, desc, and, isNull } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { tenants, healthChecks, metricsSnapshots } from '../db/schema.js';

export type TenantRow = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export interface TenantWithStatus extends TenantRow {
  lastApiHealth: string | null;
  lastAgentHealth: string | null;
  lastCheckedAt: Date | null;
}

export class TenantRepository {
  constructor(private db: DbClient) {}

  async create(data: Omit<NewTenant, 'id' | 'onboardedAt' | 'updatedAt'>): Promise<TenantRow> {
    const [row] = await this.db.insert(tenants).values(data).returning();
    return row;
  }

  async findAll(includeOffboarded = false): Promise<TenantRow[]> {
    if (includeOffboarded) {
      return this.db.select().from(tenants).orderBy(desc(tenants.onboardedAt));
    }
    return this.db
      .select()
      .from(tenants)
      .where(isNull(tenants.offboardedAt))
      .orderBy(desc(tenants.onboardedAt));
  }

  async findById(id: string): Promise<TenantRow | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.id, id));
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<TenantRow | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.slug, slug));
    return row ?? null;
  }

  async update(id: string, data: Partial<Omit<NewTenant, 'id'>>): Promise<TenantRow | null> {
    const [row] = await this.db
      .update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return row ?? null;
  }

  async offboard(id: string): Promise<TenantRow | null> {
    const [row] = await this.db
      .update(tenants)
      .set({ status: 'offboarded', offboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return row ?? null;
  }

  async findWithStatus(): Promise<TenantWithStatus[]> {
    const allTenants = await this.findAll();

    return Promise.all(
      allTenants.map(async (tenant) => {
        // Get latest health for each service
        const [apiHealth] = await this.db
          .select()
          .from(healthChecks)
          .where(and(eq(healthChecks.tenantId, tenant.id), eq(healthChecks.service, 'api')))
          .orderBy(desc(healthChecks.checkedAt))
          .limit(1);

        const [agentHealth] = await this.db
          .select()
          .from(healthChecks)
          .where(and(eq(healthChecks.tenantId, tenant.id), eq(healthChecks.service, 'agent')))
          .orderBy(desc(healthChecks.checkedAt))
          .limit(1);

        return {
          ...tenant,
          lastApiHealth: apiHealth?.status ?? null,
          lastAgentHealth: agentHealth?.status ?? null,
          lastCheckedAt: apiHealth?.checkedAt ?? null,
        };
      })
    );
  }

  async getLatestMetrics(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.tenantId, tenantId))
      .orderBy(desc(metricsSnapshots.snapshotAt))
      .limit(1);
    return row ?? null;
  }
}
