import { GEMINI_BASE_URL, OPENROUTER_BASE_URL, FREELLMAPI_BASE_URL } from './ai-presets';

export function isGeminiEndpoint(baseURL: string) {
  return baseURL.trim().replace(/\/$/, '') === GEMINI_BASE_URL;
}

export function isOpenRouterEndpoint(baseURL: string) {
  return baseURL.trim().replace(/\/$/, '') === OPENROUTER_BASE_URL;
}

export function isFreeLLMAPIEndpoint(baseURL: string) {
  return baseURL.trim().replace(/\/$/, '') === FREELLMAPI_BASE_URL;
}

// Never expose upstream error bodies, keys, or URLs supplied by a provider.
export function providerError(status: number, baseURL: string) {
  const gemini = isGeminiEndpoint(baseURL);
  if (status === 404)
    return gemini
      ? 'Gemini returned 404: the requested model or API route was not found. In Settings → AI model, click Load Gemini models, choose a text/chat model, then Save connection and Test saved connection. A listed model may not support the OpenAI-compatible API. Changing .env.local will not override a saved model.'
      : 'The AI provider returned 404: the model or API route was not found. Check the model name and OpenAI-compatible base URL in Settings, then Save connection and Test saved connection.';
  if (status === 401)
    return 'Your AI API key was rejected (401). Enter the correct key in Settings and save the connection.';
  if (status === 402)
    return 'The AI provider requires account credits or plan access (402). Check whether your selected model is free and available to your account.';
  if (status === 403)
    return 'The AI provider denied access (403). Check the API key restrictions, project permissions and model access with your provider.';
  if (status === 429)
    return 'The AI provider rate limit or quota was exceeded (429). Check usage and billing with your provider, or wait before retrying.';
  if (status === 400)
    return 'The AI provider rejected the request (400). Check the model and its support for chat, generation parameters and tools. Try Test saved connection in Settings.';
  if (status >= 500)
    return `The AI provider is having a server error (${status}). Try again later.`;
  return `The AI provider returned ${status}. Check your saved model connection in Settings.`;
}
