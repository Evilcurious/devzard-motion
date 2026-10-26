import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEndpoint } from '../lib/endpoint';
import { isFreeLLMAPIEndpoint } from '../lib/ai-errors';
import { FREELLMAPI_BASE_URL } from '../lib/ai-presets';

test('local FreeLLMAPI endpoint is allowed only at the requested loopback host and port', () => {
  const names = ['AI_ALLOWED_ORIGINS', 'AI_BASE_URL', 'OLLAMA_BASE_URL'] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) delete process.env[name];
  try {
    assert.equal(validateEndpoint(FREELLMAPI_BASE_URL), FREELLMAPI_BASE_URL);
    assert.equal(validateEndpoint(`${FREELLMAPI_BASE_URL}/`), FREELLMAPI_BASE_URL);
    assert.equal(isFreeLLMAPIEndpoint(FREELLMAPI_BASE_URL), true);
    assert.equal(isFreeLLMAPIEndpoint(`${FREELLMAPI_BASE_URL}/`), true);
    for (const endpoint of [
      'http://127.0.0.1:31415/',
      'http://127.0.0.1:31415/v1/chat/completions',
      'https://127.0.0.1:31415/v1',
      'http://127.0.0.1:31416/v1',
      'http://localhost:31415/v1',
      'http://127.0.0.1.attacker.invalid:31415/v1',
      `${FREELLMAPI_BASE_URL}?key=secret`,
    ])
      assert.throws(
        () => validateEndpoint(endpoint),
        (error) => error instanceof Error,
        endpoint,
      );
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
