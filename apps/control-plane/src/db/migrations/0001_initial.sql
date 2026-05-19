-- Control Plane Database Migration
-- Run against a SEPARATE database (not the client tenant DB)

CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  plan                  TEXT NOT NULL DEFAULT 'standard',
  status                TEXT NOT NULL DEFAULT 'active',
  api_url               TEXT NOT NULL,
  agent_url             TEXT,
  vps_provider          TEXT,
  vps_region            TEXT,
  vps_managed_by_daemon BOOLEAN NOT NULL DEFAULT false,
  admin_email           TEXT,
  notes                 TEXT,
  onboarded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  offboarded_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS health_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  service          TEXT NOT NULL,
  status           TEXT NOT NULL,
  response_time_ms INTEGER,
  http_status      INTEGER,
  error_message    TEXT,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_tenant_service ON health_checks (tenant_id, service, checked_at DESC);

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_hours          INTEGER NOT NULL DEFAULT 1,
  api_requests_total    INTEGER DEFAULT 0,
  api_requests_error    INTEGER DEFAULT 0,
  api_avg_response_ms   REAL,
  objects_total         INTEGER DEFAULT 0,
  proposals_created     INTEGER DEFAULT 0,
  proposals_approved    INTEGER DEFAULT 0,
  proposals_rejected    INTEGER DEFAULT 0,
  agent_invocations     INTEGER DEFAULT 0,
  schema_object_types   INTEGER DEFAULT 0,
  schema_action_types   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_metrics_tenant_time ON metrics_snapshots (tenant_id, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS server_info_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  os_name               TEXT,
  node_version          TEXT,
  uptime_seconds        INTEGER,
  cpu_usage_percent     REAL,
  mem_used_mb           REAL,
  mem_total_mb          REAL,
  disk_used_gb          REAL,
  disk_total_gb         REAL,
  network_rx_mb_per_sec REAL,
  network_tx_mb_per_sec REAL
);

CREATE INDEX IF NOT EXISTS idx_sysinfo_tenant_time ON server_info_snapshots (tenant_id, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS server_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  service          TEXT NOT NULL,
  level            TEXT NOT NULL,
  method           TEXT,
  path             TEXT,
  status_code      INTEGER,
  response_time_ms INTEGER,
  message          TEXT,
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_tenant_time  ON server_logs (tenant_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level        ON server_logs (level, logged_at DESC);
