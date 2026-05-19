import Fastify from 'fastify';
import { dbPlugin } from './db/db.plugin.js';
import { tenantsRoute } from './tenants/tenants.route.js';
import { healthRoute } from './health/health.route.js';
import { logReceiveRoute, logQueryRoute } from './logs/logs.route.js';
import { wsRoute } from './ws/ws.route.js';
import { HealthPoller } from './health/health.poller.js';
import { WsBroadcaster } from './ws/ws.broadcaster.js';
import {
  internalAgentRoute,
  type InternalAgentRunnerFactory,
} from './internal-agent/internal-agent.route.js';

export interface ControlPlaneConfig {
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  internalSecret: string;
  pollIntervalMs?: number;
  internalAgentModel?: string;
  internalAgentTemperature?: number;
  createInternalAgentRunner?: InternalAgentRunnerFactory;
}

export async function buildControlPlane(config: ControlPlaneConfig) {
  const app = Fastify({ logger: true });

  // DB
  await app.register(dbPlugin, {
    config: {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    },
  });

  // Internal auth
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return;
    if (request.url.startsWith('/ws/')) return; // WebSocket — auth via query param or skip for now
    const auth = request.headers.authorization;
    if (!auth || auth !== `Bearer ${config.internalSecret}`) {
      reply.code(401).send({ error: 'Unauthorized — internal access only' });
    }
  });

  // Shared broadcaster
  const broadcaster = new WsBroadcaster();

  // Health poller
  const poller = new HealthPoller(app.db, {
    intervalMs: config.pollIntervalMs ?? 30000,
    timeoutMs: 5000,
  });

  app.addHook('onReady', async () => {
    poller.start();
  });

  app.addHook('onClose', async () => {
    poller.stop();
  });

  // Routes
  app.get('/health', async () => ({
    status: 'ok',
    service: 'control-plane',
    timestamp: new Date().toISOString(),
  }));

  await app.register(tenantsRoute, { prefix: '/tenants' });
  await app.register(healthRoute, { prefix: '/tenants' });
  await app.register(logReceiveRoute, { broadcaster, prefix: '/logs' });
  await app.register(logQueryRoute, { prefix: '/tenants' });
  await app.register(internalAgentRoute, {
    prefix: '/internal-agent',
    modelConfig: {
      agentModel: config.internalAgentModel ?? 'openrouter:minimax/minimax-m2.7',
      temperature: config.internalAgentTemperature,
    },
    createRunner: config.createInternalAgentRunner,
  });
  await app.register(wsRoute, { broadcaster });

  return app;
}
