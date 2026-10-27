import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Pool } from 'pg';
import { dbQuery } from './db';
import { decryptSecret, encryptSecret } from './secret-crypto';
import { getUserPolicy } from './accounts';
import { sessionAccountId } from './security';
import { postgresConfig } from './postgres-config.mjs';

const tenantSchema = `
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
ALTER TABLE relay_workspace DROP CONSTRAINT IF EXISTS relay_workspace_id_check;
CREATE TABLE IF NOT EXISTS relay_action_claims (
  id text PRIMARY KEY,
  account text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relay_analytics (
  id text PRIMARY KEY,
  account_id text NOT NULL,
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
CREATE INDEX IF NOT EXISTS relay_analytics_account_created_idx ON relay_analytics (account_id, created_at);
COMMIT;`;
const poolCache = globalThis as typeof globalThis & { relayTenantPools?: Map<string, Pool> };
const pools = (poolCache.relayTenantPools ||= new Map());
const TENANT_PURPOSE = (accountId: string) => `tenant-database:${accountId}`;

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const value = address.toLowerCase();
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('ff') ||
    value.startsWith('::ffff:127.') ||
    value.startsWith('::ffff:10.') ||
    value.startsWith('::ffff:192.168.')
  );
}
function isSupportedDatabaseHost(host: string) {
  return [
    '.neon.tech',
    '.supabase.co',
    '.pooler.supabase.com',
    '.rds.amazonaws.com',
    '.postgres.database.azure.com',
    '.db.ondigitalocean.com',
    '.cockroachlabs.cloud',
    '.rlwy.net',
  ].some((suffix) => host.endsWith(suffix));
}
async function safeTenantConfig(raw: string) {
  const url = new URL(raw.trim());
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')
    throw new Error('Use a PostgreSQL connection URL from a supported hosted database provider.');
  const host = url.hostname.toLowerCase();
  if (!host || isIP(host) || !isSupportedDatabaseHost(host))
    throw new Error('Use a public Neon, Supabase, or other supported hosted PostgreSQL URL.');
  const addresses = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address)))
    throw new Error('The database host must resolve only to public addresses.');
  url.searchParams.set('sslmode', 'verify-full');
  url.searchParams.delete('ssl');
  return postgresConfig(url.toString());
}
async function readTenantUrl(accountId: string) {
  const result = await dbQuery(
    'SELECT encrypted_url FROM relay_tenant_databases WHERE account_id=$1',
    [accountId],
  );
  if (!result.rows[0]) return null;
  return decryptSecret<string>(String(result.rows[0].encrypted_url), TENANT_PURPOSE(accountId));
}
async function poolFor(accountId: string): Promise<Pool> {
  let pool: Pool | undefined = pools.get(accountId);
  if (pool) return pool;
  const raw = await readTenantUrl(accountId);
  if (!raw)
    throw new Error('Connect your PostgreSQL database to finish setting up your Free account.');
  const config = await safeTenantConfig(raw);
  pool = new Pool({
    connectionString: config.connectionString,
    enableChannelBinding: config.enableChannelBinding,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    max: 2,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  pool.on('error', () => console.error('Relay: a user database connection closed.'));
  pools.set(accountId, pool);
  if (pools.size > 100) {
    const oldest = pools.keys().next().value as string | undefined;
    if (oldest && oldest !== accountId) {
      const expired = pools.get(oldest);
      pools.delete(oldest);
      void expired?.end();
    }
  }
  return pool;
}
async function beginTenantQuery(accountId: string) {
  await dbQuery(
    `INSERT INTO relay_account_migrations (account_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [accountId],
  );
  const result = await dbQuery(
    `UPDATE relay_account_migrations SET active_queries=active_queries+1
     WHERE account_id=$1 AND migrating=false RETURNING account_id`,
    [accountId],
  );
  if (!result.rowCount)
    throw new Error('Your account data is being transferred. Please retry in a moment.');
}
async function endTenantQuery(accountId: string) {
  await dbQuery(
    `UPDATE relay_account_migrations SET active_queries=GREATEST(active_queries-1,0)
     WHERE account_id=$1`,
    [accountId],
  );
}
export async function accountDbQuery(text: string, values: unknown[] = []) {
  const accountId = await sessionAccountId();
  if (accountId === 'owner') return dbQuery(text, values);
  const policy = await getUserPolicy(accountId);
  if (!policy || policy.plan === 'premium') return dbQuery(text, values);
  await beginTenantQuery(accountId);
  try {
    const currentPolicy = await getUserPolicy(accountId);
    if (!currentPolicy || currentPolicy.plan === 'premium') return await dbQuery(text, values);
    try {
      return await (await poolFor(accountId)).query(text, values);
    } catch (error) {
      const message = (error as Error).message;
      if (/connect your PostgreSQL/i.test(message)) throw error;
      throw new Error(
        'Could not reach your PostgreSQL database. Check its connection URL and status.',
      );
    }
  } finally {
    await endTenantQuery(accountId);
  }
}
export async function accountDatabaseConfigured(accountId: string) {
  const policy = await getUserPolicy(accountId);
  if (!policy || policy.plan === 'premium') return true;
  return !!(await readTenantUrl(accountId));
}
export async function configureAccountDatabase(accountId: string, raw: string) {
  const policy = await getUserPolicy(accountId);
  if (!policy || policy.plan !== 'free')
    throw new Error('Only Free accounts can connect a personal PostgreSQL database.');
  await beginTenantQuery(accountId);
  try {
    const currentPolicy = await getUserPolicy(accountId);
    if (!currentPolicy || currentPolicy.plan !== 'free')
      throw new Error('Only Free accounts can connect a personal PostgreSQL database.');
    if (await readTenantUrl(accountId))
      throw new Error(
        'A database is already connected. Contact the administrator to change it safely.',
      );
    const config = await safeTenantConfig(raw);
    const pool = new Pool({
      connectionString: config.connectionString,
      enableChannelBinding: config.enableChannelBinding,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      max: 1,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    try {
      await pool.query('SELECT 1');
      await pool.query(tenantSchema);
      const encrypted = encryptSecret(raw.trim(), TENANT_PURPOSE(accountId));
      const inserted = await dbQuery(
        `INSERT INTO relay_tenant_databases (account_id, encrypted_url)
         VALUES ($1,$2) ON CONFLICT (account_id) DO NOTHING RETURNING account_id`,
        [accountId, encrypted],
      );
      if (!inserted.rowCount) throw new Error('A database is already connected.');
      const previous = pools.get(accountId);
      pools.set(accountId, pool);
      await previous?.end().catch(() => {});
    } catch (error) {
      await pool.end().catch(() => {});
      if ((error as Error).message === 'A database is already connected.') throw error;
      throw new Error(
        'Could not connect to that PostgreSQL database or initialize Relay tables. Check the URL, TLS and database permissions.',
      );
    }
  } finally {
    await endTenantQuery(accountId);
  }
}
export async function replaceAccountDatabase(accountId: string, raw: string) {
  const policy = await getUserPolicy(accountId);
  if (!policy || policy.plan !== 'free')
    throw new Error('Only Free accounts can connect a personal PostgreSQL database.');
  await beginTenantQuery(accountId);
  let replacement: Pool | null = null;
  try {
    const currentPolicy = await getUserPolicy(accountId);
    if (!currentPolicy || currentPolicy.plan !== 'free')
      throw new Error('Only Free accounts can connect a personal PostgreSQL database.');
    if (!(await readTenantUrl(accountId)))
      throw new Error('No database is currently connected. Use the standard connect flow instead.');
    const config = await safeTenantConfig(raw);
    replacement = new Pool({
      connectionString: config.connectionString,
      enableChannelBinding: config.enableChannelBinding,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      max: 1,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    await replacement.query('SELECT 1');
    await replacement.query(tenantSchema);
    const encrypted = encryptSecret(raw.trim(), TENANT_PURPOSE(accountId));
    const updated = await dbQuery(
      `UPDATE relay_tenant_databases SET encrypted_url=$2, updated_at=now()
       WHERE account_id=$1 RETURNING account_id`,
      [accountId, encrypted],
    );
    if (!updated.rowCount) throw new Error('The saved database connection was not found.');
    const previous = pools.get(accountId);
    pools.set(accountId, replacement);
    replacement = null;
    await previous?.end().catch(() => {});
  } catch (error) {
    await replacement?.end().catch(() => {});
    if ((error as Error).message.includes('No database is currently connected')) throw error;
    if ((error as Error).message.includes('Only Free accounts')) throw error;
    if ((error as Error).message.includes('saved database connection was not found')) throw error;
    throw new Error(
      'Could not connect to that PostgreSQL database or initialize Relay tables. The previous database URL and its data were left unchanged.',
    );
  } finally {
    await endTenantQuery(accountId);
  }
}
export async function accountDatabaseHealth(accountId: string) {
  const configured = await accountDatabaseConfigured(accountId);
  if (!configured) return { configured: false, ready: false };
  try {
    const policy = await getUserPolicy(accountId);
    if (!policy || policy.plan === 'premium') return { configured: true, ready: true };
    const pool = await poolFor(accountId);
    const result = await pool.query(
      "SELECT to_regclass('relay_settings') AS settings, to_regclass('relay_workspace') AS workspace, to_regclass('relay_analytics') AS analytics, to_regclass('relay_action_claims') AS claims",
    );
    return {
      configured: true,
      ready:
        !!result.rows[0]?.settings &&
        !!result.rows[0]?.workspace &&
        !!result.rows[0]?.analytics &&
        !!result.rows[0]?.claims,
    };
  } catch {
    return { configured: true, ready: false };
  }
}
async function centralInsertBatch(table: string, columns: string[], rows: unknown[][]) {
  if (!rows.length) return;
  const values = rows.flat();
  const groups = rows.map((_, rowIndex) => {
    const start = rowIndex * columns.length;
    return `(${columns.map((__, columnIndex) => `$${start + columnIndex + 1}`).join(',')})`;
  });
  await dbQuery(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES ${groups.join(',')} ON CONFLICT DO NOTHING`,
    values,
  );
}
type AnalyticsMigrationRow = {
  id: string;
  account_id: string;
  created_at: Date;
  provider_id: string;
  model_id: string;
  succeeded: boolean;
  status_code: number | null;
  latency_ms: number;
  ttft_ms: number | null;
  input_tokens: string | null;
  output_tokens: string | null;
};
async function copyFreeAccountDataToCentral(accountId: string) {
  const policy = await getUserPolicy(accountId);
  if (!policy || policy.plan !== 'free') return;
  const raw = await readTenantUrl(accountId);
  if (!raw) return;
  const pool = await poolFor(accountId);
  const workspace = await pool.query(
    'SELECT id, data, revision, updated_at FROM relay_workspace WHERE id=$1',
    [accountId],
  );
  if (workspace.rows[0]) {
    const row = workspace.rows[0];
    await dbQuery(
      `INSERT INTO relay_workspace (id,data,revision,updated_at)
       VALUES ($1,$2::jsonb,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [accountId, JSON.stringify(row.data), Number(row.revision) || 0, row.updated_at],
    );
  }
  const settings = await pool.query<{
    key: string;
    encrypted_value: string;
    updated_at: Date;
  }>('SELECT key, encrypted_value, updated_at FROM relay_settings WHERE key LIKE $1', [
    `account:${accountId}:%`,
  ]);
  for (let i = 0; i < settings.rows.length; i += 250) {
    await centralInsertBatch(
      'relay_settings',
      ['key', 'encrypted_value', 'updated_at'],
      settings.rows.slice(i, i + 250).map((row) => [row.key, row.encrypted_value, row.updated_at]),
    );
  }
  const claims = await pool.query<{
    id: string;
    account: string;
    claimed_at: Date;
  }>('SELECT id, account, claimed_at FROM relay_action_claims');
  for (let i = 0; i < claims.rows.length; i += 250) {
    await centralInsertBatch(
      'relay_action_claims',
      ['id', 'account', 'claimed_at'],
      claims.rows.slice(i, i + 250).map((row) => [row.id, row.account, row.claimed_at]),
    );
  }
  let cursorAt: Date | null = null;
  let cursorId = '';
  while (true) {
    const events: { rows: AnalyticsMigrationRow[] } = await pool.query<AnalyticsMigrationRow>(
      `SELECT id, account_id, created_at, provider_id, model_id, succeeded, status_code,
        latency_ms, ttft_ms, input_tokens, output_tokens FROM relay_analytics
       WHERE account_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)>($2::timestamptz,$3::text))
       ORDER BY created_at,id LIMIT 250`,
      [accountId, cursorAt, cursorId],
    );
    if (!events.rows.length) break;
    await centralInsertBatch(
      'relay_analytics',
      [
        'id',
        'account_id',
        'created_at',
        'provider_id',
        'model_id',
        'succeeded',
        'status_code',
        'latency_ms',
        'ttft_ms',
        'input_tokens',
        'output_tokens',
      ],
      events.rows.map((row) => [
        row.id,
        row.account_id,
        row.created_at,
        row.provider_id,
        row.model_id,
        row.succeeded,
        row.status_code,
        row.latency_ms,
        row.ttft_ms,
        row.input_tokens,
        row.output_tokens,
      ]),
    );
    const last: AnalyticsMigrationRow = events.rows[events.rows.length - 1];
    cursorAt = last.created_at;
    cursorId = String(last.id);
  }
}
export async function migrateFreeAccountDataToCentral(
  accountId: string,
  activate: () => Promise<void>,
) {
  await dbQuery(
    `INSERT INTO relay_account_migrations (account_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [accountId],
  );
  const locked = await dbQuery(
    `UPDATE relay_account_migrations SET migrating=true
     WHERE account_id=$1 AND migrating=false RETURNING account_id`,
    [accountId],
  );
  if (!locked.rowCount)
    throw new Error('This account is already being transferred. Please retry in a moment.');
  try {
    const deadline = Date.now() + 15000;
    while (true) {
      const active = await dbQuery(
        'SELECT active_queries FROM relay_account_migrations WHERE account_id=$1',
        [accountId],
      );
      if (Number(active.rows[0]?.active_queries) === 0) break;
      if (Date.now() >= deadline)
        throw new Error(
          'Account requests are still finishing. Retry the Premium activation shortly.',
        );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await copyFreeAccountDataToCentral(accountId);
    await activate();
    await disconnectAccountDatabase(accountId);
  } finally {
    await dbQuery('DELETE FROM relay_account_migrations WHERE account_id=$1', [accountId]);
  }
}
export async function disconnectAccountDatabase(accountId: string) {
  await dbQuery('DELETE FROM relay_tenant_databases WHERE account_id=$1', [accountId]);
  const pool = pools.get(accountId);
  pools.delete(accountId);
  await pool?.end().catch(() => {});
}
