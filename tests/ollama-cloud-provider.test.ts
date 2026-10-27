import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOllamaCloudBalance,
  discoverOllamaCloudBalance,
  discoverOllamaCloudProvider,
} from '../lib/router-catalog';

test('Ollama Cloud model discovery checks both authenticated model-list APIs and merges safe quota metadata', async () => {
  const requests: Array<{ url: string; authorization: string; redirect: string | null }> = [];
  const result = await discoverOllamaCloudProvider('test-ollama-key', async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get('authorization') || '',
      redirect: init?.redirect || null,
    });
    if (url.endsWith('/v1/models'))
      return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    return Response.json({
      models: [
        {
          name: 'qwen3:8b-cloud',
          available_tokens: 1200,
          context_length: 32000,
          supports_tools: true,
          private_metadata: 'must not leak',
        },
        { name: 'llama3.2:3b-cloud', free: true },
      ],
    });
  });

  assert.deepEqual(
    requests.map((request) => request.url),
    ['https://ollama.com/v1/models', 'https://ollama.com/api/tags'],
  );
  assert.equal(
    requests.every((request) => request.authorization === 'Bearer test-ollama-key'),
    true,
  );
  assert.equal(
    requests.every((request) => request.redirect === 'error'),
    true,
  );
  assert.deepEqual(
    result.models.map((model) => [
      model.id,
      model.availableTokens,
      model.contextTokens,
      model.isFree,
    ]),
    [
      ['qwen3:8b-cloud', 1200, 32000, false],
      ['llama3.2:3b-cloud', null, null, true],
    ],
  );
  assert.equal(JSON.stringify(result).includes('test-ollama-key'), false);
  assert.equal(JSON.stringify(result).includes('must not leak'), false);
});

test('Ollama free-usage eligibility requires both positive included balance and authenticated model listing', async () => {
  const listedModels = [
    'beam:latest',
    'gemma4:31b',
    'gpt-oss:120b',
    'gpt-oss:20b',
    'nemotron-3-nano:30b',
    'nemotron-3-super',
    'nemotron-3-ultra',
    'another-cloud-model',
  ];
  const result = await discoverOllamaCloudProvider('test-ollama-list-key', async (input) => {
    if (String(input).endsWith('/api/tags')) return Response.json({ models: [] });
    return Response.json({ data: listedModels.map((id) => ({ id })) });
  });

  assert.equal(
    result.models.every((model) => !model.isFree),
    true,
  );
  assert.deepEqual(
    applyOllamaCloudBalance(result.models, {
      includedCreditsAvailable: true,
      purchasedCreditsAvailable: false,
      error: null,
    }).map((model) => [model.id, model.isFree]),
    [
      ['beam:latest', true],
      ['gemma4:31b', true],
      ['gpt-oss:120b', true],
      ['gpt-oss:20b', true],
      ['nemotron-3-nano:30b', true],
      ['nemotron-3-super', true],
      ['nemotron-3-ultra', true],
      ['another-cloud-model', false],
    ],
  );
  assert.equal(
    applyOllamaCloudBalance(result.models, {
      includedCreditsAvailable: false,
      purchasedCreditsAvailable: true,
      error: null,
    }).every((model) => model.accountCreditsAvailable),
    true,
  );
});

test('Ollama Cloud balance adapter reads included, purchased, and legacy quota balances safely', async () => {
  let request: { url: string; authorization: string; redirect: string | null } | null = null;
  const balance = await discoverOllamaCloudBalance(
    'test-ollama-balance-key',
    async (input, init) => {
      request = {
        url: String(input),
        authorization: new Headers(init?.headers).get('authorization') || '',
        redirect: init?.redirect || null,
      };
      return Response.json({
        included: { balance_usd: 96.4, allowance_usd: 100 },
        purchased: { balance_usd: 0 },
      });
    },
  );

  assert.deepEqual(request, {
    url: 'https://ollama.com/api/balance',
    authorization: 'Bearer test-ollama-balance-key',
    redirect: 'error',
  });
  assert.deepEqual(balance, {
    includedCreditsAvailable: true,
    purchasedCreditsAvailable: false,
    error: null,
  });

  const legacy = await discoverOllamaCloudBalance('test-ollama-legacy-key', async () =>
    Response.json({
      included: {
        session: { remaining_percent: 0 },
        weekly: { remaining_percent: 40 },
      },
      purchased: { balance_usd: '2.50' },
    }),
  );
  assert.deepEqual(legacy, {
    includedCreditsAvailable: true,
    purchasedCreditsAvailable: true,
    error: null,
  });

  const empty = await discoverOllamaCloudBalance('test-ollama-empty-key', async () =>
    Response.json({ included: { balance_usd: 0 }, purchased: { balance_usd: 0 } }),
  );
  assert.deepEqual(empty, {
    includedCreditsAvailable: false,
    purchasedCreditsAvailable: false,
    error: null,
  });

  const rejected = await discoverOllamaCloudBalance(
    'test-ollama-rejected-balance-key',
    async () =>
      new Response(JSON.stringify({ error: 'test-ollama-rejected-balance-key' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
  );
  assert.equal(rejected.includedCreditsAvailable, false);
  assert.match(rejected.error || '', /HTTP 401/);
  assert.equal(JSON.stringify(rejected).includes('test-ollama-rejected-balance-key'), false);
});

test('Ollama Cloud errors do not expose upstream bodies or bypass rejected credentials', async () => {
  let requestCount = 0;
  const result = await discoverOllamaCloudProvider('test-ollama-key', async () => {
    requestCount++;
    return new Response(JSON.stringify({ error: { message: 'test-ollama-key leaked' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  });
  assert.equal(requestCount, 1);
  assert.equal(result.models.length, 0);
  assert.match(result.error || '', /HTTP 401/);
  assert.equal((result.error || '').includes('test-ollama-key'), false);
});
