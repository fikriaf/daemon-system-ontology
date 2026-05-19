import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createDbClient, type DbClient, type DbConfig } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DbClient;
  }
}

const dbPlugin: FastifyPluginAsync<{ config: DbConfig }> = async (fastify, opts) => {
  const db = createDbClient(opts.config);
  fastify.decorate('db', db);
};

export default fp(dbPlugin);
export { dbPlugin };
