import { getRouterProvider, type RouterProviderId, type RouterTarget } from './model-router';
import { getProviderKeys } from './provider-credentials';

export type ResolvedTarget = {
  providerId: RouterProviderId;
  analyticsProviderId?: string;
  model: string;
  baseURL: string;
  key: string;
  apiKeys?: string[];
  supportsTools?: boolean;
};

export async function resolveRouterTarget(target: RouterTarget): Promise<ResolvedTarget> {
  const provider = getRouterProvider(target.providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL) {
    throw new Error('The selected model provider is not supported.');
  }
  const apiKeys = await getProviderKeys(provider.id);
  const apiKey = apiKeys[0] || '';
  if (provider.keyRequired && !apiKey) {
    throw new Error(`${provider.name} needs an API key before it can be used.`);
  }
  return {
    providerId: provider.id,
    analyticsProviderId: provider.id,
    model: target.modelId,
    baseURL: provider.baseURL.replace(/\/$/, ''),
    key: apiKey || (provider.id === 'aihorde' ? '0000000000' : ''),
    apiKeys,
    ...(provider.id === 'aihorde' ? { supportsTools: false } : {}),
  };
}
