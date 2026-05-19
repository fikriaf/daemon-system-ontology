import { buildControlPlane } from './app.js';

const config = {
  port: Number(process.env.PORT ?? '4000'),
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? '5432'),
  dbUser: process.env.DB_USER ?? 'daemon',
  dbPassword: process.env.DB_PASSWORD ?? '',
  dbName: process.env.DB_NAME ?? 'daemon_control',
  internalSecret: process.env.INTERNAL_SECRET ?? 'change-me-in-production',
  internalAgentModel: process.env.INTERNAL_AGENT_MODEL ?? 'openrouter:minimax/minimax-m2.7',
  internalAgentTemperature: Number(process.env.INTERNAL_AGENT_TEMPERATURE ?? '0.2'),
};

const app = await buildControlPlane(config);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Control plane running on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
