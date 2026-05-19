import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { OntologyEngine, createRedisClient } from '@daemon/ontology-engine';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../app.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine: OntologyEngine;
    redis: Redis;
  }
}

interface EnginePluginOptions {
  config: AppConfig;
}

const enginePlugin: FastifyPluginAsync<EnginePluginOptions> = async (fastify, opts) => {
  const redisUrl = new URL(opts.config.redisUrl);
  const redisConfig = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
  };

  const engine = await OntologyEngine.create({
    db: {
      host: opts.config.dbHost,
      port: opts.config.dbPort,
      user: opts.config.dbUser,
      password: opts.config.dbPassword,
      database: opts.config.dbName,
    },
    redis: redisConfig,
    tenantId: 'default',
    schemaDir: opts.config.schemaDir,
  });

  const redis = createRedisClient(redisConfig);

  fastify.decorate('engine', engine);
  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(enginePlugin);
export { enginePlugin };
