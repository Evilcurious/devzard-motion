import test from 'node:test';
import assert from 'node:assert/strict';
import { isEligibleProviderModel } from '../lib/router-catalog';

import { getRouterProvider, routerModelIds } from '../lib/model-router';
import { normalizeProviderTokenUsage } from '../lib/provider-usage';

test('BluesMinds account-listed model IDs can be selected even when its catalog omits quota metadata', () => {
  const provider = getRouterProvider('bluesminds');
  assert.equal(provider?.baseURL, 'https://api.bluesminds.com/v1');
  assert.equal(
    new URL(provider!.modelsPath!, provider!.baseURL!).href,
    'https://api.bluesminds.com/v1/models',
  );

  const listed = routerModelIds({ data: [{ id: 'qwen/qwen3-next-80b-a3b-instruct' }] });
  assert.equal(listed[0]?.id, 'qwen/qwen3-next-80b-a3b-instruct');
  assert.equal(
    isEligibleProviderModel('bluesminds', listed[0]),
    true,
    'a model returned by the authenticated BluesMinds catalog is selectable',
  );
  assert.equal(
    isEligibleProviderModel('openrouter', listed[0]),
    false,
    'models without quota or an authenticated provider listing stay unavailable',
  );
  assert.equal(
    isEligibleProviderModel('openrouter', { ...listed[0], authenticatedListing: true }),
    true,
    'models returned for a connected API key stay visible when quota metadata is absent',
  );
  assert.equal(
    isEligibleProviderModel('ollama-cloud', { ...listed[0], authenticatedListing: true }),
    false,
    'Ollama Cloud still requires its documented free-usage or account-credit eligibility',
  );
});

test('BluesMinds total-only token usage still counts toward a Free account allowance', () => {
  assert.deepEqual(normalizeProviderTokenUsage({ total_tokens: 27 }), {
    inputTokens: 27,
    outputTokens: 0,
  });
  assert.deepEqual(normalizeProviderTokenUsage({ prompt_tokens: 20, total_tokens: 27 }), {
    inputTokens: 20,
    outputTokens: 7,
  });
  assert.deepEqual(normalizeProviderTokenUsage({ input_tokens: 20, output_tokens: 7 }), {
    inputTokens: 20,
    outputTokens: 7,
  });
  assert.deepEqual(normalizeProviderTokenUsage({}), {
    inputTokens: null,
    outputTokens: null,
  });
});
