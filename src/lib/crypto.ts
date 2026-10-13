import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALGO = "aes-256-gcm";

function secret(): Buffer {
  const raw = process.env.APP_SECRET || "dev-secret-change-me-0123456789abcdef0123456789abcdef";
  // Derive a stable 32-byte key from whatever string the user configured.
  return createHmac("sha256", raw).update("devzard-motion:v1").digest();
}

/** Encrypt a secret (API key, OAuth refresh token) before it hits the DB. */
export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, secret(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  if (!payload) return "";
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== "v1") return "";
    const decipher = createDecipheriv(ALGO, secret(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
