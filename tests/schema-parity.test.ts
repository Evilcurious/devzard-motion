import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaSql } from '../lib/schema-sql';

test('hosted migration schema stays identical to the safe CLI migration', async () => {
  const fileSchema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.equal(schemaSql.trim(), fileSchema.trim());
  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS relay_workspace/);
  assert.match(schemaSql, /ON CONFLICT DO NOTHING/);
  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS relay_analytics/);
  assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS relay_analytics_created_at_idx/);
});
