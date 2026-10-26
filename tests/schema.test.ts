import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { relaySchemaSql } from '../lib/schema-sql';

const normalize = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

test('the in-app schema matches db/schema.sql, the CLI migration source', async () => {
  const file = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.equal(normalize(relaySchemaSql), normalize(file));
});

test('the schema only creates objects and never drops data', () => {
  assert.doesNotMatch(relaySchemaSql, /\b(drop|truncate|delete|alter)\b/i);
  assert.match(relaySchemaSql, /CREATE TABLE IF NOT EXISTS relay_settings/);
  assert.match(relaySchemaSql, /CREATE TABLE IF NOT EXISTS relay_workspace/);
  assert.match(relaySchemaSql, /CREATE TABLE IF NOT EXISTS relay_action_claims/);
});
