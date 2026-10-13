import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { retrieve } from "@/lib/rag/retrieve";
import { buildMessages } from "@/lib/rag/context";
import { aiChat } from "@/lib/ai";
import { getChatbotConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ query?: string; channel?: "web" | "email" | "whatsapp" | "instagram" }>(request);
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "Ask something first" }, { status: 400 });

  const cfg = await getChatbotConfig();
  const { messages, sources } = await buildMessages(query, cfg, { channel: body.channel ?? "web" });

  let answer = "";
  let meta = {};
  try {
    const res = await aiChat({ messages, feature: "kb-test" });
    answer = res.text.trim();
    meta = { provider: res.provider, model: res.model, ms: res.ms, costUsd: res.costUsd };
  } catch (err) {
    answer = "";
    meta = { error: (err as Error).message };
  }

  return NextResponse.json({
    answer,
    sources: sources.map((s) => ({ title: s.title, score: Math.round(s.score * 100) / 100, excerpt: s.text.slice(0, 240) })),
    meta,
  });
}

export async function GET(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await retrieve(q, 5) });
}
