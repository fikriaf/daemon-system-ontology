import { buildAgentServer } from './server.js';

const config = {
  port: Number(process.env.AGENT_PORT ?? '3001'),
  modelConfig: {
    agentModel: process.env.AGENT_MODEL ?? 'openai:gpt-4o',
    temperature: Number(process.env.AGENT_TEMPERATURE ?? '0'),
  },
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? '5433'),
  dbUser: process.env.DB_USER ?? 'daemon',
  dbPassword: process.env.DB_PASSWORD ?? 'daemon_test',
  dbName: process.env.DB_NAME ?? 'daemon_test',
  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: Number(process.env.REDIS_PORT ?? '6381'),
  schemaDir: process.env.SCHEMA_DIR ?? './schemas',
  defaultTenantId: process.env.TENANT_ID ?? 'default',
};

const app = await buildAgentServer(config);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Agent service running on port ${config.port}`);
  console.log(`Model: ${config.modelConfig.agentModel}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
