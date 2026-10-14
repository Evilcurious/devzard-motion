import { Pool } from 'pg';
import { postgresConfig, databaseErrorMessage } from './postgres-config.mjs';
const globalDB = globalThis as unknown as { relayPool?: Pool };
export function databaseConfigured() {
  return !!process.env.DATABASE_URL?.trim();
}
export function database() {
  if (!globalDB.relayPool) {
    const { connectionString, enableChannelBinding, connectionTimeoutMillis } = postgresConfig();
    globalDB.relayPool = new Pool({
      connectionString,
      enableChannelBinding,
      connectionTimeoutMillis,
      max: 3,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    globalDB.relayPool.on('error', () =>
      console.error('Relay: an idle database connection closed.'),
    );
  }
  return globalDB.relayPool;
}
export async function dbQuery(text: string, values: unknown[] = []) {
  try {
    return await database().query(text, values);
  } catch (error) {
    throw new Error(databaseErrorMessage(error));
  }
}
export async function databaseHealth() {
  if (!databaseConfigured())
    return { configured: false, ready: false, provider: null, pooled: false, tls: false };
  let provider: string | null = null;
  let pooled = false;
  try {
    const config = postgresConfig();
    provider = config.provider;
    pooled = config.pooled;
    const result = await dbQuery(
      "SELECT to_regclass('relay_settings') AS settings, to_regclass('relay_workspace') AS workspace, to_regclass('relay_action_claims') AS claims",
    );
    if (!result.rows[0]?.settings || !result.rows[0]?.workspace || !result.rows[0]?.claims)
      throw new Error(
        'Connected, but Relay tables are missing. Run npm run db:migrate, then refresh.',
      );
    return { configured: true, ready: true, provider, pooled, tls: config.verifyTLS };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      provider,
      pooled,
      tls: false,
      error: (error as Error).message,
    };
  }
}
