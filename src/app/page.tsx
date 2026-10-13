import Link from "next/link";

const FEATURES = [
  {
    title: "AI chatbot",
    body: "An embeddable widget that answers from your own knowledge base, not from the model's imagination.",
  },
  {
    title: "Gmail auto-reply",
    body: "New mail becomes a drafted, grounded reply in Gmail Drafts. Approve in the inbox, or auto-send above a confidence threshold.",
  },
  {
    title: "Google Sheets money desk",
    body: "Customers, spend, income and profit mirrored into a spreadsheet — two-way, so edits in the sheet flow back.",
  },
  {
    title: "WhatsApp + Instagram support",
    body: "Meta Cloud API webhooks feed the same brain. Sandbox mode lets you rehearse before app review.",
  },
  {
    title: "Any AI, anywhere",
    body: "OpenAI, Gemini, Claude, Groq, OpenRouter — or Ollama / LM Studio / any OpenAI-compatible server on your own hardware.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
        Runs on Vercel or your laptop · cloud or local AI
      </span>

      <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-100 sm:text-5xl">
        One AI automation platform for chat, email, WhatsApp, Instagram{" "}
        <span className="text-brand-400">and your money</span>.
      </h1>

      <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
        Feed it your policies and prices once. It answers customers on every channel, drafts your email replies, and keeps
        customers, budget spend and profit in sync with Google Sheets.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/dashboard" className="btn-primary !px-5 !py-2.5">
          Open dashboard
        </Link>
        <Link href="/embed" className="btn-ghost !px-5 !py-2.5">
          Try the chat widget
        </Link>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card card-pad">
            <h2 className="text-sm font-semibold text-slate-100">{f.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-14 text-xs text-slate-600">
        Default login is <code className="text-slate-500">admin / admin</code> — change it in <code className="text-slate-500">.env</code>.
      </p>
    </main>
  );
}
