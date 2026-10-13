"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Spinner } from "@/components/ui";
import { PROVIDERS } from "@/lib/ai/catalog";
import type { ProviderId } from "@/lib/ai/types";

interface SettingsPayload {
  ai: {
    provider: ProviderId;
    model: string;
    temperature: number;
    maxTokens: number;
    fallbackProvider: ProviderId | "";
    fallbackModel: string;
    keys: Record<string, string>;
    bases: Record<string, string>;
  };
  google: {
    clientId: string;
    hasClientSecret: boolean;
    connected: boolean;
    email: string;
    sheetId: string;
    sheetUrl: string;
    scopes: string;
  };
  meta: {
    verifyToken: string;
    apiVersion: string;
    waPhoneId: string;
    igAccountId: string;
    hasWaToken: boolean;
    hasIgToken: boolean;
    hasAppSecret: boolean;
    autoReplyWhatsapp: boolean;
    autoReplyInstagram: boolean;
  };
  finance: { currency: string; monthlyBudget: number; aiBudget: number };
  chatbot: Record<string, unknown>;
}

export default function SettingsPage() {
  const [s, setS] = useState<SettingsPayload | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState("");
  const [origin, setOrigin] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    setS((await res.json()) as SettingsPayload);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g) {
      setFlash(g === "connected" ? "Google account connected." : `Google: ${g}`);
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [load]);

  async function save(payload: Record<string, unknown>) {
    setBusy("save");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy("");
    await load();
  }

  async function loadModels(provider: ProviderId) {
    setModels([]);
    const res = await fetch(`/api/ai/test?provider=${provider}`);
    const data = (await res.json()) as { models: string[] };
    setModels(data.models ?? []);
  }

  async function runTest() {
    if (!s) return;
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/ai/test", { method: "POST" });
    setTest((await res.json()) as { ok: boolean; message: string });
    setTesting(false);
  }

  if (!s) {
    return (
      <div className="card card-pad">
        <Spinner label="Loading settings…" />
      </div>
    );
  }

  const meta = PROVIDERS.find((p) => p.id === s.ai.provider)!;
  const webhookUrl = `${origin}/api/webhooks/meta`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
          <p className="text-sm text-slate-500">Connect your brain, your Google account and your messaging channels.</p>
        </div>
        {busy === "save" && <Spinner label="Saving…" />}
      </header>

      {flash && <div className="rounded-lg border border-mint-500/30 bg-mint-500/10 px-4 py-2.5 text-xs text-mint-400">{flash}</div>}

      {/* ── AI ─────────────────────────────────────────────────────────── */}
      <Card
        title="AI brain"
        subtitle="One interface, any model — cloud API key or a model running on your own machine"
        actions={
          <button className="btn-ghost !py-1.5 text-xs" disabled={testing} onClick={runTest}>
            {testing ? <Spinner /> : "Test connection"}
          </button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="label">Provider</span>
            <select
              className="input"
              value={s.ai.provider}
              onChange={(e) => save({ ai: { ...s.ai, provider: e.target.value as ProviderId } })}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.local ? " · local" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              {meta.local
                ? "Runs on your machine or LAN — no per-token cost. On Vercel, point the base URL at a publicly reachable Ollama/LM Studio host."
                : `Get a key at ${meta.docs}`}
            </span>
          </label>

          <label className="block">
            <span className="label">Model</span>
            <div className="flex gap-2">
              <input className="input" value={s.ai.model} onChange={(e) => setS({ ...s, ai: { ...s.ai, model: e.target.value } })} />
              <button className="btn-ghost shrink-0" onClick={() => loadModels(s.ai.provider)}>
                List
              </button>
              <button
                className="btn-ghost shrink-0"
                onClick={() => save({ ai: { ...s.ai, model: s.ai.model } })}
              >
                Save
              </button>
            </div>
            {models.length > 0 && (
              <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {models.slice(0, 40).map((m) => (
                  <button
                    key={m}
                    className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/10"
                    onClick={() => setS({ ...s, ai: { ...s.ai, model: m } })}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </label>

          {meta.needsKey && (
            <label className="block">
              <span className="label">API key ({meta.keyEnv})</span>
              <input
                className="input"
                type="password"
                placeholder={s.ai.keys[s.ai.provider] ? "Saved — type to replace" : "sk-…"}
                onChange={(e) => save({ ai: { ...s.ai, keys: { ...s.ai.keys, [s.ai.provider]: e.target.value } } })}
              />
              <span className="mt-1 block text-xs text-slate-500">Stored encrypted with your APP_SECRET.</span>
            </label>
          )}

          <label className="block">
            <span className="label">Base URL</span>
            <input
              className="input"
              value={s.ai.bases[s.ai.provider] ?? ""}
              placeholder={meta.defaultBase}
              onChange={(e) => setS({ ...s, ai: { ...s.ai, bases: { ...s.ai.bases, [s.ai.provider]: e.target.value } } })}
              onBlur={(e) => save({ ai: { ...s.ai, bases: { ...s.ai.bases, [s.ai.provider]: e.target.value } } })}
            />
            <span className="mt-1 block text-xs text-slate-500">
              {s.ai.provider === "ollama"
                ? "Ollama: http://localhost:11434 (or your LAN box / tunnel)."
                : s.ai.provider === "lmstudio"
                  ? "LM Studio server: http://localhost:1234/v1"
                  : "Only change this for proxies or self-hosted gateways."}
            </span>
          </label>

          <label className="block">
            <span className="label">Fallback provider (optional)</span>
            <select
              className="input"
              value={s.ai.fallbackProvider}
              onChange={(e) => save({ ai: { ...s.ai, fallbackProvider: e.target.value as ProviderId | "" } })}
            >
              <option value="">None</option>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">Used automatically if the primary provider errors.</span>
          </label>

          <label className="block">
            <span className="label">Temperature: {s.ai.temperature}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="w-full accent-brand-500"
              value={s.ai.temperature}
              onChange={(e) => setS({ ...s, ai: { ...s.ai, temperature: Number(e.target.value) } })}
              onMouseUp={() => save({ ai: { ...s.ai, temperature: s.ai.temperature } })}
            />
            <span className="mt-1 block text-xs text-slate-500">Lower = stricter, more literal answers.</span>
          </label>
        </div>

        {test && (
          <div
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs ${
              test.ok ? "border-mint-500/30 bg-mint-500/10 text-mint-400" : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {test.message}
          </div>
        )}
      </Card>

      {/* ── Google ─────────────────────────────────────────────────────── */}
      <Card
        title="Google — Gmail + Sheets"
        subtitle="Auto-draft email replies and mirror customers, spend and profit into a spreadsheet"
        actions={
          <Badge tone={s.google.connected ? "good" : s.google.clientId && s.google.hasClientSecret ? "warn" : "bad"}>
            {s.google.connected ? `Connected${s.google.email ? ` · ${s.google.email}` : ""}` : s.google.clientId && s.google.hasClientSecret ? "Client set — connect below" : "Not configured"}
          </Badge>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="label">OAuth Client ID</span>
            <input
              className="input"
              value={s.google.clientId}
              placeholder="xxxx.apps.googleusercontent.com"
              onChange={(e) => setS({ ...s, google: { ...s.google, clientId: e.target.value } })}
              onBlur={(e) => save({ google: { clientId: e.target.value } })}
            />
          </label>
          <label className="block">
            <span className="label">OAuth Client secret</span>
            <input
              className="input"
              type="password"
              placeholder={s.google.hasClientSecret ? "Saved — type to replace" : "GOCSPX-…"}
              onChange={(e) => save({ google: { clientSecret: e.target.value } })}
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-slate-400">
          <p className="mb-1.5 font-medium text-slate-300">Authorised redirect URI — add this to your Google OAuth client</p>
          <code className="block break-all text-[11px] text-brand-400">{origin}/api/google/oauth/callback</code>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn-primary" href="/api/google/oauth/start">
            {s.google.connected ? "Reconnect Google account" : "Connect Google account"}
          </a>
          {s.google.connected && (
            <button className="btn-ghost" onClick={() => fetch("/api/google/status", { method: "DELETE" }).then(load)}>
              Disconnect
            </button>
          )}
          {s.google.sheetUrl && (
            <a className="btn-ghost" href={s.google.sheetUrl} target="_blank" rel="noreferrer">
              Open spreadsheet
            </a>
          )}
        </div>

        {!s.google.connected && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
            Enable the Gmail API and Google Sheets API in your Google Cloud project, create an OAuth client
            (type: Web application), paste the ID and secret above, then connect.
          </p>
        )}
      </Card>

      {/* ── Meta ───────────────────────────────────────────────────────── */}
      <Card
        title="WhatsApp + Instagram"
        subtitle="Meta Cloud API. Leave blank to keep running in sandbox mode."
        actions={
          <span className="flex gap-2">
            <Badge tone={s.meta.hasWaToken && s.meta.waPhoneId ? "good" : "slate"}>WA {s.meta.hasWaToken && s.meta.waPhoneId ? "live" : "sandbox"}</Badge>
            <Badge tone={s.meta.hasIgToken && s.meta.igAccountId ? "good" : "slate"}>IG {s.meta.hasIgToken && s.meta.igAccountId ? "live" : "sandbox"}</Badge>
          </span>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="label">Webhook verify token</span>
            <input
              className="input"
              value={s.meta.verifyToken}
              onChange={(e) => setS({ ...s, meta: { ...s.meta, verifyToken: e.target.value } })}
              onBlur={(e) => save({ meta: { verifyToken: e.target.value } })}
            />
          </label>
          <label className="block">
            <span className="label">App secret (optional, enables signature checks)</span>
            <input
              className="input"
              type="password"
              placeholder={s.meta.hasAppSecret ? "Saved — type to replace" : ""}
              onChange={(e) => save({ meta: { appSecret: e.target.value } })}
            />
          </label>

          <label className="block">
            <span className="label">WhatsApp phone number ID</span>
            <input
              className="input"
              value={s.meta.waPhoneId}
              onChange={(e) => setS({ ...s, meta: { ...s.meta, waPhoneId: e.target.value } })}
              onBlur={(e) => save({ meta: { waPhoneId: e.target.value } })}
            />
          </label>
          <label className="block">
            <span className="label">WhatsApp access token</span>
            <input
              className="input"
              type="password"
              placeholder={s.meta.hasWaToken ? "Saved — type to replace" : "EAAG…"}
              onChange={(e) => save({ meta: { waToken: e.target.value } })}
            />
          </label>

          <label className="block">
            <span className="label">Instagram account ID</span>
            <input
              className="input"
              value={s.meta.igAccountId}
              onChange={(e) => setS({ ...s, meta: { ...s.meta, igAccountId: e.target.value } })}
              onBlur={(e) => save({ meta: { igAccountId: e.target.value } })}
            />
          </label>
          <label className="block">
            <span className="label">Instagram access token</span>
            <input
              className="input"
              type="password"
              placeholder={s.meta.hasIgToken ? "Saved — type to replace" : "IGQVJ…"}
              onChange={(e) => save({ meta: { igToken: e.target.value } })}
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-slate-400">
          <p className="mb-1.5 font-medium text-slate-300">Webhook URL — paste into Meta App → WhatsApp / Instagram → Configuration</p>
          <code className="block break-all text-[11px] text-brand-400">{webhookUrl}</code>
          <p className="mt-2">
            Subscribe to the <span className="text-slate-300">messages</span> field. Verify token must match the box above.
          </p>
        </div>
      </Card>

      {/* ── Money + account ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Money defaults">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Currency</span>
              <input
                className="input"
                value={s.finance.currency}
                onChange={(e) => setS({ ...s, finance: { ...s.finance, currency: e.target.value } })}
                onBlur={() => save({ finance: s.finance })}
              />
            </label>
            <label className="block">
              <span className="label">Monthly budget</span>
              <input
                className="input"
                type="number"
                value={s.finance.monthlyBudget}
                onChange={(e) => setS({ ...s, finance: { ...s.finance, monthlyBudget: Number(e.target.value) } })}
                onBlur={() => save({ finance: s.finance })}
              />
            </label>
            <label className="block">
              <span className="label">AI budget</span>
              <input
                className="input"
                type="number"
                value={s.finance.aiBudget}
                onChange={(e) => setS({ ...s, finance: { ...s.finance, aiBudget: Number(e.target.value) } })}
                onBlur={() => save({ finance: s.finance })}
              />
            </label>
          </div>
        </Card>

        <Card title="Account & deployment">
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              Dashboard login comes from <code className="text-slate-300">ADMIN_USER</code> / <code className="text-slate-300">ADMIN_PASSWORD</code>.
            </li>
            <li>
              Token encryption + session signing use <code className="text-slate-300">APP_SECRET</code> — set a long random value before deploying.
            </li>
            <li>
              Cron jobs (<code className="text-slate-300">/api/cron/gmail</code>, <code className="text-slate-300">/api/cron/sheets</code>) are declared in{" "}
              <code className="text-slate-300">vercel.json</code>. Protect them with <code className="text-slate-300">CRON_SECRET</code>.
            </li>
            <li>
              Database: SQLite at <code className="text-slate-300">.data/devzard.db</code> locally, Postgres when <code className="text-slate-300">DATABASE_URL</code> is set.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
