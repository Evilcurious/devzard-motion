import { newId } from "../db/ids";
import { nowIso, getDb } from "../db";
import { getAiConfig } from "../settings";
import { cleanJson, callProvider, listModels } from "./providers";
import { providerMeta } from "./catalog";
import type { AiConfig, AiRequest, AiResult, ProviderId, ResolvedProvider } from "./types";

export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90_000);

export function resolveFrom(config: AiConfig, provider: ProviderId, model: string): ResolvedProvider {
  const meta = providerMeta(provider);
  return {
    provider,
    model: model || meta.defaultModel,
    apiKey: config.keys?.[provider] ?? "",
    baseUrl: config.bases?.[provider] || meta.defaultBase,
  };
}

export async function activeProvider(): Promise<ResolvedProvider> {
  const cfg = await getAiConfig();
  return resolveFrom(cfg, cfg.provider, cfg.model);
}

export async function fallbackProvider(): Promise<ResolvedProvider | null> {
  const cfg = await getAiConfig();
  if (!cfg.fallbackProvider) return null;
  return resolveFrom(cfg, cfg.fallbackProvider, cfg.fallbackModel);
}

async function logUsage(feature: string, r: AiResult, ok: boolean): Promise<void> {
  try {
    const db = await getDb();
    await db.run(
      `INSERT INTO usage_logs (id, feature, provider, model, tokens_in, tokens_out, cost_usd, ok, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId("use"), feature, r.provider, r.model, r.tokensIn, r.tokensOut, r.costUsd, ok ? 1 : 0, nowIso()],
    );
  } catch {
    /* telemetry must never break a reply */
  }
}

export interface ChatOptions extends AiRequest {
  /** label used in the AI-spend dashboard, e.g. "chatbot" | "email" | "whatsapp" */
  feature?: string;
  /** skip the configured fallback provider */
  noFallback?: boolean;
}

/**
 * Single entry point for every AI call in the product.
 * Tries the active provider, then the configured fallback, then fails loudly.
 */
export async function aiChat(opts: ChatOptions): Promise<AiResult> {
  const cfg = await getAiConfig();
  const targets: ResolvedProvider[] = [
    resolveFrom(cfg, cfg.provider, cfg.model),
    ...(opts.noFallback ? [] : cfg.fallbackProvider ? [resolveFrom(cfg, cfg.fallbackProvider, cfg.fallbackModel)] : []),
  ];

  const errors: string[] = [];
  for (const target of targets) {
    const meta = providerMeta(target.provider);
    if (meta.needsKey && !target.apiKey) {
      errors.push(`${meta.label}: no API key set`);
      continue;
    }
    try {
      const result = await callProvider(target, {
        ...opts,
        temperature: opts.temperature ?? cfg.temperature,
        maxTokens: opts.maxTokens ?? cfg.maxTokens,
        signal: opts.signal ?? AbortSignal.timeout(AI_TIMEOUT_MS),
      });
      void logUsage(opts.feature ?? "generic", result, true);
      return result;
    } catch (err) {
      errors.push(`${target.provider}/${target.model}: ${(err as Error).message}`);
    }
  }

  const empty: AiResult = {
    text: "",
    provider: cfg.provider,
    model: cfg.model,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    ms: 0,
  };
  void logUsage(opts.feature ?? "generic", empty, false);
  throw new Error(`All AI providers failed → ${errors.join(" | ")}`);
}

/** Ask for JSON and parse it defensively. */
export async function aiJson<T>(opts: ChatOptions): Promise<{ data: T; raw: AiResult }> {
  const raw = await aiChat({ ...opts, json: true });
  try {
    return { data: JSON.parse(cleanJson(raw.text)) as T, raw };
  } catch {
    throw new Error(`Model did not return valid JSON: ${raw.text.slice(0, 200)}`);
  }
}

export async function testProvider(provider: ProviderId, model: string, key: string, base: string) {
  const cfg = await getAiConfig();
  const target: ResolvedProvider = {
    provider,
    model: model || providerMeta(provider).defaultModel,
    apiKey: key || cfg.keys?.[provider] || "",
    baseUrl: base || cfg.bases?.[provider] || providerMeta(provider).defaultBase,
  };
  const started = Date.now();
  try {
    const res = await callProvider(target, {
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      maxTokens: 16,
      temperature: 0,
      signal: AbortSignal.timeout(30_000),
    });
    return { ok: true as const, text: res.text.trim().slice(0, 80), ms: Date.now() - started, target };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message, ms: Date.now() - started, target };
  }
}

export { listModels, cleanJson };
export type { AiResult, ChatMessage, ProviderId } from "./types";
