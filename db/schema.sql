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
COMMIT;
