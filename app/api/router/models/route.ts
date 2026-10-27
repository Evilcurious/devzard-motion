import { guard, errorResponse } from '@/lib/security';
import { discoverRouterCatalog } from '@/lib/router-catalog';
import { filterCatalogForPrincipal, getUsageBlockedTargets } from '@/lib/account-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const principal = await guard();
    if (principal.role === 'user' && principal.plan === 'premium')
      return Response.json(
        { models: [], providers: [], refreshedAt: new Date().toISOString(), metricsNote: null },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    let catalog = await discoverRouterCatalog(true);
    if (principal.role === 'user') {
      catalog = await filterCatalogForPrincipal(catalog, principal);
      const blocked = await getUsageBlockedTargets();
      catalog.models = catalog.models.flatMap((model) => {
        const providers = model.providers.filter(
          (provider) => !blocked.has(`${provider.id}::${provider.modelId}`),
        );
        return providers.length ? [{ ...model, providers }] : [];
      });
      catalog.providers = catalog.providers.map((provider) => ({
        ...provider,
        modelCount: catalog.models.reduce(
          (count, model) =>
            count + model.providers.filter((item) => item.id === provider.providerId).length,
          0,
        ),
      }));
    }
    return Response.json(catalog, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
