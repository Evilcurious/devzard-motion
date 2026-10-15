import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiModelIds, loadGeminiModels } from '../lib/gemini-models';
import { isGeminiEndpoint, providerError } from '../lib/ai-errors';
import { GEMINI_BASE_URL, GEMINI_ORIGIN } from '../lib/ai-presets';
import { POST } from '../app/api/model/models/route';

const generationModel = (id: string) => ({
  name: `models/${id}`,
  supportedGenerationMethods: ['generateContent', 'countTokens'],
});

test('Gemini catalog exposes only bounded generation model IDs, not upstream metadata', () => {
  assert.deepEqual(
    geminiModelIds({
      models: [
        generationModel('gemini-example-flash'),
        { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
        generationModel('other-model'),
        generationModel('gemini-<script>'),
        generationModel(`gemini-${'x'.repeat(100)}`),
        { name: 'models/gemini-missing-methods', description: 'private metadata' },
        null,
        'bad',
      ],
    }),
    ['gemini-example-flash'],
  );
  assert.deepEqual(geminiModelIds(null), []);
  assert.deepEqual(geminiModelIds({ models: 'bad' }), []);
});

test('model discovery paginates on a fixed Google origin with a private header, without redirects or caching', async () => {
  const calls: URL[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.equal(url.origin, GEMINI_ORIGIN);
    assert.equal(url.pathname, '/v1beta/models');
    assert.equal(url.searchParams.get('pageSize'), '1000');
    assert.ok(!url.href.includes('test-only-key'));
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-only-key');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    if (calls.length === 1)
      return Response.json({
        models: [generationModel('gemini-z'), generationModel('gemini-a')],
        nextPageToken: 'https://attacker.invalid/?key=ignored',
      });
    assert.equal(url.searchParams.get('pageToken'), 'https://attacker.invalid/?key=ignored');
    return Response.json({ models: [generationModel('gemini-a'), generationModel('gemini-b')] });
  };
  assert.deepEqual(await loadGeminiModels('  test-only-key  ', fakeFetch), [
    'gemini-a',
    'gemini-b',
    'gemini-z',
  ]);
  assert.equal(calls.length, 2);
});

test('catalog errors distinguish credentials, permissions, quotas and missing catalog without leaking provider bodies', async () => {
  for (const [status, expected] of [
    [401, /key was rejected/],
    [403, /denied access/],
    [429, /quota/],
    [404, /catalog returned 404/],
    [503, /server error/],
  ] as const) {
    await assert.rejects(
      () =>
        loadGeminiModels(
          'test-only-key',
          async () => new Response('private upstream details test-only-key', { status }),
        ),
      (error: unknown) =>
        error instanceof Error &&
        expected.test(error.message) &&
        !/private|test-only-key/.test(error.message),
    );
  }
  await assert.rejects(
    () =>
      loadGeminiModels('', async () => {
        throw new Error('should never fetch');
      }),
    /Enter a Gemini API key/,
  );
  await assert.rejects(
    () =>
      loadGeminiModels('test-only-key', async () => {
        throw new Error('private URL and key');
      }),
    /Could not reach the Gemini model catalog/,
  );
  await assert.rejects(
    () => loadGeminiModels('test-only-key', async () => new Response('invalid private JSON')),
    /invalid model catalog/,
  );
  await assert.rejects(
    () => loadGeminiModels('test-only-key', async () => Response.json({ models: [] })),
    /no Gemini generation models/,
  );
});

test('catalog pagination is bounded even for a repeated token', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      loadGeminiModels('test-only-key', async () => {
        calls++;
        return Response.json({
          models: [generationModel('gemini-example')],
          nextPageToken: 'repeated',
        });
      }),
    /could not be fully loaded/,
  );
  assert.equal(calls, 10);
});

test('chat and connection test use safe actionable error categories', () => {
  assert.match(providerError(404, GEMINI_BASE_URL), /Load Gemini models/);
  assert.doesNotMatch(providerError(404, GEMINI_BASE_URL), /quota/);
  assert.match(providerError(404, 'https://other.invalid/v1'), /OpenAI-compatible base URL/);
  assert.doesNotMatch(providerError(404, 'https://other.invalid/v1'), /Gemini/);
  assert.match(providerError(429, GEMINI_BASE_URL), /quota/);
  assert.equal(isGeminiEndpoint(`${GEMINI_BASE_URL}/`), true);
  assert.equal(isGeminiEndpoint(`${GEMINI_BASE_URL}.invalid`), false);
});

test('catalog route enforces auth/origin and returns only IDs, never the key', async (t) => {
  const names = ['APP_PASSWORD', 'SESSION_SECRET', 'DATABASE_URL', 'VERCEL'] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) delete process.env[name];
  t.after(() =>
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    }),
  );
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({
      models: [{ ...generationModel('gemini-test'), description: 'private info' }],
    });
  });
  const request = (body: unknown, origin = 'http://localhost:3000') =>
    new Request('http://localhost:3000/api/model/models', {
      method: 'POST',
      headers: { host: 'localhost:3000', origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const rejected = await POST(request({ key: 'test-only-key' }, 'https://attacker.invalid'));
  assert.equal(rejected.status, 400);
  assert.equal(calls, 0);
  const invalid = await POST(
    request({ key: 'test-only-key', baseURL: 'https://attacker.invalid' }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);
  process.env.APP_PASSWORD = 'test-password';
  const unauthenticated = await POST(request({ key: 'test-only-key' }));
  assert.equal(unauthenticated.status, 401);
  assert.equal(calls, 0);
  delete process.env.APP_PASSWORD;
  const response = await POST(request({ key: 'test-only-key' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { models: ['gemini-test'] });
  assert.equal(calls, 1);
});
