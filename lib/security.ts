import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';

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
export async function authorized() {
  if ((process.env.VERCEL || process.env.DATABASE_URL) && !process.env.APP_PASSWORD) return false;
  if (process.env.APP_PASSWORD && (process.env.SESSION_SECRET?.length || 0) < 32) return false;
  if (!process.env.APP_PASSWORD) return true;
  const token = (await cookies()).get('relay_auth')?.value;
  const data = token && unseal<{ fingerprint: string }>(token);
  return (
    !!data &&
    equal(data.fingerprint, createHash('sha256').update(process.env.APP_PASSWORD).digest('hex'))
  );
}
export async function guard(request?: Request) {
  if (!(await authorized())) throw new Error('UNAUTHORIZED');
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || (new URL(origin).host !== host && origin !== process.env.APP_URL))
      throw new Error('Invalid request origin.');
  }
}
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return Response.json({ error: message }, { status: message === 'UNAUTHORIZED' ? 401 : 400 });
}
export async function readJson(request: Request, max = 250_000) {
  const text = await request.text();
  if (text.length > max) throw new Error('Request is too large. Start a new conversation.');
  return JSON.parse(text);
}
