#!/usr/bin/env node
import { Command } from 'commander';
import { tenantInit } from './commands/init.js';
import { tenantMigrate } from './commands/migrate.js';
import { generateToken } from './commands/token.js';
import { schemaUpload } from './commands/schema-upload.js';

const program = new Command();

program
  .name('daemon-cli')
  .description('Daemon System Ontology — operator CLI')
  .version('0.1.0');

// ─── tenant ──────────────────────────────────────────────────────────────────

const tenant = program.command('tenant').description('Tenant management commands');

tenant
  .command('init')
  .description('Initialize a new tenant: apply migrations + generate admin token')
  .requiredOption('--tenant-id <id>', 'Tenant identifier')
  .requiredOption('--admin-user <id>', 'Admin user ID')
  .requiredOption('--legal-entity <id>', 'Legal entity ID')
  .requiredOption('--jwt-secret <secret>', 'JWT signing secret (from apps/api .env)')
  .option('--db-host <host>', 'PostgreSQL host', 'localhost')
  .option('--db-port <port>', 'PostgreSQL port', '5432')
  .option('--db-user <user>', 'PostgreSQL user', 'daemon')
  .option('--db-password <password>', 'PostgreSQL password', '')
  .option('--db-name <name>', 'PostgreSQL database name', 'daemon')
  .action(async (opts) => {
    try {
      await tenantInit({
        tenantId: opts.tenantId,
        adminUserId: opts.adminUser,
        legalEntityId: opts.legalEntity,
        jwtSecret: opts.jwtSecret,
        host: opts.dbHost,
        port: Number(opts.dbPort),
        user: opts.dbUser,
        password: opts.dbPassword,
        database: opts.dbName,
      });
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

tenant
  .command('migrate')
  .description('Apply database migrations')
  .option('--db-host <host>', 'PostgreSQL host', 'localhost')
  .option('--db-port <port>', 'PostgreSQL port', '5432')
  .option('--db-user <user>', 'PostgreSQL user', 'daemon')
  .option('--db-password <password>', 'PostgreSQL password', '')
  .option('--db-name <name>', 'PostgreSQL database name', 'daemon')
  .action(async (opts) => {
    try {
      await tenantMigrate({
        host: opts.dbHost,
        port: Number(opts.dbPort),
        user: opts.dbUser,
        password: opts.dbPassword,
        database: opts.dbName,
      });
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

tenant
  .command('token')
  .description('Generate a JWT for a user')
  .requiredOption('--tenant-id <id>', 'Tenant identifier')
  .requiredOption('--user-id <id>', 'User identifier')
  .requiredOption('--role <role>', 'Role: admin | operator | viewer')
  .requiredOption('--legal-entity <id>', 'Legal entity ID')
  .requiredOption('--jwt-secret <secret>', 'JWT signing secret')
  .option('--expires-in <duration>', 'Token expiry (e.g. 30d, 8h)', '30d')
  .action((opts) => {
    try {
      const token = generateToken({
        tenantId: opts.tenantId,
        userId: opts.userId,
        roleId: opts.role,
        legalEntityId: opts.legalEntity,
        jwtSecret: opts.jwtSecret,
        expiresIn: opts.expiresIn,
      });
      console.log(token);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ─── schema ───────────────────────────────────────────────────────────────────

const schema = program.command('schema').description('Schema management commands');

schema
  .command('upload')
  .description('Upload YAML schema files to a running API instance')
  .requiredOption('--schema-dir <path>', 'Directory containing YAML schema files')
  .requiredOption('--api-url <url>', 'API base URL (e.g. http://localhost:3000)')
  .requiredOption('--token <jwt>', 'Admin JWT token')
  .action(async (opts) => {
    try {
      await schemaUpload({
        schemaDir: opts.schemaDir,
        apiUrl: opts.apiUrl,
        token: opts.token,
      });
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
