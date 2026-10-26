// Opt-in integration test. Uses a dedicated relay_test database, never the app's DATABASE_URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { encryptSecret, decryptSecret } from '../lib/secrets';
import { seal } from '../lib/security';

const enabled = !!(
  process.env.TEST_DATABASE_URL &&
  process.env.TEST_SERVER_URL &&
  process.env.TEST_APP_PASSWORD &&
  process.env.TEST_SESSION_SECRET
);
test(
  'PostgreSQL saves secrets/history across sessions, rejects stale writes and duplicate actions',
  { skip: !enabled },
  async () => {
    const connectionString = process.env.TEST_DATABASE_URL!;
    assert.equal(
      new URL(connectionString).pathname,
      '/relay_test',
      'Use a dedicated database named relay_test.',
    );
    const origin = new URL(process.env.TEST_SERVER_URL!).origin;
    const pool = new Pool({ connectionString, max: 2 });
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = process.env.TEST_SESSION_SECRET;
    let cookie = '';
    async function call(path: string, method = 'GET', body?: unknown) {
      const response = await fetch(origin + path, {
        method,
        headers: { origin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        data: await response.json(),
        cookies: response.headers.get('set-cookie'),
      };
    }
    async function login() {
      const response = await call('/api/auth/login', 'POST', {
        password: process.env.TEST_APP_PASSWORD,
      });
      assert.equal(response.status, 200);
      cookie = response.cookies!.split(';')[0];
    }
    try {
      const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
      await pool.query(schema);
      await pool.query(schema); // Migration must be safe to rerun.
      await pool.query('TRUNCATE relay_settings, relay_action_claims');
      await pool.query("UPDATE relay_workspace SET data=NULL, revision=0 WHERE id='owner'");
      assert.equal((await call('/api/workspace')).status, 401);
      await login();
      assert.equal((await call('/api/database')).data.ready, true);
      const first = await call('/api/config', 'POST', {
        provider: 'openai',
        model: 'gpt-4o-mini',
        key: 'unit-test-api-key',
      });
      assert.equal(first.status, 200);
      assert.equal(first.data.storage, 'postgresql');
      const stored = (
        await pool.query("SELECT encrypted_value FROM relay_settings WHERE key='model'")
      ).rows[0].encrypted_value;
      assert.ok(!stored.includes('unit-test-api-key'));
      assert.equal(decryptSecret<{ key: string }>(stored, 'model').key, 'unit-test-api-key');
      const config = await call('/api/config');
      assert.equal(config.data.keySaved, true);
      assert.equal(config.data.key, undefined);
      assert.equal(
        (await call('/api/config', 'POST', { provider: 'openai', model: 'gpt-4o-mini', key: '' }))
          .status,
        200,
      );
      const preserved = (
        await pool.query("SELECT encrypted_value FROM relay_settings WHERE key='model'")
      ).rows[0].encrypted_value;
      assert.equal(decryptSecret<{ key: string }>(preserved, 'model').key, 'unit-test-api-key');
      const workspace = {
        conversations: [
          {
            id: 'persistent-chat',
            title: 'Saved chat',
            updated: new Date().toISOString(),
            messages: [{ id: 'm1', role: 'user', content: 'Keep this after logout' }],
          },
        ],
        workflows: [],
        activities: [],
        theme: 'gold',
      };
      const saved = await call('/api/workspace', 'PUT', { revision: 0, data: workspace });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.revision, 1);
      assert.equal(
        (await call('/api/workspace', 'PUT', { revision: 0, data: { ...workspace, theme: 'red' } }))
          .status,
        409,
      );
      await call('/api/auth/logout', 'POST');
      cookie = '';
      await login();
      assert.equal(
        (await call('/api/workspace')).data.data.conversations[0].messages[0].content,
        'Keep this after logout',
      );
      assert.equal((await call('/api/workspace')).data.data.theme, 'gold');
      assert.equal((await call('/api/config')).data.keySaved, true);
      assert.equal(
        (
          await call('/api/google/config', 'POST', {
            clientId: 'test.apps.googleusercontent.com',
            clientSecret: 'test-client-secret',
          })
        ).status,
        200,
      );
      const googleConfig = await call('/api/google/config');
      assert.equal(googleConfig.data.secretSaved, true);
      assert.equal(googleConfig.data.clientSecret, undefined);
      assert.equal(googleConfig.data.redirectURI, origin + '/api/google/callback');
      const connect = await call('/api/google/connect', 'POST');
      assert.equal(connect.status, 200);
      const url = new URL(connect.data.url);
      assert.equal(url.hostname, 'accounts.google.com');
      assert.match(url.searchParams.get('scope')!, /gmail.send/);
      assert.match(url.searchParams.get('scope')!, /spreadsheets/);
      const session = encryptSecret(
        {
          access_token: 'test-token-never-used',
          email: 'owner@example.com',
          expires_at: Date.now() + 3600000,
        },
        'google',
      );
      await pool.query(
        "INSERT INTO relay_settings (key,encrypted_value) VALUES ('google',$1) ON CONFLICT(key) DO UPDATE SET encrypted_value=EXCLUDED.encrypted_value",
        [session],
      );
      const id = 'already-claimed-test';
      await pool.query('INSERT INTO relay_action_claims (id,account) VALUES ($1,$2)', [
        id,
        'owner@example.com',
      ]);
      const token = seal(
        {
          id,
          email: 'owner@example.com',
          action: {
            name: 'send_email',
            args: { to: 'alice@example.com', subject: 'Test only', body: 'Must never send' },
          },
        },
        60,
      );
      const duplicate = await call('/api/actions', 'POST', { token });
      assert.equal(duplicate.status, 400);
      assert.match(duplicate.data.error, /already submitted/);
      // An unavailable table must be surfaced, not silently replaced with browser settings.
      await pool.query('ALTER TABLE relay_settings RENAME TO relay_settings_test_unavailable');
      try {
        assert.equal((await call('/api/status')).data.databaseReady, false);
        assert.equal(
          (
            await call('/api/config', 'POST', {
              provider: 'openai',
              model: 'gpt-4o-mini',
              key: 'never-fallback',
            })
          ).status,
          400,
        );
      } finally {
        await pool.query('ALTER TABLE relay_settings_test_unavailable RENAME TO relay_settings');
      }
      assert.equal((await call('/api/google/disconnect', 'POST')).status, 200);
      assert.equal(
        (await pool.query("SELECT * FROM relay_settings WHERE key='google'")).rowCount,
        0,
      );
      assert.equal((await call('/api/config', 'DELETE')).status, 200);
      assert.equal(
        (await pool.query("SELECT * FROM relay_settings WHERE key='model'")).rowCount,
        0,
      );
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
      await pool.end();
    }
  },
);
