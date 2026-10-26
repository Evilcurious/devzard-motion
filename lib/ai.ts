import { readConnection } from './connection-store';
import { getRouterProvider, type RouterSelection } from './model-router';
import { getProviderKeys } from './provider-credentials';
export type ModelSettings = {
  provider: 'openai' | 'ollama' | 'compatible';
  model: string;
  key?: string;
  baseURL?: string;
};

export async function aiConfig() {
  const selection = await readConnection<RouterSelection>('router-selection');
  if (selection) {
    const provider = getRouterProvider(selection.providerId);
    if (provider?.category === 'models' && provider.baseURL) {
      const apiKeys = await getProviderKeys(provider.id);
      const key = apiKeys[0] || (provider.id === 'aihorde' ? '0000000000' : '');
      const configured = !provider.keyRequired || !!key;
      return {
        provider: 'compatible' as const,
        routerProviderId: provider.id,
        model: selection.modelId,
        availableTokens: selection.availableTokens ?? null,
        contextTokens: selection.contextTokens ?? null,
        supportsTools: provider.id === 'aihorde' ? false : selection.supportsTools,
        isFree: selection.isFree ?? false,
        baseURL: provider.baseURL.replace(/\/$/, ''),
        key,
        apiKeys,
        configured,
        strategy: selection.strategy === 'fusion' ? ('fusion' as const) : ('auto' as const),
        autoPick: selection.autoPick ?? true,
        fusionModels: selection.fusionModels || [],
      };
    }
  }
  const saved = await readConnection<ModelSettings>('model');
  const provider = saved?.provider || process.env.AI_PROVIDER || 'openai';
  const key =
    saved?.key ||
    (provider === (process.env.AI_PROVIDER || 'openai') ? process.env.AI_API_KEY : '') ||
    '';
  const baseURL = (
    saved?.baseURL ||
    (provider === 'ollama'
      ? process.env.OLLAMA_BASE_URL ||
        (process.env.AI_PROVIDER === 'ollama' ? process.env.AI_BASE_URL : '') ||
        'http://localhost:11434/v1'
      : provider === 'compatible'
        ? process.env.AI_BASE_URL || ''
        : 'https://api.openai.com/v1')
  ).replace(/\/$/, '');
  return {
    provider,
    model:
      saved?.model ||
      (provider === (process.env.AI_PROVIDER || 'openai') ? process.env.AI_MODEL : '') ||
      (provider === 'ollama' ? 'qwen2.5:7b' : 'gpt-4o-mini'),
    baseURL,
    key,
    configured: provider === 'ollama' || (provider === 'openai' ? !!key : !!baseURL),
    supportsTools: undefined,
    strategy: 'manual' as const,
    fusionModels: [],
  };
}
