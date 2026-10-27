import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { readConnection, saveConnection } from '@/lib/connection-store';
import { getRouterProvider, type RouterSelection, type RouterTarget } from '@/lib/model-router';
import {
  canUserUseTarget,
  filterCatalogForPrincipal,
  getUsageBlockedTargets,
} from '@/lib/account-access';
import { discoverRouterCatalog } from '@/lib/router-catalog';

const targetSchema = z.object({
  providerId: z.string().min(1).max(40),
  modelId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[\w./:-]+$/),
  availableTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  contextTokens: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  supportsTools: z.boolean().nullable().optional(),
  isFree: z.boolean().optional(),
});
const schema = z
  .object({
    ...targetSchema.shape,
    strategy: z.enum(['auto', 'fallback', 'fusion', 'auto-fusion']),
    autoPick: z.boolean().default(false),
    fallbackChain: z.array(targetSchema).max(3).default([]),
    fusionModels: z.array(targetSchema).max(3).default([]),
  })
  .superRefine((input, context) => {
    if (input.strategy === 'fallback' && !input.fallbackChain.length) {
      context.addIssue({
        code: 'custom',
        path: ['fallbackChain'],
        message: 'Choose at least one fallback model.',
      });
    }
    if (input.strategy === 'fusion' && !input.fusionModels.length) {
      context.addIssue({
        code: 'custom',
        path: ['fusionModels'],
        message: 'Choose at least one additional model to fuse.',
      });
    }
    const targets = [input, ...input.fallbackChain, ...input.fusionModels];
    const keys = targets.map((target) => `${target.providerId}::${target.modelId}`);
    if (new Set(keys).size !== keys.length)
      context.addIssue({ code: 'custom', message: 'Each routing model must be unique.' });
    for (const [index, target] of targets.entries()) {
      const provider = getRouterProvider(target.providerId);
      if (!provider || provider.category !== 'models') {
        context.addIssue({
          code: 'custom',
          path:
            index === 0
              ? ['providerId']
              : index <= input.fallbackChain.length
                ? ['fallbackChain', index - 1]
                : ['fusionModels', index - input.fallbackChain.length - 1],
          message: 'Select a chat-model provider.',
        });
      }
    }
  });

export async function GET() {
  try {
    const principal = await guard();
    const raw = await readConnection<RouterSelection>('router-selection');
    if (principal.role === 'user' && principal.plan === 'premium')
      return Response.json(
        { selection: raw ? { modelId: raw.modelId } : null },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    if (!raw) return Response.json({ selection: null });
    const selection = {
      ...raw,
      strategy: raw.strategy || 'auto',
      autoPick: raw.autoPick ?? (raw.strategy === 'auto' || raw.strategy === 'auto-fusion'),
      fallbackChain: (raw.fallbackChain || []).slice(0, 3),
      fusionModels: (raw.fusionModels || []).slice(0, 3),
    } as RouterSelection;
    return Response.json({ selection });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    if (principal.role === 'user' && principal.plan === 'premium')
      throw new Error('Premium model assignments are managed by the administrator.');
    let selection = schema.parse(await readJson(request, 3000));
    if (principal.role === 'user') {
      const catalog = await filterCatalogForPrincipal(await discoverRouterCatalog(), principal);
      const blocked = await getUsageBlockedTargets();
      for (const target of [selection, ...selection.fallbackChain, ...selection.fusionModels]) {
        if (!(await canUserUseTarget(principal, target as RouterTarget)))
          throw new Error('That model is not enabled for this account.');
        if (blocked.has(`${target.providerId}::${target.modelId}`))
          throw new Error(
            'That model does not report token usage and cannot be used with your monthly allowance.',
          );
        const model = catalog.models.find((item) =>
          item.providers.some(
            (provider) => provider.id === target.providerId && provider.modelId === target.modelId,
          ),
        );
        if (!model) throw new Error('That model is not currently available for this account.');
      }
      const normalize = (target: z.infer<typeof targetSchema>) => {
        const model = catalog.models.find((item) =>
          item.providers.some(
            (provider) => provider.id === target.providerId && provider.modelId === target.modelId,
          ),
        );
        const provider = model?.providers.find(
          (item) => item.id === target.providerId && item.modelId === target.modelId,
        );
        return provider
          ? {
              ...target,
              availableTokens: provider.availableTokens,
              contextTokens: provider.contextTokens,
              supportsTools: provider.supportsTools,
              isFree: provider.isFree,
            }
          : target;
      };
      selection = {
        ...selection,
        ...normalize(selection),
        fallbackChain: selection.fallbackChain.map((target) => normalize(target)),
        fusionModels: selection.fusionModels.map((target) => normalize(target)),
      };
    }
    await saveConnection('router-selection', selection);
    return Response.json({ ok: true, selection });
  } catch (error) {
    return errorResponse(error);
  }
}
