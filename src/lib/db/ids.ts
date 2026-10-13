import { randomBytes, randomUUID } from "node:crypto";

export function newId(prefix = ""): string {
  const id = randomUUID().replace(/-/g, "").slice(0, 20);
  return prefix ? `${prefix}_${id}` : id;
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
