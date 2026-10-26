import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEndpoint } from '../lib/endpoint';
import { isOpenRouterEndpoint, providerError } from '../lib/ai-errors';
import { OPENROUTER_BASE_URL, OPENROUTER_FREE_MODEL } from '../lib/ai-presets';

test('official OpenRouter base URL is trusted by default and recognized exactly', () => {
  const names = ['AI_ALLOWED_ORIGINS', 'AI_BASE_URL', 'OLLAMA_BASE_URL'] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) delete process.env[name];
  try {
    assert.equal(validateEndpoint(OPENROUTER_BASE_URL), OPENROUTER_BASE_URL);
    assert.equal(validateEndpoint(`${OPENROUTER_BASE_URL}/`), OPENROUTER_BASE_URL);
    assert.equal(isOpenRouterEndpoint(OPENROUTER_BASE_URL), true);
    assert.equal(isOpenRouterEndpoint(`${OPENROUTER_BASE_URL}/`), true);
    assert.equal(isOpenRouterEndpoint('https://openrouter.ai.attacker.invalid/api/v1'), false);
    assert.equal(OPENROUTER_FREE_MODEL, 'openrouter/free');
    assert.match(providerError(402, OPENROUTER_BASE_URL), /credits or plan access/);
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test('OpenRouter preset refuses incorrect paths, insecure URLs and lookalike hosts', () => {
  for (const value of [
    'https://openrouter.ai/v1',
    'https://openrouter.ai/api/v1/chat/completions',
    'http://openrouter.ai/api/v1',
    'https://openrouter.ai.attacker.invalid/api/v1',
    'https://openrouter.ai:8443/api/v1',
    `${OPENROUTER_BASE_URL}?key=secret`,
  ])
    assert.throws(() => validateEndpoint(value));
});
