import { dbQuery } from './db';
import { accountDbQuery } from './tenant-database';
import { decryptSecret, encryptSecret } from './secret-crypto';
export { decryptSecret, encryptSecret } from './secret-crypto';

export async function readSecret<T>(key: string): Promise<T | null> {
  const result = await accountDbQuery('SELECT encrypted_value FROM relay_settings WHERE key = $1', [
    key,
  ]);
  return result.rows[0] ? decryptSecret<T>(result.rows[0].encrypted_value, key) : null;
}
export async function writeSecret(key: string, value: unknown) {
  const encrypted = encryptSecret(value, key);
  await accountDbQuery(
    'INSERT INTO relay_settings (key, encrypted_value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET encrypted_value=EXCLUDED.encrypted_value, updated_at=now()',
    [key, encrypted],
  );
}
export async function deleteSecret(key: string) {
  await accountDbQuery('DELETE FROM relay_settings WHERE key = $1', [key]);
}
export async function readCentralSecret<T>(key: string): Promise<T | null> {
  const result = await dbQuery('SELECT encrypted_value FROM relay_settings WHERE key = $1', [key]);
  return result.rows[0] ? decryptSecret<T>(result.rows[0].encrypted_value, key) : null;
}
export async function writeCentralSecret(key: string, value: unknown) {
  const encrypted = encryptSecret(value, key);
  await dbQuery(
    'INSERT INTO relay_settings (key, encrypted_value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET encrypted_value=EXCLUDED.encrypted_value, updated_at=now()',
    [key, encrypted],
  );
}
export async function deleteCentralSecret(key: string) {
  await dbQuery('DELETE FROM relay_settings WHERE key = $1', [key]);
}
