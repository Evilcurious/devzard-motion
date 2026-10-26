import { cookies } from 'next/headers';
import { guard, errorResponse } from '@/lib/security';
export async function POST(request: Request) {
  try {
    await guard(request);
    const jar = await cookies();
    jar.delete('relay_auth');
    jar.delete('relay_google');
    jar.delete('relay_model');
    jar.delete('relay_google_client');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
