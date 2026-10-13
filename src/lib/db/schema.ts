/**
 * One schema, two engines.
 *
 * Rules that keep a single DDL set valid on BOTH SQLite and Postgres:
 *   - ids are TEXT (generated in JS) — no AUTOINCREMENT / SERIAL divergence
 *   - booleans are INTEGER 0/1
 *   - timestamps are ISO-8601 TEXT generated in JS
 *   - JSON blobs are TEXT
 *   - every statement is idempotent (IF NOT EXISTS)
 */
export const SCHEMA_SQL: string[] = [
  // ── key/value settings (encrypted blobs live here too) ──────────────────
  `CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,

  // ── knowledge base (what the AI is allowed to answer from) ──────────────
  `CREATE TABLE IF NOT EXISTS kb_sources (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'text',
    content    TEXT NOT NULL DEFAULT '',
    url        TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '',
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS kb_chunks (
    id          TEXT PRIMARY KEY,
    source_id   TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kb_chunks_source ON kb_chunks(source_id)`,

  // ── customers ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS customers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    company      TEXT NOT NULL DEFAULT '',
    notes        TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '',
    channel      TEXT NOT NULL DEFAULT '',
    sheet_row    INTEGER,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`,

  // ── money in / money out (budget spend + profit) ─────────────────────────
  `CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general',
    amount      REAL NOT NULL DEFAULT 0,
    currency    TEXT NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL DEFAULT '',
    occurred_on TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'manual',
    sheet_row   INTEGER,
    created_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(occurred_on)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_kind ON transactions(kind)`,

  // ── unified inbox ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,
    channel         TEXT NOT NULL,
    external_id     TEXT NOT NULL DEFAULT '',
    customer_id     TEXT NOT NULL DEFAULT '',
    customer_name   TEXT NOT NULL DEFAULT '',
    customer_handle TEXT NOT NULL DEFAULT '',
    subject         TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'open',
    unread          INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT NOT NULL,
    meta            TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_last ON conversations(last_message_at)`,

  `CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role            TEXT NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'sent',
    external_id     TEXT NOT NULL DEFAULT '',
    ai_confidence   REAL,
    ai_provider     TEXT NOT NULL DEFAULT '',
    ai_model        TEXT NOT NULL DEFAULT '',
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    cost_usd        REAL NOT NULL DEFAULT 0,
    meta            TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_external ON messages(external_id)`,

  // ── automation rules ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS automations (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    enabled    INTEGER NOT NULL DEFAULT 1,
    channel    TEXT NOT NULL DEFAULT 'any',
    trigger    TEXT NOT NULL DEFAULT 'new_message',
    conditions TEXT NOT NULL DEFAULT '{}',
    actions    TEXT NOT NULL DEFAULT '{}',
    run_count  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  // ── AI usage / cost telemetry ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS usage_logs (
    id         TEXT PRIMARY KEY,
    feature    TEXT NOT NULL DEFAULT '',
    provider   TEXT NOT NULL DEFAULT '',
    model      TEXT NOT NULL DEFAULT '',
    tokens_in  INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd   REAL NOT NULL DEFAULT 0,
    ok         INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at)`,

  // ── activity feed ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS activity (
    id         TEXT PRIMARY KEY,
    level      TEXT NOT NULL DEFAULT 'info',
    message    TEXT NOT NULL,
    meta       TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at)`,
];
