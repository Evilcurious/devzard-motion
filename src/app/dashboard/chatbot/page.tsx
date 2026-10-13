"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Toggle } from "@/components/ui";

interface ChatbotConfig {
  name: string;
  welcome: string;
  color: string;
  position: "right" | "left";
  tone: string;
  systemPrompt: string;
  guardrails: string;
  fallbackReply: string;
  signature: string;
  businessHours: string;
  handoffKeywords: string;
  channels: { web: boolean; email: boolean; whatsapp: boolean; instagram: boolean };
  autoSend: boolean;
  autoSendConfidence: number;
}

export default function ChatbotPage() {
  const [cfg, setCfg] = useState<ChatbotConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void (async () => {
      const res = await fetch("/api/settings");
      const data = (await res.json()) as { chatbot: ChatbotConfig };
      setCfg(data.chatbot);
    })();
  }, []);

  const save = useCallback(async (next: ChatbotConfig) => {
    setCfg(next);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatbot: next }),
    });
    setSaved("Saved");
    setTimeout(() => setSaved(""), 1600);
  }, []);

  if (!cfg) return <div className="card card-pad text-sm text-slate-500">Loading…</div>;

  const set = (patch: Partial<ChatbotConfig>) => save({ ...cfg, ...patch });
  const snippet = `<script src="${origin}/widget.js" defer></script>`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Chatbot</h1>
          <p className="text-sm text-slate-500">The website widget — same brain, same knowledge base, same inbox.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <Badge tone="good">{saved}</Badge>}
          <a className="btn-ghost" href="/embed" target="_blank">
            Open live preview
          </a>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Appearance">
          <div className="space-y-3">
            <label className="block">
              <span className="label">Assistant name</span>
              <input className="input" value={cfg.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Welcome message</span>
              <input className="input" value={cfg.welcome} onChange={(e) => set({ welcome: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Accent colour</span>
                <input type="color" className="input h-10 p-1" value={cfg.color} onChange={(e) => set({ color: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">Position</span>
                <select className="input" value={cfg.position} onChange={(e) => set({ position: e.target.value as "left" | "right" })}>
                  <option value="right">Bottom right</option>
                  <option value="left">Bottom left</option>
                </select>
              </label>
            </div>
          </div>
        </Card>

        <Card title="Personality" subtitle="How the AI behaves on every channel">
          <div className="space-y-3">
            <label className="block">
              <span className="label">Tone</span>
              <input className="input" value={cfg.tone} onChange={(e) => set({ tone: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">System prompt</span>
              <textarea className="input min-h-[6rem]" value={cfg.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Hard rules</span>
              <textarea className="input min-h-[4.5rem]" value={cfg.guardrails} onChange={(e) => set({ guardrails: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Fallback (when the answer isn&apos;t in your knowledge base)</span>
              <textarea className="input min-h-[3rem]" value={cfg.fallbackReply} onChange={(e) => set({ fallbackReply: e.target.value })} />
            </label>
          </div>
        </Card>

        <Card title="Channels" subtitle="Where the AI replies automatically">
          <div className="space-y-3">
            {(["web", "email", "whatsapp", "instagram"] as const).map((ch) => (
              <Toggle
                key={ch}
                checked={cfg.channels[ch]}
                onChange={(v) => set({ channels: { ...cfg.channels, [ch]: v } })}
                label={ch === "web" ? "Website chat widget" : ch === "email" ? "Gmail auto-draft" : ch === "whatsapp" ? "WhatsApp" : "Instagram DMs"}
                hint={
                  ch === "email"
                    ? "Drafts land in Gmail Drafts. Turn on auto-send below to skip review."
                    : ch === "whatsapp"
                      ? "Needs WhatsApp Cloud API credentials."
                      : ch === "instagram"
                        ? "Needs Instagram Messaging credentials."
                        : "Answers instantly on your site."
                }
              />
            ))}
          </div>
        </Card>

        <Card title="Autonomy" subtitle="How much you trust the model">
          <div className="space-y-4">
            <Toggle
              checked={cfg.autoSend}
              onChange={(v) => set({ autoSend: v })}
              label="Send without asking me"
              hint="Off = every reply waits in the Inbox for approval."
            />
            <label className="block">
              <span className="label">
                Minimum confidence to auto-send: {Math.round(cfg.autoSendConfidence * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                className="w-full accent-brand-500"
                value={cfg.autoSendConfidence}
                onChange={(e) => set({ autoSendConfidence: Number(e.target.value) })}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Confidence is how strongly the reply is grounded in your knowledge base.
              </span>
            </label>
            <label className="block">
              <span className="label">Hand off to a human when the reply mentions</span>
              <input className="input" value={cfg.handoffKeywords} onChange={(e) => set({ handoffKeywords: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Email signature</span>
              <input className="input" value={cfg.signature} onChange={(e) => set({ signature: e.target.value })} />
            </label>
          </div>
        </Card>
      </div>

      <Card title="Install on your site" subtitle="One line of HTML — works with any site or builder">
        <div className="space-y-3">
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-ink-950 px-4 py-3 text-xs text-slate-300">
            <code>{snippet}</code>
          </pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-slate-400">
              <p className="mb-1 font-medium text-slate-300">Next.js / React</p>
              <code className="text-[11px] text-slate-500">{"<script src=\"/widget.js\" defer /> in app/layout.tsx"}</code>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs text-slate-400">
              <p className="mb-1 font-medium text-slate-300">WordPress / Shopify / Webflow</p>
              <code className="text-[11px] text-slate-500">Paste the snippet into the footer / custom-code block.</code>
            </div>
          </div>
          <p className="text-[11px] text-slate-600">
            The widget talks to <code className="text-slate-500">/api/chat</code> on this deployment, keeps a session id in
            localStorage, and every conversation shows up in your Inbox.
          </p>
        </div>
      </Card>
    </div>
  );
}
