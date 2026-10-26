import { GEMINI_ORIGIN, GEMINI_BASE_URL } from './ai-presets';
import { providerError } from './ai-errors';

export function geminiModelIds(body: unknown): string[] {
  if (!body || typeof body !== 'object' || !('models' in body)) return [];
  const models = body.models;
  if (!Array.isArray(models)) return [];
  return models.flatMap((model) => {
    if (
      !model ||
      typeof model.name !== 'string' ||
      !/^models\/gemini-[a-zA-Z0-9._-]+$/.test(model.name) ||
      model.name.length > 107 ||
      !Array.isArray(model.supportedGenerationMethods) ||
      !model.supportedGenerationMethods.includes('generateContent')
    )
      return [];
    return [model.name.slice('models/'.length)];
  });
}

// Only Google's fixed HTTPS host can receive this credential. Never follow redirects.
// ListModels does not generate content or establish that a model has chat/tools/quota access.
export async function loadGeminiModels(key: string, fetcher: typeof fetch = fetch) {
  if (!key.trim()) throw new Error('Enter a Gemini API key first, or save a Gemini connection.');
  const ids = new Set<string>();
  let pageToken = '';
  const signal = AbortSignal.timeout(15000);
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${GEMINI_ORIGIN}/v1beta/models`);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { 'x-goog-api-key': key.trim() },
        redirect: 'error',
        cache: 'no-store',
        signal,
      });
    } catch {
      throw new Error(
        'Could not reach the Gemini model catalog. Check your internet connection and try again.',
      );
    }
    if (!response.ok) {
      if (response.status === 404)
        throw new Error(
          'The Gemini model catalog returned 404. Try again later or enter a current text model ID from Google AI Studio.',
        );
      throw new Error(providerError(response.status, GEMINI_BASE_URL));
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error('Gemini returned an invalid model catalog. Try again later.');
    }
    for (const id of geminiModelIds(body)) ids.add(id);
    if (!body?.nextPageToken) {
      if (!ids.size)
        throw new Error(
          'Google returned no Gemini generation models for this key. Check the key and project in Google AI Studio.',
        );
      return [...ids].sort();
    }
    if (typeof body.nextPageToken !== 'string' || body.nextPageToken.length > 4096) break;
    pageToken = body.nextPageToken;
  }
  throw new Error(
    'The Gemini model catalog could not be fully loaded. Try again or enter a current model ID from Google AI Studio.',
  );
}
