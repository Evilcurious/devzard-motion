import { readConnection, saveConnection } from './connection-store';
import {
  getRouterProvider,
  type RouterProviderId,
  type RouterSelection,
  type RouterTarget,
} from './model-router';
import { getOwnProviderKeys, getProviderKeysForTarget } from './provider-credentials';
import { canUserUseTarget, getUsageBlockedTargets } from './account-access';
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
async function firstUsableAssignedSelection(user: UserPrincipal): Promise<RouterSelection | null> {
  const blocked = await getUsageBlockedTargets();
  for (const target of user.allowedModels) {
    if (blocked.has(`${target.providerId}::${target.modelId}`)) continue;
    const selection: RouterSelection = {
      providerId: target.providerId as RouterProviderId,
      modelId: target.modelId,
      strategy: 'auto',
      autoPick: true,
      fusionModels: [],
    };
    if (target.providerId === 'managed') {
      const managed = await getManagedModelConfig();
      if (managed.configured && managed.model === target.modelId && managed.baseURL)
        return selection;
      continue;
    }
    const provider = getRouterProvider(target.providerId);
    if (!provider || provider.category !== 'models' || !provider.baseURL) continue;
    if (!(await userCanUseTarget(user, selection))) continue;
    const keys = await getProviderKeysForTarget(selection);
    if (provider.keyRequired && !keys.length) continue;
    return selection;
  }
  return null;
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
    configured: !!provider && (!provider.keyRequired || keys.length > 0),
    strategy: selection.strategy,
    autoPick: selection.autoPick ?? false,
    fallbackChain: selection.fallbackChain || [],
    fusionModels: selection.fusionModels || [],
  };
}
async function userAIConfig(user: UserPrincipal) {
  let selection = await readConnection<RouterSelection>('router-selection');
  if (!selection) {
    selection = await firstUsableAssignedSelection(user);
    if (selection) await saveConnection('router-selection', selection);
  }
  if (selection) {
    const primary = { providerId: selection.providerId, modelId: selection.modelId };
    if (selection.providerId === 'managed') {
      const extraTargets =
        selection.strategy === 'fusion'
          ? selection.fusionModels || []
          : selection.strategy === 'fallback'
            ? selection.fallbackChain || []
            : [];
      const routingAllowed = (
        await Promise.all(extraTargets.map((target) => userCanUseTarget(user, target)))
      ).every(Boolean);
      if ((await userCanUseTarget(user, primary)) && routingAllowed) {
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
            strategy: selection.strategy,
            autoPick: selection.autoPick ?? false,
            fallbackChain: selection.fallbackChain || [],
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
    const extraTargets =
      selection.strategy === 'fusion'
        ? selection.fusionModels || []
        : selection.strategy === 'fallback'
          ? selection.fallbackChain || []
          : [];
    const routingAllowed = (
      await Promise.all(extraTargets.map((target) => userCanUseTarget(user, target)))
    ).every(Boolean);
    if (allowed && routingAllowed) {
      const [keys, ownKeys] = await Promise.all([
        getProviderKeysForTarget(primary),
        getOwnProviderKeys(provider.id),
      ]);
      const configured = asUserRouterConfig(
        selection,
        provider.id,
        provider.baseURL!,
        keys,
        ownKeys[0] || '',
      );
      if (configured.configured) return configured;
    }
  }
  const usageBlockedTargets = await getUsageBlockedTargets();
  for (const target of user.allowedModels) {
    if (usageBlockedTargets.has(`${target.providerId}::${target.modelId}`)) continue;
    if (target.providerId === 'managed') {
      const managed = await getManagedModelConfig();
      if (!managed.configured || managed.model !== target.modelId || !managed.baseURL) continue;
      const fallbackSelection: RouterSelection = {
        providerId: 'managed',
        modelId: target.modelId,
        strategy: 'auto',
        autoPick: true,
        fusionModels: [],
      };
      if (
        selection?.providerId !== fallbackSelection.providerId ||
        selection.modelId !== fallbackSelection.modelId ||
        !selection.autoPick
      )
        await saveConnection('router-selection', fallbackSelection);
      const apiKeys = await getProviderKeysForTarget(fallbackSelection);
      return {
        provider: 'compatible' as const,
        routerProviderId: 'managed',
        model: managed.model,
        baseURL: managed.baseURL,
        key: apiKeys[0] || '',
        apiKeys,
        configured: true,
        strategy: 'auto' as const,
        autoPick: true,
        fusionModels: [],
      };
    }
    const provider = getRouterProvider(target.providerId);
    if (!provider || provider.category !== 'models' || !provider.baseURL) continue;
    const fallbackSelection: RouterSelection = {
      providerId: target.providerId as RouterProviderId,
      modelId: target.modelId,
      strategy: 'auto',
      autoPick: true,
      fusionModels: [],
    };
    const [keys, ownKeys] = await Promise.all([
      getProviderKeysForTarget(fallbackSelection),
      getOwnProviderKeys(provider.id),
    ]);
    if (provider.keyRequired && !keys.length) continue;
    if (
      selection?.providerId !== fallbackSelection.providerId ||
      selection.modelId !== fallbackSelection.modelId ||
      !selection.autoPick
    )
      await saveConnection('router-selection', fallbackSelection);
    return asUserRouterConfig(
      fallbackSelection,
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
        strategy: selection.strategy,
        autoPick: selection.autoPick ?? true,
        fallbackChain: selection.fallbackChain || [],
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
