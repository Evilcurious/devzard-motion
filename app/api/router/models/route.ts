import { guard, errorResponse } from '@/lib/security';
import { discoverRouterCatalog } from '@/lib/router-catalog';
import { filterCatalogForPrincipal, getUsageBlockedTargets } from '@/lib/account-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const principal = await guard();
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
    }
    return Response.json(catalog, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
