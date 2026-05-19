import { buildApp } from './app.js';

const config = {
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6381',
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? '5433'),
  dbUser: process.env.DB_USER ?? 'daemon',
  dbPassword: process.env.DB_PASSWORD ?? 'daemon_test',
  dbName: process.env.DB_NAME ?? 'daemon_test',
  schemaDir: process.env.SCHEMA_DIR ?? './schemas',
};

const app = await buildApp(config);

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('API server running on port 3000');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
