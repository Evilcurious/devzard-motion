import { getProviderKeys } from './provider-credentials';
import {
  canonicalModelKey,
  getRouterProvider,
  routerModelIds,
  routerProviders,
  type RouterModel,
  type RouterProviderId,
} from './model-router';

type ProviderModel = ReturnType<typeof routerModelIds>[number] & {
  providerId: RouterProviderId;
  providerName: string;
};
export type RouterCatalog = {
  models: RouterModel[];
  providers: Array<{
    providerId: string;
    modelCount: number;
    listedCount: number;
    error: string | null;
  }>;
  refreshedAt: string;
  metricsNote: string;
};
type ProviderLoad = {
  providerId: RouterProviderId;
  error: string | null;
  models: ProviderModel[];
};
type CachedCatalog = typeof globalThis & {
  relayRouterCatalog?: { at: number; result: RouterCatalog };
};
const catalogCache = globalThis as CachedCatalog;
type CooldownGlobal = typeof globalThis & { relayRouterCooldowns?: Map<string, number> };
const cooldownCache = globalThis as CooldownGlobal;
const CACHE_MS = 45_000;

export function markRouterTargetDepleted(target: {
  providerId: RouterProviderId;
  modelId: string;
}) {
  const cooldowns = (cooldownCache.relayRouterCooldowns ||= new Map());
  cooldowns.set(`${target.providerId}::${target.modelId}`, Date.now() + 5 * 60_000);
}

export function isRouterTargetDepleted(target: { providerId: RouterProviderId; modelId: string }) {
  const key = `${target.providerId}::${target.modelId}`;
  const cooldowns = cooldownCache.relayRouterCooldowns;
  const until = cooldowns?.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns?.delete(key);
    return false;
  }
  return true;
}

async function requestJSON(url: string, apiKey: string, timeoutMs = 6000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) throw new Error('Provider returned a non-JSON response.');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverOllamaCloudProvider(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderLoad> {
  const provider = getRouterProvider('ollama-cloud')!;
  const models = new Map<string, ProviderModel>();
  let lastError: unknown;
  // Ollama Cloud exposes both its OpenAI-compatible model listing and the standard
  // Ollama tags endpoint. Some account/model configurations populate only one list.
  for (const endpoint of ['https://ollama.com/v1/models', 'https://ollama.com/api/tags']) {
    try {
      const response = await fetcher(endpoint, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`Ollama Cloud returned HTTP ${response.status}.`);
      if (!(response.headers.get('content-type') || '').includes('json'))
        throw new Error('Ollama Cloud returned a non-JSON model list.');
      const body = await response.json();
      for (const model of routerModelIds(body)) {
        const previous = models.get(model.id);
        models.set(model.id, {
          ...previous,
          ...model,
          contextTokens: model.contextTokens ?? previous?.contextTokens ?? null,
          availableTokens: model.availableTokens ?? previous?.availableTokens ?? null,
          supportsTools: model.supportsTools ?? previous?.supportsTools ?? null,
          isFree: model.isFree || previous?.isFree || false,
          providerId: 'ollama-cloud',
          providerName: provider.name,
        });
      }
    } catch (error) {
      lastError = error;
      // Do not let a fallback endpoint turn a rejected credential into a successful listing.
      if (error instanceof Error && /HTTP (401|403)/.test(error.message)) break;
    }
  }
  if (models.size) return { providerId: 'ollama-cloud', error: null, models: [...models.values()] };
  return {
    providerId: 'ollama-cloud',
    error: lastError instanceof Error ? lastError.message.slice(0, 240) : null,
    models: [],
  };
}

export async function discoverGeminiProvider(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderLoad> {
  const provider = getRouterProvider('gemini')!;
  const models: ProviderModel[] = [];
  let pageToken = '';
  try {
    for (let page = 0; page < 10; page++) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`Google Gemini API returned HTTP ${response.status}.`);
      if (!(response.headers.get('content-type') || '').includes('json'))
        throw new Error('Google Gemini API returned a non-JSON model list.');
      const body = await response.json();
      const entries = Array.isArray(body?.models) ? body.models : [];
      for (const item of entries.slice(0, 2000)) {
        if (!item || typeof item !== 'object') continue;
        const name = typeof item.name === 'string' ? item.name : '';
        const id = name.replace(/^models\//, '');
        if (
          !/^gemini-[\w.-]{1,180}$/.test(id) ||
          !Array.isArray(item.supportedGenerationMethods) ||
          !item.supportedGenerationMethods.includes('generateContent')
        )
          continue;
        const normalized = routerModelIds({
          models: [
            {
              id,
              name: typeof item.displayName === 'string' ? item.displayName : id,
              context_length: item.inputTokenLimit,
              available_tokens:
                item.availableTokens ??
                item.available_tokens ??
                item.remainingTokens ??
                item.remaining_tokens,
              is_free: item.isFree === true || item.is_free === true || item.free === true,
              pricing: item.pricing,
            },
          ],
        })[0];
        if (normalized)
          models.push({ ...normalized, providerId: 'gemini', providerName: provider.name });
      }
      if (typeof body?.nextPageToken !== 'string' || !body.nextPageToken) break;
      if (body.nextPageToken.length > 4096)
        throw new Error('Google returned an invalid page token.');
      pageToken = body.nextPageToken;
    }
    return { providerId: 'gemini', error: null, models };
  } catch (error) {
    return {
      providerId: 'gemini',
      error: error instanceof Error ? error.message.slice(0, 240) : 'Could not load Google models.',
      models: [],
    };
  }
}

async function discoverProvider(providerId: RouterProviderId): Promise<ProviderLoad> {
  const provider = getRouterProvider(providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL)
    return { providerId, error: null, models: [] };
  const keys = await getProviderKeys(provider.id);
  if (provider.keyRequired && !keys.length) return { providerId, error: null, models: [] };
  if (provider.id === 'ollama-cloud') {
    const results = await Promise.all(keys.map((key) => discoverOllamaCloudProvider(key)));
    const models = new Map<string, ProviderModel>();
    for (const result of results) for (const model of result.models) models.set(model.id, model);
    return {
      providerId,
      error: models.size ? null : results.find((result) => result.error)?.error || null,
      models: [...models.values()],
    };
  }
  if (provider.id === 'gemini') {
    const results = await Promise.all(keys.map((key) => discoverGeminiProvider(key)));
    const models = new Map<string, ProviderModel>();
    for (const result of results) for (const model of result.models) models.set(model.id, model);
    return {
      providerId,
      error: models.size ? null : results.find((result) => result.error)?.error || null,
      models: [...models.values()],
    };
  }

  const endpoint = provider.modelsPath
    ? new URL(provider.modelsPath, provider.baseURL).toString()
    : `${provider.baseURL.replace(/\/$/, '')}/models`;
  let lastError: unknown;
  for (const apiKey of keys.length ? keys : ['']) {
    const headers = new Headers({ Accept: 'application/json' });
    if (provider.id === 'aihorde') headers.set('Authorization', `Bearer ${apiKey || '0000000000'}`);
    else if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
    if (provider.userAgent) headers.set('User-Agent', provider.userAgent);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`${provider.name} returned HTTP ${response.status}.`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json'))
        throw new Error(`${provider.name} returned a non-JSON model list.`);
      const body = await response.json();
      const models = routerModelIds(body).map((model) => ({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
      }));
      return { providerId, error: null, models };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    providerId,
    error: lastError instanceof Error ? lastError.message.slice(0, 240) : 'Could not load models.',
    models: [],
  };
}

async function openRouterPaidAccess(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const [creditsBody, keyBody] = await Promise.all([
      requestJSON('https://openrouter.ai/api/v1/credits', apiKey),
      requestJSON('https://openrouter.ai/api/v1/key', apiKey),
    ]);
    const credits =
      creditsBody && typeof creditsBody === 'object' && 'data' in creditsBody
        ? (creditsBody as { data?: Record<string, unknown> }).data
        : undefined;
    const key =
      keyBody && typeof keyBody === 'object' && 'data' in keyBody
        ? (keyBody as { data?: Record<string, unknown> }).data
        : undefined;
    const total = Number(credits?.total_credits);
    const used = Number(credits?.total_usage);
    const keyRemaining = key?.limit_remaining;
    const balanceKnown = Number.isFinite(total) && Number.isFinite(used);
    const balanceRemaining = balanceKnown ? total - used : null;
    const keyRemainingNumber =
      keyRemaining === null || keyRemaining === undefined ? null : Number(keyRemaining);
    const keyLimitEmpty =
      keyRemainingNumber !== null && Number.isFinite(keyRemainingNumber) && keyRemainingNumber <= 0;
    return !keyLimitEmpty && balanceRemaining !== null && balanceRemaining > 0;
  } catch {
    return false;
  }
}

function withoutDepletedModels(result: RouterCatalog): RouterCatalog {
  const counts = new Map<string, number>();
  const models = result.models.flatMap((model) => {
    const providers = model.providers.filter(
      (provider) => !isRouterTargetDepleted({ providerId: provider.id, modelId: provider.modelId }),
    );
    for (const provider of providers) counts.set(provider.id, (counts.get(provider.id) || 0) + 1);
    return providers.length ? [{ ...model, providers }] : [];
  });
  return {
    ...result,
    models,
    providers: result.providers.map((provider) => ({
      ...provider,
      modelCount: counts.get(provider.providerId) || 0,
    })),
  };
}

export async function discoverRouterCatalog(forceRefresh = false): Promise<RouterCatalog> {
  const cached = catalogCache.relayRouterCatalog;
  if (!forceRefresh && cached && Date.now() - cached.at < CACHE_MS)
    return withoutDepletedModels(cached.result);

  const providerIds = routerProviders
    .filter((provider) => provider.category === 'models')
    .map((provider) => provider.id);
  const settled = await Promise.all(providerIds.map(discoverProvider));
  const openRouterKeys = await getProviderKeys('openrouter');
  const openRouterPaid = (await Promise.all(openRouterKeys.map(openRouterPaidAccess))).some(
    Boolean,
  );
  const grouped = new Map<string, RouterModel>();
  const eligibleCounts = new Map<RouterProviderId, number>();

  for (const result of settled) {
    for (const model of result.models) {
      // Only keep models the authenticated catalog explicitly marks free or reports
      // positive model-specific tokens for. OpenRouter paid access is additionally
      // bounded by its live account and API-key credit limits.
      if (isRouterTargetDepleted({ providerId: model.providerId, modelId: model.id })) continue;
      const free = model.isFree === true;
      const hasTokens = model.availableTokens !== null && model.availableTokens > 0;
      if (!free && !hasTokens && !(result.providerId === 'openrouter' && openRouterPaid)) continue;
      if (model.availableTokens === 0) continue;
      eligibleCounts.set(result.providerId, (eligibleCounts.get(result.providerId) || 0) + 1);
      const key = canonicalModelKey(model.id);
      const existing = grouped.get(key);
      const providerEntry = {
        id: model.providerId,
        name: model.providerName,
        modelId: model.id,
        contextTokens: model.contextTokens,
        availableTokens: model.availableTokens,
        supportsTools: model.supportsTools,
        isFree: model.isFree,
      };
      if (existing) {
        existing.providers.push(providerEntry);
        existing.contextTokens =
          existing.contextTokens === null || model.contextTokens === null
            ? (existing.contextTokens ?? model.contextTokens)
            : Math.max(existing.contextTokens, model.contextTokens);
        existing.availableTokens =
          existing.availableTokens === null || model.availableTokens === null
            ? null
            : existing.availableTokens + model.availableTokens;
        existing.isFree = existing.isFree || model.isFree;
      } else {
        grouped.set(key, {
          key,
          id: model.id,
          name: model.name,
          providers: [providerEntry],
          contextTokens: model.contextTokens,
          availableTokens: model.availableTokens,
          isFree: model.isFree,
        });
      }
    }
  }
  const result: RouterCatalog = {
    models: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name)),
    providers: settled.map(({ providerId, error, models }) => ({
      providerId,
      modelCount: eligibleCounts.get(providerId) || 0,
      listedCount: models.length,
      error,
    })),
    refreshedAt: new Date().toISOString(),
    metricsNote:
      'Only authenticated model listings explicitly marked free, reporting positive remaining tokens, or (for OpenRouter) backed by positive account/key credits are shown. Token and credit values are provider-reported snapshots.',
  };
  catalogCache.relayRouterCatalog = { at: Date.now(), result };
  return withoutDepletedModels(result);
}
