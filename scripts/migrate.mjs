import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import pg from 'pg';
import { postgresConfig, databaseErrorMessage } from '../lib/postgres-config.mjs';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
let pool;
try {
  const {
    connectionString,
    enableChannelBinding,
    connectionTimeoutMillis,
    provider,
    pooled,
    verifyTLS,
  } = postgresConfig();
  pool = new pg.Pool({
    connectionString,
    enableChannelBinding,
    connectionTimeoutMillis,
    max: 1,
    statement_timeout: 30000,
  });
  const label = provider === 'neon' ? 'Neon Postgres' : 'PostgreSQL';
  if (process.argv.includes('--check')) {
    const result = await pool.query(
      "SELECT to_regclass('relay_workspace') AS workspace, to_regclass('relay_settings') AS settings, to_regclass('relay_action_claims') AS claims",
    );
    console.log(
      `${label} connection successful. ${pooled ? 'Pooled endpoint. ' : ''}${verifyTLS ? 'Certificate-verified TLS is enabled.' : 'TLS follows your PostgreSQL connection settings.'}`,
    );
    if (result.rows[0].workspace && result.rows[0].settings && result.rows[0].claims)
      console.log('All Relay tables are ready.');
    else {
      console.error('Connection works, but tables are missing. Run npm run db:migrate.');
      process.exitCode = 1;
    }
  } else {
    await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    console.log(`Relay ${label} tables are ready. Existing data was preserved.`);
  }
} catch (error) {
  console.error(databaseErrorMessage(error));
  process.exitCode = 1;
} finally {
  await pool?.end();
}
