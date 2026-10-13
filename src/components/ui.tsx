"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "brand";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-100",
    good: "text-mint-400",
    warn: "text-amberish-400",
    bad: "text-rose-400",
    brand: "text-brand-400",
  };
  return (
    <div className="card card-pad">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "good" | "warn" | "bad" | "brand" }) {
  const tones: Record<string, string> = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    good: "border-mint-500/30 bg-mint-500/10 text-mint-400",
    warn: "border-amberish-400/30 bg-amberish-400/10 text-amberish-400",
    bad: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    brand: "border-brand-500/30 bg-brand-500/10 text-brand-400",
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition ${
          checked ? "border-brand-500/60 bg-brand-600/80" : "border-white/15 bg-white/5"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[1.15rem]" : "translate-x-1"
          }`}
        />
      </button>
      <span>
        {label && <span className="block text-sm text-slate-200">{label}</span>}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/finance", label: "Money" },
  { href: "/dashboard/chatbot", label: "Chatbot" },
  { href: "/dashboard/automations", label: "Automations" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-ink-900/60 px-4 py-4 backdrop-blur md:h-screen md:w-60 md:border-b-0 md:border-r md:px-4 md:py-6">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-mint-500 text-sm font-black text-ink-950">
          D
        </span>
        <span className="text-sm font-semibold tracking-tight text-slate-100">
          Devzard <span className="text-brand-400">Motion</span>
        </span>
      </Link>

      <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {NAV.map((item) => {
          const active = item.href === "/dashboard" ? path === "/dashboard" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-white/[0.08] text-slate-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden pt-6 md:block">
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="btn-ghost w-full !justify-start text-xs">
            Sign out
          </button>
        </form>
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-slate-600">
          Runs on Vercel or locally · Cloud or local AI
        </p>
      </div>
    </aside>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center">
      <p className="text-sm text-slate-400">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-brand-500" />
      {label}
    </span>
  );
}

export function money(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n) || 0);
  } catch {
    return `${Number(n || 0).toFixed(2)} ${currency}`;
  }
}

export function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
