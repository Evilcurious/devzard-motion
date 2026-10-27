import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { readConnection, saveConnection, removeConnection } from '@/lib/connection-store';
import {
  getRouterProvider,
  routerProviders,
  type RouterProviderId,
  type RouterSelection,
} from '@/lib/model-router';
import { databaseConfigured } from '@/lib/db';
import { isOpenRouterEndpoint } from '@/lib/ai-errors';
import type { ModelSettings } from '@/lib/ai';
import { addProviderKey, getOwnProviderKeys, removeProviderKey } from '@/lib/provider-credentials';

const saveSchema = z.object({
  providerId: z.string().min(1).max(40),
  apiKey: z.string().trim().max(500).optional(),
});
const deleteSchema = z.object({
  providerId: z.string().min(1).max(40),
  keyIndex: z.number().int().min(0).max(4).optional(),
});

export async function GET() {
  try {
    const principal = await guard();
    if (principal.role === 'user' && principal.plan === 'premium')
      return Response.json(
        { providers: [] },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    const providers = await Promise.all(
      routerProviders.map(async (provider) => {
        const keys = await getOwnProviderKeys(provider.id);
        const legacy =
          provider.id === 'openrouter' ? await readConnection<ModelSettings>('model') : null;
        const legacyKey =
          legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || '')
            ? legacy.key
            : '';
        const keyCount = Math.max(keys.length, legacyKey && !keys.includes(legacyKey) ? 1 : 0);
        return {
          id: provider.id,
          name: provider.name,
          category: provider.category,
          keyRequired: provider.keyRequired,
          connected: keyCount > 0 || (provider.category === 'models' && !provider.keyRequired),
          keySaved: keyCount > 0,
          keyCount,
          maxKeys: 5,
          docsURL: provider.docsURL,
          note: provider.note || null,
        };
      }),
    );
    return Response.json(
      { providers, storage: databaseConfigured() ? 'postgresql' : 'cookie' },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    if (
      principal.role === 'user' &&
      (principal.plan === 'premium' || principal.providerMode !== 'both')
    )
      throw new Error('Personal provider keys are not available for this account.');
    const input = saveSchema.parse(await readJson(request, 1000));
    const provider = getRouterProvider(input.providerId);
    if (!provider) return Response.json({ error: 'Unknown provider.' }, { status: 400 });
    if (provider.keyRequired && !input.apiKey?.trim()) {
      return Response.json({ error: `${provider.name} requires an API key.` }, { status: 400 });
    }
    const keyCount = input.apiKey?.trim()
      ? await addProviderKey(provider.id, input.apiKey)
      : (await getOwnProviderKeys(provider.id)).length;
    return Response.json({ ok: true, providerId: provider.id, keyCount });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const principal = await guard(request);
    if (
      principal.role === 'user' &&
      (principal.plan === 'premium' || principal.providerMode !== 'both')
    )
      throw new Error('Personal provider keys are not available for this account.');
    const input = deleteSchema.parse(await readJson(request, 500));
    const provider = getRouterProvider(input.providerId);
    if (!provider) return Response.json({ error: 'Unknown provider.' }, { status: 400 });
    const keyCount = await removeProviderKey(provider.id, input.keyIndex);
    if (provider.id === 'openrouter' && input.keyIndex === undefined) {
      const legacy = await readConnection<ModelSettings>('model');
      if (legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || ''))
        await removeConnection('model');
    }
    if (keyCount === 0) {
      const selection = await readConnection<RouterSelection>('router-selection');
      if (selection?.providerId === provider.id) {
        await removeConnection('router-selection');
      } else if (selection) {
        const fusionModels = selection.fusionModels.filter(
          (target) => target.providerId !== provider.id,
        );
        if (selection.strategy === 'fusion' && !fusionModels.length) {
          await removeConnection('router-selection');
        } else {
          await saveConnection('router-selection', {
            ...selection,
            strategy: selection.strategy === 'fusion' ? 'fusion' : 'auto',
            fusionModels,
          });
        }
      }
    }
    return Response.json({ ok: true, keyCount });
  } catch (error) {
    return errorResponse(error);
  }
}

export function isRouterProviderId(id: string): id is RouterProviderId {
  return id === 'managed' || routerProviders.some((provider) => provider.id === id);
}
