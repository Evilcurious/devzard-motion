type VolatileUsage = { accountId: string; at: number; tokens: number };
type UsageGlobal = typeof globalThis & { relayVolatileUsage?: VolatileUsage[] };
const usageGlobal = globalThis as UsageGlobal;

export function rememberUnpersistedUsage(
  accountId: string,
  inputTokens: number | null,
  outputTokens: number | null,
) {
  if (accountId === 'owner' || inputTokens === null || outputTokens === null) return;
  const entries = (usageGlobal.relayVolatileUsage ||= []);
  entries.push({ accountId, at: Date.now(), tokens: inputTokens + outputTokens });
  if (entries.length > 10000) entries.splice(0, entries.length - 10000);
}

export function unpersistedUsageThisMonth(accountId: string, now = Date.now()) {
  const date = new Date(now);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const entries = usageGlobal.relayVolatileUsage || [];
  return entries
    .filter((entry) => entry.accountId === accountId && entry.at >= start && entry.at <= now)
    .reduce((total, entry) => total + entry.tokens, 0);
}
