import { getDb, nowIso } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { AiConfig, ProviderId } from "./ai/types";

export type { AiConfig, ProviderId } from "./ai/types";
import { providerMeta } from "./ai/catalog";

/* ------------------------------------------------------------------ */
/* raw key/value                                                       */
/* ------------------------------------------------------------------ */

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, nowIso()],
  );
}

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await setSetting(key, JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/* AI                                                                   */
/* ------------------------------------------------------------------ */

export const AI_DEFAULTS: AiConfig = {
  provider: "ollama",
  model: "llama3.1",
  temperature: 0.3,
  maxTokens: 700,
  fallbackProvider: "",
  fallbackModel: "",
  keys: {},
  bases: {},
};

export async function getAiConfig(): Promise<AiConfig> {
  const stored = await getJson<Partial<AiConfig>>("ai_config", {});
  const provider = (stored.provider || (process.env.AI_PROVIDER as ProviderId) || "ollama") as ProviderId;
  const meta = providerMeta(provider);

  const keys: Partial<Record<ProviderId, string>> = {};
  for (const p of ["openai", "gemini", "anthropic", "openrouter", "groq", "deepseek", "mistral", "custom"] as ProviderId[]) {
    const fromDb = stored.keys?.[p] ? decrypt(stored.keys[p] as string) : "";
    const envKey = process.env[providerMeta(p).keyEnv] ?? "";
    const value = fromDb || envKey || "";
    if (value) keys[p] = value;
  }

  const bases: Partial<Record<ProviderId, string>> = { ...(stored.bases ?? {}) };
  if (!bases.openai) bases.openai = process.env.OPENAI_BASE_URL || providerMeta("openai").defaultBase;
  if (!bases.ollama) bases.ollama = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  if (!bases.lmstudio) bases.lmstudio = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
  if (!bases.custom) bases.custom = process.env.CUSTOM_BASE_URL || "http://localhost:8000/v1";

  return {
    provider,
    model: stored.model || process.env.AI_MODEL || meta.defaultModel,
    temperature: stored.temperature ?? 0.3,
    maxTokens: stored.maxTokens ?? 700,
    fallbackProvider: (stored.fallbackProvider || (process.env.AI_FALLBACK_PROVIDER as ProviderId) || "") as ProviderId | "",
    fallbackModel: stored.fallbackModel || process.env.AI_FALLBACK_MODEL || "",
    keys,
    bases,
  };
}

export async function setAiConfig(next: AiConfig): Promise<void> {
  const stored: Partial<AiConfig> = {
    provider: next.provider,
    model: next.model,
    temperature: next.temperature,
    maxTokens: next.maxTokens,
    fallbackProvider: next.fallbackProvider,
    fallbackModel: next.fallbackModel,
    keys: {},
    bases: next.bases ?? {},
  };
  for (const [p, key] of Object.entries(next.keys ?? {})) {
    if (key) (stored.keys as Record<string, string>)[p] = encrypt(key as string);
  }
  await setJson("ai_config", stored);
}

/* ------------------------------------------------------------------ */
/* Chatbot / agent behaviour                                            */
/* ------------------------------------------------------------------ */

export interface ChatbotConfig {
  name: string;
  welcome: string;
  color: string;
  position: "right" | "left";
  tone: string;
  systemPrompt: string;
  guardrails: string;
  fallbackReply: string;
  channels: { web: boolean; email: boolean; whatsapp: boolean; instagram: boolean };
  autoSend: boolean;
  autoSendConfidence: number;
  businessHours: string;
  handoffKeywords: string;
  signature: string;
}

export const CHATBOT_DEFAULTS: ChatbotConfig = {
  name: "Devzard Assistant",
  welcome: "Hi! Ask me anything about our products, pricing or delivery.",
  color: "#38bdf8",
  position: "right",
  tone: "friendly and concise",
  systemPrompt:
    "You are a customer support assistant. Answer ONLY from the provided knowledge base. Be short (2-5 sentences), never invent facts, prices or policies.",
  guardrails:
    "Never promise discounts you were not given. Never share internal data. If the answer is not in the knowledge base, say you will escalate to a human.",
  fallbackReply: "Thanks for reaching out! I don't have that detail to hand — a teammate will follow up shortly.",
  channels: { web: true, email: true, whatsapp: true, instagram: true },
  autoSend: false,
  autoSendConfidence: 0.75,
  businessHours: "Mon–Sat, 9am–7pm",
  handoffKeywords: "refund, cancel, complaint, legal, manager, human",
  signature: "\n\n— Devzard Motion Team",
};

export const getChatbotConfig = () => getJson<ChatbotConfig>("chatbot_config", CHATBOT_DEFAULTS);

/* ------------------------------------------------------------------ */
/* Google                                                               */
/* ------------------------------------------------------------------ */

export interface GoogleConfig {
  clientId: string;
  clientSecretEnc: string;
  tokensEnc: string;
  email: string;
  sheetId: string;
  sheetUrl: string;
  lastHistoryId: string;
  connectedAt: string;
  autoSetupSheet: boolean;
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GOOGLE_DEFAULTS: GoogleConfig = {
  clientId: "",
  clientSecretEnc: "",
  tokensEnc: "",
  email: "",
  sheetId: "",
  sheetUrl: "",
  lastHistoryId: "",
  connectedAt: "",
  autoSetupSheet: true,
};

export async function getGoogleConfig(): Promise<GoogleConfig> {
  const stored = await getJson<GoogleConfig>("google_config", GOOGLE_DEFAULTS);
  return {
    ...stored,
    clientId: stored.clientId || process.env.GOOGLE_CLIENT_ID || "",
    clientSecretEnc: stored.clientSecretEnc || (process.env.GOOGLE_CLIENT_SECRET ? encrypt(process.env.GOOGLE_CLIENT_SECRET) : ""),
    sheetId: stored.sheetId || process.env.GOOGLE_SHEET_ID || "",
  };
}

export function googleClientSecret(cfg: GoogleConfig): string {
  return cfg.clientSecretEnc ? decrypt(cfg.clientSecretEnc) : "";
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}

export function googleTokens(cfg: GoogleConfig): GoogleTokens | null {
  if (!cfg.tokensEnc) return null;
  try {
    return JSON.parse(decrypt(cfg.tokensEnc)) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function setGoogleTokens(tokens: GoogleTokens): Promise<void> {
  const current = await getGoogleConfig();
  await setJson("google_config", { ...current, tokensEnc: encrypt(JSON.stringify(tokens)) });
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/* ------------------------------------------------------------------ */
/* Meta — WhatsApp Cloud API + Instagram Messaging                      */
/* ------------------------------------------------------------------ */

export interface MetaConfig {
  verifyToken: string;
  appSecretEnc: string;
  waPhoneId: string;
  waTokenEnc: string;
  igAccountId: string;
  igTokenEnc: string;
  apiVersion: string;
  autoReplyWhatsapp: boolean;
  autoReplyInstagram: boolean;
}

export const META_DEFAULTS: MetaConfig = {
  verifyToken: "",
  appSecretEnc: "",
  waPhoneId: "",
  waTokenEnc: "",
  igAccountId: "",
  igTokenEnc: "",
  apiVersion: "v21.0",
  autoReplyWhatsapp: true,
  autoReplyInstagram: true,
};

export async function getMetaConfig(): Promise<MetaConfig> {
  const stored = await getJson<MetaConfig>("meta_config", META_DEFAULTS);
  return {
    ...stored,
    verifyToken: stored.verifyToken || process.env.META_VERIFY_TOKEN || "devzard-motion",
    appSecretEnc: stored.appSecretEnc || (process.env.META_APP_SECRET ? encrypt(process.env.META_APP_SECRET) : ""),
    waPhoneId: stored.waPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    waTokenEnc: stored.waTokenEnc || (process.env.WHATSAPP_ACCESS_TOKEN ? encrypt(process.env.WHATSAPP_ACCESS_TOKEN) : ""),
    igAccountId: stored.igAccountId || process.env.INSTAGRAM_ACCOUNT_ID || "",
    igTokenEnc: stored.igTokenEnc || (process.env.INSTAGRAM_ACCESS_TOKEN ? encrypt(process.env.INSTAGRAM_ACCESS_TOKEN) : ""),
    apiVersion: stored.apiVersion || process.env.WHATSAPP_API_VERSION || "v21.0",
  };
}

const dec = (v: string) => (v ? decrypt(v) : "");

export async function metaSecrets() {
  const cfg = await getMetaConfig();
  return {
    ...cfg,
    appSecret: dec(cfg.appSecretEnc),
    waToken: dec(cfg.waTokenEnc),
    igToken: dec(cfg.igTokenEnc),
  };
}

/* ------------------------------------------------------------------ */
/* Finance                                                              */
/* ------------------------------------------------------------------ */

export interface FinanceConfig {
  currency: string;
  monthlyBudget: number;
  aiBudget: number;
}

export const FINANCE_DEFAULTS: FinanceConfig = {
  currency: "USD",
  monthlyBudget: Number(process.env.DEFAULT_MONTHLY_BUDGET || 1000),
  aiBudget: 50,
};

export const getFinanceConfig = () => getJson<FinanceConfig>("finance_config", FINANCE_DEFAULTS);
