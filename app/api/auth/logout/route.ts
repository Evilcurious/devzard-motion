import { cookies } from 'next/headers';
import { errorResponse } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || (new URL(origin).host !== host && origin !== process.env.APP_URL))
      throw new Error('Invalid request origin.');
    const jar = await cookies();
    for (const name of [
      'relay_auth',
      'relay_google_auth_state',
      'relay_google',
      'relay_model',
      'relay_google_client',
    ])
      jar.delete(name);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
