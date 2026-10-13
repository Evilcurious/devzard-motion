import { googleJson } from "./oauth";

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  messageIdHeader: string;
  references: string;
}

function header(headers: { name?: string; value?: string }[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64(payload.body.data);
  if (payload.mimeType === "text/html" && payload.body?.data) return b64(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ");
  const parts: any[] = payload.parts ?? [];
  for (const p of parts) {
    if (p.mimeType === "text/plain" && p.body?.data) return b64(p.body.data);
  }
  for (const p of parts) {
    const nested = decodeBody(p);
    if (nested) return nested;
  }
  return payload.body?.data ? b64(payload.body.data) : "";
}

function b64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export async function getMessage(id: string): Promise<GmailMessage> {
  const data = await googleJson<any>(`/gmail/v1/users/me/messages/${id}?format=full`);
  const headers = data.payload?.headers ?? [];
  return {
    id: data.id,
    threadId: data.threadId,
    from: header(headers, "From"),
    fromName: header(headers, "From").replace(/<.*>/, "").replace(/"/g, "").trim() || header(headers, "From"),
    to: header(headers, "To"),
    subject: header(headers, "Subject") || "(no subject)",
    snippet: data.snippet ?? "",
    body: decodeBody(data.payload).slice(0, 8000),
    date: new Date(Number(data.internalDate || Date.now())).toISOString(),
    messageIdHeader: header(headers, "Message-Id"),
    references: header(headers, "References"),
  };
}

/**
 * Fetch messages that arrived since the last sync.
 * Uses history.list when we have a historyId (cheap + precise), else falls
 * back to a query scan so the very first sync still works.
 */
export async function fetchNew(lastHistoryId?: string, newerThanDays = 2): Promise<{ messages: GmailMessage[]; historyId: string }> {
  const scanned: string[] = [];

  if (lastHistoryId) {
    try {
      const data = await googleJson<any>(
        `/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(lastHistoryId)}&historyTypes=messageAdded&maxResults=50`,
      );
      for (const h of data.history ?? []) {
        for (const m of h.messagesAdded ?? []) scanned.push(m.message.id);
      }
      return { messages: await hydrate(scanned), historyId: data.historyId ?? lastHistoryId };
    } catch (err) {
      if (!/40[13]/.test((err as Error).message)) throw err;
    }
  }

  const q = encodeURIComponent(`in:inbox -from:me newer_than:${newerThanDays}d`);
  const list = await googleJson<any>(`/gmail/v1/users/me/messages?q=${q}&maxResults=25`);
  for (const m of list.messages ?? []) scanned.push(m.id);
  const profile = await googleJson<any>("/gmail/v1/users/me/profile").catch(() => null);
  return { messages: await hydrate(scanned), historyId: profile?.historyId ?? "" };
}

async function hydrate(ids: string[]): Promise<GmailMessage[]> {
  const out: GmailMessage[] = [];
  for (const id of [...new Set(ids)].slice(0, 25)) {
    try {
      out.push(await getMessage(id));
    } catch {
      /* skip unreadable message */
    }
  }
  return out;
}

function rawMessage(opts: {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  return Buffer.from(`${lines.join("\r\n")}\r\n\r\n${opts.body}`, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Create a DRAFT in the same thread (nothing is sent). */
export async function createDraft(opts: {
  to: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ id: string }> {
  const raw = rawMessage({ to: opts.to, from: "me", subject: opts.subject, body: opts.body, inReplyTo: opts.inReplyTo, references: opts.references });
  return googleJson<{ id: string }>("/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { threadId: opts.threadId, raw } }),
  });
}

export async function updateDraft(
  draftId: string,
  opts: { to: string; subject: string; body: string; threadId: string; inReplyTo?: string; references?: string },
): Promise<{ id: string }> {
  const raw = rawMessage({ to: opts.to, from: "me", subject: opts.subject, body: opts.body, inReplyTo: opts.inReplyTo, references: opts.references });
  return googleJson<{ id: string }>(`/gmail/v1/users/me/drafts/${draftId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { threadId: opts.threadId, raw } }),
  });
}

/** Send a prepared raw message immediately (used after a human approves). */
export async function sendMessage(opts: {
  to: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ id: string }> {
  const raw = rawMessage({ to: opts.to, from: "me", subject: opts.subject, body: opts.body, inReplyTo: opts.inReplyTo, references: opts.references });
  return googleJson<{ id: string }>("/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId: opts.threadId, raw }),
  });
}

export async function markRead(id: string): Promise<void> {
  await googleJson(`/gmail/v1/users/me/messages/${id}/modify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  }).catch(() => undefined);
}
