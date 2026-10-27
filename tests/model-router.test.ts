import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalModelKey,
  filterRouterModels,
  getRouterProvider,
  hasPositiveAccountCredits,
  rankRouterTargets,
  selectRouterCandidates,
  selectFallbackCandidates,
  selectAutoFusionTargets,
  routerModelIds,
  routerProviders,
} from '../lib/model-router';

test('model provider registry uses fixed HTTPS hosts and separates search services', () => {
  const providerIds = routerProviders.map((provider) => provider.id);
  assert.equal(new Set(providerIds).size, providerIds.length, 'provider IDs are unique');
  assert.ok(providerIds.length >= 60, 'registry includes the expanded FreeLLMAPI gateway set');
  assert.equal(getRouterProvider('openai')?.baseURL, 'https://api.openai.com/v1');
  assert.equal(getRouterProvider('openai')?.keyRequired, true);
  assert.equal(getRouterProvider('gemini')?.name, 'Google Gemini API');
  assert.equal(
    getRouterProvider('gemini')?.baseURL,
    'https://generativelanguage.googleapis.com/v1beta/openai',
  );
  assert.equal(getRouterProvider('gemini')?.keyRequired, true);
  assert.equal(getRouterProvider('openrouter')?.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(getRouterProvider('kilo')?.baseURL, 'https://api.kilo.ai/api/gateway/v1');
  assert.equal(getRouterProvider('aihorde')?.keyRequired, false);
  assert.equal(getRouterProvider('electronhub')?.baseURL, 'https://api.electronhub.ai/v1');
  assert.equal(getRouterProvider('xkiro')?.baseURL, 'https://api.xkiro.com/v1');
  assert.equal(getRouterProvider('septorlabs')?.baseURL, 'https://api.septorlabs.com/v1');
  assert.equal(getRouterProvider('bluesminds')?.name, 'BluesMinds');
  assert.equal(getRouterProvider('bluesminds')?.baseURL, 'https://api.bluesminds.com/v1');
  assert.equal(getRouterProvider('bluesminds')?.modelsPath, '/v1/models');
  assert.equal(getRouterProvider('bluesminds')?.keyRequired, true);
  assert.equal(getRouterProvider('firecrawl')?.category, 'search');
  assert.equal(getRouterProvider('firecrawl')?.baseURL, 'https://api.firecrawl.dev/v2');
  assert.equal(getRouterProvider('parallel')?.category, 'search');
  assert.equal(getRouterProvider('keenable')?.category, 'search');
  for (const id of [
    'groq',
    'cerebras',
    'opencode-zen',
    'mistral',
    'cohere',
    'zai',
    'nvidia',
    'huggingface',
    'modelscope',
  ]) {
    const provider = getRouterProvider(id);
    assert.equal(provider?.category, 'models');
    assert.ok(provider?.docsURL.startsWith('https://'));
    assert.match(provider?.note || '', /FreeLLMAPI lists/);
  }
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
      { id: 'vendor/free-model:free' },
      { id: 'vendor/zero-priced', pricing: { input: 0, output: '0' } },
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
      isFree: false,
    },
    {
      id: 'another-model',
      name: 'another-model',
      contextTokens: 8192,
      availableTokens: 700,
      supportsTools: null,
      isFree: false,
    },
    {
      id: 'vendor/free-model:free',
      name: 'vendor/free-model:free',
      contextTokens: null,
      availableTokens: null,
      supportsTools: null,
      isFree: true,
    },
    {
      id: 'vendor/zero-priced',
      name: 'vendor/zero-priced',
      contextTokens: null,
      availableTokens: null,
      supportsTools: null,
      isFree: true,
    },
  ]);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(routerModelIds({ models: [{ id: 'model-y' }] })[0]?.id, 'model-y');
  assert.equal(routerModelIds('not json').length, 0);
});

test('model normalization recognizes quota metadata nested across provider response formats', () => {
  assert.deepEqual(
    routerModelIds({
      results: [
        {
          model: 'vendor/allocated-model',
          metadata: { context_window: '64000' },
          quota: { remaining_tokens: '1250' },
          availability: { supportsTools: true },
        },
      ],
    }),
    [
      {
        id: 'vendor/allocated-model',
        name: 'vendor/allocated-model',
        contextTokens: 64000,
        availableTokens: 1250,
        supportsTools: true,
        isFree: false,
      },
    ],
  );
});

test('provider account availability requires an explicit positive balance or remaining-quota signal', () => {
  assert.equal(hasPositiveAccountCredits({ usage: { credits_remaining: 12.5 } }), true);
  assert.equal(hasPositiveAccountCredits({ free_usage: { used_percent: 3.6 } }), true);
  assert.equal(hasPositiveAccountCredits({ quota: { tokens_remaining: 42 } }), true);
  assert.equal(
    hasPositiveAccountCredits({ data: { total_credits: '10', total_usage: '2' } }),
    true,
  );
  assert.equal(hasPositiveAccountCredits({ quota: { remaining_percent: 0 } }), false);
  assert.equal(hasPositiveAccountCredits({ usage: { used_percent: 100 } }), false);
  assert.equal(hasPositiveAccountCredits({ usage: { percent_used: 3.6 } }), true);
  assert.equal(
    hasPositiveAccountCredits({ data: [{ id: 'model', quota: { remaining_tokens: 100 } }] }),
    false,
    'per-model quota must not be promoted to an account-wide balance',
  );
});

test('routing excludes reported zero quota and ranks only from provider or observed metrics', () => {
  const targets = [
    {
      providerId: 'openrouter' as const,
      modelId: 'quota-large',
      availableTokens: 900,
      contextTokens: 8000,
    },
    {
      providerId: 'kilo' as const,
      modelId: 'quota-small',
      availableTokens: 100,
      contextTokens: 64000,
    },
    {
      providerId: 'ovh' as const,
      modelId: 'unknown-quota',
      availableTokens: null,
      contextTokens: 128000,
    },
    {
      providerId: 'agnes' as const,
      modelId: 'depleted',
      availableTokens: 0,
      contextTokens: 1000000,
    },
  ];
  assert.deepEqual(
    rankRouterTargets(targets, 'auto').map((target) => target.modelId),
    ['quota-large', 'quota-small', 'unknown-quota'],
  );
  assert.deepEqual(
    rankRouterTargets(
      [
        { providerId: 'openrouter', modelId: 'paid', availableTokens: null },
        { providerId: 'kilo', modelId: 'free', availableTokens: null, isFree: true },
      ],
      'auto',
    ).map((target) => target.modelId),
    ['free', 'paid'],
  );
  assert.deepEqual(
    rankRouterTargets(targets, 'high').map((target) => target.modelId),
    ['quota-small', 'quota-large', 'unknown-quota'],
  );
  const observed = new Map([
    ['openrouter::quota-large', 500],
    ['kilo::quota-small', 100],
  ]);
  assert.deepEqual(
    rankRouterTargets(targets, 'faster', observed).map((target) => target.modelId),
    ['quota-small', 'quota-large', 'unknown-quota'],
  );
  assert.deepEqual(
    rankRouterTargets(targets, 'fast', observed).map((target) => target.modelId),
    ['quota-large', 'quota-small', 'unknown-quota'],
  );
});

test('routing strategies use observed reliability and speed only as rankings, never as eligibility signals', () => {
  const targets = [
    {
      providerId: 'openrouter' as const,
      modelId: 'fast',
      availableTokens: 1200,
      contextTokens: 8000,
    },
    {
      providerId: 'kilo' as const,
      modelId: 'reliable',
      availableTokens: 300,
      contextTokens: 32000,
    },
    { providerId: 'ovh' as const, modelId: 'unknown', availableTokens: null, contextTokens: 64000 },
    {
      providerId: 'agnes' as const,
      modelId: 'depleted',
      availableTokens: 0,
      contextTokens: 1000000,
    },
  ];
  const metrics = new Map([
    ['openrouter::fast', { requests: 8, successRate: 87.5, averageLatencyMs: 400 }],
    ['kilo::reliable', { requests: 6, successRate: 100, averageLatencyMs: 900 }],
    ['ovh::unknown', { requests: 2, successRate: 100, averageLatencyMs: null }],
  ]);
  assert.deepEqual(
    rankRouterTargets(targets, 'auto', new Map(), 'fastest', metrics).map(
      (target) => target.modelId,
    ),
    ['fast', 'reliable', 'unknown'],
  );
  assert.deepEqual(
    rankRouterTargets(targets, 'auto', new Map(), 'most-reliable', metrics).map(
      (target) => target.modelId,
    ),
    ['reliable', 'fast', 'unknown'],
    'fewer than three observations do not qualify for the reliability ranking',
  );
  assert.deepEqual(
    rankRouterTargets(targets, 'auto', new Map(), 'largest-context', metrics).map(
      (target) => target.modelId,
    ),
    ['unknown', 'reliable', 'fast'],
  );
});

test('an explicitly selected model is pinned while Auto-pick may use the ranked eligible list', () => {
  const ranked = [
    { providerId: 'openrouter' as const, modelId: 'first', availableTokens: 900 },
    { providerId: 'kilo' as const, modelId: 'second', availableTokens: 500 },
  ];
  assert.deepEqual(selectRouterCandidates(ranked, ranked[1], false), [ranked[1]]);
  assert.deepEqual(selectRouterCandidates(ranked, ranked[1], true), ranked);
  assert.deepEqual(selectRouterCandidates(ranked, null, false), []);
  assert.deepEqual(
    selectRouterCandidates(ranked, { providerId: 'ovh', modelId: 'gone' }, false),
    [],
  );
});

test('model search matches model IDs and provider routes while narrowing provider matches', () => {
  const models = [
    {
      key: 'vendor-model',
      id: 'vendor/model-a',
      name: 'Model Alpha',
      providers: [
        { id: 'openrouter', name: 'OpenRouter', modelId: 'vendor/model-a' },
        { id: 'kilo', name: 'Kilo', modelId: 'vendor/model-a' },
      ],
    },
    {
      key: 'other',
      id: 'other/model',
      name: 'Other Model',
      providers: [{ id: 'gemini', name: 'Google Gemini', modelId: 'other/model' }],
    },
  ];

  assert.equal(filterRouterModels(models, '').length, 2);
  assert.deepEqual(
    filterRouterModels(models, 'google gemini').map((model) => model.id),
    ['other/model'],
  );
  assert.deepEqual(
    filterRouterModels(models, 'kilo').map((model) => model.providers.map((p) => p.id)),
    [['kilo']],
  );
  assert.equal(filterRouterModels(models, 'missing').length, 0);
});

test('fallback chains keep the user order, skip unavailable models and deduplicate entries', () => {
  const available = [
    { providerId: 'openrouter' as const, modelId: 'primary', availableTokens: 800 },
    { providerId: 'kilo' as const, modelId: 'backup-a', availableTokens: 700 },
    { providerId: 'ovh' as const, modelId: 'backup-b', availableTokens: 600 },
    { providerId: 'agnes' as const, modelId: 'depleted', availableTokens: 0 },
  ];
  assert.deepEqual(
    selectFallbackCandidates(available, available[0], [
      available[2],
      { providerId: 'openrouter', modelId: 'missing' },
      available[1],
      available[2],
      available[3],
    ]).map((target) => target.modelId),
    ['primary', 'backup-b', 'backup-a'],
  );
});

test('Auto Fusion chooses prompt-relevant, eligible models and diversifies providers', () => {
  const targets = [
    { providerId: 'openrouter' as const, modelId: 'general-chat', availableTokens: 900 },
    { providerId: 'kilo' as const, modelId: 'qwen-coder', availableTokens: 400 },
    { providerId: 'ovh' as const, modelId: 'deepseek-r1-reasoner', availableTokens: 300 },
    { providerId: 'agnes' as const, modelId: 'claude-sonnet', availableTokens: 200 },
    { providerId: 'routeway' as const, modelId: 'depleted-coder', availableTokens: 0 },
    { providerId: 'openrouter' as const, modelId: 'secondary-chat', availableTokens: 100 },
  ];
  const selected = selectAutoFusionTargets(
    'Debug this TypeScript function and explain why it fails.',
    targets,
  );
  assert.equal(selected.length, 4);
  assert.ok(selected.some((target) => target.modelId === 'qwen-coder'));
  assert.ok(selected.every((target) => target.modelId !== 'depleted-coder'));
  assert.equal(new Set(selected.map((target) => target.providerId)).size, 4);
});

test('identical model ids merge case-insensitively without stripping vendor namespaces', () => {
  assert.equal(canonicalModelKey(' Vendor/Model-X '), 'vendor/model-x');
  assert.notEqual(canonicalModelKey('vendor/model-x'), canonicalModelKey('model-x'));
});
