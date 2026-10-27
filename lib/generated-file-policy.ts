export const MAX_GENERATED_FILES = 30;
export const MAX_GENERATED_FILE_BYTES = 300_000;
const forbiddenNames = new Set(['.git', 'node_modules', '.next', '.vercel']);

export function isSafeGeneratedPath(path: string) {
  if (!path || path.length > 240 || path.startsWith('/') || path.includes('\\')) return false;
  if (/^[a-zA-Z]:|[\u0000-\u001f\u007f]/.test(path) || path.includes(':')) return false;
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return false;
  if (parts.some((part) => forbiddenNames.has(part.toLowerCase()))) return false;
  if (parts.some((part) => /^\.env(?:\.|$)/i.test(part))) return false;
  if (/\.(?:pem|key|p12|pfx)$/i.test(path)) return false;
  return true;
}
