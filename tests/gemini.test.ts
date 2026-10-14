import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEndpoint } from '../lib/endpoint';
import { GEMINI_BASE_URL } from '../lib/ai-presets';

test('Gemini official endpoint is allowed without any environment allowlist', () => {
  const names = ['AI_ALLOWED_ORIGINS', 'AI_BASE_URL', 'OLLAMA_BASE_URL'] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) delete process.env[name];
  try {
    assert.equal(validateEndpoint(GEMINI_BASE_URL), GEMINI_BASE_URL);
    assert.equal(validateEndpoint(`  ${GEMINI_BASE_URL}/  `), GEMINI_BASE_URL);
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test('Gemini exception does not allow insecure, lookalike or unrelated Google hosts', () => {
  for (const value of [
    'http://generativelanguage.googleapis.com/v1beta/openai',
    'https://generativelanguage.googleapis.com.attacker.invalid/v1beta/openai',
    'https://other.googleapis.com/v1beta/openai',
    'https://generativelanguage.googleapis.com:8443/v1beta/openai',
    `${GEMINI_BASE_URL}?key=private`,
    'https://user:private@generativelanguage.googleapis.com/v1beta/openai',
  ])
    assert.throws(() => validateEndpoint(value));
});

test('native Gemini and duplicated completion paths get actionable errors', () => {
  for (const value of [
    'https://generativelanguage.googleapis.com/v1',
    'https://generativelanguage.googleapis.com/v1beta/models/example:generateContent',
    `${GEMINI_BASE_URL}/chat/completions`,
  ])
    assert.throws(() => validateEndpoint(value), /For Gemini, use/);
  assert.throws(() => validateEndpoint('not-a-url'), /complete HTTP/);
  assert.equal(validateEndpoint('https://api.openai.com/v1'), 'https://api.openai.com/v1');
  assert.equal(validateEndpoint('http://localhost:11434/v1'), 'http://localhost:11434/v1');
});
