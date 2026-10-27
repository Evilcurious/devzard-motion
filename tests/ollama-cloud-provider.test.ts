import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverOllamaCloudProvider } from '../lib/router-catalog';

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
