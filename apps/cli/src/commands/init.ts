import { tenantMigrate, type DbOptions } from './migrate.js';
import { generateToken } from './token.js';

export interface TenantInitOptions extends DbOptions {
  tenantId: string;
  adminUserId: string;
  legalEntityId: string;
  jwtSecret: string;
}

export async function tenantInit(opts: TenantInitOptions): Promise<void> {
  console.log(`\n=== Initializing tenant: ${opts.tenantId} ===\n`);

  // 1. Apply migrations
  console.log('--- Step 1/2: Apply database migrations ---');
  await tenantMigrate(opts);

  // 2. Generate admin token
  console.log('\n--- Step 2/2: Generate admin token ---');
  const token = generateToken({
    tenantId: opts.tenantId,
    userId: opts.adminUserId,
    roleId: 'admin',
    legalEntityId: opts.legalEntityId,
    jwtSecret: opts.jwtSecret,
    expiresIn: '90d',
  });

  console.log(`\n=== Tenant "${opts.tenantId}" initialized ===`);
  console.log(`\nAdmin JWT (valid 90 days):\n`);
  console.log(token);
  console.log(`\nUsage:`);
  console.log(`  curl -H "Authorization: Bearer <token>" http://localhost:3000/schema`);
}
