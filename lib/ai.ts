import { readConnection } from './connection-store';
import {
  getRouterProvider,
  type RouterProviderId,
  type RouterSelection,
  type RouterTarget,
} from './model-router';
import { getOwnProviderKeys, getProviderKeysForTarget } from './provider-credentials';
import { canUserUseTarget } from './account-access';
import { getManagedModelConfig } from './managed-model';
import { getPrincipal } from './security';
import type { UserPrincipal } from './security';
export type ModelSettings = {
  provider: 'openai' | 'ollama' | 'compatible';
  model: string;
  key?: string;
  baseURL?: string;
};
async function userCanUseTarget(
  user: UserPrincipal,
  target: Pick<RouterTarget, 'providerId' | 'modelId'>,
) {
  return canUserUseTarget(user, target);
}
function asUserRouterConfig(
  selection: RouterSelection,
  providerId: string,
  baseURL: string,
  keys: string[],
  visibleKey = keys[0] || '',
) {
  const provider = getRouterProvider(providerId);
  const key = visibleKey || (providerId === 'aihorde' ? '0000000000' : '');
  return {
    provider: 'compatible' as const,
    routerProviderId: providerId,
    model: selection.modelId,
    availableTokens: selection.availableTokens ?? null,
    contextTokens: selection.contextTokens ?? null,
    supportsTools: providerId === 'aihorde' ? false : selection.supportsTools,
    isFree: selection.isFree ?? false,
    baseURL: baseURL.replace(/\/$/, ''),
    key,
    apiKeys: keys,
    configured: !!provider && (!provider.keyRequired || !!key),
    strategy: selection.strategy === 'fusion' ? ('fusion' as const) : ('auto' as const),
    autoPick: selection.autoPick ?? false,
    fusionModels: selection.fusionModels || [],
  };
}
async function userAIConfig(user: UserPrincipal) {
  const selection = await readConnection<RouterSelection>('router-selection');
  if (selection) {
    const primary = { providerId: selection.providerId, modelId: selection.modelId };
    if (selection.providerId === 'managed') {
      const fusionAllowed =
        selection.strategy !== 'fusion' ||
        (
          await Promise.all(
            (selection.fusionModels || []).map((target) => userCanUseTarget(user, target)),
          )
        ).every(Boolean);
      if ((await userCanUseTarget(user, primary)) && fusionAllowed) {
        const managed = await getManagedModelConfig();
        if (managed.configured && managed.model === selection.modelId && managed.baseURL) {
          const apiKeys = await getProviderKeysForTarget(selection);
          return {
            provider: 'compatible' as const,
            routerProviderId: 'managed',
            model: managed.model,
            baseURL: managed.baseURL,
            key: apiKeys[0] || '',
            apiKeys,
            configured: true,
            strategy: selection.strategy === 'fusion' ? ('fusion' as const) : ('auto' as const),
            autoPick: selection.autoPick ?? false,
            fusionModels: selection.fusionModels || [],
          };
        }
      }
    }
    const provider = getRouterProvider(selection.providerId);
    const allowed =
      provider?.category === 'models' &&
      provider.baseURL &&
      (await userCanUseTarget(user, primary));
    const fusionAllowed =
      selection.strategy !== 'fusion' ||
      (
        await Promise.all(
          (selection.fusionModels || []).map((target) => userCanUseTarget(user, target)),
        )
      ).every(Boolean);
    if (allowed && fusionAllowed) {
      const [keys, ownKeys] = await Promise.all([
        getProviderKeysForTarget(primary),
        getOwnProviderKeys(provider.id),
      ]);
      return asUserRouterConfig(selection, provider.id, provider.baseURL!, keys, ownKeys[0] || '');
    }
  }
  for (const target of user.allowedModels) {
    if (target.providerId === 'managed') {
      const managed = await getManagedModelConfig();
      if (!managed.configured || managed.model !== target.modelId || !managed.baseURL) continue;
      const apiKeys = await getProviderKeysForTarget({
        providerId: 'managed',
        modelId: target.modelId,
      });
      return {
        provider: 'compatible' as const,
        routerProviderId: 'managed',
        model: managed.model,
        baseURL: managed.baseURL,
        key: apiKeys[0] || '',
        apiKeys,
        configured: true,
        strategy: 'auto' as const,
        autoPick: false,
        fusionModels: [],
      };
    }
    const provider = getRouterProvider(target.providerId);
    if (!provider || provider.category !== 'models' || !provider.baseURL) continue;
    const [keys, ownKeys] = await Promise.all([
      getProviderKeysForTarget({
        providerId: target.providerId as RouterProviderId,
        modelId: target.modelId,
      }),
      getOwnProviderKeys(provider.id),
    ]);
    if (provider.keyRequired && !keys.length) continue;
    return asUserRouterConfig(
      {
        providerId: target.providerId as RouterProviderId,
        modelId: target.modelId,
        strategy: 'auto',
        autoPick: false,
        fusionModels: [],
      },
      provider.id,
      provider.baseURL,
      keys,
      ownKeys[0] || '',
    );
  }
  return {
    provider: 'compatible' as const,
    routerProviderId: undefined,
    model: '',
    baseURL: '',
    key: '',
    apiKeys: [],
    configured: false,
    strategy: 'auto' as const,
    autoPick: false,
    fusionModels: [],
  };
}
export async function aiConfig() {
  const principal = await getPrincipal();
  if (principal?.role === 'user') return userAIConfig(principal);
  const selection = await readConnection<RouterSelection>('router-selection');
  if (selection) {
    const provider = getRouterProvider(selection.providerId);
    if (provider?.category === 'models' && provider.baseURL) {
      const apiKeys = await getProviderKeysForTarget(selection);
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
