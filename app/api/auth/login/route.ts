import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { cookieOptions, equal, seal, errorResponse, readJson } from '@/lib/security';
import {
  findUserByEmail,
  findUserByUsername,
  normalizeEmail,
  verifyAccountPassword,
} from '@/lib/accounts';
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
      throw new Error(
        'Set SESSION_SECRET to at least 32 random characters in your server environment.',
      );
    await ensureAccountSchema();
    if (!(await databaseHealth()).ready)
      throw new Error('Account storage is temporarily unavailable. Please try again later.');
    await enforceAuthRateLimit([`ip:${requestIp(request)}`]);
    const { email: emailValue, username, password } = await readJson(request, 4000);
    const identity = String(emailValue || username || '').trim();
    if (!identity || typeof password !== 'string' || !password)
      return Response.json({ error: 'Enter your email and password.' }, { status: 401 });
    await enforceAuthRateLimit([`email:${identity.toLowerCase()}`]);
    if (identity.toLowerCase() === 'admin' || identity.toLowerCase() === 'owner') {
      if (!process.env.APP_PASSWORD || !equal(password, process.env.APP_PASSWORD))
        return Response.json({ error: 'Incorrect email or password.' }, { status: 401 });
      const token = seal(
        { fingerprint: createHash('sha256').update(password).digest('hex') },
        7 * 86400,
      );
      (await cookies()).set('relay_auth', token, { ...cookieOptions, maxAge: 7 * 86400 });
      return Response.json({ ok: true });
    }
    const user = identity.includes('@')
      ? await findUserByEmail(normalizeEmail(identity))
      : await findUserByUsername(identity);
    const userEmail = user && 'email' in user ? user.email : null;
    if (user)
      await enforceAuthRateLimit([
        `account:${user.id}`,
        ...(userEmail ? [`email:${userEmail}`] : []),
      ]);
    if (!user?.enabled || !user.passwordHash || !verifyAccountPassword(password, user.passwordHash))
      return Response.json({ error: 'Incorrect email or password.' }, { status: 401 });
    const token = seal({ userId: user.id }, 30 * 86400);
    (await cookies()).set('relay_auth', token, { ...cookieOptions, maxAge: 30 * 86400 });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
