import { createHmac } from "node:crypto";
import { metaSecrets } from "./settings";

export type MetaChannel = "whatsapp" | "instagram";

export interface InboundEvent {
  channel: MetaChannel;
  externalId: string;
  threadId: string;
  from: string;
  name: string;
  text: string;
  timestamp: string;
}

/** True when the integration has no live credentials — we simulate delivery. */
export async function sandbox(channel: MetaChannel): Promise<boolean> {
  const s = await metaSecrets();
  return channel === "whatsapp" ? !(s.waPhoneId && s.waToken) : !(s.igAccountId && s.igToken);
}

export function verifySignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!appSecret) return true; // signature checking is opt-in until an app secret is set
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/* ------------------------------------------------------------------ */
/* WhatsApp Cloud API                                                   */
/* ------------------------------------------------------------------ */

export async function sendWhatsapp(to: string, body: string): Promise<{ ok: boolean; simulated?: boolean; error?: string; id?: string }> {
  const s = await metaSecrets();
  if (!s.waPhoneId || !s.waToken) {
    return { ok: true, simulated: true, id: `sim_${Date.now()}` };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${s.apiVersion}/${s.waPhoneId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s.waToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/[^\d+]/g, ""),
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Instagram Messaging (Graph API)                                      */
/* ------------------------------------------------------------------ */

export async function sendInstagram(recipientId: string, body: string): Promise<{ ok: boolean; simulated?: boolean; error?: string; id?: string }> {
  const s = await metaSecrets();
  if (!s.igAccountId || !s.igToken) {
    return { ok: true, simulated: true, id: `sim_${Date.now()}` };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${s.apiVersion}/${s.igAccountId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s.igToken}` },
      body: JSON.stringify({ messaging_product: "instagram", recipient: { id: recipientId }, message: { text: body } }),
    });
    if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
    const data = (await res.json()) as { message_id?: string };
    return { ok: true, id: data.message_id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Webhook parsing                                                      */
/* ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseWebhook(payload: any): InboundEvent[] {
  const events: InboundEvent[] = [];
  const kind: string = payload?.object ?? "";

  if (kind === "whatsapp_business_account") {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        for (const message of value.messages ?? []) {
          if (message.type !== "text" || !message.text?.body) continue;
          const waId: string = message.from ?? "";
          const name: string = (value.contacts ?? []).find((c: any) => c.wa_id === waId)?.profile?.name ?? "";
          events.push({
            channel: "whatsapp",
            externalId: message.id ?? `wa_${Date.now()}`,
            threadId: waId,
            from: waId,
            name,
            text: message.text.body as string,
            timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
          });
        }
      }
    }
  }

  if (kind === "instagram") {
    for (const entry of payload.entry ?? []) {
      for (const item of entry.messaging ?? []) {
        const text: string = item?.message?.text ?? "";
        if (!text) continue;
        events.push({
          channel: "instagram",
          externalId: item.message?.mid ?? `ig_${Date.now()}`,
          threadId: item.sender?.id ?? "",
          from: item.sender?.id ?? "",
          name: "",
          text,
          timestamp: new Date(Number(item.timestamp ?? Date.now())).toISOString(),
        });
      }
    }
  }

  return events;
}
