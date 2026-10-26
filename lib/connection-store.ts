import { cookies } from 'next/headers';
import { databaseConfigured } from './db';
import { readSecret, writeSecret, deleteSecret } from './secrets';
import { seal, unseal, cookieOptions } from './security';
export async function readConnection<T>(name: string): Promise<T | null> {
  if (databaseConfigured()) return readSecret<T>(name);
  return unseal<T>((await cookies()).get(`relay_${name}`)?.value || '');
}
export async function saveConnection(name: string, value: unknown) {
  if ((process.env.SESSION_SECRET?.length || 0) < 32)
    throw new Error(
      process.env.VERCEL
        ? 'Set a stable SESSION_SECRET of at least 32 characters in Vercel → Project Settings → Environment Variables, then redeploy. Preserve the existing value so saved credentials remain readable.'
        : 'Run npm run setup, then restart Relay before saving credentials. This creates SESSION_SECRET and a workspace password without changing your existing settings.',
    );
  const jar = await cookies();
  if (databaseConfigured()) {
    await writeSecret(name, value);
    jar.delete(`relay_${name}`);
  } else {
    const encrypted = seal(value, 30 * 86400);
    if (encrypted.length > 3800)
      throw new Error(
        'This connection is too large for cookie storage. Connect Neon Postgres to save it.',
      );
    jar.set(`relay_${name}`, encrypted, { ...cookieOptions, maxAge: 30 * 86400 });
  }
}
export async function removeConnection(name: string) {
  if (databaseConfigured()) await deleteSecret(name);
  (await cookies()).delete(`relay_${name}`);
}
