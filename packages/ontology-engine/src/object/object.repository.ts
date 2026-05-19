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

  async update(id: string, properties: Record<string, unknown>): Promise<ObjectRow | undefined> {
    const [row] = await this.db
      .update(objects)
      .set({ properties, updatedAt: new Date() })
      .where(and(eq(objects.id, id), isNull(objects.deletedAt)))
      .returning();
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

    // In-memory property filter
    return rows.filter(row => {
      const props = row.properties as Record<string, unknown>;
      return Object.entries(filters).every(([key, val]) => props[key] === val);
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const [row] = await this.db
      .update(objects)
      .set({ deletedAt: new Date() })
      .where(and(eq(objects.id, id), isNull(objects.deletedAt)))
      .returning();
    return !!row;
  }
}
