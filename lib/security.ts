import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { getUserPolicy, type UserPolicy } from './accounts';

const developmentKey = randomBytes(32).toString('hex');
function key() {
  return createHash('sha256')
    .update(process.env.SESSION_SECRET || developmentKey)
    .digest();
}
export function seal(value: unknown, seconds = 3600) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ value, expires: Date.now() + seconds * 1000 })),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function unseal<T>(token: string): T | null {
  try {
    const buffer = Buffer.from(token, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key(), buffer.subarray(0, 12));
    cipher.setAuthTag(buffer.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString(),
    );
    return payload.expires > Date.now() ? (payload.value as T) : null;
  } catch {
    return null;
  }
}
export function equal(a: string, b: string) {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.APP_URL?.startsWith('https://') || !!process.env.VERCEL,
  sameSite: 'lax' as const,
  path: '/',
};
export type AdminPrincipal = {
  id: 'owner';
  role: 'admin';
  username: 'admin';
};
export type UserPrincipal = UserPolicy & {
  role: 'user';
};
export type Principal = AdminPrincipal | UserPrincipal;
type SessionPayload = { fingerprint?: string; userId?: string };
async function sessionPayload() {
  const token = (await cookies()).get('relay_auth')?.value;
  return token ? unseal<SessionPayload>(token) : null;
}
export async function getPrincipal(): Promise<Principal | null> {
  if ((process.env.VERCEL || process.env.DATABASE_URL) && !process.env.APP_PASSWORD) return null;
  if ((process.env.SESSION_SECRET?.length || 0) < 32 && process.env.APP_PASSWORD) return null;
  if (!process.env.APP_PASSWORD) return { id: 'owner', role: 'admin', username: 'admin' };
  const session = await sessionPayload();
  if (!session) return null;
  const fingerprint = createHash('sha256').update(process.env.APP_PASSWORD).digest('hex');
  if (session.fingerprint && equal(session.fingerprint, fingerprint))
    return { id: 'owner', role: 'admin', username: 'admin' };
  if (!session.userId) return null;
  try {
    const user = await getUserPolicy(session.userId);
    return user?.enabled ? { ...user, role: 'user' } : null;
  } catch {
    return null;
  }
}
export async function sessionAccountId() {
  const session = await sessionPayload();
  return session?.userId || 'owner';
}
export async function authorized() {
  return !!(await getPrincipal());
}
export async function guard(request?: Request): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new Error('UNAUTHORIZED');
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || (new URL(origin).host !== host && origin !== process.env.APP_URL))
      throw new Error('Invalid request origin.');
  }
  return principal;
}
export async function requireAdmin(request?: Request): Promise<AdminPrincipal> {
  const principal = await guard(request);
  if (principal.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return principal;
}
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const status = message === 'UNAUTHORIZED' ? 401 : message === 'ADMIN_REQUIRED' ? 403 : 400;
  return Response.json({ error: message }, { status });
}
export async function readJson(request: Request, max = 250_000) {
  const text = await request.text();
  if (text.length > max) throw new Error('Request is too large. Start a new conversation.');
  return JSON.parse(text);
}
