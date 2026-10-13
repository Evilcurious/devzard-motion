import { getDb, nowIso } from "./db";
import { newId } from "./db/ids";
import { insert, update } from "./db/helpers";
import { aiChat } from "./ai";
import { buildMessages, needsHuman, scoreConfidence } from "./rag/context";
import { deliver, stageEmailDraft, type Channel } from "./channels";

export type { Channel };
import { getChatbotConfig, getGoogleConfig, googleTokens } from "./settings";
import { bumpRunCount, listRules, matchRule } from "./automations";
import { logActivity } from "./activity";

export interface Incoming {
  channel: Channel;
  externalId: string;
  threadId: string;
  from: string;
  name?: string;
  text: string;
  subject?: string;
  inReplyTo?: string;
  references?: string;
  meta?: Record<string, unknown>;
  /** override the per-channel auto-reply switch */
  autoReply?: boolean;
}

export interface ReplyOutcome {
  conversationId: string;
  messageId: string;
  reply?: {
    id: string;
    body: string;
    confidence: number;
    status: string;
    simulated: boolean;
    handoff: boolean;
    provider: string;
    model: string;
    costUsd: number;
  };
}

/* ------------------------------------------------------------------ */
/* customers + conversations                                            */
/* ------------------------------------------------------------------ */

function identity(channel: Channel, from: string): { column: "email" | "phone"; value: string } {
  if (channel === "email") return { column: "email", value: from.toLowerCase() };
  if (channel === "instagram") return { column: "phone", value: `ig:${from}` };
  return { column: "phone", value: from };
}

export async function upsertCustomer(channel: Channel, from: string, name?: string): Promise<string> {
  const db = await getDb();
  const { column, value } = identity(channel, from);
  if (!value) return "";

  const existing = await db.get<{ id: string }>(`SELECT id FROM customers WHERE ${column} = ?`, [value]);
  if (existing) {
    if (name) {
      await db.run("UPDATE customers SET name = ?, updated_at = ? WHERE id = ? AND (name IS NULL OR name = '')", [
        name,
        nowIso(),
        existing.id,
      ]);
    }
    return existing.id;
  }

  const id = newId("cus");
  await insert("customers", {
    id,
    name: name || from,
    [column]: value,
    channel,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  return id;
}

async function upsertConversation(incoming: Incoming, customerId: string, customerName: string): Promise<string> {
  const db = await getDb();
  const existing = await db.get<{ id: string }>(
    "SELECT id FROM conversations WHERE channel = ? AND external_id = ?",
    [incoming.channel, incoming.threadId],
  );
  if (existing) {
    await db.run("UPDATE conversations SET last_message_at = ?, unread = 1, customer_id = ? WHERE id = ?", [
      nowIso(),
      customerId,
      existing.id,
    ]);
    return existing.id;
  }
  const id = newId("con");
  await insert("conversations", {
    id,
    channel: incoming.channel,
    external_id: incoming.threadId,
    customer_id: customerId,
    customer_name: customerName,
    customer_handle: incoming.from,
    subject: incoming.subject ?? "",
    status: "open",
    unread: 1,
    last_message_at: nowIso(),
    meta: JSON.stringify(incoming.meta ?? {}),
  });
  return id;
}

async function history(conversationId: string, limit = 8) {
  const db = await getDb();
  const rows = await db.all<{ role: string; body: string }>(
    "SELECT role, body FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
    [conversationId, limit],
  );
  return rows.reverse().map((r) => ({ role: r.role as "customer" | "agent" | "ai", body: r.body }));
}

/* ------------------------------------------------------------------ */
/* main entry                                                           */
/* ------------------------------------------------------------------ */

export async function handleIncoming(incoming: Incoming): Promise<ReplyOutcome> {
  const db = await getDb();
  const cfg = await getChatbotConfig();

  const customerId = await upsertCustomer(incoming.channel, incoming.from, incoming.name);
  const conversationId = await upsertConversation(incoming, customerId, incoming.name || incoming.from);

  const dupe = incoming.externalId
    ? await db.get("SELECT id FROM messages WHERE external_id = ?", [incoming.externalId])
    : undefined;
  if (dupe) return { conversationId, messageId: String((dupe as { id: string }).id) };

  const messageId = await insert("messages", {
    conversation_id: conversationId,
    role: "customer",
    body: incoming.text,
    status: "received",
    external_id: incoming.externalId || "",
    meta: JSON.stringify({ from: incoming.from, inReplyTo: incoming.inReplyTo, references: incoming.references }),
  });

  const wantsReply = incoming.autoReply ?? cfg.channels[incoming.channel] ?? false;
  if (!wantsReply) {
    await logActivity("info", `New ${incoming.channel} message from ${incoming.name || incoming.from} (auto-reply off)`);
    return { conversationId, messageId };
  }

  const rules = await listRules();
  const pending = await buildReply(conversationId, incoming, cfg);

  if (!pending) return { conversationId, messageId };

  const rule = matchRule(rules, {
    channel: incoming.channel,
    text: incoming.text,
    confidence: pending.confidence,
    hasKnowledge: pending.sources.length > 0,
  });

  const autoSend = rule ? !!rule.actions.autoSend : cfg.autoSend && pending.confidence >= cfg.autoSendConfidence;
  const shouldReply = rule ? rule.actions.reply !== false : true;

  if (!shouldReply) return { conversationId, messageId };

  let status = "draft";
  let simulated = false;
  let externalId = "";
  let draftId = "";

  if (autoSend) {
    const result = await deliver(
      incoming.channel,
      {
        to: incoming.from,
        threadId: incoming.threadId,
        subject: incoming.subject ? `Re: ${incoming.subject.replace(/^re:\s*/i, "")}` : undefined,
        inReplyTo: incoming.inReplyTo,
        references: incoming.references,
      },
      pending.body,
    );
    status = result.ok ? "sent" : "failed";
    simulated = result.simulated;
    externalId = result.externalId ?? "";
    if (!result.ok) await logActivity("error", `Failed to send ${incoming.channel} reply: ${result.error}`);
  } else if (incoming.channel === "email") {
    const staged = await stageEmailDraft(
      {
        to: incoming.from,
        threadId: incoming.threadId,
        subject: incoming.subject ? `Re: ${incoming.subject.replace(/^re:\s*/i, "")}` : "Re: your message",
        inReplyTo: incoming.inReplyTo,
        references: incoming.references,
      },
      pending.body,
    );
    simulated = staged.simulated;
    draftId = staged.draftId ?? "";
    if (staged.ok) await logActivity("success", `Drafted Gmail reply to ${incoming.from}`);
  }

  const replyId = await insert("messages", {
    conversation_id: conversationId,
    role: "ai",
    body: pending.body,
    status,
    external_id: externalId,
    ai_confidence: pending.confidence,
    ai_provider: pending.provider,
    ai_model: pending.model,
    tokens_in: pending.tokensIn,
    tokens_out: pending.tokensOut,
    cost_usd: pending.costUsd,
    meta: JSON.stringify({ draftId, sources: pending.sources.map((s) => s.title), handoff: pending.handoff }),
  });

  await update("conversations", conversationId, {
    status: pending.handoff ? "awaiting_human" : status === "sent" ? "open" : "pending_ai",
    last_message_at: nowIso(),
    unread: 1,
  });

  if (rule) await bumpRunCount(rule.id);

  await logActivity(
    status === "sent" ? "success" : "info",
    `${status === "sent" ? "Auto-replied" : "Drafted reply"} on ${incoming.channel} to ${incoming.name || incoming.from} (confidence ${Math.round(pending.confidence * 100)}%)`,
    { conversationId, provider: pending.provider, simulated },
  );

  return {
    conversationId,
    messageId,
    reply: {
      id: replyId,
      body: pending.body,
      confidence: pending.confidence,
      status,
      simulated,
      handoff: pending.handoff,
      provider: pending.provider,
      model: pending.model,
      costUsd: pending.costUsd,
    },
  };
}

/* ------------------------------------------------------------------ */
/* reply generation                                                     */
/* ------------------------------------------------------------------ */

export async function buildReply(
  conversationId: string,
  incoming: Pick<Incoming, "channel" | "text" | "subject" | "from">,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cfg?: any,
) {
  const config = cfg ?? (await getChatbotConfig());
  const db = await getDb();

  const customer = await db.get<{ name: string; notes: string }>(
    `SELECT c.name, c.notes FROM customers c
       JOIN conversations v ON v.customer_id = c.id
      WHERE v.id = ?`,
    [conversationId],
  );

  const { messages, sources } = await buildMessages(incoming.text, config, {
    channel: incoming.channel,
    customerName: customer?.name,
    customerNote: customer?.notes,
    threadSubject: incoming.subject,
    history: await history(conversationId),
  });

  let text = "";
  let provider = config.name;
  let model = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;

  try {
    const res = await aiChat({ messages, feature: incoming.channel });
    text = res.text.trim();
    provider = res.provider;
    model = res.model;
    tokensIn = res.tokensIn;
    tokensOut = res.tokensOut;
    costUsd = res.costUsd;
  } catch (err) {
    await logActivity("error", `AI error on ${incoming.channel}: ${(err as Error).message}`);
    text = config.fallbackReply;
  }

  let body = text || config.fallbackReply;
  if (incoming.channel === "email" && config.signature && !body.includes(config.signature.trim())) {
    body = `${body}${config.signature}`;
  }

  return {
    body,
    confidence: scoreConfidence(sources, body),
    handoff: needsHuman({ answer: body, question: incoming.text, cfg: config }),
    sources,
    provider,
    model,
    tokensIn,
    tokensOut,
    costUsd,
  };
}

/** Re-run the model for an existing conversation (UI "Regenerate"). */
export async function regenerate(conversationId: string): Promise<{ body: string; confidence: number }> {
  const db = await getDb();
  const last = await db.get<{ body: string }>(
    "SELECT body FROM messages WHERE conversation_id = ? AND role = 'customer' ORDER BY created_at DESC LIMIT 1",
    [conversationId],
  );
  const convo = await db.get<{ channel: Channel; subject: string; customer_handle: string }>(
    "SELECT channel, subject, customer_handle FROM conversations WHERE id = ?",
    [conversationId],
  );
  if (!last || !convo) throw new Error("Nothing to regenerate");
  const reply = await buildReply(conversationId, {
    channel: convo.channel,
    text: last.body,
    subject: convo.subject,
    from: convo.customer_handle,
  });
  await db.run(
    `UPDATE messages SET body = ?, ai_confidence = ? WHERE id = (
       SELECT id FROM messages WHERE conversation_id = ? AND role = 'ai' AND status IN ('draft','failed')
       ORDER BY created_at DESC LIMIT 1)`,
    [reply.body, reply.confidence, conversationId],
  );
  return { body: reply.body, confidence: reply.confidence };
}

/** Approve (optionally edited) and send a drafted reply. */
export async function approveDraft(
  messageId: string,
  editedBody?: string,
): Promise<{ ok: boolean; simulated: boolean; error?: string }> {
  const db = await getDb();
  const msg = await db.get<any>("SELECT * FROM messages WHERE id = ?", [messageId]);
  if (!msg) return { ok: false, simulated: false, error: "Draft not found" };

  const convo = await db.get<any>("SELECT * FROM conversations WHERE id = ?", [msg.conversation_id]);
  const body = (editedBody ?? msg.body ?? "").trim();
  if (!body) return { ok: false, simulated: false, error: "Empty reply" };

  const meta = safeJson(msg.meta);
  const target = {
    to: convo.customer_handle,
    threadId: convo.external_id || convo.id,
    subject: convo.subject ? `Re: ${convo.subject.replace(/^re:\s*/i, "")}` : "Re: your message",
    inReplyTo: meta.inReplyTo as string | undefined,
    references: meta.references as string | undefined,
  };

  // Email drafts live in Gmail — push the edit then send.
  if (convo.channel === "email" && meta.draftId) {
    const g = await getGoogleConfig();
    if (googleTokens(g)) {
      const { updateDraft, sendMessage } = await import("./google/gmail");
      try {
        const draft = await updateDraft(meta.draftId as string, { ...target, body });
        await sendMessage({ ...target, body, threadId: target.threadId });
        void draft;
      } catch (err) {
        await logActivity("error", `Gmail send failed: ${(err as Error).message}`);
      }
    }
  }

  const result = await deliver(convo.channel as Channel, target, body);
  await db.run("UPDATE messages SET body = ?, status = ?, external_id = ? WHERE id = ?", [
    body,
    result.ok ? "sent" : "failed",
    result.externalId ?? "",
    messageId,
  ]);
  await db.run("UPDATE conversations SET status = ?, unread = 0 WHERE id = ?", ["open", convo.id]);
  await logActivity(result.ok ? "success" : "error", `Reply ${result.ok ? "sent" : "failed"} on ${convo.channel}`, {
    simulated: result.simulated,
  });
  return { ok: result.ok, simulated: result.simulated, error: result.error };
}

/** Human-typed reply from the dashboard. */
export async function sendAgentReply(conversationId: string, body: string): Promise<{ ok: boolean; simulated: boolean; error?: string }> {
  const db = await getDb();
  const convo = await db.get<any>("SELECT * FROM conversations WHERE id = ?", [conversationId]);
  if (!convo) return { ok: false, simulated: false, error: "Conversation not found" };

  const result = await deliver(convo.channel as Channel, {
    to: convo.customer_handle,
    threadId: convo.external_id || convo.id,
    subject: convo.subject ? `Re: ${convo.subject.replace(/^re:\s*/i, "")}` : "Re: your message",
  }, body);

  await insert("messages", {
    conversation_id: conversationId,
    role: "agent",
    body,
    status: result.ok ? "sent" : "failed",
    external_id: result.externalId ?? "",
  });
  await db.run("UPDATE conversations SET status = ?, unread = 0, last_message_at = ? WHERE id = ?", [
    "open",
    nowIso(),
    conversationId,
  ]);
  return { ok: result.ok, simulated: result.simulated, error: result.error };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
