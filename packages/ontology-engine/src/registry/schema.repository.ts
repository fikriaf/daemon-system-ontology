import { eq } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import { tenantSchemas } from '../db/schema.js';
import type { OntologySchema } from '@daemon/ontology-language';

export class SchemaRepository {
  constructor(private db: DbClient) {}

  async save(tenantId: string, schema: OntologySchema, uploadedBy: string): Promise<void> {
    await this.db
      .insert(tenantSchemas)
      .values({
        tenantId,
        schema: schema as unknown as Record<string, unknown>,
        uploadedBy,
      })
      .onConflictDoUpdate({
        target: tenantSchemas.tenantId,
        set: {
          schema: schema as unknown as Record<string, unknown>,
          version: new Date().toISOString(),
          uploadedBy,
          uploadedAt: new Date(),
        },
      });
  }

  async load(tenantId: string): Promise<OntologySchema | null> {
    const [row] = await this.db
      .select()
      .from(tenantSchemas)
      .where(eq(tenantSchemas.tenantId, tenantId));

    if (!row) return null;
    return row.schema as unknown as OntologySchema;
  }
}
