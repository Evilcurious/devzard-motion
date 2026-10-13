"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, money, timeAgo } from "@/components/ui";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tags: string;
  notes: string;
  channel: string;
  created_at: string;
  messages: number;
  revenue: number;
}

const blank = { name: "", email: "", phone: "", company: "", tags: "", notes: "", channel: "manual" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/customers");
    const data = (await res.json()) as { customers: Customer[] };
    setCustomers(data.customers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    await fetch("/api/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(blank);
    setBusy(false);
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function syncSheet() {
    await fetch("/api/google/sheets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "push" }),
    });
  }

  const totalRevenue = customers.reduce((a, c) => a + Number(c.revenue ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Customers</h1>
          <p className="text-sm text-slate-500">Auto-created from every incoming conversation, or added by hand.</p>
        </div>
        <button className="btn-ghost" onClick={syncSheet}>
          Push to Google Sheet
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card card-pad">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Total customers</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{customers.length}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Revenue attributed</p>
          <p className="mt-2 text-2xl font-semibold text-mint-400">{money(totalRevenue)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Conversations</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">
            {customers.reduce((a, c) => a + Number(c.messages ?? 0), 0)}
          </p>
        </div>
      </div>

      <Card title="Add a customer">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Phone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="input" placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <input className="input" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button className="btn-primary mt-3" disabled={!form.name.trim() || busy} onClick={save}>
          Add customer
        </button>
      </Card>

      <Card title="All customers" subtitle={`${customers.length} records`}>
        {customers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem]">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="th">Customer</th>
                  <th className="th">Contact</th>
                  <th className="th">Source</th>
                  <th className="th">Conversations</th>
                  <th className="th">Revenue</th>
                  <th className="th">Added</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="td">
                      <p className="text-slate-200">{c.name}</p>
                      {c.company && <p className="text-xs text-slate-600">{c.company}</p>}
                    </td>
                    <td className="td">
                      <p className="text-xs">{c.email || "—"}</p>
                      <p className="text-xs text-slate-600">{(c.phone ?? "").replace(/^ig:/, "IG ") || "—"}</p>
                    </td>
                    <td className="td">
                      <Badge tone="slate">{c.channel || "manual"}</Badge>
                    </td>
                    <td className="td tabular-nums">{c.messages}</td>
                    <td className="td tabular-nums text-mint-400">{money(Number(c.revenue ?? 0))}</td>
                    <td className="td text-xs text-slate-600">{timeAgo(c.created_at)}</td>
                    <td className="td text-right">
                      <button className="btn-danger !px-2.5 !py-1 text-[11px]" onClick={() => remove(c.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No customers yet" hint="They appear automatically when someone messages you." />
        )}
      </Card>
    </div>
  );
}
