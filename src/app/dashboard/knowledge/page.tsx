"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Empty, Spinner, Toggle, timeAgo } from "@/components/ui";

interface Source {
  id: string;
  title: string;
  kind: string;
  content: string;
  url: string;
  tags: string;
  enabled: number;
  chunks: number;
  updated_at: string;
}

export default function KnowledgePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState({ sources: 0, chunks: 0, chars: 0 });
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"text" | "qa">("text");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; sources: { title: string; score: number; excerpt: string }[]; meta: Record<string, unknown> } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/kb");
    const data = (await res.json()) as { sources: Source[]; stats: typeof stats };
    setSources(data.sources ?? []);
    setStats(data.stats ?? stats);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!content.trim()) return;
    setBusy("add");
    await fetch("/api/kb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Untitled", content, kind, tags }),
    });
    setTitle("");
    setContent("");
    setTags("");
    setBusy("");
    await load();
  }

  async function importUrl() {
    if (!url.trim()) return;
    setBusy("url");
    await fetch("/api/kb", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    setUrl("");
    setBusy("");
    await load();
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/kb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, enabled: enabled ? 1 : 0 }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/kb?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function test() {
    if (!question.trim()) return;
    setTesting(true);
    setAnswer(null);
    const res = await fetch("/api/kb/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: question }),
    });
    setAnswer((await res.json()) as typeof answer);
    setTesting(false);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Knowledge base</h1>
        <p className="text-sm text-slate-500">
          This is what your AI is allowed to answer from. Paste policies, prices, FAQs, product details — the model can only use what you feed it.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card card-pad">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Sources</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{stats.sources}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Searchable chunks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{stats.chunks}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Characters fed</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{stats.chars.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Add knowledge" subtitle="Text, notes, or a Q&A list">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Title</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shipping & delivery" />
              </label>
              <label className="block">
                <span className="label">Type</span>
                <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "text" | "qa")}>
                  <option value="text">Plain text / notes</option>
                  <option value="qa">Q&amp;A list (Q: … A: …)</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="label">Content</span>
              <textarea
                className="input min-h-[12rem] font-mono text-[13px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  kind === "qa"
                    ? "Q: Do you deliver to Lahore?\nA: Yes — 2 working days, flat Rs 250.\n\nQ: What is your refund policy?\nA: 14 days, unused items, original packaging."
                    : "We ship nationwide. Standard delivery is 2-4 working days and costs Rs 250. Express (next day) is Rs 600. Orders above Rs 8,000 ship free."
                }
              />
            </label>

            <label className="block">
              <span className="label">Tags (optional)</span>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="shipping, policy" />
            </label>

            <button className="btn-primary" disabled={!content.trim() || !!busy} onClick={add}>
              {busy === "add" ? <Spinner label="Saving…" /> : "Save to knowledge base"}
            </button>

            <div className="border-t border-white/[0.07] pt-4">
              <span className="label">Or import a public page</span>
              <div className="flex gap-2">
                <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yoursite.com/faq" />
                <button className="btn-ghost" disabled={!url.trim() || !!busy} onClick={importUrl}>
                  {busy === "url" ? <Spinner /> : "Import"}
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Test it" subtitle="Ask exactly what a customer would ask">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !testing && test()}
                placeholder="Do you deliver to Lahore?"
              />
              <button className="btn-primary" disabled={!question.trim() || testing} onClick={test}>
                {testing ? <Spinner /> : "Ask"}
              </button>
            </div>

            {answer && (
              <div className="space-y-3">
                <div className="rounded-lg border border-brand-500/25 bg-brand-500/10 px-3.5 py-3 text-sm text-slate-100">
                  {answer.answer || "(no answer)"}
                </div>
                {typeof answer.meta?.error === "string" && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {answer.meta.error}
                  </p>
                )}
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Grounded in</p>
                  {answer.sources.length ? (
                    answer.sources.map((s, i) => (
                      <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-300">{s.title}</span>
                          <Badge tone="brand">score {s.score}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{s.excerpt}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-600">Nothing matched — the model will use your fallback reply.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Your sources" subtitle={`${sources.length} saved`}>
        {sources.length ? (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-slate-200">{s.title}</span>
                    <Badge tone="slate">{s.kind}</Badge>
                    <Badge tone="brand">{s.chunks} chunks</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-600">{s.content.slice(0, 160)}</p>
                  <p className="mt-1 text-[10px] text-slate-600">Updated {timeAgo(s.updated_at)}</p>
                </div>
                <Toggle checked={!!s.enabled} onChange={(v) => toggle(s.id, v)} label="Active" />
                <button className="btn-danger !py-1.5 text-xs" onClick={() => remove(s.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No knowledge yet" hint="Add your first source above — start with your 10 most common customer questions." />
        )}
      </Card>
    </div>
  );
}
