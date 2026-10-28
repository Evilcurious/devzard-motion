import { getRouterProvider, type RouterProviderId, type RouterTarget } from './model-router';
import { getProviderKeysForTarget } from './provider-credentials';
import { getManagedModelConfig } from './managed-model';

export type ResolvedTarget = {
  providerId: RouterProviderId;
  analyticsProviderId?: string;
  model: string;
  baseURL: string;
  key: string;
  apiKeys?: string[];
  supportsTools?: boolean;
  contextTokens?: number | null;
};

export async function resolveRouterTarget(target: RouterTarget): Promise<ResolvedTarget> {
  if (target.providerId === 'managed') {
    const config = await getManagedModelConfig();
    if (!config.configured || config.model !== target.modelId || !config.baseURL)
      throw new Error('The administrator’s assigned model is no longer available.');
    const apiKeys = await getProviderKeysForTarget(target);
    return {
      providerId: 'managed',
      analyticsProviderId: 'managed',
      model: config.model,
      baseURL: config.baseURL,
      key: apiKeys[0] || '',
      apiKeys,
    };
  }
  const provider = getRouterProvider(target.providerId);
  if (!provider || provider.category !== 'models' || !provider.baseURL) {
    throw new Error('The selected model provider is not supported.');
  }
  const apiKeys = await getProviderKeysForTarget(target);
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
    contextTokens: target.contextTokens ?? null,
    ...(provider.id === 'aihorde' ? { supportsTools: false } : {}),
  };
}
