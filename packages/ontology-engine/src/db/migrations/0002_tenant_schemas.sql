-- Migration 0002: Add tenant_schemas table for hot-reload schema support
CREATE TABLE IF NOT EXISTS public.tenant_schemas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL UNIQUE,
  schema      JSONB NOT NULL,
  version     TEXT NOT NULL DEFAULT '1',
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
