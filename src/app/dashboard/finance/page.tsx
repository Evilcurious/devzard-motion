"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, Spinner, money } from "@/components/ui";

interface Summary {
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
  aiBudget: number;
  aiSpendMonth: number;
  categories: { category: string; amount: number; kind: string }[];
  monthly: { month: string; income: number; expense: number; profit: number }[];
  topCustomers: { name: string; revenue: number }[];
}

interface Transaction {
  id: string;
  kind: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  occurred_on: string;
  source: string;
}

export default function FinancePage() {
  const [data, setData] = useState<{ money: Summary; transactions: Transaction[]; aiByProvider: { provider: string; cost: number; calls: number }[] } | null>(null);
  const [form, setForm] = useState({ kind: "expense", amount: "", category: "", description: "", occurred_on: "" });
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/finance");
    setData((await res.json()) as typeof data);
    if (data?.money) setBudget(String(data.money.budget));
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (data?.money) setBudget(String(data.money.budget));
  }, [data]);

  async function add() {
    if (!Number(form.amount)) return;
    setBusy("add");
    await fetch("/api/finance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    setForm({ kind: "expense", amount: "", category: "", description: "", occurred_on: "" });
    setBusy("");
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function saveBudget() {
    setBusy("budget");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ finance: { monthlyBudget: Number(budget) || 0 } }),
    });
    setBusy("");
    await load();
  }

  async function sheet(action: "create" | "sync" | "pull") {
    setBusy(action);
    setNotice("");
    try {
      if (action === "create") {
        const res = await fetch("/api/google/sheets", { method: "PUT" });
        const d = (await res.json()) as { ok?: boolean; error?: string; sheetUrl?: string };
        setNotice(d.ok ? `Spreadsheet created: ${d.sheetUrl}` : `Failed: ${d.error}`);
      } else {
        const res = await fetch("/api/google/sheets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: action === "pull" ? "pull" : "push" }),
        });
        const d = (await res.json()) as { simulated?: boolean; error?: string; customers?: unknown; transactions?: unknown; imported?: unknown };
        setNotice(
          d.simulated
            ? "Simulated — connect Google in Settings to write to a real sheet."
            : `Synced · customers ${JSON.stringify(d.customers)} · transactions ${JSON.stringify(d.transactions)} · imported ${JSON.stringify(d.imported)}`,
        );
      }
    } catch (err) {
      setNotice((err as Error).message);
    }
    setBusy("");
    await load();
  }

  if (!data) {
    return (
      <div className="card card-pad">
        <Spinner label="Loading money…" />
      </div>
    );
  }

  const m = data.money;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Money</h1>
          <p className="text-sm text-slate-500">Budget spend, profit and AI cost — mirrored into Google Sheets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!!busy} onClick={() => sheet("create")}>
            {busy === "create" ? <Spinner /> : "Create sheet"}
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => sheet("pull")}>
            {busy === "pull" ? <Spinner /> : "Pull from sheet"}
          </button>
          <button className="btn-primary" disabled={!!busy} onClick={() => sheet("sync")}>
            {busy === "sync" ? <Spinner /> : "Push to sheet"}
          </button>
        </div>
      </header>

      {notice && <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-slate-300">{notice}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Profit (all time)" value={money(m.profit, m.currency)} tone={m.profit >= 0 ? "text-mint-400" : "text-rose-400"} hint={`Margin ${m.margin}%`} />
        <Stat label="Income (all time)" value={money(m.income, m.currency)} tone="text-brand-400" hint={`${money(m.monthIncome, m.currency)} this month`} />
        <Stat label="Expenses (all time)" value={money(m.expense, m.currency)} tone="text-rose-400" hint={`${money(m.monthExpense, m.currency)} this month`} />
        <Stat
          label="AI spend"
          value={money(m.aiSpendMonth, m.currency)}
          tone={m.aiSpendMonth > m.aiBudget ? "text-amberish-400" : "text-slate-100"}
          hint={`${money(m.aiSpend, m.currency)} all time`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Monthly budget" subtitle="Expenses vs the limit you set" className="lg:col-span-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                <span>{money(m.monthExpense, m.currency)} spent</span>
                <span>{m.budgetUsedPct}% of {money(m.budget, m.currency)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${m.budgetUsedPct > 90 ? "bg-rose-500" : m.budgetUsedPct > 70 ? "bg-amberish-400" : "bg-mint-500"}`}
                  style={{ width: `${Math.min(100, m.budgetUsedPct)}%` }}
                />
              </div>
              <p className={`mt-2 text-xs ${m.budgetLeft >= 0 ? "text-slate-400" : "text-rose-400"}`}>
                {m.budgetLeft >= 0 ? `${money(m.budgetLeft, m.currency)} left this month` : `Over budget by ${money(-m.budgetLeft, m.currency)}`}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <input className="input !w-32" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
              <button className="btn-ghost" disabled={!!busy} onClick={saveBudget}>
                {busy === "budget" ? <Spinner /> : "Set budget"}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <p className="label">Income vs expenses by month</p>
            {m.monthly.length ? (
              <div className="flex h-40 items-end gap-3">
                {m.monthly.map((x) => {
                  const max = Math.max(...m.monthly.map((y) => Math.max(y.income, y.expense)), 1);
                  return (
                    <div key={x.month} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-32 w-full items-end justify-center gap-1">
                        <div className="w-1/2 rounded-t bg-mint-500/70" style={{ height: `${(x.income / max) * 100}%` }} title={`Income ${x.income}`} />
                        <div className="w-1/2 rounded-t bg-rose-500/70" style={{ height: `${(x.expense / max) * 100}%` }} title={`Expense ${x.expense}`} />
                      </div>
                      <span className="text-[9px] text-slate-600">{x.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty title="No data yet" hint="Log an income or expense below." />
            )}
            <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-mint-500/70" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-rose-500/70" /> Expense
              </span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="AI spend by provider" subtitle="What each model costs you">
            {data.aiByProvider.length ? (
              <ul className="space-y-2">
                {data.aiByProvider.map((p) => (
                  <li key={p.provider} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{p.provider}</span>
                    <span className="tabular-nums text-slate-400">
                      {money(p.cost)} <span className="text-xs text-slate-600">· {p.calls} calls</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No AI usage yet" hint="Local models cost nothing." />
            )}
          </Card>

          <Card title="Top customers" subtitle="By attributed revenue">
            {m.topCustomers.length ? (
              <ul className="space-y-2">
                {m.topCustomers.map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-slate-300">{c.name}</span>
                    <span className="tabular-nums text-mint-400">{money(c.revenue, m.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No revenue linked yet" hint="Attach transactions to customers." />
            )}
          </Card>
        </div>
      </div>

      <Card title="Log money" subtitle="Every entry is pushed to the Transactions tab">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input className="input" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input lg:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="input" type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} />
        </div>
        <button className="btn-primary mt-3" disabled={!Number(form.amount) || !!busy} onClick={add}>
          {busy === "add" ? <Spinner /> : "Add entry"}
        </button>
      </Card>

      <Card title="Ledger" subtitle={`${data.transactions.length} entries`}>
        {data.transactions.length ? (
          <div className="max-h-[26rem] overflow-y-auto">
            <table className="w-full min-w-[36rem]">
              <thead className="sticky top-0 bg-ink-900">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Category</th>
                  <th className="th">Description</th>
                  <th className="th">Source</th>
                  <th className="th text-right">Amount</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="td text-xs text-slate-500">{t.occurred_on.slice(0, 10)}</td>
                    <td className="td">
                      <Badge tone={t.kind === "income" ? "good" : "bad"}>{t.kind}</Badge>
                    </td>
                    <td className="td">{t.category}</td>
                    <td className="td max-w-[18rem] truncate">{t.description}</td>
                    <td className="td text-xs text-slate-600">{t.source}</td>
                    <td className={`td text-right tabular-nums ${t.kind === "income" ? "text-mint-400" : "text-rose-400"}`}>
                      {t.kind === "income" ? "+" : "−"}
                      {money(t.amount, t.currency)}
                    </td>
                    <td className="td text-right">
                      <button className="btn-danger !px-2.5 !py-1 text-[11px]" onClick={() => remove(t.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nothing logged yet" hint="Add your first income or expense above." />
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="card card-pad">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
