import { createDbClient } from '@daemon/ontology-engine';
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/ontology-engine/src/db/migrations'
);

export interface DbOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export async function tenantMigrate(opts: DbOptions): Promise<void> {
  console.log(`Connecting to ${opts.host}:${opts.port}/${opts.database}...`);

  const db = createDbClient({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password,
    database: opts.database,
  });

  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  console.log(`Found ${sqlFiles.length} migration(s):`);

  for (const file of sqlFiles) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`  Applying ${file}...`);
    try {
      // Execute raw SQL via drizzle's underlying client
      // @ts-expect-error — accessing internal session
      await db.session.execute(sql);
      console.log(`  ✓ ${file}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Skip "already exists" errors — idempotent
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`  ~ ${file} (already applied, skipping)`);
      } else {
        throw new Error(`Migration ${file} failed: ${msg}`);
      }
    }
  }

  // @ts-expect-error — close underlying pool
  await db.$client?.end?.();
  console.log('Migrations complete.');
}
