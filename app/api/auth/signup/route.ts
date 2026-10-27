import { cookies } from 'next/headers';
import { cookieOptions, errorResponse, readJson, seal } from '@/lib/security';
import { createFreeEmailAccount, normalizeEmail } from '@/lib/accounts';
import { enforceAuthRateLimit, requestIp } from '@/lib/auth-rate-limit';
import { databaseHealth, ensureAccountSchema } from '@/lib/db';

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (
    !!origin &&
    (new URL(origin).host === request.headers.get('host') || origin === process.env.APP_URL)
  );
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new Error('Invalid request origin.');
    if ((process.env.SESSION_SECRET?.length || 0) < 32)
      throw new Error('This workspace is not ready to create accounts. Contact the administrator.');
    await ensureAccountSchema();
    if (!(await databaseHealth()).ready)
      throw new Error('Account storage is temporarily unavailable. Please try again later.');
    await enforceAuthRateLimit([`ip:${requestIp(request)}`]);
    const input = await readJson(request, 5000);
    const email = normalizeEmail(String(input?.email || ''));
    await enforceAuthRateLimit([`email:${email}`]);
    const password = typeof input?.password === 'string' ? input.password : '';
    const confirmPassword = typeof input?.confirmPassword === 'string' ? input.confirmPassword : '';
    if (password !== confirmPassword) throw new Error('Passwords do not match.');
    if (password.length < 12) throw new Error('Choose a password of at least 12 characters.');
    const user = await createFreeEmailAccount(email, password);
    (await cookies()).set('relay_auth', seal({ userId: user.id }, 30 * 86400), {
      ...cookieOptions,
      maxAge: 30 * 86400,
    });
    return Response.json({ ok: true, plan: 'free' });
  } catch (error) {
    return errorResponse(error);
  }
}
