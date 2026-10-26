import { dbQuery } from './db';
import { relaySchemaSql } from './schema-sql';

// Safe to rerun: the schema only creates missing objects and never deletes data.
export async function ensureSchema() {
  await dbQuery(relaySchemaSql);
}
