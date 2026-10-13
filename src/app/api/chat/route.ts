import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { handleIncoming } from "@/lib/pipeline";
import { getChatbotConfig } from "@/lib/settings";
import { buildMessages } from "@/lib/rag/context";
import { aiChat } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Crude in-memory throttle; swap for Upstash/KV if you need it across instances. */
const hits = new Map<string, { n: number; t: number }>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  rec.n++;
  return rec.n > 30;
}

/** Public endpoint used by the embeddable chat widget. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(ip)) return NextResponse.json({ error: "Too many messages — slow down a second." }, { status: 429 });

  let body: { message?: string; sessionId?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "Message too long" }, { status: 400 });

  const sessionId = body.sessionId?.trim() || newId("sess");

  try {
    const outcome = await handleIncoming({
      channel: "web",
      externalId: newId("wm"),
      threadId: sessionId,
      from: body.name?.trim() || `visitor-${sessionId.slice(0, 6)}`,
      name: body.name?.trim() || "Website visitor",
      text: message,
      autoReply: true,
    });

    const db = await getDb();
    let reply = await db.get<{ id: string; body: string; status: string; ai_confidence: number }>(
      `SELECT id, body, status, ai_confidence FROM messages
        WHERE conversation_id = ? AND role = 'ai' ORDER BY created_at DESC LIMIT 1`,
      [outcome.conversationId],
    );

    if (!reply) {
      // auto-reply switch was off for web — answer anyway so the widget is useful
      const cfg = await getChatbotConfig();
      const { messages } = await buildMessages(message, cfg, { channel: "web" });
      const res = await aiChat({ messages, feature: "chatbot" });
      const id = newId("msg");
      await db.run(
        `INSERT INTO messages (id, conversation_id, role, body, status, ai_confidence, ai_provider, ai_model, tokens_in, tokens_out, cost_usd, created_at)
         VALUES (?, ?, 'ai', ?, 'sent', 0.6, ?, ?, ?, ?, ?, ?)`,
        [id, outcome.conversationId, res.text.trim(), res.provider, res.model, res.tokensIn, res.tokensOut, res.costUsd, new Date().toISOString()],
      );
      reply = { id, body: res.text.trim(), status: "sent", ai_confidence: 0.6 };
    } else if (reply.status === "draft") {
      await db.run("UPDATE messages SET status = 'sent' WHERE id = ?", [reply.id]);
      reply.status = "sent";
    }

    return NextResponse.json({
      reply: reply.body,
      sessionId,
      conversationId: outcome.conversationId,
      confidence: Number(reply.ai_confidence ?? 0),
    });
  } catch (err) {
    const cfg = await getChatbotConfig();
    return NextResponse.json({ reply: cfg.fallbackReply, sessionId, error: (err as Error).message });
  }
}

/** Widget boot config (public — only non-secret fields). */
export async function GET() {
  const cfg = await getChatbotConfig();
  return NextResponse.json({
    name: cfg.name,
    welcome: cfg.welcome,
    color: cfg.color,
    position: cfg.position,
  });
}
