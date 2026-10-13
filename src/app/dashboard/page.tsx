"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, Spinner, StatCard, money, timeAgo } from "@/components/ui";

interface Health {
  db: { kind: string; ok: boolean };
  ai: { provider: string; model: string; local: boolean; keyPresent: boolean; fallback: string | null };
  google: { clientConfigured: boolean; connected: boolean; sheetId: string };
  whatsapp: { configured: boolean };
  instagram: { configured: boolean };
}

interface MoneyPayload {
  money: {
    currency: string;
    income: number;
    expense: number;
    profit: number;
    margin: number;
    monthIncome: number;
    monthExpense: number;
    monthProfit: number;
    budget: number;
    budgetUsedPct: number;
    budgetLeft: number;
    aiSpend: number;
    aiSpendMonth: number;
    aiBudget: number;
  };
  activity: { id: string; level: string; message: string; created_at: string }[];
}

export default function OverviewPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [moneyData, setMoneyData] = useState<MoneyPayload | null>(null);
  const [counts, setCounts] = useState<{ conversations: number; drafts: number }>({ conversations: 0, drafts: 0 });
  const [kb, setKb] = useState<{ sources: number; chunks: number }>({ sources: 0, chunks: 0 });
  const [busy, setBusy] = useState<string>("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [h, f, c, k] = await Promise.all([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/finance").then((r) => r.json()),
      fetch("/api/conversations").then((r) => r.json()),
      fetch("/api/kb").then((r) => r.json()),
    ]);
    setHealth(h as Health);
    setMoneyData(f as MoneyPayload);
    const list = (c.conversations ?? []) as { drafts: number }[];
    setCounts({
      conversations: list.length,
      drafts: list.reduce((a, x) => a + Number(x.drafts ?? 0), 0),
    });
    setKb({ sources: (k.stats?.sources ?? 0) as number, chunks: (k.stats?.chunks ?? 0) as number });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(name: string, path: string, init?: RequestInit) {
    setBusy(name);
    try {
      const res = await fetch(path, { method: "POST", ...init });
      const data = (await res.json()) as Record<string, unknown>;
      setToast({
        kind: res.ok ? "ok" : "err",
        text: typeof data.error === "string" ? data.error : `${name}: ${JSON.stringify(data).slice(0, 160)}`,
      });
      await load();
    } catch (err) {
      setToast({ kind: "err", text: (err as Error).message });
    }
    setBusy("");
  }

  const m = moneyData?.money;
  const steps = [
    { label: "Pick an AI brain", done: !!health?.ai.keyPresent || health?.ai.local, href: "/dashboard/settings" },
    { label: "Feed your knowledge", done: kb.sources > 0, href: "/dashboard/knowledge" },
    { label: "Connect Google (Gmail + Sheets)", done: !!health?.google.connected, href: "/dashboard/settings" },
    { label: "Create the tracking sheet", done: !!health?.google.sheetId, href: "/dashboard/finance" },
    { label: "Connect WhatsApp", done: !!health?.whatsapp.configured, href: "/dashboard/settings" },
    { label: "Connect Instagram", done: !!health?.instagram.configured, href: "/dashboard/settings" },
    { label: "Embed the chat widget", done: false, href: "/dashboard/chatbot" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Overview</h1>
          <p className="text-sm text-slate-500">Everything running right now, in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!!busy} onClick={() => action("Gmail sync", "/api/google/sync/gmail")}>
            {busy === "Gmail sync" ? <Spinner label="Syncing…" /> : "Sync Gmail"}
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action("Sheet sync", "/api/google/sheets")}>
            {busy === "Sheet sync" ? <Spinner label="Syncing…" /> : "Sync Sheet"}
          </button>
          <button className="btn-primary" disabled={!!busy} onClick={() => action("Simulated message", "/api/simulate")}>
            {busy === "Simulated message" ? <Spinner label="Running…" /> : "Simulate inbound"}
          </button>
        </div>
      </header>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs ${
            toast.kind === "ok" ? "border-mint-500/30 bg-mint-500/10 text-mint-400" : "border-amberish-400/30 bg-amberish-400/10 text-amberish-400"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversations" value={counts.conversations} hint="Across web, email, WhatsApp, Instagram" />
        <StatCard
          label="Drafts awaiting you"
          value={counts.drafts}
          tone={counts.drafts > 0 ? "warn" : "default"}
          hint="AI wrote these; approve before sending"
        />
        <StatCard
          label="Profit this month"
          value={m ? money(m.monthProfit, m.currency) : "—"}
          tone={m && m.monthProfit >= 0 ? "good" : "bad"}
          hint={m ? `Margin ${m.margin}% all-time` : ""}
        />
        <StatCard
          label="AI spend this month"
          value={m ? money(m.aiSpendMonth, m.currency) : "—"}
          tone={m && m.aiSpendMonth > m.aiBudget ? "warn" : "brand"}
          hint={m ? `${health?.ai.local ? "Local model — free" : "Cloud tokens"}` : ""}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Setup checklist" subtitle="Tick these off to go live" className="lg:col-span-2">
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm transition hover:bg-white/[0.05]"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
                      s.done ? "border-mint-500/40 bg-mint-500/15 text-mint-400" : "border-white/15 text-slate-600"
                    }`}
                  >
                    {s.done ? "✓" : ""}
                  </span>
                  <span className={s.done ? "text-slate-400 line-through" : "text-slate-200"}>{s.label}</span>
                  <span className="ml-auto text-xs text-slate-600">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Integrations" subtitle="Live status">
          <dl className="space-y-3 text-sm">
            <Row
              label="AI brain"
              value={
                health ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <code className="text-xs text-slate-300">{health.ai.provider}</code>
                    <span className="text-xs text-slate-500">{health.ai.model}</span>
                    <Badge tone={health.ai.local ? "good" : health.ai.keyPresent ? "brand" : "bad"}>
                      {health.ai.local ? "local" : health.ai.keyPresent ? "key set" : "no key"}
                    </Badge>
                  </span>
                ) : (
                  "…"
                )
              }
            />
            <Row
              label="Google"
              value={<Badge tone={health?.google.connected ? "good" : health?.google.clientConfigured ? "warn" : "bad"}>
                {health?.google.connected ? "connected" : health?.google.clientConfigured ? "client set" : "not configured"}
              </Badge>}
            />
            <Row
              label="WhatsApp"
              value={<Badge tone={health?.whatsapp.configured ? "good" : "slate"}>{health?.whatsapp.configured ? "live" : "sandbox"}</Badge>}
            />
            <Row
              label="Instagram"
              value={<Badge tone={health?.instagram.configured ? "good" : "slate"}>{health?.instagram.configured ? "live" : "sandbox"}</Badge>}
            />
            <Row
              label="Database"
              value={<Badge tone={health?.db.ok ? "good" : "bad"}>{health?.db.kind ?? "…"}</Badge>}
            />
          </dl>
          <Link href="/dashboard/settings" className="btn-ghost mt-4 w-full">
            Open settings
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Money at a glance" subtitle="Synced with Google Sheets" actions={<Link href="/dashboard/finance" className="btn-ghost !py-1.5 text-xs">Open</Link>}>
          {m ? (
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Income (month)" value={money(m.monthIncome, m.currency)} tone="text-mint-400" />
              <Mini label="Expenses (month)" value={money(m.monthExpense, m.currency)} tone="text-rose-400" />
              <Mini label="Profit (month)" value={money(m.monthProfit, m.currency)} tone={m.monthProfit >= 0 ? "text-brand-400" : "text-rose-400"} />
              <Mini label="Budget left" value={money(m.budgetLeft, m.currency)} tone={m.budgetLeft >= 0 ? "text-slate-100" : "text-amberish-400"} />
              <div className="col-span-2">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                  <span>Budget used</span>
                  <span>{m.budgetUsedPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${m.budgetUsedPct > 90 ? "bg-rose-500" : m.budgetUsedPct > 70 ? "bg-amberish-400" : "bg-mint-500"}`}
                    style={{ width: `${Math.min(100, m.budgetUsedPct)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Spinner label="Loading…" />
          )}
        </Card>

        <Card title="Recent activity" subtitle="Automations, syncs and AI runs">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {(moneyData?.activity ?? []).length ? (
              moneyData!.activity.map((a) => (
                <div key={a.id} className="flex gap-2.5 border-b border-white/[0.05] pb-2 last:border-0">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      a.level === "error"
                        ? "bg-rose-400"
                        : a.level === "success"
                          ? "bg-mint-400"
                          : a.level === "warn"
                            ? "bg-amberish-400"
                            : "bg-slate-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-300">{a.message}</p>
                    <p className="text-[10px] text-slate-600">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <Empty title="Nothing yet" hint="Sync Gmail or simulate a message to see activity." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
