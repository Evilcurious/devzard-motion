import { Pool } from 'pg';
const globalDB = globalThis as unknown as { relayPool?: Pool };
export function databaseConfigured() {
  return !!process.env.DATABASE_URL;
}
export function database() {
  if (!databaseConfigured())
    throw new Error('PostgreSQL is not configured. Set DATABASE_URL in .env.local.');
  if (!globalDB.relayPool) {
    globalDB.relayPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    // Idle connection failures are handled by the next query; never leak a DSN to the client.
    globalDB.relayPool.on('error', () =>
      console.error('Relay: an idle database connection closed.'),
    );
  }
  return globalDB.relayPool;
}
export async function dbQuery(text: string, values: unknown[] = []) {
  try {
    return await database().query(text, values);
  } catch {
    throw new Error(
      'PostgreSQL is unavailable or not initialized. Check DATABASE_URL and run npm run db:migrate.',
    );
  }
}
export async function databaseHealth() {
  if (!databaseConfigured()) return { configured: false, ready: false };
  try {
    const result = await dbQuery(
      "SELECT to_regclass('relay_settings') AS settings, to_regclass('relay_workspace') AS workspace, to_regclass('relay_action_claims') AS claims",
    );
    if (!result.rows[0]?.settings || !result.rows[0]?.workspace || !result.rows[0]?.claims)
      throw new Error('Tables missing. Run npm run db:migrate, then refresh.');
    return { configured: true, ready: true };
  } catch (error) {
    return { configured: true, ready: false, error: (error as Error).message };
  }
}
