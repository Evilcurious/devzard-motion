import { z } from 'zod';
import { guard, errorResponse, readJson } from '@/lib/security';
import { readConnection, saveConnection } from '@/lib/connection-store';
import { getRouterProvider, type CodeRouterSelection, type RouterTarget } from '@/lib/model-router';
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
  accountCreditsAvailable: z.boolean().optional(),
});
const schema = z.object({ targets: z.array(targetSchema).max(8) }).superRefine((input, context) => {
  const keys = input.targets.map((target) => `${target.providerId}::${target.modelId}`);
  if (new Set(keys).size !== keys.length)
    context.addIssue({ code: 'custom', path: ['targets'], message: 'Code models must be unique.' });
  input.targets.forEach((target, index) => {
    if (getRouterProvider(target.providerId)?.category !== 'models')
      context.addIssue({
        code: 'custom',
        path: ['targets', index, 'providerId'],
        message: 'Select a chat-model provider.',
      });
  });
});

export async function GET() {
  try {
    await guard();
    const selection = await readConnection<CodeRouterSelection>('code-router-selection');
    return Response.json(
      { selection: selection ? { targets: selection.targets.slice(0, 8) } : { targets: [] } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await guard(request);
    const input = schema.parse(await readJson(request, 12_000));
    let catalog = await discoverRouterCatalog();
    if (principal.role === 'user') catalog = await filterCatalogForPrincipal(catalog, principal);
    const blocked = principal.role === 'user' ? await getUsageBlockedTargets() : new Set<string>();
    const targets: RouterTarget[] = [];
    for (const target of input.targets) {
      if (principal.role === 'user') {
        if (!(await canUserUseTarget(principal, target as RouterTarget)))
          throw new Error('That code model is not enabled for this account.');
        if (blocked.has(`${target.providerId}::${target.modelId}`))
          throw new Error('That code model cannot be used with this account’s token allowance.');
      }
      const model = catalog.models.find((entry) =>
        entry.providers.some(
          (provider) => provider.id === target.providerId && provider.modelId === target.modelId,
        ),
      );
      const provider = model?.providers.find(
        (entry) => entry.id === target.providerId && entry.modelId === target.modelId,
      );
      if (!provider)
        throw new Error(
          'That code model is not currently available. Refresh models and try again.',
        );
      targets.push({
        providerId: provider.id,
        modelId: provider.modelId,
        availableTokens: provider.availableTokens,
        contextTokens: provider.contextTokens,
        supportsTools: provider.supportsTools,
        isFree: provider.isFree,
        accountCreditsAvailable: provider.accountCreditsAvailable,
      });
    }
    const selection = { targets } satisfies CodeRouterSelection;
    await saveConnection('code-router-selection', selection);
    return Response.json(
      { ok: true, selection },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
