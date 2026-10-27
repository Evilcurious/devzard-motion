import type { RouterCatalog } from './router-catalog';
import { getRouterProvider, type RouterModel, type RouterTarget } from './model-router';
import { getAdminProviderKeys, getOwnProviderKeys } from './provider-credentials';
import type { Principal, UserPrincipal } from './security';
import { readConnection, saveConnection } from './connection-store';

export async function canUserUseTarget(
  user: UserPrincipal,
  target: Pick<RouterTarget, 'providerId' | 'modelId'>,
) {
  if (
    user.allowedModels.some(
      (item) => item.providerId === target.providerId && item.modelId === target.modelId,
    )
  )
    return true;
  if (user.plan === 'premium' && user.modelAccess === 'all') {
    const provider = getRouterProvider(target.providerId);
    if (!provider || provider.id === 'managed') return false;
    if (!provider.keyRequired) return true;
    if ((await getOwnProviderKeys(provider.id)).length) return true;
    return (await getAdminProviderKeys(provider.id)).length > 0;
  }
  if (user.plan === 'premium' && user.modelAccess === 'selected') {
    const provider = getRouterProvider(target.providerId);
    return !!provider && provider.keyRequired && (await getOwnProviderKeys(provider.id)).length > 0;
  }
  if (user.providerMode !== 'both') return false;
  const provider = getRouterProvider(target.providerId);
  if (!provider || provider.id === 'managed') return false;
  if (!provider.keyRequired) return true;
  return (await getOwnProviderKeys(provider.id)).length > 0;
}
export async function filterCatalogForPrincipal(
  catalog: RouterCatalog,
  principal: Principal,
): Promise<RouterCatalog> {
  if (principal.role === 'admin') return catalog;
  const providersWithOwnKeys = new Set<string>();
  if (principal.providerMode === 'both' || principal.plan === 'premium') {
    await Promise.all(
      catalog.providers.map(async ({ providerId }) => {
        const provider = getRouterProvider(providerId);
        if (
          provider &&
          (provider.keyRequired
            ? (await getOwnProviderKeys(provider.id)).length > 0
            : principal.plan !== 'premium' || principal.modelAccess === 'all')
        )
          providersWithOwnKeys.add(providerId);
      }),
    );
  }
  const adminProviders = new Set<string>();
  if (principal.plan === 'premium') {
    const assignedProviders = new Set(principal.allowedModels.map((model) => model.providerId));
    await Promise.all(
      catalog.providers.map(async ({ providerId }) => {
        const provider = getRouterProvider(providerId);
        const eligibleForSharedKeys =
          principal.modelAccess === 'all' || assignedProviders.has(providerId);
        if (provider && eligibleForSharedKeys && (await getAdminProviderKeys(provider.id)).length)
          adminProviders.add(providerId);
      }),
    );
  }
  const models: RouterModel[] = [];
  for (const model of catalog.models) {
    const visibleProviders = [];
    for (const provider of model.providers) {
      const assigned = principal.allowedModels.some(
        (allowed) => allowed.providerId === provider.id && allowed.modelId === provider.modelId,
      );
      const own = providersWithOwnKeys.has(provider.id);
      const providerInfo = getRouterProvider(provider.id);
      const adminAvailable =
        principal.plan === 'premium' &&
        principal.modelAccess === 'all' &&
        !!providerInfo &&
        (!providerInfo.keyRequired || adminProviders.has(provider.id));
      if (!assigned && !own && !adminAvailable) continue;
      visibleProviders.push(assigned ? { ...provider, name: 'Admin-managed model' } : provider);
    }
    if (visibleProviders.length) models.push({ ...model, providers: visibleProviders });
  }
  return {
    ...catalog,
    models,
    providers: catalog.providers.map((provider) => ({
      ...provider,
      modelCount: providersWithOwnKeys.has(provider.providerId) ? provider.modelCount : 0,
      error: providersWithOwnKeys.has(provider.providerId) ? provider.error : null,
      listedCount: providersWithOwnKeys.has(provider.providerId) ? provider.listedCount : 0,
    })),
  };
}
export async function getUsageBlockedTargets(): Promise<Set<string>> {
  const saved = await readConnection<{ targets?: string[] }>('quota-unreported-targets');
  return new Set(Array.isArray(saved?.targets) ? saved.targets : []);
}
export async function markUsageBlockedTarget(target: Pick<RouterTarget, 'providerId' | 'modelId'>) {
  const blocked = await getUsageBlockedTargets();
  blocked.add(`${target.providerId}::${target.modelId}`);
  await saveConnection('quota-unreported-targets', { targets: [...blocked].slice(-500) });
}
