import { guard, errorResponse } from '@/lib/security';
import { discoverRouterCatalog } from '@/lib/router-catalog';

export async function GET() {
  try {
    await guard();
    return Response.json(await discoverRouterCatalog(true), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
