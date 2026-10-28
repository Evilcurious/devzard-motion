function reportedTokens(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  }
  return null;
}

function firstObject(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>;
  }
  return null;
}

export function normalizeProviderTokenUsage(usage: unknown) {
  const record = firstObject(usage);
  if (!record) return { inputTokens: null, outputTokens: null };
  const inputTokens = reportedTokens(
    record.prompt_tokens,
    record.input_tokens,
    record.prompt_eval_count,
    record.promptTokenCount,
    record.inputTokenCount,
  );
  const outputTokens = reportedTokens(
    record.completion_tokens,
    record.output_tokens,
    record.eval_count,
    record.candidatesTokenCount,
    record.outputTokenCount,
  );
  const totalTokens = reportedTokens(
    record.total_tokens,
    record.totalTokens,
    record.totalTokenCount,
  );

  if (totalTokens !== null) {
    if (inputTokens === null && outputTokens === null) {
      // Some compatible gateways report only a total. Count it conservatively as input
      // so capped accounts do not lose the usage just because the split is unavailable.
      return { inputTokens: totalTokens, outputTokens: 0 };
    }
    if (inputTokens === null && outputTokens !== null && totalTokens >= outputTokens)
      return { inputTokens: totalTokens - outputTokens, outputTokens };
    if (outputTokens === null && inputTokens !== null && totalTokens >= inputTokens)
      return { inputTokens, outputTokens: totalTokens - inputTokens };
  }
  return { inputTokens, outputTokens };
}

export function normalizeProviderResponseUsage(response: unknown) {
  const record = firstObject(response);
  return normalizeProviderTokenUsage(
    record?.usage ?? record?.usageMetadata ?? record?.usage_metadata ?? response,
  );
}

export function providerRetryAfterMs(headers: Headers, now = Date.now()) {
  const value = headers.get('retry-after')?.trim();
  if (!value) return null;
  const seconds = Number(value);
  const retryAt =
    Number.isFinite(seconds) && seconds >= 0 ? now + seconds * 1000 : Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(1000, Math.min(60 * 60_000, retryAt - now));
}
