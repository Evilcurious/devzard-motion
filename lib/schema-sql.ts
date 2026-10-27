// Keep this idempotent schema in sync with db/schema.sql; it is bundled for
// authenticated hosted migration so Vercel users do not need a local CLI.
export const schemaSql = `-- Relay supports one admin workspace and isolated admin-created user accounts.
BEGIN;
CREATE TABLE IF NOT EXISTS relay_settings (
  key text PRIMARY KEY,
  encrypted_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_workspace (
  id text PRIMARY KEY,
  data jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Older installs restricted this table to the owner row. Remove only that check; keep all data.
ALTER TABLE relay_workspace DROP CONSTRAINT IF EXISTS relay_workspace_id_check;
INSERT INTO relay_workspace (id) VALUES ('owner') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS relay_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  provider_mode text NOT NULL DEFAULT 'managed' CHECK (provider_mode IN ('managed','both')),
  monthly_token_limit bigint NOT NULL CHECK (monthly_token_limit >= 0),
  allowed_models jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_invites (
  token_hash text PRIMARY KEY,
  policy jsonb NOT NULL,
  created_by text NOT NULL DEFAULT 'owner',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_action_claims (
  id text PRIMARY KEY,
  account text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_analytics (
  id text PRIMARY KEY,
  account_id text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  provider_id text NOT NULL,
  model_id text NOT NULL,
  succeeded boolean NOT NULL,
  status_code integer,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  ttft_ms integer CHECK (ttft_ms IS NULL OR ttft_ms >= 0),
  input_tokens bigint CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens bigint CHECK (output_tokens IS NULL OR output_tokens >= 0)
);
ALTER TABLE relay_analytics ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS relay_analytics_created_at_idx ON relay_analytics (created_at);
CREATE INDEX IF NOT EXISTS relay_analytics_account_created_idx ON relay_analytics (account_id, created_at);
CREATE INDEX IF NOT EXISTS relay_invites_expires_at_idx ON relay_invites (expires_at);
COMMIT;`;
