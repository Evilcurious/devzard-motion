import { createDraft, markRead, sendMessage } from "./google/gmail";
import { sendInstagram, sendWhatsapp } from "./meta";

export type Channel = "web" | "email" | "whatsapp" | "instagram";

export const CHANNEL_LABEL: Record<Channel, string> = {
  web: "Website chat",
  email: "Email",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export interface DeliveryTarget {
  /** email address / wa number / ig scoped user id */
  to: string;
  threadId?: string;
  subject?: string;
  inReplyTo?: string;
  references?: string;
}

export interface DeliveryResult {
  ok: boolean;
  simulated: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Send (or stage) a reply on a channel.
 * With no credentials configured the call is simulated and flagged, so the
 * whole product is demo-able before any Meta app review.
 */
export async function deliver(channel: Channel, target: DeliveryTarget, body: string): Promise<DeliveryResult> {
  try {
    if (channel === "email") {
      if (!target.threadId) return { ok: false, simulated: false, error: "Missing email thread id" };
      const res = await sendMessage({
        to: target.to,
        subject: target.subject ?? "Re: your message",
        body,
        threadId: target.threadId,
        inReplyTo: target.inReplyTo,
        references: target.references,
      });
      return { ok: true, simulated: false, externalId: res.id };
    }

    if (channel === "whatsapp") {
      const res = await sendWhatsapp(target.to, body);
      return { ok: res.ok, simulated: !!res.simulated, externalId: res.id, error: res.error };
    }

    if (channel === "instagram") {
      const res = await sendInstagram(target.to, body);
      return { ok: res.ok, simulated: !!res.simulated, externalId: res.id, error: res.error };
    }

    // web: the widget polls the conversation, nothing to push
    return { ok: true, simulated: false };
  } catch (err) {
    return { ok: false, simulated: false, error: (err as Error).message };
  }
}

/** Stage a reply in Gmail Drafts for human review. */
export async function stageEmailDraft(
  target: DeliveryTarget,
  body: string,
  draftId?: string,
): Promise<{ ok: boolean; draftId?: string; simulated: boolean; error?: string }> {
  if (!target.threadId) return { ok: false, simulated: false, error: "Missing email thread id" };
  try {
    const args = {
      to: target.to,
      subject: target.subject ?? "Re: your message",
      body,
      threadId: target.threadId,
      inReplyTo: target.inReplyTo,
      references: target.references,
    };
    const res = draftId ? await import("./google/gmail").then((m) => m.updateDraft(draftId, args)) : await createDraft(args);
    return { ok: true, draftId: res.id, simulated: false };
  } catch (err) {
    // No Google connection yet → keep the draft local so the flow still works.
    return { ok: false, simulated: true, error: (err as Error).message };
  }
}

export { markRead };
