import test from 'node:test';
import assert from 'node:assert/strict';
import { isEligibleProviderModel } from '../lib/router-catalog';
import {
  normalizeOpenRouterAccountBalance,
  normalizeSiliconFlowAccountBalance,
} from '../lib/router-account-balance';

test('FreeLLMAPI monthly-budget metadata does not by itself make a provider route eligible', () => {
  const model = {
    isFree: false,
    availableTokens: null,
    monthlyTokenBudget: '1M tokens/month',
  };
  assert.equal(isEligibleProviderModel('groq', model), false);
});

test('OpenRouter account credits and key limits normalize safely from provider responses', () => {
  assert.deepEqual(
    normalizeOpenRouterAccountBalance(
      { data: { total_credits: 10, total_usage: 3.25 } },
      { data: { limit_remaining: '4.50' } },
    ),
    {
      eligible: true,
      label: '$6.75 USD account credits remaining · key $4.50 remaining',
    },
  );
  assert.equal(
    normalizeOpenRouterAccountBalance(
      { data: { total_credits: 10, total_usage: 3 } },
      { data: { limit_remaining: 0 } },
    ).eligible,
    false,
  );
  assert.deepEqual(normalizeOpenRouterAccountBalance({}, {}), { eligible: false, label: null });
});

test('SiliconFlow account balance exposes only a normalized currency label', () => {
  assert.equal(
    normalizeSiliconFlowAccountBalance({ data: { totalBalance: '18.4', balance: '10' } }),
    'CNY 18.40 account credits reported',
  );
  assert.equal(normalizeSiliconFlowAccountBalance({ data: { balance: 'invalid' } }), null);
});

test('authenticated provider model listings remain eligible when quota metadata is absent', () => {
  const model = {
    isFree: false,
    availableTokens: null,
    authenticatedListing: true,
    monthlyTokenBudget: '1M tokens/month',
  };
  assert.equal(isEligibleProviderModel('groq', model), true);
});
