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
    strategy: z.enum(['auto', 'fusion']),
    autoPick: z.boolean().default(false),
    fusionModels: z.array(targetSchema).max(4).default([]),
  })
  .superRefine((input, context) => {
    if (input.strategy === 'fusion' && !input.fusionModels.length) {
      context.addIssue({
        code: 'custom',
        path: ['fusionModels'],
        message: 'Add at least one synthesis model.',
      });
    }
    for (const [index, target] of [input, ...input.fusionModels].entries()) {
      const provider = getRouterProvider(target.providerId);
      if (!provider || provider.category !== 'models') {
        context.addIssue({
          code: 'custom',
          path: [index === 0 ? 'providerId' : 'fusionModels', index || 0],
          message: 'Select a chat-model provider.',
        });
      }
    }
  });

export async function GET() {
  try {
    await guard();
    const raw = await readConnection<RouterSelection & { fallbackChain?: unknown }>(
      'router-selection',
    );
    if (!raw) return Response.json({ selection: null });
    const selection = {
      ...raw,
      strategy: raw.strategy === 'fusion' ? ('fusion' as const) : ('auto' as const),
      autoPick: raw.autoPick ?? true,
      fusionModels: raw.fusionModels || [],
    } as RouterSelection & { fallbackChain?: unknown };
    delete selection.fallbackChain;
    return Response.json({ selection });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    let selection = schema.parse(await readJson(request, 3000));
    if (principal.role === 'user') {
      const catalog = await filterCatalogForPrincipal(await discoverRouterCatalog(), principal);
      const blocked = await getUsageBlockedTargets();
      for (const target of [selection, ...selection.fusionModels]) {
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
        fusionModels: selection.fusionModels.map((target) => normalize(target)),
      };
    }
    await saveConnection('router-selection', selection);
    return Response.json({ ok: true, selection });
  } catch (error) {
    return errorResponse(error);
  }
}
