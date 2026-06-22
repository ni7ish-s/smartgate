-- ─────────────────────────────────────────────────────────────────────────────
-- SmartGate — Initial Schema
-- Migration: 001_init.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable uuid extension for primary keys
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Routes ────────────────────────────────────────────────────────────────────
-- Each row describes a proxy rule:
--   prefix        → incoming path prefix to match  (e.g. /api/users)
--   upstream      → target base URL                (e.g. http://user-svc:4001)
--   strip_prefix  → if true, prefix is removed before forwarding
--   auth_required → if true, Phase 3 auth middleware enforces JWT/API key
--   rate_limit_rps→ max requests per second per client (Phase 4)
--   active        → soft-delete / disable without dropping the row

CREATE TABLE IF NOT EXISTS routes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix         TEXT        NOT NULL UNIQUE,
  upstream       TEXT        NOT NULL,
  strip_prefix   BOOLEAN     NOT NULL DEFAULT false,
  auth_required  BOOLEAN     NOT NULL DEFAULT false,
  rate_limit_rps INTEGER     NOT NULL DEFAULT 100,
  active         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Request Log ───────────────────────────────────────────────────────────────
-- Populated in Phase 5 by the logging middleware.
-- Partitioning by day is left as a future optimisation.

CREATE TABLE IF NOT EXISTS request_logs (
  id             BIGSERIAL   PRIMARY KEY,
  route_id       UUID        REFERENCES routes(id) ON DELETE SET NULL,
  method         TEXT        NOT NULL,
  path           TEXT        NOT NULL,
  status_code    INTEGER,
  client_ip      TEXT,
  duration_ms    INTEGER,
  request_size   INTEGER,
  response_size  INTEGER,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_route_id  ON request_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_logged_at ON request_logs(logged_at DESC);

-- ── Anomaly Alerts ────────────────────────────────────────────────────────────
-- Populated in Phase 7 by the AI anomaly detection service.

CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id          BIGSERIAL   PRIMARY KEY,
  route_id    UUID        REFERENCES routes(id) ON DELETE SET NULL,
  severity    TEXT        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT        NOT NULL,
  metadata    JSONB,
  resolved    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Seed data — example routes for local development ─────────────────────────
-- These point at httpbin.org so you can test without running real services.

INSERT INTO routes (prefix, upstream, strip_prefix, auth_required, rate_limit_rps)
VALUES
  ('/api/httpbin', 'https://httpbin.org', true,  false, 50),
  ('/api/echo',    'https://httpbin.org', false, false, 200)
ON CONFLICT (prefix) DO NOTHING;
