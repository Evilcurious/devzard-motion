// Editable endpoints are a privileged, single-owner feature, not an unrestricted proxy.
// Allow exact origins via server configuration, including local Ollama.
export function validateEndpoint(value: string) {
  const url = new URL(value);
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
  return value.replace(/\/$/, '');
}
