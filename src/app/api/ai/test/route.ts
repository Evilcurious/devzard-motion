import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { testProvider, listModels } from "@/lib/ai";
import { getAiConfig } from "@/lib/settings";
import type { ProviderId } from "@/lib/ai/types";

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ provider?: ProviderId; model?: string; key?: string; base?: string }>(request);
  const cfg = await getAiConfig();
  const provider = (body.provider ?? cfg.provider) as ProviderId;

  const result = await testProvider(provider, body.model ?? "", body.key ?? "", body.base ?? "");
  return NextResponse.json({
    ok: result.ok,
    message: result.ok ? `Connected — model replied "${result.text}"` : result.error,
    ms: result.ms,
    target: { provider: result.target.provider, model: result.target.model, baseUrl: result.target.baseUrl },
  });
}

export async function GET(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const provider = (new URL(request.url).searchParams.get("provider") ?? "openai") as ProviderId;
  const cfg = await getAiConfig();
  const models = await listModels({
    provider,
    model: "",
    apiKey: cfg.keys?.[provider] ?? "",
    baseUrl: cfg.bases?.[provider] ?? "",
  });
  return NextResponse.json({ provider, models });
}
