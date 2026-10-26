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
  providers: Array<{ providerId: string; modelCount: number; error: string | null }>;
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

async function discoverProvider(providerId: RouterProviderId): Promise<ProviderLoad> {
  const provider = getRouterProvider(providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL)
    return { providerId, error: null, models: [] };
  const keys = await getProviderKeys(provider.id);
  if (provider.keyRequired && !keys.length) return { providerId, error: null, models: [] };

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
    providers: settled.map(({ providerId, error }) => ({
      providerId,
      modelCount: eligibleCounts.get(providerId) || 0,
      error,
    })),
    refreshedAt: new Date().toISOString(),
    metricsNote:
      'Only authenticated model listings explicitly marked free, reporting positive remaining tokens, or (for OpenRouter) backed by positive account/key credits are shown. Token and credit values are provider-reported snapshots.',
  };
  catalogCache.relayRouterCatalog = { at: Date.now(), result };
  return withoutDepletedModels(result);
}
