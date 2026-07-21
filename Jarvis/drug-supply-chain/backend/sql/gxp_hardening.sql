-- Phase 8: PostgreSQL permission hardening for GxP audit trail
-- Run as superuser AFTER gxp_audit_trail table exists (after first app startup / migration).

-- Append-only enforcement at database level
REVOKE UPDATE, DELETE ON TABLE gxp_audit_trail FROM PUBLIC;

-- Portal application role (adjust role name to match your deployment)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharma_app') THEN
    GRANT SELECT, INSERT ON TABLE gxp_audit_trail TO pharma_app;
    REVOKE UPDATE, DELETE ON TABLE gxp_audit_trail FROM pharma_app;
  END IF;
END $$;

-- Optional: prevent truncate
REVOKE TRUNCATE ON TABLE gxp_audit_trail FROM PUBLIC;

COMMENT ON TABLE gxp_audit_trail IS 'FDA 21 CFR Part 11 append-only audit trail — no UPDATE/DELETE permitted';
