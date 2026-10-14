'use client';
import { ArrowUpRight, Check, ChevronRight, FileSpreadsheet, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Workflow } from '@/lib/client-types';
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`relay-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path
          d="M20 7v26M7 20h26M11 11l18 18M11 29l18-18"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function AppIcon({
  type,
  large = false,
}: {
  type: 'email' | 'sheet' | 'sparkles' | 'ollama' | 'api';
  large?: boolean;
}) {
  return (
    <span className={`app-icon icon-${type} ${large ? 'large' : ''}`}>
      {type === 'email' ? (
        <svg viewBox="0 0 32 26" fill="none" aria-hidden="true">
          <path d="M3 23V5l13 10L29 5v18" stroke="#4285F4" strokeWidth="5" strokeLinejoin="round" />
          <path d="M3 5l13 10L29 5" stroke="#EA4335" strokeWidth="5" strokeLinejoin="round" />
          <path d="M29 5v18" stroke="#34A853" strokeWidth="5" />
          <path d="M3 5v7" stroke="#C5221F" strokeWidth="5" />
          <path d="M29 5v7" stroke="#FBBC04" strokeWidth="5" />
        </svg>
      ) : type === 'sheet' ? (
        <FileSpreadsheet size={large ? 29 : 23} />
      ) : type === 'sparkles' ? (
        <Sparkles size={large ? 29 : 23} />
      ) : type === 'api' ? (
        <Mark small />
      ) : (
        <svg viewBox="0 0 32 34" fill="none" aria-hidden="true">
          <path
            d="M10 15C7 9 8 2 11 3c3 1 3 9 3 11m5 0c0-5 1-12 4-11 3 1 2 10 0 13M8 17c-6 7-1 15 8 15 10 0 14-9 7-15-3-4-11-4-15 0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 22h1m7 0h1m-6 5h3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function handle(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea, select, a[href], [tabindex="0"]',
        );
        if (!nodes?.length) {
          event.preventDefault();
          return;
        }
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function WorkflowCard({ workflow, onRun }: { workflow: Workflow; onRun: () => void }) {
  return (
    <button className="workflow-card" onClick={onRun}>
      <div className="card-top">
        <AppIcon type={workflow.icon} />
        <ArrowUpRight size={17} className="card-arrow" />
      </div>
      <h3>{workflow.title}</h3>
      <p>{workflow.description}</p>
      <span className="card-link">
        Try this task <ChevronRight size={13} />
      </span>
    </button>
  );
}
export function Steps({ items }: { items: string[] }) {
  return (
    <div className="agent-steps">
      {items.map((step, i) => (
        <span key={i}>
          <Check size={13} />
          {step}
        </span>
      ))}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
