import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import pg from 'pg';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in .env.local first. See README.md → PostgreSQL.');
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
});
try {
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('Relay PostgreSQL tables are ready. Existing data was preserved.');
} catch {
  console.error('Database migration failed. Check DATABASE_URL, TLS, and database permissions.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
