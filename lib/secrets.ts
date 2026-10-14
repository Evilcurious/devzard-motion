import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { dbQuery } from './db';
function encryptionKey() {
  if ((process.env.SESSION_SECRET?.length || 0) < 32)
    throw new Error(
      'Run npm run setup, then restart Relay. A stable SESSION_SECRET of at least 32 characters is required to save API credentials.',
    );
  return createHash('sha256').update(process.env.SESSION_SECRET!).digest();
}
export function encryptSecret(value: unknown, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`relay:v1:${purpose}`));
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return 'v1.' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function decryptSecret<T>(value: string, purpose: string): T {
  const key = encryptionKey();
  try {
    if (!value.startsWith('v1.')) throw new Error();
    const buffer = Buffer.from(value.slice(3), 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
    cipher.setAAD(Buffer.from(`relay:v1:${purpose}`));
    cipher.setAuthTag(buffer.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString(),
    ) as T;
  } catch {
    throw new Error(
      'Saved credentials could not be decrypted. Restore the original SESSION_SECRET or remove and re-enter the saved connection.',
    );
  }
}
export async function readSecret<T>(key: string): Promise<T | null> {
  const result = await dbQuery('SELECT encrypted_value FROM relay_settings WHERE key = $1', [key]);
  return result.rows[0] ? decryptSecret<T>(result.rows[0].encrypted_value, key) : null;
}
export async function writeSecret(key: string, value: unknown) {
  const encrypted = encryptSecret(value, key);
  await dbQuery(
    'INSERT INTO relay_settings (key, encrypted_value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET encrypted_value=EXCLUDED.encrypted_value, updated_at=now()',
    [key, encrypted],
  );
}
export async function deleteSecret(key: string) {
  await dbQuery('DELETE FROM relay_settings WHERE key = $1', [key]);
}
