import { removeConnection } from '@/lib/connection-store';
import { guard, errorResponse } from '@/lib/security';
export async function POST(request: Request) {
  try {
    await guard(request);
    await removeConnection('google');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
