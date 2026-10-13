import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { handleIncoming, type Channel } from "@/lib/pipeline";
import { newId } from "@/lib/db/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Inject a fake inbound message.
 * Lets you demo the whole pipeline (AI draft → approve → send) before any
 * Meta app review or Google OAuth is in place.
 */
export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ channel?: Channel; from?: string; name?: string; text?: string }>(request);
  const channel = (body.channel ?? "whatsapp") as Channel;

  const presets: Record<string, { from: string; name: string; text: string }> = {
    whatsapp: { from: "+923001234567", name: "Ayesha (simulated)", text: "Do you deliver to Lahore and how much is shipping?" },
    instagram: { from: "ig_48271", name: "hamza_creates (simulated)", text: "hi! what are your prices?" },
    email: { from: "customer@example.com", name: "Bilal Ahmed", text: "Hi, can I get a discount on a bulk order of 50 units?" },
    web: { from: "visitor-demo", name: "Website visitor", text: "What is your refund policy?" },
  };
  const preset = presets[channel] ?? presets.whatsapp;

  const out = await handleIncoming({
    channel,
    externalId: newId("sim"),
    threadId: body.from || preset.from,
    from: body.from || preset.from,
    name: body.name || preset.name,
    text: body.text?.trim() || preset.text,
    autoReply: true,
  });

  return NextResponse.json({ ok: true, ...out });
}
