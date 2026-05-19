import { loadOntologyFromDirectory, validateOntologySchema } from '@daemon/ontology-language';
import type { OntologySchema } from '@daemon/ontology-language';
import { createDbClient, type DbConfig } from './db/client.js';
import { createRedisClient, type RedisConfig } from './db/redis.client.js';
import { SchemaRegistry } from './registry/schema.registry.js';
import { SchemaCacheService } from './registry/schema.cache.js';
import { ObjectRepository } from './object/object.repository.js';
import { ObjectService } from './object/object.service.js';
import { ActionExecutor } from './action/action.executor.js';
import { ActionAuditService } from './action/action.audit.js';
import { EventPublisher } from './events/event.publisher.js';

export interface EngineConfig {
  db: DbConfig;
  redis: RedisConfig;
  tenantId: string;
  schemaDir?: string;
  schema?: OntologySchema;
}

export class OntologyEngine {
  private registry: SchemaRegistry;
  readonly objects: ObjectService;
  readonly actions: ActionExecutor;

  private constructor(
    registry: SchemaRegistry,
    objects: ObjectService,
    actions: ActionExecutor
  ) {
    this.registry = registry;
    this.objects = objects;
    this.actions = actions;
  }

  static async create(config: EngineConfig): Promise<OntologyEngine> {
    // 1. Load schema
    let schema: OntologySchema;
    if (config.schema) {
      schema = config.schema;
    } else if (config.schemaDir) {
      schema = await loadOntologyFromDirectory(config.schemaDir);
      const errors = validateOntologySchema(schema);
      if (errors.length > 0) {
        throw new Error(`Invalid ontology schema:\n${errors.join('\n')}`);
      }
    } else {
      throw new Error('Either schema or schemaDir must be provided');
    }

    // 2. Create clients
    const db = createDbClient(config.db);
    const redis = createRedisClient(config.redis);

    // 3. Setup registry with cache
    const registry = new SchemaRegistry(schema);
    const cache = new SchemaCacheService(redis);
    await cache.setRegistry(config.tenantId, schema);

    // 4. Wire services
    const objectRepo = new ObjectRepository(db);
    const objectService = new ObjectService(objectRepo, registry);
    const auditService = new ActionAuditService(db);
    const eventPublisher = new EventPublisher(redis);
    const actionExecutor = new ActionExecutor(registry, objectRepo, auditService, eventPublisher);

    return new OntologyEngine(registry, objectService, actionExecutor);
  }

  getRegistry(): SchemaRegistry {
    return this.registry;
  }
}
