import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { OntologyEngine } from '@daemon/ontology-engine';
import type { AppConfig } from '../app.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine: OntologyEngine;
  }
}

interface EnginePluginOptions {
  config: AppConfig;
}

const enginePlugin: FastifyPluginAsync<EnginePluginOptions> = async (fastify, opts) => {
  const redisUrl = new URL(opts.config.redisUrl);
  const engine = await OntologyEngine.create({
    db: {
      host: opts.config.dbHost,
      port: opts.config.dbPort,
      user: opts.config.dbUser,
      password: opts.config.dbPassword,
      database: opts.config.dbName,
    },
    redis: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
    },
    tenantId: 'default',
    schemaDir: opts.config.schemaDir,
  });

  fastify.decorate('engine', engine);
};

export default fp(enginePlugin);
export { enginePlugin };
