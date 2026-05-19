import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { authPlugin } from './plugins/auth.plugin.js';
import { enginePlugin } from './plugins/engine.plugin.js';
import { objectsQueryRoute } from './routes/objects/query.route.js';
import { objectsGetRoute } from './routes/objects/get.route.js';
import { actionsProposeRoute } from './routes/actions/propose.route.js';
import { actionsApproveRoute } from './routes/actions/approve.route.js';
import { actionsRejectRoute } from './routes/actions/reject.route.js';
import { actionsExecuteRoute } from './routes/actions/execute.route.js';
import { schemaReadRoute } from './routes/schema/read.route.js';
import { auditLogRoute } from './routes/audit/log.route.js';

export interface AppConfig {
  jwtSecret: string;
  redisUrl: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  schemaDir: string;
}

export async function buildApp(config: AppConfig) {
  const app = Fastify({ logger: false });

  // Plugins
  await app.register(fastifyJwt, { secret: config.jwtSecret });
  await app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(authPlugin);
  await app.register(enginePlugin, { config });

  // Health check — no auth
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await app.register(objectsQueryRoute, { prefix: '/objects' });
  await app.register(objectsGetRoute, { prefix: '/objects' });
  await app.register(actionsProposeRoute, { prefix: '/actions' });
  await app.register(actionsApproveRoute, { prefix: '/actions' });
  await app.register(actionsRejectRoute, { prefix: '/actions' });
  await app.register(actionsExecuteRoute, { prefix: '/actions' });
  await app.register(schemaReadRoute, { prefix: '/schema' });
  await app.register(auditLogRoute, { prefix: '/audit' });

  return app;
}
