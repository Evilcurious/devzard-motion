import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { readConnection, saveConnection } from '@/lib/connection-store';
import { getRouterProvider, type RouterSelection } from '@/lib/model-router';

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
    await guard(request);
    const selection = schema.parse(await readJson(request, 3000));
    await saveConnection('router-selection', selection);
    return Response.json({ ok: true, selection });
  } catch (error) {
    return errorResponse(error);
  }
}
