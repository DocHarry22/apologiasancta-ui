BEGIN;
CREATE SCHEMA IF NOT EXISTS apologia_agent;
REVOKE ALL ON SCHEMA apologia_agent FROM PUBLIC;
CREATE TABLE IF NOT EXISTS apologia_agent.jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic text NOT NULL UNIQUE,
 pillar text NOT NULL, priority integer NOT NULL DEFAULT 100,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','blocked')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, lease_token uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_jobs_ready ON apologia_agent.jobs(status,available_at,priority);
CREATE TABLE IF NOT EXISTS apologia_agent.runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid REFERENCES apologia_agent.jobs(id),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running', stage text NOT NULL DEFAULT 'discovery',
 report jsonb NOT NULL DEFAULT '{}', usage jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS agent_runs_started ON apologia_agent.runs(started_at DESC);
CREATE TABLE IF NOT EXISTS apologia_agent.packs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL UNIQUE REFERENCES apologia_agent.jobs(id),
 topic text NOT NULL, pack jsonb NOT NULL, sources jsonb NOT NULL, review jsonb NOT NULL,
 published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE apologia_agent.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE apologia_agent.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE apologia_agent.packs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA apologia_agent FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON SCHEMA apologia_agent FROM anon, authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA apologia_agent FROM anon, authenticated;
 END IF;
END $$;
COMMIT;
