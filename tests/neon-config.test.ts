import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { postgresConfig, databaseErrorMessage } from '../lib/postgres-config.mjs';
import { databaseLabel } from '../lib/database-label';

const pooled =
  'postgresql://test_role:test_password@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

test('Neon pooled endpoint retains database name and credentials while enforcing TLS', () => {
  const config = postgresConfig(pooled);
  assert.equal(config.provider, 'neon');
  assert.equal(config.pooled, true);
  assert.equal(config.verifyTLS, true);
  assert.equal(config.enableChannelBinding, true);
  assert.equal(config.connectionTimeoutMillis, 15000);
  const url = new URL(config.connectionString);
  assert.equal(url.pathname, '/neondb');
  assert.equal(url.username, 'test_role');
  assert.equal(url.password, 'test_password');
  assert.equal(url.searchParams.get('sslmode'), 'verify-full');
  assert.equal(url.searchParams.get('channel_binding'), 'require');
  // Inspect the actual pg driver's parsed TLS settings without opening a network connection.
  const client = new Client(config);
  const ssl = client.ssl as boolean | import('node:tls').ConnectionOptions;
  assert.ok(ssl);
  if (typeof ssl === 'object') {
    assert.notEqual(ssl.rejectUnauthorized, false);
    assert.equal(ssl.checkServerIdentity, undefined);
  }
});

test('Neon direct endpoint works without forcing a pooled hostname or a new database name', () => {
  const config = postgresConfig(pooled.replace('-pooler', '').replace('/neondb?', '/relay?'));
  assert.equal(config.provider, 'neon');
  assert.equal(config.pooled, false);
  assert.equal(new URL(config.connectionString).pathname, '/relay');
});

test('Neon cannot disable TLS with connection-string overrides', () => {
  const input = pooled.split('?')[0] + '?sslmode=disable&ssl=0&uselibpqcompat=true';
  const url = new URL(postgresConfig(input).connectionString);
  assert.equal(url.searchParams.get('sslmode'), 'verify-full');
  assert.equal(url.searchParams.has('ssl'), false);
  assert.equal(url.searchParams.has('uselibpqcompat'), false);
  assert.throws(() => postgresConfig(pooled + '&host=untrusted.invalid'), /overrides/);
});

test('existing local Postgres remains compatible, and lookalike hosts are not called Neon', () => {
  const local = 'postgresql://test:pass@localhost:5432/relay_test';
  const config = postgresConfig(local);
  assert.equal(config.provider, 'postgresql');
  assert.equal(config.connectionString, local);
  assert.equal(config.enableChannelBinding, false);
  assert.equal(config.verifyTLS, false);
  assert.equal(
    postgresConfig(pooled.replace('neon.tech', 'neon.tech.attacker.invalid')).provider,
    'postgresql',
  );
  assert.equal(databaseLabel({ databaseProvider: 'neon' }), 'Neon Postgres');
  assert.equal(databaseLabel({ databaseProvider: 'postgresql' }), 'PostgreSQL');
  assert.equal(databaseLabel(), 'Neon Postgres');
});

test('bad URL and driver errors provide actionable messages without exposing credentials', () => {
  for (const value of [
    '',
    'not a database URL',
    pooled.replace('&', '&amp;'),
    pooled.replace('test_password', '[test_password](mailto:test_password)'),
    'https://example.invalid/relay',
  ]) {
    assert.throws(
      () => postgresConfig(value),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes('test_password'));
        assert.ok(!error.message.includes('ep-example'));
        return true;
      },
    );
  }
  assert.match(databaseErrorMessage({ code: '3D000', message: pooled }), /actual database name/);
  assert.match(databaseErrorMessage({ code: '28P01', message: pooled }), /sign-in failed/);
  assert.match(databaseErrorMessage({ code: '42P01', message: pooled }), /db:migrate/);
  assert.ok(!databaseErrorMessage(new Error(pooled)).includes('test_password'));
});
