import { guard, errorResponse } from '@/lib/security';
import { readConnection } from '@/lib/connection-store';
import { isOpenRouterEndpoint } from '@/lib/ai-errors';
import type { ModelSettings } from '@/lib/ai';
import {
  canonicalModelKey,
  getRouterProvider,
  routerModelIds,
  routerProviders,
  type RouterModel,
} from '@/lib/model-router';

type ProviderCredential = { apiKey: string };

async function loadProviderModels(providerId: string) {
  const provider = getRouterProvider(providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL) return [];
  const credential = await readConnection<ProviderCredential>(`router-provider-${provider.id}`);
  const legacy = provider.id === 'openrouter' ? await readConnection<ModelSettings>('model') : null;
  const legacyKey =
    legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || '')
      ? legacy.key || ''
      : '';
  const apiKey = credential?.apiKey || legacyKey;
  if (provider.keyRequired && !apiKey) return [];
  const endpoint = provider.modelsPath
    ? new URL(provider.modelsPath, provider.baseURL).toString()
    : `${provider.baseURL.replace(/\/$/, '')}/models`;
  const headers = new Headers({ Accept: 'application/json' });
  if (provider.id === 'aihorde') headers.set('Authorization', `Bearer ${apiKey || '0000000000'}`);
  else if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
  if (provider.userAgent) headers.set('User-Agent', provider.userAgent);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
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
    return routerModelIds(await response.json()).map((model) => ({
      ...model,
      providerId: provider.id,
      providerName: provider.name,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    await guard();
    const settled = await Promise.all(
      routerProviders
        .filter((provider) => provider.category === 'models')
        .map(async (provider) => {
          try {
            return {
              providerId: provider.id,
              error: null,
              models: await loadProviderModels(provider.id),
            };
          } catch (error) {
            return {
              providerId: provider.id,
              error:
                error instanceof Error ? error.message.slice(0, 240) : 'Could not load models.',
              models: [],
            };
          }
        }),
    );
    const grouped = new Map<string, RouterModel>();
    for (const result of settled) {
      for (const model of result.models) {
        const key = canonicalModelKey(model.id);
        const existing = grouped.get(key);
        const providerEntry = {
          id: model.providerId,
          name: model.providerName,
          modelId: model.id,
          contextTokens: model.contextTokens,
          availableTokens: model.availableTokens,
          supportsTools: model.supportsTools,
        };
        if (existing) {
          existing.providers.push(providerEntry);
          existing.contextTokens =
            existing.contextTokens === null || model.contextTokens === null
              ? (existing.contextTokens ?? model.contextTokens)
              : Math.max(existing.contextTokens, model.contextTokens);
          // This field is only present when the provider explicitly returned a quota-like value.
          existing.availableTokens =
            existing.availableTokens === null || model.availableTokens === null
              ? null
              : existing.availableTokens + model.availableTokens;
        } else {
          grouped.set(key, {
            key,
            id: model.id,
            name: model.name,
            providers: [providerEntry],
            contextTokens: model.contextTokens,
            availableTokens: model.availableTokens,
          });
        }
      }
    }
    const providerStates = settled.map(({ providerId, error, models }) => ({
      providerId,
      modelCount: models.length,
      error,
    }));
    return Response.json({
      models: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name)),
      providers: providerStates,
      refreshedAt: new Date().toISOString(),
      metricsNote:
        'Context length is a model limit, not your account quota. Quota is shown only when explicitly returned by a provider.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
