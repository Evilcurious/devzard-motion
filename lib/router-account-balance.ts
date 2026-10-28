export type OpenRouterAccountBalance = { eligible: boolean; label: string | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dataRecord(value: unknown) {
  const record = asRecord(value);
  return asRecord(record?.data) || record;
}

function balanceNumber(value: unknown): number | null {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

export function normalizeOpenRouterAccountBalance(
  creditsBody: unknown,
  keyBody: unknown,
): OpenRouterAccountBalance {
  const credits = dataRecord(creditsBody);
  const key = dataRecord(keyBody);
  const total = balanceNumber(credits?.total_credits);
  const used = balanceNumber(credits?.total_usage);
  const keyRemaining = balanceNumber(key?.limit_remaining);
  const remaining = total !== null && used !== null ? total - used : null;
  const keyLimitEmpty = keyRemaining !== null && keyRemaining <= 0;
  return {
    eligible: !keyLimitEmpty && remaining !== null && remaining > 0,
    label:
      remaining !== null
        ? `$${Math.max(0, remaining).toFixed(2)} USD account credits remaining${keyRemaining !== null ? ` · key $${Math.max(0, keyRemaining).toFixed(2)} remaining` : ''}`
        : keyRemaining !== null
          ? `Key limit: $${Math.max(0, keyRemaining).toFixed(2)} remaining`
          : null,
  };
}

export function normalizeSiliconFlowAccountBalance(body: unknown): string | null {
  const data = dataRecord(body);
  const amount = balanceNumber(data?.totalBalance ?? data?.balance);
  return amount === null ? null : `CNY ${Math.max(0, amount).toFixed(2)} account credits reported`;
}
