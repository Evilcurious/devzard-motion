import { FREELLMAPI_BASE_URL } from './ai-presets';
import { providerError } from './ai-errors';

export function freeLLMAPIModelIds(body: unknown): string[] {
  if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data))
    return [];
  const ids = new Set<string>();
  for (const model of body.data.slice(0, 1000)) {
    if (!model || typeof model.id !== 'string') continue;
    const id = model.id.trim();
    if (id.length > 0 && id.length <= 200 && /^[\w./:-]+$/.test(id)) ids.add(id);
  }
  return [...ids].sort();
}

// This request can only send the saved/local key to the exact loopback FreeLLMAPI host.
export async function loadFreeLLMAPImodels(key: string, fetcher: typeof fetch = fetch) {
  if (!key.trim())
    throw new Error('Enter your FreeLLMAPI key, or save the local FreeLLMAPI connection first.');
  let response: Response;
  try {
    response = await fetcher(`${FREELLMAPI_BASE_URL}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key.trim()}` },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(
      'Could not reach FreeLLMAPI at 127.0.0.1:31415. Make sure the local server is running on the same computer as Relay.',
    );
  }
  if (response.status === 404)
    throw new Error(
      'FreeLLMAPI model listing returned 404. It should expose GET /v1/models. If model listing is unsupported, enter the model ID configured in FreeLLMAPI manually; chat still requires POST /v1/chat/completions.',
    );
  if (!response.ok) throw new Error(providerError(response.status, FREELLMAPI_BASE_URL));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('FreeLLMAPI returned an invalid model list. Check its OpenAI-compatible API.');
  }
  const models = freeLLMAPIModelIds(body);
  if (!models.length)
    throw new Error(
      'FreeLLMAPI returned no model IDs. Configure a model in its server and expose it through GET /v1/models.',
    );
  return models;
}
