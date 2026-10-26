import { readConnection } from './connection-store';
import { getRouterProvider, type RouterProviderId } from './model-router';
import { isOpenRouterEndpoint } from './ai-errors';
import type { ModelSettings } from './ai';

type ProviderCredential = { apiKey: string };
export type RouterTarget = { providerId: RouterProviderId; modelId: string };
export type ResolvedTarget = {
  providerId: RouterProviderId;
  analyticsProviderId?: string;
  model: string;
  baseURL: string;
  key: string;
  supportsTools?: boolean;
};

export async function resolveRouterTarget(target: RouterTarget): Promise<ResolvedTarget> {
  const provider = getRouterProvider(target.providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL) {
    throw new Error('The selected model provider is not supported.');
  }
  const saved = await readConnection<ProviderCredential>(`router-provider-${provider.id}`);
  const legacy = provider.id === 'openrouter' ? await readConnection<ModelSettings>('model') : null;
  const legacyKey =
    legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || '')
      ? legacy.key || ''
      : '';
  const apiKey = saved?.apiKey || legacyKey;
  if (provider.keyRequired && !apiKey) {
    throw new Error(`${provider.name} needs an API key before it can be used.`);
  }
  return {
    providerId: provider.id,
    analyticsProviderId: provider.id,
    model: target.modelId,
    baseURL: provider.baseURL.replace(/\/$/, ''),
    key: apiKey || (provider.id === 'aihorde' ? '0000000000' : ''),
    ...(provider.id === 'aihorde' ? { supportsTools: false } : {}),
  };
}
