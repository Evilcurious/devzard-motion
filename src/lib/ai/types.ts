export type ProviderId =
  | "openai"
  | "gemini"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "ollama"
  | "lmstudio"
  | "custom";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask for strict JSON output when the provider supports it. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface AiResult {
  text: string;
  provider: ProviderId;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  ms: number;
}

export interface ResolvedProvider {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface AiConfig {
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  fallbackProvider: ProviderId | "";
  fallbackModel: string;
  keys: Partial<Record<ProviderId, string>>;
  bases: Partial<Record<ProviderId, string>>;
}
