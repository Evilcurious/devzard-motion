-- Relay is a single-owner workspace. Use a dedicated database, not a shared tenant schema.
BEGIN;
CREATE TABLE IF NOT EXISTS relay_settings (
  key text PRIMARY KEY,
  encrypted_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_workspace (
  id text PRIMARY KEY CHECK (id = 'owner'),
  data jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO relay_workspace (id) VALUES ('owner') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS relay_action_claims (
  id text PRIMARY KEY,
  account text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_analytics (
  id text PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS relay_analytics_created_at_idx ON relay_analytics (created_at);
COMMIT;
