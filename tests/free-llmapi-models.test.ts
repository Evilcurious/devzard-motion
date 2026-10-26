import test from 'node:test';
import assert from 'node:assert/strict';
import { freeLLMAPIModelIds, loadFreeLLMAPImodels } from '../lib/free-llmapi-models';
import { FREELLMAPI_BASE_URL } from '../lib/ai-presets';
import { providerError } from '../lib/ai-errors';
import { POST } from '../app/api/model/local-models/route';

test('FreeLLMAPI discovery returns only bounded, unique OpenAI model IDs', () => {
  assert.deepEqual(
    freeLLMAPIModelIds({
      data: [
        { id: 'local/llama:latest' },
        { id: 'local/llama:latest' },
        { id: 'qwen-2.5' },
        { id: 'bad model id' },
        { id: '<script>' },
        { id: 'x'.repeat(201) },
        null,
      ],
    }),
    ['local/llama:latest', 'qwen-2.5'],
  );
  assert.deepEqual(freeLLMAPIModelIds({ data: 'bad' }), []);
  assert.deepEqual(freeLLMAPIModelIds({}), []);
});

test('model discovery calls only the fixed local endpoint and keeps the API key out of its URL', async () => {
  let called = '';
  const fetcher: typeof fetch = async (input, init) => {
    called = String(input);
    assert.equal(called, `${FREELLMAPI_BASE_URL}/models`);
    assert.ok(!called.includes('local-test-secret'));
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer local-test-secret');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    return Response.json({ data: [{ id: 'local-chat-model' }] });
  };
  assert.deepEqual(await loadFreeLLMAPImodels(' local-test-secret ', fetcher), [
    'local-chat-model',
  ]);
  assert.equal(called, `${FREELLMAPI_BASE_URL}/models`);
});

test('chat 404 guidance points users to local model discovery and route compatibility', () => {
  assert.match(providerError(404, FREELLMAPI_BASE_URL), /Load FreeLLMAPI models/);
  assert.match(providerError(404, FREELLMAPI_BASE_URL), /POST \/v1\/chat\/completions/);
});

test('catalog diagnostics cover unavailable models route, auth, quota and malformed responses without leaking bodies', async () => {
  for (const [status, expected] of [
    [401, /key was rejected/],
    [403, /denied access/],
    [404, /GET \/v1\/models/],
    [429, /quota/],
    [503, /server error/],
  ] as const) {
    await assert.rejects(
      () =>
        loadFreeLLMAPImodels(
          'local-test-secret',
          async () => new Response('secret upstream body', { status }),
        ),
      (error: unknown) =>
        error instanceof Error &&
        expected.test(error.message) &&
        !/secret upstream body/.test(error.message),
    );
  }
  await assert.rejects(
    () =>
      loadFreeLLMAPImodels('', async () => {
        throw new Error('not called');
      }),
    /Enter your FreeLLMAPI key/,
  );
  await assert.rejects(
    () =>
      loadFreeLLMAPImodels('secret', async () => {
        throw new Error('secret URL');
      }),
    /Could not reach FreeLLMAPI/,
  );
  await assert.rejects(
    () => loadFreeLLMAPImodels('secret', async () => new Response('not JSON')),
    /invalid model list/,
  );
  await assert.rejects(
    () => loadFreeLLMAPImodels('secret', async () => Response.json({ data: [] })),
    /no model IDs/,
  );
});

test('model discovery route enforces same-origin and exposes model IDs, not credentials', async (t) => {
  const names = ['APP_PASSWORD', 'SESSION_SECRET', 'DATABASE_URL', 'VERCEL'] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) delete process.env[name];
  t.after(() =>
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }),
  );
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.equal(String(input), `${FREELLMAPI_BASE_URL}/models`);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer local-test-secret');
    return Response.json({ data: [{ id: 'configured-local-model' }] });
  });
  const makeRequest = (body: unknown, origin = 'http://localhost:3000') =>
    new Request('http://localhost:3000/api/model/local-models', {
      method: 'POST',
      headers: { host: 'localhost:3000', origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const crossOrigin = await POST(
    makeRequest({ key: 'local-test-secret' }, 'https://attacker.invalid'),
  );
  assert.equal(crossOrigin.status, 400);
  assert.equal(calls, 0);
  const response = await POST(makeRequest({ key: 'local-test-secret' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { models: ['configured-local-model'] });
  assert.equal(calls, 1);
});
