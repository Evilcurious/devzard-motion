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
});
const schema = z
  .object({
    ...targetSchema.shape,
    strategy: z.enum([
      'manual',
      'fallback',
      'fusion',
      'balanced',
      'fastest',
      'reliable',
      'smartest',
    ]),
    fallbackChain: z.array(targetSchema).max(8).default([]),
    fusionModels: z.array(targetSchema).max(4).default([]),
  })
  .superRefine((input, context) => {
    if (input.strategy === 'fallback' && !input.fallbackChain.length) {
      context.addIssue({
        code: 'custom',
        path: ['fallbackChain'],
        message: 'Add at least one fallback model.',
      });
    }
    if (input.strategy === 'fusion' && !input.fusionModels.length) {
      context.addIssue({
        code: 'custom',
        path: ['fusionModels'],
        message: 'Add at least one synthesis model.',
      });
    }
    for (const [index, target] of [
      input,
      ...input.fallbackChain,
      ...input.fusionModels,
    ].entries()) {
      const provider = getRouterProvider(target.providerId);
      if (!provider || provider.category !== 'models') {
        context.addIssue({
          code: 'custom',
          path: [index === 0 ? 'providerId' : 'fallbackChain', index || 0],
          message: 'Select a chat-model provider.',
        });
      }
    }
  });

export async function GET() {
  try {
    await guard();
    return Response.json({ selection: await readConnection<RouterSelection>('router-selection') });
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
