"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, Toggle } from "@/components/ui";

interface Rule {
  id: string;
  name: string;
  enabled: number;
  channel: string;
  trigger: "new_message" | "keyword" | "no_reply";
  conditions: { keywords?: string; minConfidence?: number; requireKnowledge?: boolean };
  actions: { reply: boolean; autoSend: boolean; tag?: string; markStatus?: string; notify?: string };
  run_count: number;
}

const CHANNELS = ["any", "web", "email", "whatsapp", "instagram"];

export default function AutomationsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("any");
  const [trigger, setTrigger] = useState<"new_message" | "keyword">("new_message");
  const [keywords, setKeywords] = useState("");
  const [autoSend, setAutoSend] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/automations");
    const data = (await res.json()) as { rules: Rule[] };
    setRules(data.rules ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/automations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        channel,
        trigger,
        conditions: trigger === "keyword" ? { keywords } : {},
        actions: { reply: true, autoSend },
      }),
    });
    setName("");
    setKeywords("");
    setAutoSend(false);
    await load();
  }

  async function patch(id: string, body: Partial<Rule>) {
    await fetch("/api/automations", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Automations</h1>
        <p className="text-sm text-slate-500">
          Rules decide what happens to each incoming message. The first matching rule wins; otherwise your global
          Chatbot settings apply.
        </p>
      </header>

      <Card title="New rule">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input className="input lg:col-span-2" placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c === "any" ? "Any channel" : c}
              </option>
            ))}
          </select>
          <select className="input" value={trigger} onChange={(e) => setTrigger(e.target.value as "new_message" | "keyword")}>
            <option value="new_message">On every message</option>
            <option value="keyword">Only when it mentions…</option>
          </select>
          <button className="btn-primary" disabled={!name.trim()} onClick={create}>
            Add rule
          </button>
        </div>

        {trigger === "keyword" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="price, delivery, refund"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
            <Toggle checked={autoSend} onChange={setAutoSend} label="Send immediately" hint="Skip the approval step for these" />
          </div>
        )}
      </Card>

      <Card title="Rules" subtitle={`${rules.length} configured`}>
        {rules.length ? (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-200">{r.name}</span>
                  <Badge tone="slate">{r.channel}</Badge>
                  <Badge tone="brand">{r.trigger === "keyword" ? `keyword: ${r.conditions.keywords ?? ""}` : "every message"}</Badge>
                  {r.actions.autoSend ? <Badge tone="warn">auto-sends</Badge> : <Badge tone="good">drafts for review</Badge>}
                  <span className="text-[11px] text-slate-600">ran {r.run_count}×</span>
                  <button className="btn-danger !ml-auto !px-2.5 !py-1 text-[11px]" onClick={() => remove(r.id)}>
                    Delete
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-4">
                  <Toggle
                    checked={!!r.enabled}
                    onChange={(v) => patch(r.id, { enabled: v ? 1 : 0 })}
                    label="Enabled"
                  />
                  <Toggle
                    checked={!!r.actions.autoSend}
                    onChange={(v) => patch(r.id, { actions: { ...r.actions, autoSend: v } })}
                    label="Send without approval"
                    hint="Only use this once you trust the answers."
                  />
                  <Toggle
                    checked={r.actions.reply !== false}
                    onChange={(v) => patch(r.id, { actions: { ...r.actions, reply: v } })}
                    label="Reply at all"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No rules yet"
            hint="Without rules, your global Chatbot channel switches decide whether the AI replies."
          />
        )}
      </Card>
    </div>
  );
}
