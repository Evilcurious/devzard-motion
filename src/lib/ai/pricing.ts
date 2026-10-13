/**
 * Rough USD price per 1M tokens (input, output).
 * Only used for the "AI spend" part of the budget dashboard — local models
 * are always 0. Unknown models fall back to the provider default.
 */
const TABLE: Record<string, [number, number]> = {
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2.0, 8.0],
  "o4-mini": [1.1, 4.4],
  "gemini-2.0-flash": [0.1, 0.4],
  "gemini-2.5-flash": [0.15, 0.6],
  "gemini-2.5-pro": [1.25, 10],
  "gemini-1.5-flash": [0.075, 0.3],
  "claude-3-5-haiku-latest": [0.8, 4],
  "claude-3-5-sonnet-latest": [3, 15],
  "claude-3-7-sonnet-latest": [3, 15],
  "llama-3.3-70b-versatile": [0.59, 0.79],
  "llama-3.1-8b-instant": [0.05, 0.08],
  "mixtral-8x7b-32768": [0.24, 0.24],
  "deepseek-chat": [0.27, 1.1],
  "deepseek-reasoner": [0.55, 2.19],
  "mistral-small-latest": [0.1, 0.3],
  "mistral-large-latest": [2, 6],
  "open-mistral-nemo": [0.15, 0.15],
};

const DEFAULTS: Record<string, [number, number]> = {
  openrouter: [0.4, 1.2],
  openai: [0.5, 1.5],
  gemini: [0.15, 0.6],
  anthropic: [3, 15],
  groq: [0.3, 0.4],
  deepseek: [0.3, 1.2],
  mistral: [0.2, 0.6],
};

export function estimateCost(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  if (provider === "ollama" || provider === "lmstudio" || provider === "custom") return 0;
  const rate = TABLE[model] ?? DEFAULTS[provider] ?? [0.5, 1.5];
  const cost = (tokensIn / 1_000_000) * rate[0] + (tokensOut / 1_000_000) * rate[1];
  return Math.round(cost * 1e6) / 1e6;
}
