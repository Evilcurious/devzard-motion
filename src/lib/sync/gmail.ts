import { fetchNew } from "../google/gmail";
import { getGoogleConfig, googleTokens, setJson } from "../settings";
import { handleIncoming } from "../pipeline";
import { logActivity } from "../activity";

export interface GmailSyncReport {
  ok: boolean;
  checked: number;
  drafted: number;
  sent: number;
  simulated: boolean;
  error?: string;
}

/**
 * Poll Gmail for new inbound mail and run each thread through the AI pipeline.
 * Runs on Vercel Cron (every 10 min), the local worker, or the "Sync now" button.
 */
export async function syncGmail(): Promise<GmailSyncReport> {
  const cfg = await getGoogleConfig();
  if (!googleTokens(cfg)) {
    return { ok: true, checked: 0, drafted: 0, sent: 0, simulated: true, error: "Gmail not connected" };
  }

  try {
    const { messages, historyId } = await fetchNew(cfg.lastHistoryId || undefined);
    let drafted = 0;
    let sent = 0;

    for (const m of messages) {
      const from = (m.from.match(/<(.+)>/)?.[1] ?? m.from).trim();
      if (!from) continue;
      const out = await handleIncoming({
        channel: "email",
        externalId: m.id,
        threadId: m.threadId,
        from,
        name: m.fromName || from,
        text: m.body || m.snippet,
        subject: m.subject,
        inReplyTo: m.messageIdHeader,
        references: m.references ? `${m.references} ${m.messageIdHeader}`.trim() : m.messageIdHeader,
      });
      if (out.reply?.status === "sent") sent++;
      else if (out.reply) drafted++;
    }

    if (historyId) {
      await setJson("google_config", { ...(await getGoogleConfig()), lastHistoryId: historyId });
    }
    if (messages.length) await logActivity("info", `Gmail sync: ${messages.length} new message(s)`);

    return { ok: true, checked: messages.length, drafted, sent, simulated: false };
  } catch (err) {
    const message = (err as Error).message;
    await logActivity("error", `Gmail sync failed: ${message}`);
    return { ok: false, checked: 0, drafted: 0, sent: 0, simulated: false, error: message };
  }
}
