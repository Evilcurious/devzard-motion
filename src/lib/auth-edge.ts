/**
 * Edge-safe half of the auth layer.
 *
 * Middleware runs on the Edge runtime where `node:crypto` is unavailable, so
 * session verification is re-implemented with Web Crypto. It produces exactly
 * the same signature as the Node implementation in `auth.ts`, so a cookie
 * issued by either side validates on the other.
 */

export const SESSION_COOKIE = "dm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

const DEFAULT_SECRET = "dev-secret-change-me-0123456789abcdef0123456789abcdef";
const DERIVE_INFO = "devzard-motion:v1";
const encoder = new TextEncoder();

function configuredSecret(): string {
  return process.env.APP_SECRET || DEFAULT_SECRET;
}

async function signingKey(): Promise<CryptoKey> {
  const root = await crypto.subtle.importKey(
    "raw",
    encoder.encode(configuredSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // match node: createHmac("sha256", secret).update(DERIVE_INFO).digest()
  const derived = await crypto.subtle.sign("HMAC", root, encoder.encode(DERIVE_INFO));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signPayload(payload: string): Promise<string> {
  const key = await signingKey();
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cookie is present, correctly signed and not expired. */
export async function verifySessionWeb(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  if (!constantTimeEqual(sig, await signPayload(payload))) return false;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { t?: number };
    return typeof data.t === "number" && Date.now() - data.t <= SESSION_MAX_AGE * 1000;
  } catch {
    return false;
  }
}
