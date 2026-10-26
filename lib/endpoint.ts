import {
  GEMINI_ORIGIN,
  GEMINI_BASE_URL,
  OPENROUTER_ORIGIN,
  OPENROUTER_BASE_URL,
} from './ai-presets';

// Editable endpoints are a privileged, single-owner feature, not an unrestricted proxy.
// Allow exact origins via server configuration, including local Ollama.
export function validateEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a complete HTTP(S) API endpoint, not an API key or model name.');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use a plain HTTP(S) endpoint without credentials, query parameters or fragments.',
    );
  const allowed = [
    'https://api.openai.com',
    GEMINI_ORIGIN,
    OPENROUTER_ORIGIN,
    'http://localhost:11434',
    'http://127.0.0.1:11434',
    process.env.AI_BASE_URL,
    process.env.OLLAMA_BASE_URL,
    ...(process.env.AI_ALLOWED_ORIGINS || '').split(','),
  ]
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s!.trim()).origin;
      } catch {
        return '';
      }
    });
  if (!allowed.includes(url.origin))
    throw new Error(
      'This endpoint origin is not allowed. Add its origin to AI_ALLOWED_ORIGINS in .env.local, then restart Relay.',
    );
  const normalized = url.toString().replace(/\/$/, '');
  if (url.origin === GEMINI_ORIGIN && normalized !== GEMINI_BASE_URL) {
    throw new Error(
      `For Gemini, use ${GEMINI_BASE_URL} with Other API. Do not add /v1, /chat/completions or a generateContent path.`,
    );
  }
  if (url.origin === OPENROUTER_ORIGIN && normalized !== OPENROUTER_BASE_URL) {
    throw new Error(
      `For OpenRouter, use ${OPENROUTER_BASE_URL}. Do not add /chat/completions to the base URL.`,
    );
  }
  return normalized;
}
