function reportedTokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function normalizeProviderTokenUsage(usage: unknown) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage))
    return { inputTokens: null, outputTokens: null };
  const record = usage as Record<string, unknown>;
  let inputTokens = reportedTokens(record.prompt_tokens ?? record.input_tokens);
  let outputTokens = reportedTokens(record.completion_tokens ?? record.output_tokens);
  const totalTokens = reportedTokens(record.total_tokens);

  if (totalTokens !== null) {
    if (inputTokens === null && outputTokens === null) {
      // Some OpenAI-compatible gateways report only total_tokens. Keep monthly
      // usage accounting correct even though the input/output split is unknown.
      inputTokens = totalTokens;
      outputTokens = 0;
    } else if (inputTokens === null && outputTokens !== null && totalTokens >= outputTokens) {
      inputTokens = totalTokens - outputTokens;
    } else if (outputTokens === null && inputTokens !== null && totalTokens >= inputTokens) {
      outputTokens = totalTokens - inputTokens;
    }
  }
  return { inputTokens, outputTokens };
}
