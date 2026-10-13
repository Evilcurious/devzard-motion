import type { ProviderId } from "./types";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** true = runs on your own machine / your own box, no per-token bill */
  local: boolean;
  defaultModel: string;
  models: string[];
  defaultBase: string;
  keyEnv: string;
  needsKey: boolean;
  docs: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI",
    local: false,
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    defaultBase: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    needsKey: true,
    docs: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    local: false,
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
    defaultBase: "https://generativelanguage.googleapis.com/v1beta",
    keyEnv: "GEMINI_API_KEY",
    needsKey: true,
    docs: "https://aistudio.google.com/apikey",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    local: false,
    defaultModel: "claude-3-5-sonnet-latest",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
    defaultBase: "https://api.anthropic.com/v1",
    keyEnv: "ANTHROPIC_API_KEY",
    needsKey: true,
    docs: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter (300+ models)",
    local: false,
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    models: [
      "meta-llama/llama-3.3-70b-instruct",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o-mini",
      "deepseek/deepseek-chat",
    ],
    defaultBase: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    needsKey: true,
    docs: "https://openrouter.ai/keys",
  },
  {
    id: "groq",
    label: "Groq (very fast)",
    local: false,
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    defaultBase: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    needsKey: true,
    docs: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    local: false,
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultBase: "https://api.deepseek.com/v1",
    keyEnv: "DEEPSEEK_API_KEY",
    needsKey: true,
    docs: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    label: "Mistral",
    local: false,
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest", "open-mistral-nemo"],
    defaultBase: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    needsKey: true,
    docs: "https://console.mistral.ai/api-keys",
  },
  {
    id: "ollama",
    label: "Ollama (local, free)",
    local: true,
    defaultModel: "llama3.1",
    models: ["llama3.1", "llama3.2", "mistral", "qwen2.5", "phi4", "gemma2", "deepseek-r1"],
    defaultBase: "http://localhost:11434",
    keyEnv: "",
    needsKey: false,
    docs: "https://ollama.com/download",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local, free)",
    local: true,
    defaultModel: "local-model",
    models: ["local-model"],
    defaultBase: "http://localhost:1234/v1",
    keyEnv: "",
    needsKey: false,
    docs: "https://lmstudio.ai/",
  },
  {
    id: "custom",
    label: "Custom (any OpenAI-compatible server)",
    local: true,
    defaultModel: "local-model",
    models: ["local-model"],
    defaultBase: "http://localhost:8000/v1",
    keyEnv: "CUSTOM_API_KEY",
    needsKey: false,
    docs: "llama.cpp · vLLM · text-generation-webui · LocalAI · Ollama /v1",
  },
];

export function providerMeta(id: ProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
