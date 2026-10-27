import { readConnection, saveConnection, removeConnection } from './connection-store';
import { isOpenRouterEndpoint } from './ai-errors';
import type { ModelSettings } from './ai';
import type { RouterProviderId, RouterTarget } from './model-router';
import type { AllowedAccountModel } from './accounts';
import type { UserPrincipal } from './security';
import { getPrincipal } from './security';
import { getManagedModelConfig } from './managed-model';

type ProviderCredential = { apiKey?: string; apiKeys?: string[] };
const MAX_KEYS_PER_PROVIDER = 5;
function normalizeKeys(value: ProviderCredential | null | undefined): string[] {
  return [
    ...new Set(
      [...(value?.apiKeys || []), value?.apiKey || ''].map((key) => key.trim()).filter(Boolean),
    ),
  ].slice(0, MAX_KEYS_PER_PROVIDER);
}
export async function getOwnProviderKeys(providerId: RouterProviderId): Promise<string[]> {
  const saved = await readConnection<ProviderCredential>(`router-provider-${providerId}`);
  const keys = normalizeKeys(saved);
  const principal = await getPrincipal();
  if (principal?.role === 'admin' && providerId === 'openrouter') {
    const legacy = await readConnection<ModelSettings>('model');
    const legacyKey =
      legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || '')
        ? legacy.key?.trim()
        : '';
    if (legacyKey && !keys.includes(legacyKey)) keys.push(legacyKey);
  }
  return keys.slice(0, MAX_KEYS_PER_PROVIDER);
}
export async function getAdminProviderKeys(providerId: RouterProviderId): Promise<string[]> {
  if (providerId === 'managed') {
    const config = await getManagedModelConfig();
    return config.key ? [config.key] : [];
  }
  const saved = await readConnection<ProviderCredential>(`router-provider-${providerId}`, 'owner');
  const keys = normalizeKeys(saved);
  if (providerId === 'openrouter') {
    const legacy = await readConnection<ModelSettings>('model', 'owner');
    const legacyKey =
      legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || '')
        ? legacy.key?.trim()
        : '';
    if (legacyKey && !keys.includes(legacyKey)) keys.push(legacyKey);
  }
  return keys.slice(0, MAX_KEYS_PER_PROVIDER);
}
// Provider discovery and general integrations must never receive admin credentials for a user.
export async function getProviderKeys(providerId: RouterProviderId): Promise<string[]> {
  return getOwnProviderKeys(providerId);
}
export function hasAdminModelAssignment(
  allowedModels: Array<Pick<AllowedAccountModel, 'providerId' | 'modelId'>>,
  target: Pick<RouterTarget, 'providerId' | 'modelId'>,
) {
  return allowedModels.some(
    (model) => model.providerId === target.providerId && model.modelId === target.modelId,
  );
}
export function canUserUseSharedProviderKeys(
  user: UserPrincipal,
  target: Pick<RouterTarget, 'providerId' | 'modelId'>,
) {
  return (
    hasAdminModelAssignment(user.allowedModels, target) ||
    (user.plan === 'premium' && user.modelAccess === 'all' && target.providerId !== 'managed')
  );
}
// Shared admin keys remain server-side and are returned only for an authorized target.
export async function getProviderKeysForTarget(
  target: Pick<RouterTarget, 'providerId' | 'modelId'>,
): Promise<string[]> {
  const principal = await getPrincipal();
  const own = await getOwnProviderKeys(target.providerId);
  if (!principal || principal.role === 'admin') return own;
  if (!canUserUseSharedProviderKeys(principal, target)) return own;
  const shared = await getAdminProviderKeys(target.providerId);
  return [...new Set([...own, ...shared])].slice(0, MAX_KEYS_PER_PROVIDER * 2);
}
export async function addProviderKey(
  providerId: RouterProviderId,
  apiKey: string,
): Promise<number> {
  const key = apiKey.trim();
  const keys = await getOwnProviderKeys(providerId);
  if (!keys.includes(key)) {
    if (keys.length >= MAX_KEYS_PER_PROVIDER)
      throw new Error(`You can save up to ${MAX_KEYS_PER_PROVIDER} API keys per provider.`);
    keys.push(key);
  }
  await saveConnection(`router-provider-${providerId}`, { apiKeys: keys });
  return keys.length;
}
export async function removeProviderKey(
  providerId: RouterProviderId,
  index?: number,
): Promise<number> {
  if (index === undefined) {
    await removeConnection(`router-provider-${providerId}`);
    return 0;
  }
  const saved = await readConnection<ProviderCredential>(`router-provider-${providerId}`);
  const storedKeys = normalizeKeys(saved);
  const keys = await getOwnProviderKeys(providerId);
  if (index < 0 || index >= keys.length)
    throw new Error('That saved key was not found. Refresh the provider list and try again.');
  const principal = await getPrincipal();
  if (principal?.role === 'admin' && providerId === 'openrouter' && index >= storedKeys.length) {
    const legacy = await readConnection<ModelSettings>('model');
    if (legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || ''))
      await saveConnection('model', { ...legacy, key: '' });
  }
  keys.splice(index, 1);
  if (keys.length) await saveConnection(`router-provider-${providerId}`, { apiKeys: keys });
  else await removeConnection(`router-provider-${providerId}`);
  return keys.length;
}
export const maxProviderKeys = MAX_KEYS_PER_PROVIDER;
