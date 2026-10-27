import { cookies } from 'next/headers';
import { cookieOptions, errorResponse, readJson, seal } from '@/lib/security';
import { inspectUserInvite, redeemUserInvite } from '@/lib/accounts';
import { enforceAuthRateLimit, requestIp } from '@/lib/auth-rate-limit';
import { ensureAccountSchema } from '@/lib/db';
export const dynamic = 'force-dynamic';
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (
    !!origin &&
    (new URL(origin).host === request.headers.get('host') || origin === process.env.APP_URL)
  );
}
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    return Response.json(await inspectUserInvite(token), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new Error('Invalid request origin.');
    if ((process.env.SESSION_SECRET?.length || 0) < 32)
      throw new Error(
        'This workspace is not ready to create an account. Ask the administrator for help.',
      );
    const input = await readJson(request, 4000);
    if (typeof input?.token !== 'string' || input.token.length > 100)
      throw new Error('This setup link is invalid or expired.');
    const username = String(input?.username || '')
      .trim()
      .toLowerCase();
    await ensureAccountSchema();
    await enforceAuthRateLimit([`ip:${requestIp(request)}`, `account:${username}`]);
    const user = await redeemUserInvite(input.token, username, input.password);
    (await cookies()).set('relay_auth', seal({ userId: user.id }, 30 * 86400), {
      ...cookieOptions,
      maxAge: 30 * 86400,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
