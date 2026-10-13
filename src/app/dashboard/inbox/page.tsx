"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Card, Empty, Spinner, timeAgo } from "@/components/ui";

type Channel = "web" | "email" | "whatsapp" | "instagram";

interface Conversation {
  id: string;
  channel: Channel;
  customer_name: string;
  customer_handle: string;
  subject: string;
  status: string;
  unread: number;
  last_message_at: string;
  last_body: string;
  last_role: string;
  drafts: number;
}

interface Message {
  id: string;
  role: "customer" | "agent" | "ai";
  body: string;
  status: string;
  ai_confidence: number | null;
  ai_provider: string;
  ai_model: string;
  cost_usd: number;
  meta: string;
  created_at: string;
}

const CHANNELS: { id: Channel | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "web", label: "Website" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
];

export default function InboxPage() {
  const [filter, setFilter] = useState<Channel | "all">("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draftEdit, setDraftEdit] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations ?? []);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { conversation: Conversation; messages: Message[] };
    setConversation(data.conversation);
    setMessages(data.messages ?? []);
    const draft = (data.messages ?? []).find((m) => m.role === "ai" && m.status === "draft");
    setDraftEdit(draft?.body ?? "");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selected) void loadThread(selected);
  }, [selected, loadThread]);

  const visible = useMemo(
    () => (filter === "all" ? conversations : conversations.filter((c) => c.channel === filter)),
    [conversations, filter],
  );

  const draft = messages.find((m) => m.role === "ai" && m.status === "draft");

  async function run(label: string, fn: () => Promise<Response>) {
    setBusy(label);
    setNotice("");
    try {
      const res = await fn();
      const data = (await res.json().catch(() => ({}))) as { error?: string; simulated?: boolean };
      setNotice(
        res.ok
          ? `${label} done${data.simulated ? " (simulated — no live credentials yet)" : ""}`
          : `${label} failed: ${data.error ?? res.status}`,
      );
      if (selected) await loadThread(selected);
      await loadList();
    } catch (err) {
      setNotice(`${label} failed: ${(err as Error).message}`);
    }
    setBusy("");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Inbox</h1>
          <p className="text-sm text-slate-500">Every channel in one thread. AI drafts, you approve.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="input !w-auto"
            value="whatsapp"
            onChange={(e) =>
              run(`Simulate ${e.target.value}`, () =>
                fetch("/api/simulate", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ channel: e.target.value }),
                }),
              )
            }
          >
            <option value="whatsapp">+ Simulate WhatsApp</option>
            <option value="instagram">+ Simulate Instagram</option>
            <option value="email">+ Simulate Email</option>
            <option value="web">+ Simulate Web chat</option>
          </select>
        </div>
      </header>

      {notice && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-slate-300">{notice}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="overflow-hidden">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  filter === c.id
                    ? "border-brand-500/40 bg-brand-500/15 text-brand-400"
                    : "border-white/10 text-slate-400 hover:bg-white/5"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="-mx-2 max-h-[32rem] space-y-1 overflow-y-auto">
            {visible.length ? (
              visible.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                    selected === c.id ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-200">{c.customer_name || c.customer_handle}</span>
                    <span className="ml-auto text-[10px] text-slate-600">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={c.channel === "email" ? "brand" : c.channel === "web" ? "slate" : c.channel === "whatsapp" ? "good" : "warn"}>
                      {c.channel}
                    </Badge>
                    {Number(c.drafts) > 0 && <Badge tone="warn">{c.drafts} draft</Badge>}
                    {c.status === "awaiting_human" && <Badge tone="bad">handoff</Badge>}
                  </div>
                  <p className="mt-1.5 truncate text-xs text-slate-500">{c.last_body}</p>
                </button>
              ))
            ) : (
              <Empty title="No conversations yet" hint="Use + Simulate to see the flow end to end." />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {!selected || !conversation ? (
            <Card>
              <Empty title="Pick a conversation" hint="Or simulate an inbound message to see the AI draft a reply." />
            </Card>
          ) : (
            <>
              <Card
                title={conversation.customer_name || conversation.customer_handle}
                subtitle={`${conversation.channel} · ${conversation.customer_handle}${conversation.subject ? ` · ${conversation.subject}` : ""}`}
                actions={
                  <>
                    <Badge tone={conversation.status === "awaiting_human" ? "bad" : "slate"}>{conversation.status}</Badge>
                    <button
                      className="btn-ghost !py-1.5 text-xs"
                      disabled={!!busy}
                      onClick={() =>
                        run("Regenerate", () =>
                          fetch(`/api/conversations/${selected}`, {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ regenerate: true }),
                          }),
                        )
                      }
                    >
                      {busy === "Regenerate" ? <Spinner /> : "Regenerate"}
                    </button>
                  </>
                }
              >
                <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                  {messages.map((m) => (
                    <Bubble key={m.id} message={m} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              </Card>

              {draft && (
                <Card
                  title="AI draft"
                  subtitle={`confidence ${Math.round(Number(draft.ai_confidence ?? 0) * 100)}% · ${draft.ai_provider || "model"}`}
                  actions={
                    <>
                      <button
                        className="btn-ghost !py-1.5 text-xs"
                        disabled={!!busy}
                        onClick={() =>
                          run("Regenerate", () =>
                            fetch(`/api/conversations/${selected}`, {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ regenerate: true }),
                            }),
                          )
                        }
                      >
                        {busy === "Regenerate" ? <Spinner /> : "Try again"}
                      </button>
                      <button
                        className="btn-primary !py-1.5 text-xs"
                        disabled={!!busy || !draftEdit.trim()}
                        onClick={() =>
                          run("Approve & send", () =>
                            fetch(`/api/messages/${draft.id}/approve`, {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ body: draftEdit.trim() }),
                            }),
                          )
                        }
                      >
                        {busy === "Approve & send" ? <Spinner /> : "Approve & send"}
                      </button>
                    </>
                  }
                >
                  <textarea
                    className="input min-h-[7rem] font-mono text-[13px] leading-relaxed"
                    value={draftEdit}
                    onChange={(e) => setDraftEdit(e.target.value)}
                  />
                  <p className="mt-2 text-[11px] text-slate-600">
                    Edit anything before approving. Nothing leaves the app until you press Approve &amp; send.
                  </p>
                </Card>
              )}

              <Card title="Reply yourself" subtitle="Sends immediately on the customer's channel">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <textarea
                    className="input min-h-[4.5rem] flex-1"
                    placeholder="Type a human reply…"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                  />
                  <button
                    className="btn-primary sm:self-end"
                    disabled={!!busy || !manual.trim()}
                    onClick={() =>
                      run("Send", () =>
                        fetch(`/api/conversations/${selected}`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ body: manual.trim() }),
                        }),
                      ).then(() => setManual(""))
                    }
                  >
                    {busy === "Send" ? <Spinner /> : "Send"}
                  </button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.role !== "customer";
  const failed = message.status === "failed";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          mine
            ? message.role === "ai"
              ? "bg-brand-600/20 text-slate-100 ring-1 ring-brand-500/25"
              : "bg-white/[0.08] text-slate-100"
            : "bg-white/[0.04] text-slate-200"
        } ${failed ? "ring-1 ring-rose-500/40" : ""}`}
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
          <span>{message.role === "ai" ? "AI" : message.role === "agent" ? "You" : "Customer"}</span>
          {message.status !== "sent" && message.status !== "received" && <span className="text-slate-600">· {message.status}</span>}
          {message.role === "ai" && message.ai_confidence != null && (
            <span className="text-slate-600">· {Math.round(Number(message.ai_confidence) * 100)}%</span>
          )}
        </div>
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p className="mt-1 text-right text-[10px] text-slate-600">{timeAgo(message.created_at)}</p>
      </div>
    </div>
  );
}
