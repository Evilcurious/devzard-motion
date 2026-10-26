import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalModelKey,
  getRouterProvider,
  routerModelIds,
  routerProviders,
} from '../lib/model-router';

test('model provider registry uses fixed HTTPS hosts and separates search services', () => {
  assert.equal(routerProviders.length, 12);
  assert.equal(getRouterProvider('openrouter')?.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(getRouterProvider('kilo')?.baseURL, 'https://api.kilo.ai/api/gateway/v1');
  assert.equal(getRouterProvider('aihorde')?.keyRequired, false);
  assert.equal(getRouterProvider('firecrawl')?.category, 'search');
  assert.equal(getRouterProvider('parallel')?.category, 'search');
  assert.equal(getRouterProvider('keenable')?.category, 'search');
  for (const provider of routerProviders) {
    if (provider.baseURL) assert.equal(new URL(provider.baseURL).protocol, 'https:');
  }
});

test('catalog normalizer accepts bounded OpenAI arrays and wrapper shapes without leaking metadata', () => {
  const result = routerModelIds({
    data: [
      {
        id: 'vendor/model-x',
        name: 'Model X',
        context_length: 32000,
        supports_tools: true,
        api_key: 'secret',
      },
      { id: 'vendor/model-x', name: 'duplicate' },
      { id: 'x\n\nhttps://evil.invalid', name: 'unsafe' },
      { name: 'another-model', context_window: 8192, monthly_tokens_remaining: 700 },
      { id: 'ignore spaces in/id' },
      { id: 'a'.repeat(201) },
    ],
  });
  assert.deepEqual(result, [
    {
      id: 'vendor/model-x',
      name: 'Model X',
      contextTokens: 32000,
      availableTokens: null,
      supportsTools: true,
    },
    {
      id: 'another-model',
      name: 'another-model',
      contextTokens: 8192,
      availableTokens: 700,
      supportsTools: null,
    },
  ]);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(routerModelIds({ models: [{ id: 'model-y' }] })[0]?.id, 'model-y');
  assert.equal(routerModelIds('not json').length, 0);
});

test('identical model ids merge case-insensitively without stripping vendor namespaces', () => {
  assert.equal(canonicalModelKey(' Vendor/Model-X '), 'vendor/model-x');
  assert.notEqual(canonicalModelKey('vendor/model-x'), canonicalModelKey('model-x'));
});
