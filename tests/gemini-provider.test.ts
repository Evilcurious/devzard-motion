import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverGeminiProvider } from '../lib/router-catalog';

test('Google Gemini discovery uses the fixed API host, API-key header, and generation-capable models only', async () => {
  const requests: Array<{
    url: string;
    key: string;
    authorization: string;
    redirect: string | null;
  }> = [];
  const pages = [
    {
      models: [
        {
          name: 'models/gemini-free',
          displayName: 'Gemini Free',
          inputTokenLimit: 32000,
          supportedGenerationMethods: ['generateContent'],
          free: true,
          privateMetadata: 'must not leak',
        },
        {
          name: 'models/gemini-quota',
          displayName: 'Gemini Quota',
          inputTokenLimit: 64000,
          availableTokens: 123,
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-unknown-quota',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-embedding',
          supportedGenerationMethods: ['embedContent'],
        },
        {
          name: 'models/other-provider-model',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
      nextPageToken: 'next-page',
    },
    {
      models: [
        {
          name: 'models/gemini-next',
          supportedGenerationMethods: ['generateContent'],
          isFree: true,
        },
      ],
    },
  ];
  const result = await discoverGeminiProvider('test-google-key', async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      url: url.toString(),
      key: new Headers(init?.headers).get('x-goog-api-key') || '',
      authorization: new Headers(init?.headers).get('authorization') || '',
      redirect: init?.redirect || null,
    });
    return Response.json(pages[requests.length - 1]);
  });

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?/);
  assert.equal(requests[1].url.includes('pageToken=next-page'), true);
  assert.equal(requests[0].key, 'test-google-key');
  assert.equal(requests[0].authorization, '');
  assert.equal(requests[0].redirect, 'error');
  assert.deepEqual(
    result.models.map((model) => [
      model.id,
      model.contextTokens,
      model.availableTokens,
      model.isFree,
    ]),
    [
      ['gemini-free', 32000, null, true],
      ['gemini-quota', 64000, 123, false],
      ['gemini-unknown-quota', null, null, false],
      ['gemini-next', null, null, true],
    ],
  );
  assert.equal(JSON.stringify(result).includes('must not leak'), false);
  assert.equal(JSON.stringify(result).includes('test-google-key'), false);
});

test('Google Gemini discovery hides upstream error bodies and reports a safe provider error', async () => {
  const result = await discoverGeminiProvider(
    'test-google-key',
    async () =>
      new Response(JSON.stringify({ error: { message: 'test-google-key private body' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
  );
  assert.equal(result.models.length, 0);
  assert.match(result.error || '', /HTTP 403/);
  assert.equal((result.error || '').includes('test-google-key'), false);
});
