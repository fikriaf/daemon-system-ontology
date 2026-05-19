-- Enable Apache AGE extension
CREATE EXTENSION IF NOT EXISTS age;

-- Objects table (explicitly in public schema)
CREATE TABLE IF NOT EXISTS public.objects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_api_name   TEXT NOT NULL,
  properties      JSONB NOT NULL,
  legal_entity_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_objects_type ON public.objects (type_api_name);
CREATE INDEX IF NOT EXISTS idx_objects_legal_entity ON public.objects (legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_objects_properties ON public.objects USING GIN (properties);

-- Audit log — immutable, append-only
CREATE TABLE IF NOT EXISTS public.action_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id  TEXT NOT NULL,
  object_id       UUID REFERENCES public.objects(id),
  payload         JSONB NOT NULL,
  performed_by    TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'executed', 'rejected')),
  proposed_at     TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  decided_by      TEXT,
  executed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_action_type ON public.action_audit_log (action_type_id);
CREATE INDEX IF NOT EXISTS idx_audit_object_id ON public.action_audit_log (object_id);
CREATE INDEX IF NOT EXISTS idx_audit_status ON public.action_audit_log (status);

-- Schema overrides
CREATE TABLE IF NOT EXISTS public.schema_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type   TEXT NOT NULL,
  override_type TEXT NOT NULL,
  payload       JSONB NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AGE graph for link types (requires age session vars)
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT * FROM ag_catalog.create_graph('ontology_graph');
