import { cookies } from 'next/headers';
import { databaseConfigured } from './db';
import { readSecret, writeSecret, deleteSecret } from './secrets';
import { seal, unseal, cookieOptions, sessionAccountId } from './security';
type ConnectionScope = 'current' | 'owner';
async function scopedKey(name: string, scope: ConnectionScope = 'current') {
  const accountId = scope === 'owner' ? 'owner' : await sessionAccountId();
  return accountId === 'owner' ? name : `account:${accountId}:${name}`;
}
async function cookieName(name: string, scope: ConnectionScope = 'current') {
  const accountId = scope === 'owner' ? 'owner' : await sessionAccountId();
  return accountId === 'owner' ? `relay_${name}` : `relay_${accountId}_${name}`;
}
export async function readConnection<T>(name: string, scope: ConnectionScope = 'current'): Promise<T | null> {
  const key = await scopedKey(name, scope);
  if (databaseConfigured()) return readSecret<T>(key);
  return unseal<T>((await cookies()).get(await cookieName(name, scope))?.value || '');
}
export async function saveConnection(name: string, value: unknown, scope: ConnectionScope = 'current') {
  if ((process.env.SESSION_SECRET?.length || 0) < 32)
    throw new Error(
      process.env.VERCEL
        ? 'Set a stable SESSION_SECRET of at least 32 characters in Vercel → Project Settings → Environment Variables, then redeploy. Preserve the existing value so saved credentials remain readable.'
        : 'Run npm run setup, then restart Relay before saving credentials. This creates SESSION_SECRET and a workspace password without changing your existing settings.',
    );
  const jar = await cookies();
  const key = await scopedKey(name, scope);
  const cookie = await cookieName(name, scope);
  if (databaseConfigured()) {
    await writeSecret(key, value);
    jar.delete(cookie);
  } else {
    const encrypted = seal(value, 30 * 86400);
    if (encrypted.length > 3800)
      throw new Error(
        'This connection is too large for cookie storage. Connect Neon Postgres to save it.',
      );
    jar.set(cookie, encrypted, { ...cookieOptions, maxAge: 30 * 86400 });
  }
}
export async function removeConnection(name: string, scope: ConnectionScope = 'current') {
  const key = await scopedKey(name, scope);
  if (databaseConfigured()) await deleteSecret(key);
  (await cookies()).delete(await cookieName(name, scope));
}
