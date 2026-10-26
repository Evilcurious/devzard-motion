import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { readConnection, removeConnection, saveConnection } from '@/lib/connection-store';
import {
  getRouterProvider,
  routerProviders,
  type RouterProviderId,
  type RouterSelection,
} from '@/lib/model-router';
import { databaseConfigured } from '@/lib/db';
import { isOpenRouterEndpoint } from '@/lib/ai-errors';
import type { ModelSettings } from '@/lib/ai';

const schema = z.object({
  providerId: z.string().min(1).max(40),
  apiKey: z.string().trim().max(500).optional(),
});
type ProviderCredential = { apiKey: string };

export async function GET() {
  try {
    await guard();
    const providers = await Promise.all(
      routerProviders.map(async (provider) => {
        const saved = await readConnection<ProviderCredential>(`router-provider-${provider.id}`);
        const legacy =
          provider.id === 'openrouter' ? await readConnection<ModelSettings>('model') : null;
        const legacyKey =
          legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || '')
            ? legacy.key
            : '';
        const keySaved = !!saved?.apiKey || !!legacyKey;
        return {
          id: provider.id,
          name: provider.name,
          category: provider.category,
          keyRequired: provider.keyRequired,
          connected: keySaved || (provider.category === 'models' && !provider.keyRequired),
          keySaved,
          docsURL: provider.docsURL,
          note: provider.note || null,
        };
      }),
    );
    return Response.json({ providers, storage: databaseConfigured() ? 'postgresql' : 'cookie' });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await guard(request);
    const input = schema.parse(await readJson(request, 1000));
    const provider = getRouterProvider(input.providerId);
    if (!provider) return Response.json({ error: 'Unknown provider.' }, { status: 400 });
    if (provider.keyRequired && !input.apiKey?.trim()) {
      return Response.json({ error: `${provider.name} requires an API key.` }, { status: 400 });
    }
    await saveConnection(`router-provider-${provider.id}`, { apiKey: input.apiKey?.trim() || '' });
    return Response.json({ ok: true, providerId: provider.id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await guard(request);
    const input = schema.pick({ providerId: true }).parse(await readJson(request, 500));
    const provider = getRouterProvider(input.providerId);
    if (!provider) return Response.json({ error: 'Unknown provider.' }, { status: 400 });
    await removeConnection(`router-provider-${provider.id}`);
    if (provider.id === 'openrouter') {
      const legacy = await readConnection<ModelSettings>('model');
      if (legacy?.provider === 'compatible' && isOpenRouterEndpoint(legacy.baseURL || ''))
        await removeConnection('model');
    }
    const selection = await readConnection<RouterSelection>('router-selection');
    if (selection?.providerId === provider.id) {
      await removeConnection('router-selection');
    } else if (selection) {
      const fallbackChain = selection.fallbackChain.filter(
        (target) => target.providerId !== provider.id,
      );
      const fusionModels = selection.fusionModels.filter(
        (target) => target.providerId !== provider.id,
      );
      const next = { ...selection, fallbackChain, fusionModels };
      if (
        (next.strategy === 'fallback' && !fallbackChain.length) ||
        (next.strategy === 'fusion' && !fusionModels.length)
      ) {
        await removeConnection('router-selection');
      } else {
        await saveConnection('router-selection', next);
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export function isRouterProviderId(id: string): id is RouterProviderId {
  return routerProviders.some((provider) => provider.id === id);
}
