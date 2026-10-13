import { NextResponse } from "next/server";
import { metaSecrets } from "@/lib/settings";
import { parseWebhook, verifySignature } from "@/lib/meta";
import { handleIncoming } from "@/lib/pipeline";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Meta webhook verification handshake. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const { verifyToken } = await metaSecrets();

  if (mode === "subscribe" && token && token === verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/** Inbound WhatsApp / Instagram messages. */
export async function POST(request: Request) {
  const raw = await request.text();
  const { appSecret } = await metaSecrets();

  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = parseWebhook(payload as Record<string, unknown>);
  const results = [];

  for (const event of events) {
    const out = await handleIncoming({
      channel: event.channel,
      externalId: event.externalId,
      threadId: event.threadId,
      from: event.from,
      name: event.name || event.from,
      text: event.text,
    });
    results.push({ channel: event.channel, conversationId: out.conversationId, status: out.reply?.status ?? "no_reply" });
  }

  if (events.length) await logActivity("info", `Meta webhook: ${events.length} inbound message(s)`);
  return NextResponse.json({ received: events.length, results });
}
