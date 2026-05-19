import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, real } from 'drizzle-orm/pg-core';

// ─── Tenant Registry ──────────────────────────────────────────────────────────
// Metadata client — tidak ada data bisnis client di sini
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Identity
  slug: text('slug').notNull().unique(),           // e.g. "acme-corp"
  displayName: text('display_name').notNull(),     // e.g. "PT Maju Jaya (ACME)"
  plan: text('plan').notNull().default('standard'), // standard | enterprise | trial
  status: text('status').notNull().default('active'), // active | suspended | offboarded

  // Instance endpoints
  apiUrl: text('api_url').notNull(),               // e.g. "https://acme.daemon.com"
  agentUrl: text('agent_url'),                     // e.g. "https://acme-agent.daemon.com"

  // VPS info (nullable — client-managed VPS may not expose this)
  vpsProvider: text('vps_provider'),               // e.g. "aws", "gcp", "digitalocean", "self-hosted"
  vpsRegion: text('vps_region'),                   // e.g. "ap-southeast-1"
  vpsManagedByDaemon: boolean('vps_managed_by_daemon').notNull().default(false),

  // Contact
  adminEmail: text('admin_email'),
  notes: text('notes'),

  // Timestamps
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  offboardedAt: timestamp('offboarded_at', { withTimezone: true }),
});

// ─── Health Check Results ─────────────────────────────────────────────────────
// Hasil ping per instance, disimpan rolling window 7 hari
export const healthChecks = pgTable('health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  service: text('service').notNull(),              // "api" | "agent"
  status: text('status').notNull(),                // "up" | "down" | "degraded"
  responseTimeMs: integer('response_time_ms'),
  httpStatus: integer('http_status'),
  errorMessage: text('error_message'),
  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Metrics Snapshots ────────────────────────────────────────────────────────
// Agregat usage per tenant per jam — tanpa data bisnis
export const metricsSnapshots = pgTable('metrics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),
  windowHours: integer('window_hours').notNull().default(1),

  // API usage — jumlah request, bukan konten
  apiRequestsTotal: integer('api_requests_total').default(0),
  apiRequestsError: integer('api_requests_error').default(0),
  apiAvgResponseMs: real('api_avg_response_ms'),

  // Object counts — jumlah record, bukan isinya
  objectsTotal: integer('objects_total').default(0),

  // Action funnel
  proposalsCreated: integer('proposals_created').default(0),
  proposalsApproved: integer('proposals_approved').default(0),
  proposalsRejected: integer('proposals_rejected').default(0),

  // Agent
  agentInvocations: integer('agent_invocations').default(0),

  // Schema
  schemaObjectTypes: integer('schema_object_types').default(0),
  schemaActionTypes: integer('schema_action_types').default(0),
});

// ─── Server System Info ───────────────────────────────────────────────────────
// VPS/server stats — hanya untuk VPS yang di-manage Daemon
export const serverInfoSnapshots = pgTable('server_info_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),

  // System
  osName: text('os_name'),
  nodeVersion: text('node_version'),
  uptimeSeconds: integer('uptime_seconds'),

  // Resources (%)
  cpuUsagePercent: real('cpu_usage_percent'),
  memUsedMb: real('mem_used_mb'),
  memTotalMb: real('mem_total_mb'),
  diskUsedGb: real('disk_used_gb'),
  diskTotalGb: real('disk_total_gb'),

  // Network
  networkRxMbPerSec: real('network_rx_mb_per_sec'),
  networkTxMbPerSec: real('network_tx_mb_per_sec'),
});

// ─── Server Logs ──────────────────────────────────────────────────────────────
// Access logs + error logs — tanpa body/payload bisnis
export const serverLogs = pgTable('server_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  service: text('service').notNull(),              // "api" | "agent"
  level: text('level').notNull(),                  // "info" | "warn" | "error"
  method: text('method'),                          // HTTP method
  path: text('path'),                              // URL path (tanpa query params sensitif)
  statusCode: integer('status_code'),
  responseTimeMs: integer('response_time_ms'),
  message: text('message'),                        // Error message jika ada
  loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow().notNull(),
});
