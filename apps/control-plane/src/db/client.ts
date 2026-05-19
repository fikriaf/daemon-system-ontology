import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function createDbClient(config: DbConfig) {
  const client = postgres({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
  return drizzle(client);
}

export type DbClient = ReturnType<typeof createDbClient>;
