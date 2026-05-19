import type Redis from 'ioredis';
import type { OntologySchema } from '@daemon/ontology-language';
import { SchemaRegistry } from './schema.registry.js';

const CACHE_KEY_PREFIX = 'schema:';
const CACHE_TTL_SECONDS = 3600;

export class SchemaCacheService {
  constructor(private redis: Redis) {}

  private cacheKey(tenantId: string): string {
    return `${CACHE_KEY_PREFIX}${tenantId}`;
  }

  async getRegistry(tenantId: string): Promise<SchemaRegistry | null> {
    const cached = await this.redis.get(this.cacheKey(tenantId));
    if (!cached) return null;
    const schema: OntologySchema = JSON.parse(cached);
    return new SchemaRegistry(schema);
  }

  async setRegistry(tenantId: string, schema: OntologySchema): Promise<void> {
    await this.redis.set(
      this.cacheKey(tenantId),
      JSON.stringify(schema),
      'EX',
      CACHE_TTL_SECONDS
    );
  }

  async invalidate(tenantId: string): Promise<void> {
    await this.redis.del(this.cacheKey(tenantId));
  }
}
