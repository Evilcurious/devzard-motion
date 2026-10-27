import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import {
  cookieOptions,
  equal,
  seal,
  errorResponse,
  readJson,
} from '@/lib/security';
import { findUserByUsername, verifyAccountPassword } from '@/lib/accounts';
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (
      !origin ||
      (new URL(origin).host !== request.headers.get('host') && origin !== process.env.APP_URL)
    )
      throw new Error('Invalid request origin.');
    if ((process.env.SESSION_SECRET?.length || 0) < 32)
      throw new Error('Set SESSION_SECRET to at least 32 random characters in your server environment.');
    const id = request.headers.get('x-forwarded-for') || 'local';
    const previous = attempts.get(id);
    const entry =
      previous && previous.reset > Date.now() ? previous : { count: 0, reset: Date.now() + 60000 };
    if (entry.count >= 8)
      return Response.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
    entry.count++;
    attempts.set(id, entry);
    if (attempts.size > 2000)
      for (const [key, value] of attempts) if (value.reset < Date.now()) attempts.delete(key);
    const { username, password } = await readJson(request, 3000);
    if (typeof password !== 'string' || !password)
      return Response.json({ error: 'Enter your password.' }, { status: 401 });
    let token: string;
    let maxAge: number;
    if (!username || username === 'admin') {
      if (
        !process.env.APP_PASSWORD ||
        !equal(password, process.env.APP_PASSWORD)
      )
        return Response.json({ error: 'Incorrect username or password.' }, { status: 401 });
      token = seal(
        { fingerprint: createHash('sha256').update(password).digest('hex') },
        7 * 86400,
      );
      maxAge = 7 * 86400;
    } else {
      if (typeof username !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}$/.test(username))
        return Response.json({ error: 'Incorrect username or password.' }, { status: 401 });
      const user = await findUserByUsername(username);
      if (!user?.enabled || !verifyAccountPassword(password, user.passwordHash))
        return Response.json({ error: 'Incorrect username or password.' }, { status: 401 });
      token = seal({ userId: user.id }, 30 * 86400);
      maxAge = 30 * 86400;
    }
    attempts.delete(id);
    (await cookies()).set('relay_auth', token, { ...cookieOptions, maxAge });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
