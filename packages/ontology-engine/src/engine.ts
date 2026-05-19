import { loadOntologyFromDirectory, validateOntologySchema } from '@daemon/ontology-language';
import type { OntologySchema } from '@daemon/ontology-language';
import { createDbClient, type DbConfig } from './db/client.js';
import { createRedisClient, type RedisConfig } from './db/redis.client.js';
import { SchemaRegistry } from './registry/schema.registry.js';
import { SchemaRepository } from './registry/schema.repository.js';
import { SchemaCacheService } from './registry/schema.cache.js';
import { ObjectRepository } from './object/object.repository.js';
import { ObjectService } from './object/object.service.js';
import { ActionExecutor } from './action/action.executor.js';
import { ActionAuditService } from './action/action.audit.js';
import { EventPublisher } from './events/event.publisher.js';
import { MetricsService } from './metrics/metrics.service.js';

export interface EngineConfig {
  db: DbConfig;
  redis: RedisConfig;
  tenantId: string;
  schemaDir?: string;
  schema?: OntologySchema;
}

export class OntologyEngine {
  private registry: SchemaRegistry;
  private schemaRepo: SchemaRepository;
  private cache: SchemaCacheService;
  private tenantId: string;
  readonly objects: ObjectService;
  readonly actions: ActionExecutor;
  readonly audit: ActionAuditService;
  readonly metrics: MetricsService;

  private constructor(
    registry: SchemaRegistry,
    schemaRepo: SchemaRepository,
    cache: SchemaCacheService,
    tenantId: string,
    objects: ObjectService,
    actions: ActionExecutor,
    audit: ActionAuditService,
    metrics: MetricsService
  ) {
    this.registry = registry;
    this.schemaRepo = schemaRepo;
    this.cache = cache;
    this.tenantId = tenantId;
    this.objects = objects;
    this.actions = actions;
    this.audit = audit;
    this.metrics = metrics;
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
    const schemaRepo = new SchemaRepository(db);
    const cache = new SchemaCacheService(redis);
    await cache.setRegistry(config.tenantId, schema);

    // 4. Wire services
    const objectRepo = new ObjectRepository(db);
    const objectService = new ObjectService(objectRepo, registry);
    const auditService = new ActionAuditService(db);
    const eventPublisher = new EventPublisher(redis);
    const actionExecutor = new ActionExecutor(registry, objectRepo, auditService, eventPublisher);
    const metricsService = new MetricsService(db);

    return new OntologyEngine(registry, schemaRepo, cache, config.tenantId, objectService, actionExecutor, auditService, metricsService);
  }

  getRegistry(): SchemaRegistry {
    return this.registry;
  }

  async reloadSchema(schema: OntologySchema, uploadedBy: string): Promise<void> {
    // Validate first
    const errors = validateOntologySchema(schema);
    if (errors.length > 0) {
      throw new Error(`Invalid schema:\n${errors.join('\n')}`);
    }

    // Persist to DB
    await this.schemaRepo.save(this.tenantId, schema, uploadedBy);

    // Hot-reload registry in memory
    this.registry.reload(schema);

    // Invalidate Redis cache so other instances pick up the change
    await this.cache.invalidate(this.tenantId);
    await this.cache.setRegistry(this.tenantId, schema);
  }
}
