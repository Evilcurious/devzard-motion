import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
function encryptionKey() {
  if ((process.env.SESSION_SECRET?.length || 0) < 32)
    throw new Error(
      process.env.VERCEL
        ? 'Set a stable SESSION_SECRET of at least 32 characters in Vercel → Project Settings → Environment Variables, then redeploy. Preserve the existing value so saved credentials remain readable.'
        : 'Run npm run setup, then restart Relay. A stable SESSION_SECRET of at least 32 characters is required to save API credentials.',
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
