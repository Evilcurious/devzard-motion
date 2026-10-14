import { cookies } from 'next/headers';
import { guard, errorResponse } from '@/lib/security';
export async function POST(request: Request) {
  try {
    await guard(request);
    (await cookies()).delete('relay_google');
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
