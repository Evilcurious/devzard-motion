import { createHash } from 'node:crypto';
import {
  normalizeOpenRouterAccountBalance,
  normalizeSiliconFlowAccountBalance,
} from './router-account-balance';
import { fetchFreeLlmCatalog, type FreeLlmCatalogModel } from './freellmapi-catalog';
import { getAdminProviderKeys, getProviderKeys, getOwnProviderKeys } from './provider-credentials';
import { getPrincipal } from './security';
import {
  canonicalModelKey,
  getRouterProvider,
  hasPositiveAccountCredits,
  routerModelIds,
  routerProviders,
  type RouterModel,
  type RouterProviderId,
} from './model-router';

type ProviderModel = ReturnType<typeof routerModelIds>[number] & {
  providerId: RouterProviderId;
  providerName: string;
  accountCreditsAvailable?: boolean;
  authenticatedListing?: boolean;
  monthlyTokenBudget?: string | null;
  supportsVision?: boolean | null;
};
export type RouterCatalog = {
  models: RouterModel[];
  providers: Array<{
    providerId: string;
    modelCount: number;
    listedCount: number;
    error: string | null;
    accountBalanceLabel?: string | null;
  }>;
  refreshedAt: string;
  sourceCatalog?: { version: string; generatedAt: string; tier: 'live' | 'monthly' } | null;
  sourceCatalogError?: string | null;
  metricsNote: string;
};
type ProviderLoad = {
  providerId: RouterProviderId;
  error: string | null;
  models: ProviderModel[];
};

type ProviderEligibility = {
  isFree: boolean;
  availableTokens: number | null;
  accountCreditsAvailable?: boolean;
  authenticatedListing?: boolean;
};

export function isEligibleProviderModel(
  providerId: RouterProviderId,
  model: ProviderEligibility,
  options: { openRouterPaid?: boolean; personalOpenAI?: boolean } = {},
) {
  return (
    model.isFree ||
    (model.availableTokens !== null && model.availableTokens > 0) ||
    (model.accountCreditsAvailable === true && providerId !== 'openrouter') ||
    (model.authenticatedListing === true && providerId !== 'ollama-cloud') ||
    (providerId === 'openrouter' && options.openRouterPaid === true) ||
    options.personalOpenAI === true ||
    // BluesMinds returns the models available to the authenticated API key but may
    // omit quota metadata. Allow the account-listed IDs so users can choose one;
    // provider usage/charges still apply and Relay enforces reported token usage.
    providerId === 'bluesminds'
  );
}
type CachedCatalog = typeof globalThis & {
  relayRouterCatalogs?: Map<string, { at: number; result: RouterCatalog }>;
};
const catalogCache = globalThis as CachedCatalog;
type CooldownGlobal = typeof globalThis & { relayRouterCooldowns?: Map<string, number> };
const cooldownCache = globalThis as CooldownGlobal;
type ProviderCooldownGlobal = typeof globalThis & { relayProviderCooldowns?: Map<string, number> };
const providerCooldownCache = globalThis as ProviderCooldownGlobal;
const CACHE_MS = 45_000;
const OLLAMA_FREE_USAGE_MODELS = new Set([
  'beam',
  'gemma4:31b',
  'gpt-oss:120b',
  'gpt-oss:20b',
  'nemotron-3-nano:30b',
  'nemotron-3-super',
  'nemotron-3-ultra',
]);

function isOllamaFreeUsageModel(modelId: string) {
  const id = canonicalModelKey(modelId).replace(/^library\//, '');
  return (
    OLLAMA_FREE_USAGE_MODELS.has(id) || OLLAMA_FREE_USAGE_MODELS.has(id.replace(/:latest$/, ''))
  );
}

type OllamaCloudBalance = {
  includedCreditsAvailable: boolean;
  purchasedCreditsAvailable: boolean;
  error: string | null;
};
const ollamaBalanceCache = new Map<string, { at: number; value: OllamaCloudBalance }>();
const OLLAMA_BALANCE_CACHE_MS = 60_000;

function positiveAmount(record: unknown, key: string) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const value = (record as Record<string, unknown>)[key];
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0;
}

function ollamaCloudBalance(body: unknown): OllamaCloudBalance {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return {
      includedCreditsAvailable: false,
      purchasedCreditsAvailable: false,
      error: 'Ollama Cloud returned an invalid balance response.',
    };
  const response = body as Record<string, unknown>;
  const included = response.included;
  const includedRecord =
    included && typeof included === 'object' && !Array.isArray(included)
      ? (included as Record<string, unknown>)
      : {};
  const legacyIncluded =
    positiveAmount(includedRecord.session, 'remaining_percent') ||
    positiveAmount(includedRecord.weekly, 'remaining_percent');
  return {
    includedCreditsAvailable: positiveAmount(included, 'balance_usd') || legacyIncluded,
    purchasedCreditsAvailable: positiveAmount(response.purchased, 'balance_usd'),
    error: null,
  };
}

export function applyOllamaCloudBalance(
  models: ProviderModel[],
  balance: OllamaCloudBalance,
): ProviderModel[] {
  return models.map((model) => ({
    ...model,
    isFree: model.isFree || (balance.includedCreditsAvailable && isOllamaFreeUsageModel(model.id)),
    accountCreditsAvailable: model.accountCreditsAvailable || balance.purchasedCreditsAvailable,
  }));
}

export function markRouterTargetDepleted(
  target: { providerId: RouterProviderId; modelId: string },
  accountId = 'owner',
  cooldownMs = 5 * 60_000,
) {
  const cooldowns = (cooldownCache.relayRouterCooldowns ||= new Map());
  cooldowns.set(
    `${accountId}::${target.providerId}::${target.modelId}`,
    Date.now() + Math.max(1000, Math.min(60 * 60_000, cooldownMs)),
  );
}

export function isRouterTargetDepleted(
  target: { providerId: RouterProviderId; modelId: string },
  accountId = 'owner',
) {
  const key = `${accountId}::${target.providerId}::${target.modelId}`;
  const cooldowns = cooldownCache.relayRouterCooldowns;
  const until = cooldowns?.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns?.delete(key);
    return false;
  }
  return true;
}

export function markRouterProviderDepleted(
  providerId: RouterProviderId,
  accountId = 'owner',
  cooldownMs = 5 * 60_000,
) {
  const cooldowns = (providerCooldownCache.relayProviderCooldowns ||= new Map());
  cooldowns.set(
    `${accountId}::${providerId}`,
    Date.now() + Math.max(1000, Math.min(60 * 60_000, cooldownMs)),
  );
}

export function isRouterProviderDepleted(providerId: RouterProviderId, accountId = 'owner') {
  const key = `${accountId}::${providerId}`;
  const cooldowns = providerCooldownCache.relayProviderCooldowns;
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
      const accountCreditsAvailable = hasPositiveAccountCredits(body);
      for (const model of routerModelIds(body)) {
        const previous = models.get(model.id);
        models.set(model.id, {
          ...previous,
          ...model,
          contextTokens: model.contextTokens ?? previous?.contextTokens ?? null,
          availableTokens: model.availableTokens ?? previous?.availableTokens ?? null,
          supportsTools: model.supportsTools ?? previous?.supportsTools ?? null,
          isFree: model.isFree || previous?.isFree || false,
          accountCreditsAvailable:
            accountCreditsAvailable || previous?.accountCreditsAvailable || false,
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

export async function discoverOllamaCloudBalance(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<OllamaCloudBalance> {
  const cacheKey = createHash('sha256').update(apiKey).digest('hex');
  const cached = ollamaBalanceCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OLLAMA_BALANCE_CACHE_MS) return cached.value;

  let result: OllamaCloudBalance = {
    includedCreditsAvailable: false,
    purchasedCreditsAvailable: false,
    error: null,
  };
  try {
    const response = await fetcher('https://ollama.com/api/balance', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      result.error = `Ollama Cloud balance API returned HTTP ${response.status}.`;
    } else if (!(response.headers.get('content-type') || '').includes('json')) {
      result.error = 'Ollama Cloud returned a non-JSON balance response.';
    } else {
      result = ollamaCloudBalance(await response.json());
    }
  } catch {
    // Keep discovery safe and never return upstream balance details or credentials.
    result.error = 'Could not read the Ollama Cloud account balance.';
  }
  ollamaBalanceCache.set(cacheKey, { at: Date.now(), value: result });
  return result;
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
      const accountCreditsAvailable = hasPositiveAccountCredits(body);
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
          models.push({
            ...normalized,
            providerId: 'gemini',
            providerName: provider.name,
            accountCreditsAvailable,
          });
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

async function discoverProvider(
  providerId: RouterProviderId,
  credentials?: string[],
): Promise<ProviderLoad> {
  const provider = getRouterProvider(providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL)
    return { providerId, error: null, models: [] };
  const keys = credentials ?? (await getProviderKeys(provider.id));
  if (provider.keyRequired && !keys.length) return { providerId, error: null, models: [] };
  if (provider.id === 'ollama-cloud') {
    const results = await Promise.all(
      keys.map(async (key) => {
        const result = await discoverOllamaCloudProvider(key);
        if (!result.models.length) return result;
        const balance = await discoverOllamaCloudBalance(key);
        return {
          ...result,
          error: result.error || balance.error,
          models: applyOllamaCloudBalance(result.models, balance),
        };
      }),
    );
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
    for (const result of results)
      for (const model of result.models)
        models.set(model.id, { ...model, authenticatedListing: true });
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
      const accountCreditsAvailable = hasPositiveAccountCredits(body);
      const models = routerModelIds(body).map((model) => ({
        ...model,
        providerId: provider.id,
        providerName: provider.name,
        accountCreditsAvailable,
        authenticatedListing: keys.length > 0,
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

async function openRouterAccountBalance(apiKey: string) {
  if (!apiKey) return { eligible: false, label: null };
  try {
    const [creditsBody, keyBody] = await Promise.all([
      requestJSON('https://openrouter.ai/api/v1/credits', apiKey),
      requestJSON('https://openrouter.ai/api/v1/key', apiKey),
    ]);
    return normalizeOpenRouterAccountBalance(creditsBody, keyBody);
  } catch {
    return { eligible: false, label: null };
  }
}

async function siliconFlowAccountBalance(apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  try {
    return normalizeSiliconFlowAccountBalance(
      await requestJSON('https://api.siliconflow.com/v1/user/info', apiKey),
    );
  } catch {
    return null;
  }
}

function withoutDepletedModels(result: RouterCatalog, accountId: string): RouterCatalog {
  const counts = new Map<string, number>();
  const models = result.models.flatMap((model) => {
    const providers = model.providers.filter(
      (provider) =>
        !isRouterProviderDepleted(provider.id, accountId) &&
        !isRouterTargetDepleted({ providerId: provider.id, modelId: provider.modelId }, accountId),
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
  const principal = await getPrincipal();
  const accountId = principal?.id || 'owner';
  const catalogs =
    catalogCache.relayRouterCatalogs || (catalogCache.relayRouterCatalogs = new Map());
  const cached = catalogs.get(accountId);
  if (!forceRefresh && cached && Date.now() - cached.at < CACHE_MS)
    return withoutDepletedModels(cached.result, accountId);

  const providerIds = routerProviders
    .filter((provider) => provider.category === 'models')
    .map((provider) => provider.id);
  const discoveryKeys = async (providerId: RouterProviderId) => {
    if (principal?.role !== 'user') return undefined;
    const own = await getOwnProviderKeys(providerId);
    if (
      principal.plan !== 'premium' ||
      (principal.modelAccess !== 'all' &&
        !principal.allowedModels.some((model) => model.providerId === providerId))
    )
      return own;
    const admin = await getAdminProviderKeys(providerId);
    return [...new Set([...own, ...admin])];
  };
  const [settled, sourceCatalog] = await Promise.all([
    Promise.all(
      providerIds.map(async (providerId) =>
        discoverProvider(providerId, await discoveryKeys(providerId)),
      ),
    ),
    fetchFreeLlmCatalog().catch(() => null),
  ]);
  const sourceModels = new Map<string, FreeLlmCatalogModel>();
  const sourceProviderAliases: Record<string, RouterProviderId> = {
    google: 'gemini',
    ollama: 'ollama-cloud',
    opencode: 'opencode-zen',
    septor: 'septorlabs',
  };
  for (const model of sourceCatalog?.models || []) {
    const providerId = sourceProviderAliases[model.platform] || model.platform;
    sourceModels.set(`${providerId}::${canonicalModelKey(model.modelId)}`, model);
  }
  const [openRouterKeys, siliconFlowKeys] = await Promise.all([
    principal?.role === 'user' ? getOwnProviderKeys('openrouter') : getProviderKeys('openrouter'),
    principal?.role === 'user' ? getOwnProviderKeys('siliconflow') : getProviderKeys('siliconflow'),
  ]);
  const [openRouterBalances, siliconFlowBalances] = await Promise.all([
    Promise.all(openRouterKeys.map(openRouterAccountBalance)),
    Promise.all(siliconFlowKeys.map(siliconFlowAccountBalance)),
  ]);
  const openRouterPaid = openRouterBalances.some((balance) => balance.eligible);
  const openRouterBalanceLabel =
    [...new Set(openRouterBalances.map((balance) => balance.label).filter(Boolean))].join(' · ') ||
    null;
  const siliconFlowBalanceLabel =
    [...new Set(siliconFlowBalances.filter(Boolean))].join(' · ') || null;
  const grouped = new Map<string, RouterModel>();
  const eligibleCounts = new Map<RouterProviderId, number>();

  for (const result of settled) {
    if (isRouterProviderDepleted(result.providerId, accountId)) continue;
    for (const model of result.models) {
      // Account-authenticated model listings are selectable even when a provider
      // omits quota metadata; the provider remains the source of truth for billing/access.
      // Ollama Cloud keeps its stricter free-usage/purchased-credit eligibility rules.
      if (isRouterTargetDepleted({ providerId: model.providerId, modelId: model.id }, accountId))
        continue;
      const personalOpenAI = principal?.role === 'user' && result.providerId === 'openai';
      if (
        !isEligibleProviderModel(result.providerId, model, {
          openRouterPaid,
          personalOpenAI,
        })
      )
        continue;
      if (model.availableTokens === 0) continue;
      eligibleCounts.set(result.providerId, (eligibleCounts.get(result.providerId) || 0) + 1);
      const key = canonicalModelKey(model.id);
      const sourceModel = sourceModels.get(`${model.providerId}::${key}`);
      const contextTokens = model.contextTokens ?? sourceModel?.contextWindow ?? null;
      const supportsTools = model.supportsTools ?? sourceModel?.supportsTools ?? null;
      const existing = grouped.get(key);
      const providerEntry = {
        id: model.providerId,
        name: model.providerName,
        modelId: model.id,
        contextTokens,
        availableTokens: model.availableTokens,
        supportsTools,
        supportsVision: sourceModel?.supportsVision ?? null,
        monthlyTokenBudget: sourceModel?.monthlyTokenBudget ?? null,
        isFree: model.isFree,
        accountCreditsAvailable:
          (model.accountCreditsAvailable === true && result.providerId !== 'openrouter') ||
          (result.providerId === 'openrouter' && openRouterPaid),
      };
      if (existing) {
        existing.providers.push(providerEntry);
        existing.contextTokens =
          existing.contextTokens === null || contextTokens === null
            ? (existing.contextTokens ?? contextTokens)
            : Math.max(existing.contextTokens, contextTokens);
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
          contextTokens,
          availableTokens: model.availableTokens,
          isFree: model.isFree,
        });
      }
    }
  }
  if (principal?.role === 'user') {
    for (const allowed of principal.allowedModels) {
      const providerId = allowed.providerId as RouterProviderId;
      const provider = getRouterProvider(providerId);
      if (!provider || provider.category !== 'models') continue;
      const key = canonicalModelKey(allowed.modelId);
      const existing = grouped.get(key);
      const providerEntry = {
        id: providerId,
        name: 'Admin-managed model',
        modelId: allowed.modelId,
        contextTokens: null,
        availableTokens: null,
        supportsTools: null,
        isFree: false,
      };
      if (existing) {
        if (
          !existing.providers.some(
            (item) => item.id === providerId && item.modelId === allowed.modelId,
          )
        )
          existing.providers.push(providerEntry);
      } else {
        grouped.set(key, {
          key,
          id: allowed.modelId,
          name: allowed.name || allowed.modelId,
          providers: [providerEntry],
          contextTokens: null,
          availableTokens: null,
          isFree: false,
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
      accountBalanceLabel:
        providerId === 'openrouter'
          ? openRouterBalanceLabel
          : providerId === 'siliconflow'
            ? siliconFlowBalanceLabel
            : null,
    })),
    refreshedAt: new Date().toISOString(),
    sourceCatalog: sourceCatalog
      ? {
          version: sourceCatalog.version,
          generatedAt: sourceCatalog.generatedAt,
          tier: sourceCatalog.tier,
        }
      : null,
    sourceCatalogError: sourceCatalog
      ? null
      : 'The signed FreeLLMAPI metadata feed could not be refreshed; live provider model listings remain available.',
    metricsNote:
      'Models returned by a connected provider API key are listed even when quota metadata is omitted; paid access, billing and request limits remain controlled by that provider. Unauthenticated catalogs require explicit free access or positive quota/credit signals. Ollama Cloud uses its documented free-usage or positive-credit eligibility rules. Provider-reported quota errors can temporarily mark a model unavailable.',
  };
  catalogs.set(accountId, { at: Date.now(), result });
  return withoutDepletedModels(result, accountId);
}
