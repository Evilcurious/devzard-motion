/* eslint-disable @typescript-eslint/no-explicit-any */
import { estimateCost } from "./pricing";
import type { AiRequest, AiResult, ProviderId, ResolvedProvider } from "./types";

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  return b.endsWith("/v1") && path.startsWith("/chat") ? `${b}${path}` : `${b}${path}`;
}

/** Strip a ```json fence if the model ignored the JSON instruction. */
export function cleanJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body.trim();
}

async function openaiCompatible(p: ResolvedProvider, req: AiRequest): Promise<AiResult> {
  const started = Date.now();
  const body: any = {
    model: p.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 700,
    stream: false,
  };
  if (req.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (p.apiKey) headers.authorization = `Bearer ${p.apiKey}`;

  const res = await fetch(joinUrl(p.baseUrl, "/chat/completions"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`${p.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as any;
  const text = data?.choices?.[0]?.message?.content ?? "";
  const tokensIn = data?.usage?.prompt_tokens ?? 0;
  const tokensOut = data?.usage?.completion_tokens ?? 0;

  return {
    text,
    provider: p.provider,
    model: p.model,
    tokensIn,
    tokensOut,
    costUsd: estimateCost(p.provider, p.model, tokensIn, tokensOut),
    ms: Date.now() - started,
  };
}

async function ollamaNative(p: ResolvedProvider, req: AiRequest): Promise<AiResult> {
  const started = Date.now();
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  if (system) rest.unshift({ role: "system", content: system });

  const res = await fetch(joinUrl(p.baseUrl, "/api/chat"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      messages: rest,
      stream: false,
      format: req.json ? "json" : undefined,
      options: { temperature: req.temperature ?? 0.3, num_predict: req.maxTokens ?? 700 },
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as any;
  return {
    text: data?.message?.content ?? "",
    provider: "ollama",
    model: p.model,
    tokensIn: data?.prompt_eval_count ?? 0,
    tokensOut: data?.eval_count ?? 0,
    costUsd: 0,
    ms: Date.now() - started,
  };
}

async function gemini(p: ResolvedProvider, req: AiRequest): Promise<AiResult> {
  const started = Date.now();
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const url = `${p.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: req.maxTokens ?? 700,
        responseMimeType: req.json ? "application/json" : undefined,
      },
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as any;
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((x: any) => x?.text ?? "").join("");
  const tokensIn = data?.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = data?.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    text,
    provider: "gemini",
    model: p.model,
    tokensIn,
    tokensOut,
    costUsd: estimateCost("gemini", p.model, tokensIn, tokensOut),
    ms: Date.now() - started,
  };
}

async function anthropic(p: ResolvedProvider, req: AiRequest): Promise<AiResult> {
  const started = Date.now();
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const messages = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch(joinUrl(p.baseUrl, "/messages"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: p.model,
      system: system || undefined,
      messages,
      max_tokens: req.maxTokens ?? 700,
      temperature: req.temperature ?? 0.3,
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as any;
  const text = (data?.content ?? []).map((c: any) => c?.text ?? "").join("");
  const tokensIn = data?.usage?.input_tokens ?? 0;
  const tokensOut = data?.usage?.output_tokens ?? 0;
  return {
    text,
    provider: "anthropic",
    model: p.model,
    tokensIn,
    tokensOut,
    costUsd: estimateCost("anthropic", p.model, tokensIn, tokensOut),
    ms: Date.now() - started,
  };
}

export async function callProvider(p: ResolvedProvider, req: AiRequest): Promise<AiResult> {
  switch (p.provider) {
    case "ollama":
      return ollamaNative(p, req);
    case "gemini":
      return gemini(p, req);
    case "anthropic":
      return anthropic(p, req);
    default:
      return openaiCompatible(p, req);
  }
}

/** Live model list where the provider exposes one; static list otherwise. */
export async function listModels(p: ResolvedProvider): Promise<string[]> {
  try {
    if (p.provider === "ollama") {
      const res = await fetch(joinUrl(p.baseUrl, "/api/tags"), { signal: AbortSignal.timeout(5000) });
      const data = (await res.json()) as any;
      const names: string[] = (data?.models ?? []).map((m: any) => m?.name).filter(Boolean);
      if (names.length) return names;
    } else if (p.provider !== "gemini" && p.provider !== "anthropic") {
      const headers: Record<string, string> = {};
      if (p.apiKey) headers.authorization = `Bearer ${p.apiKey}`;
      const res = await fetch(joinUrl(p.baseUrl, "/models"), { headers, signal: AbortSignal.timeout(6000) });
      const data = (await res.json()) as any;
      const ids: string[] = (data?.data ?? []).map((m: any) => m?.id).filter(Boolean);
      if (ids.length) return ids.slice(0, 200);
    }
  } catch {
    /* fall through to the static catalogue */
  }
  const { providerMeta } = await import("./catalog");
  return providerMeta(p.provider).models;
}

export type { ProviderId };
