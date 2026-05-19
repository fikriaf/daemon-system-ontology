import Fastify from 'fastify';
import { OntologyEngine } from '@daemon/ontology-engine';
import { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';
import { createRootAgent } from './agents/root.agent.js';
import { createModelFromConfig, type ModelConfig } from './model/model.factory.js';
import { TenantConfigStore } from './config/tenant-config.store.js';
import { ControlPlaneLogClient } from './monitoring/control-plane-log.client.js';
import { MonitoringScheduler } from './monitoring/monitoring.scheduler.js';
import { z } from 'zod';

export interface AgentServerConfig {
  port: number;
  modelConfig: ModelConfig;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  redisHost: string;
  redisPort: number;
  schemaDir: string;
  defaultTenantId: string;
  monitoringEnabled?: boolean;
  monitoringIntervalMs?: number;
  controlPlaneUrl?: string;
  controlPlaneSecret?: string;
  createMonitoringScheduler?: (deps: ConstructorParameters<typeof MonitoringScheduler>[0]) => MonitoringScheduler;
}

const ConfigPatchSchema = z.object({
  agentModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPromptPrefix: z.string().optional(),
  actionAllowlist: z.array(z.string()).optional(),
  activeSkills: z.array(z.string()).optional(),
  activePlugins: z.array(z.string()).optional(),
  pluginConfig: z.record(z.record(z.unknown())).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function buildAgentServer(config: AgentServerConfig) {
  const app = Fastify({ logger: false });

  // Shared infra
  console.log('[agent-service] connecting to DB and loading schema...');
  const engine = await OntologyEngine.create({
    db: {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    },
    redis: { host: config.redisHost, port: config.redisPort },
    tenantId: config.defaultTenantId,
    schemaDir: config.schemaDir,
  });

  console.log('[agent-service] engine ready, building server...');
  const redis = createRedisClient({ host: config.redisHost, port: config.redisPort });
  const configStore = new TenantConfigStore(redis);
  const logClient = new ControlPlaneLogClient({
    tenantId: config.defaultTenantId,
    controlPlaneUrl: config.controlPlaneUrl,
    controlPlaneSecret: config.controlPlaneSecret,
  });
  const schedulerFactory = config.createMonitoringScheduler ?? ((deps) => new MonitoringScheduler(deps));
  const monitoringScheduler = schedulerFactory({
    tenantId: config.defaultTenantId,
    enabled: config.monitoringEnabled ?? false,
    intervalMs: config.monitoringIntervalMs ?? 300000,
    redis,
    engine,
    modelConfig: config.modelConfig,
    configStore,
    logClient,
    modelFactory: createModelFromConfig,
    createClient: (engineArg, redisArg, tenantIdArg) => new OntologyClient(engineArg, redisArg, tenantIdArg),
    createProposer: (redisArg, tenantIdArg) => new ActionProposer(redisArg, tenantIdArg),
    createAgent: createRootAgent,
  });

  app.addHook('onReady', async () => {
    monitoringScheduler.start();
  });

  app.addHook('onClose', async () => {
    monitoringScheduler.stop();
  });

  // ─── POST /agent/invoke ────────────────────────────────────────────────────
  app.post<{
    Body: { tenantId?: string; message: string };
  }>('/agent/invoke', async (request, reply) => {
    const { tenantId = config.defaultTenantId, message } = request.body;

    // Load per-tenant config, fallback to env
    const tenantConfig = await configStore.get(tenantId);
    const model = createModelFromConfig(tenantConfig, config.modelConfig);

    const client = new OntologyClient(engine, redis, tenantId);
    const proposer = new ActionProposer(redis, tenantId);

    const agent = await createRootAgent({
      tenantId,
      model,
      engine,
      client,
      proposer,
      redis,
      systemPromptPrefix: tenantConfig?.systemPromptPrefix,
      actionAllowlist: tenantConfig?.actionAllowlist,
      activeSkills: tenantConfig?.activeSkills,
      activePlugins: tenantConfig?.activePlugins,
      pluginConfig: tenantConfig?.pluginConfig,
    });

    const result = await agent.invoke({
      messages: [{ role: 'user', content: message }],
    });

    const messages = result.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    const content =
      lastMessage
        ? (typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content))
        : '(no response)';

    return reply.send({ response: content, tenantId });
  });

  // ─── GET /agent/config/:tenantId ─────────────────────────────────────────
  app.get<{ Params: { tenantId: string } }>(
    '/agent/config/:tenantId',
    async (request, reply) => {
      const { tenantId } = request.params;
      const tenantConfig = await configStore.get(tenantId);

      return reply.send({
        tenantId,
        config: tenantConfig ?? {},
        effectiveModel: tenantConfig?.agentModel ?? config.modelConfig.agentModel,
      });
    }
  );

  // ─── PUT /agent/config/:tenantId ─────────────────────────────────────────
  app.put<{ Params: { tenantId: string } }>(
    '/agent/config/:tenantId',
    async (request, reply) => {
      const { tenantId } = request.params;
      const body = ConfigPatchSchema.safeParse(request.body);

      if (!body.success) {
        return reply.code(400).send({ error: 'Invalid config', details: body.error.errors });
      }

      const updated = await configStore.patch(tenantId, body.data);
      return reply.send({ tenantId, config: updated });
    }
  );

  // ─── DELETE /agent/config/:tenantId ──────────────────────────────────────
  app.delete<{ Params: { tenantId: string } }>(
    '/agent/config/:tenantId',
    async (request, reply) => {
      const { tenantId } = request.params;
      await configStore.delete(tenantId);
      return reply.code(204).send();
    }
  );

  // ─── Monitoring ──────────────────────────────────────────────────────────
  app.post('/agent/monitor/run', async (_request, reply) => {
    const result = await monitoringScheduler.runOnce();
    return reply.send(result);
  });

  app.get('/agent/monitor/status', async (_request, reply) => {
    return reply.send(monitoringScheduler.getStatus());
  });

  // ─── Health ───────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    model: config.modelConfig.agentModel,
  }));

  // ─── Metrics ──────────────────────────────────────────────────────────────
  app.get('/metrics', async () => {
    const mem = process.memoryUsage();
    return {
      service: 'agent',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      model: config.modelConfig.agentModel,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memUsedMb: Math.round(mem.rss / 1024 / 1024),
        memHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    };
  });

  return app;
}
