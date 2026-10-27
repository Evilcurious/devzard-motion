import test from 'node:test';
import assert from 'node:assert/strict';
import { isEligibleProviderModel } from '../lib/router-catalog';

test('FreeLLMAPI monthly-budget metadata does not by itself make a provider route eligible', () => {
  const model = {
    isFree: false,
    availableTokens: null,
    monthlyTokenBudget: '1M tokens/month',
  };
  assert.equal(isEligibleProviderModel('groq', model), false);
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
