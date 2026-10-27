import { z } from 'zod';
import {
  createUserInvite,
  findUserByEmail,
  listUserAccounts,
  setAccountPlanByEmail,
  setUserEnabled,
  type AllowedAccountModel,
} from '@/lib/accounts';
import { errorResponse, requireAdmin, readJson } from '@/lib/security';
import { discoverRouterCatalog } from '@/lib/router-catalog';
import { databaseConfigured } from '@/lib/db';
import { aiConfig } from '@/lib/ai';
import { migrateFreeAccountDataToCentral } from '@/lib/tenant-database';

const allowedModel = z.object({
  providerId: z.string().min(1).max(40),
  modelId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[\w./:-]+$/),
  name: z.string().trim().min(1).max(200),
});
const inviteSchema = z.object({
  providerMode: z.enum(['managed', 'both']),
  monthlyTokenLimit: z.number().int().min(1000).max(1_000_000_000),
  allowedModels: z.array(allowedModel).max(100),
});

async function managedDefaultModel() {
  const config = await aiConfig();
  if ('routerProviderId' in config || !config.configured || !config.model) return null;
  return {
    providerId: 'managed',
    modelId: config.model,
    name: config.model,
    providerName: 'Admin-managed model',
  };
}
const enabledSchema = z.object({
  action: z.literal('set-enabled'),
  userId: z.string().uuid(),
  enabled: z.boolean(),
});
const premiumSchema = z.object({
  action: z.literal('activate-premium'),
  email: z.string().email().max(254),
  monthlyTokenLimit: z.number().int().min(1000).max(1_000_000_000),
  allowedModels: z.array(allowedModel).max(100).optional(),
});
const patchSchema = z.discriminatedUnion('action', [enabledSchema, premiumSchema]);
export async function GET() {
  try {
    await requireAdmin();
    if (!databaseConfigured())
      throw new Error('Configure the shared Neon database before managing user accounts.');
    const [users, catalog, managed] = await Promise.all([
      listUserAccounts(),
      discoverRouterCatalog(),
      managedDefaultModel(),
    ]);
    const availableModels: Array<{
      providerId: string;
      modelId: string;
      name: string;
      providerName: string;
    }> = catalog.models.flatMap((model) =>
      model.providers.map((provider) => ({
        providerId: provider.id,
        modelId: provider.modelId,
        name: model.name,
        providerName: provider.name,
      })),
    );
    if (managed) availableModels.push(managed);
    return Response.json({ users, availableModels }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (!databaseConfigured())
      throw new Error('Configure the shared Neon database before creating invitations.');
    const input = inviteSchema.parse(await readJson(request, 30_000));
    const [catalog, managed] = await Promise.all([discoverRouterCatalog(), managedDefaultModel()]);
    const available = new Set(
      catalog.models.flatMap((model) =>
        model.providers.map((provider) => `${provider.id}::${provider.modelId}`),
      ),
    );
    if (managed) available.add(`${managed.providerId}::${managed.modelId}`);
    for (const model of input.allowedModels)
      if (!available.has(`${model.providerId}::${model.modelId}`))
        throw new Error(`Model ${model.modelId} is not currently available for assignment.`);
    const models = [
      ...new Map(
        input.allowedModels.map((model) => [`${model.providerId}::${model.modelId}`, model]),
      ).values(),
    ] as AllowedAccountModel[];
    if (!models.length)
      throw new Error('Select at least one admin-assigned model for this account.');
    const invite = await createUserInvite({
      providerMode: input.providerMode,
      monthlyTokenLimit: input.monthlyTokenLimit,
      allowedModels: models,
    });
    const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    return Response.json({
      ok: true,
      inviteUrl: `${base}/?invite=${encodeURIComponent(invite.token)}`,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    if (!databaseConfigured())
      throw new Error('Configure the shared Neon database before managing user accounts.');
    const input = patchSchema.parse(await readJson(request, 30_000));
    if (input.action === 'set-enabled') {
      if (!(await setUserEnabled(input.userId, input.enabled)))
        throw new Error('That user account was not found.');
      return Response.json({ ok: true });
    }
    const user = await findUserByEmail(input.email);
    if (!user) throw new Error('No account exists for that email yet. Ask them to sign up first.');
    if (user.plan !== 'free') throw new Error('That account is already Premium.');
    const [catalog, managed] = await Promise.all([discoverRouterCatalog(), managedDefaultModel()]);
    const firstCatalogModel = catalog.models.flatMap((model) =>
      model.providers.map((provider) => ({
        providerId: provider.id,
        modelId: provider.modelId,
        name: model.name,
      })),
    )[0];
    const models = (
      managed ? [managed] : firstCatalogModel ? [firstCatalogModel] : []
    ) as AllowedAccountModel[];
    if (!models.length)
      throw new Error('No admin-managed model is available to initialize Premium.');
    await migrateFreeAccountDataToCentral(user.id, async () => {
      if (!(await setAccountPlanByEmail(input.email, 'premium', input.monthlyTokenLimit, models)))
        throw new Error('That account could not be upgraded.');
    });
    return Response.json({ ok: true, plan: 'premium' });
  } catch (error) {
    return errorResponse(error);
  }
}
