'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Database, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client-api';

type Range = '24h' | '7d' | '30d' | '90d';
type Bucket = { at: string; success: number; failure: number };
type Summary = {
  requests: number;
  successes: number;
  failures: number;
  successRate: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  averageLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  averageTtftMs: number | null;
  estimatedSavingsUsd: number | null;
};
type BreakdownRow = {
  providerId?: string;
  modelId: string | null;
  requests: number;
  successes: number;
  failures: number;
  successRate: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  averageLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
};
type AnalyticsResponse = {
  range: Range;
  storage: 'postgresql' | 'memory' | 'unavailable';
  summary: Summary;
  buckets: Bucket[];
  providers: BreakdownRow[];
  models: BreakdownRow[];
  error?: string;
  notes?: { storage?: string; ttft?: string; savings?: string };
};

const emptySummary: Summary = {
  requests: 0,
  successes: 0,
  failures: 0,
  successRate: null,
  inputTokens: null,
  outputTokens: null,
  averageLatencyMs: null,
  p50LatencyMs: null,
  p95LatencyMs: null,
  averageTtftMs: null,
  estimatedSavingsUsd: null,
};
const ranges: Range[] = ['24h', '7d', '30d', '90d'];
const number = (value: number | null) => (value === null ? '—' : value.toLocaleString());
const duration = (value: number | null) =>
  value === null ? '—' : `${Math.round(value).toLocaleString()} ms`;

function TrendChart({ buckets }: { buckets: Bucket[] }) {
  const width = 800;
  const height = 240;
  const left = 42;
  const right = 18;
  const top = 18;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const peak = Math.max(1, ...buckets.flatMap((bucket) => [bucket.success, bucket.failure]));
  const points = (field: 'success' | 'failure') =>
    buckets
      .map((bucket, index) => {
        const x =
          left + (buckets.length <= 1 ? plotWidth / 2 : (index / (buckets.length - 1)) * plotWidth);
        const y = top + plotHeight - (bucket[field] / peak) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  const labelAt = (index: number) => {
    const date = new Date(buckets[index]?.at || Date.now());
    return rangesLabel(date, buckets.length);
  };
  return (
    <div className="analytics-chart-wrap">
      <svg
        className="analytics-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Provider API requests by time, shown as successful and failed requests"
        preserveAspectRatio="none"
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = top + plotHeight * fraction;
          const value = Math.round(peak * (1 - fraction));
          return (
            <g key={fraction}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="analytics-gridline" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="analytics-axis-label">
                {value}
              </text>
            </g>
          );
        })}
        {buckets.length > 0 && (
          <>
            <polyline points={points('success')} className="analytics-line-success" />
            <polyline points={points('failure')} className="analytics-line-failure" />
            {buckets.map((bucket, index) => {
              const x =
                left +
                (buckets.length <= 1 ? plotWidth / 2 : (index / (buckets.length - 1)) * plotWidth);
              const successY = top + plotHeight - (bucket.success / peak) * plotHeight;
              const failureY = top + plotHeight - (bucket.failure / peak) * plotHeight;
              return (
                <g key={bucket.at}>
                  {bucket.success > 0 && (
                    <circle cx={x} cy={successY} r="2.8" className="analytics-dot-success" />
                  )}
                  {bucket.failure > 0 && (
                    <circle cx={x} cy={failureY} r="2.8" className="analytics-dot-failure" />
                  )}
                </g>
              );
            })}
            <text x={left} y={height - 8} className="analytics-axis-label">
              {labelAt(0)}
            </text>
            <text x={width / 2} y={height - 8} textAnchor="middle" className="analytics-axis-label">
              {labelAt(Math.floor((buckets.length - 1) / 2))}
            </text>
            <text
              x={width - right}
              y={height - 8}
              textAnchor="end"
              className="analytics-axis-label"
            >
              {labelAt(buckets.length - 1)}
            </text>
          </>
        )}
      </svg>
      <div className="analytics-legend">
        <span>
          <i className="success" />
          Success
        </span>
        <span>
          <i className="failure" />
          Failures
        </span>
      </div>
      <table className="visually-hidden">
        <caption>Provider request trend data</caption>
        <thead>
          <tr>
            <th>Time</th>
            <th>Success</th>
            <th>Failures</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.at}>
              <td>{bucket.at}</td>
              <td>{bucket.success}</td>
              <td>{bucket.failure}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rangesLabel(date: Date, count: number) {
  return date.toLocaleDateString(
    undefined,
    count === 24
      ? { month: 'short', day: 'numeric', hour: 'numeric' }
      : { month: 'short', day: 'numeric' },
  );
}

function BreakdownTable({
  title,
  rows,
  showModel,
  showProvider = true,
}: {
  title: string;
  rows: BreakdownRow[];
  showModel: boolean;
  showProvider?: boolean;
}) {
  return (
    <section className="analytics-breakdown-panel">
      <div className="analytics-panel-heading">
        <BarChart3 size={16} />
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      {rows.length ? (
        <div className="analytics-table-scroll">
          <table className="analytics-breakdown-table">
            <thead>
              <tr>
                <th scope="col">
                  {showModel ? (showProvider ? 'Model / provider' : 'Model') : 'Provider'}
                </th>
                <th scope="col">Requests</th>
                <th scope="col">Success</th>
                <th scope="col">In tokens</th>
                <th scope="col">Out tokens</th>
                <th scope="col">Avg latency</th>
                <th scope="col">P50</th>
                <th scope="col">P95</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.providerId || 'hidden'}::${row.modelId || ''}`}>
                  <th scope="row">
                    {showModel ? (
                      <>
                        <strong>{row.modelId || 'Unknown model'}</strong>
                        {showProvider && row.providerId && <small>{row.providerId}</small>}
                      </>
                    ) : (
                      row.providerId
                    )}
                  </th>
                  <td>{number(row.requests)}</td>
                  <td>{row.successRate === null ? '—' : `${row.successRate.toFixed(1)}%`}</td>
                  <td>{number(row.inputTokens)}</td>
                  <td>{number(row.outputTokens)}</td>
                  <td>{duration(row.averageLatencyMs)}</td>
                  <td>{duration(row.p50LatencyMs)}</td>
                  <td>{duration(row.p95LatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="analytics-breakdown-empty">No calls in this range.</p>
      )}
    </section>
  );
}

export function Analytics({
  onOpenStorage,
  hideProviders = false,
}: {
  onOpenStorage?: () => void;
  hideProviders?: boolean;
}) {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  async function refresh(current: Range) {
    setBusy(true);
    setError('');
    try {
      const result = await api<AnalyticsResponse>(
        `/api/analytics?range=${current}`,
        undefined,
        'GET',
      );
      setData(result);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh(range);
  }, [range]);
  const summary = data?.summary || emptySummary;
  const buckets = useMemo(() => data?.buckets || [], [data]);
  const cards = [
    { label: 'Requests', value: number(summary.requests), note: 'Actual provider API calls' },
    {
      label: 'Success rate',
      value: summary.successRate === null ? '—' : `${summary.successRate.toFixed(1)}%`,
      note: `${number(summary.successes)} success · ${number(summary.failures)} failed`,
    },
    {
      label: 'Input tokens',
      value: number(summary.inputTokens),
      note: 'Only usage returned by providers',
    },
    {
      label: 'Output tokens',
      value: number(summary.outputTokens),
      note: 'Only usage returned by providers',
    },
    {
      label: 'Avg latency',
      value: duration(summary.averageLatencyMs),
      note: 'Measured request duration',
    },
    {
      label: 'P50 / P95 latency',
      value: `${duration(summary.p50LatencyMs)} / ${duration(summary.p95LatencyMs)}`,
      note: 'Median / 95th percentile request duration',
    },
    {
      label: 'Avg TTFT',
      value: summary.averageTtftMs === null ? 'Not measured' : duration(summary.averageTtftMs),
      note: data?.notes?.ttft || 'Measured from streaming token events',
    },
    {
      label: 'Est. savings',
      value:
        summary.estimatedSavingsUsd === null
          ? 'Unavailable'
          : `$${summary.estimatedSavingsUsd.toFixed(2)}`,
      note: data?.notes?.savings || 'Requires verified provider pricing',
    },
  ];
  return (
    <div className="page-content analytics-page">
      <div className="page-heading analytics-heading">
        <div>
          <div className="eyebrow">OBSERVED PROVIDER USAGE</div>
          <h1>Analytics</h1>
          <p>
            Request volume, latency, token usage and failures from real Relay chat-completion calls.
          </p>
        </div>
        <div className="analytics-actions">
          <div className="analytics-range" role="group" aria-label="Analytics time range">
            {ranges.map((item) => (
              <button
                key={item}
                className={range === item ? 'active' : ''}
                aria-pressed={range === item}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            aria-label="Refresh analytics"
            onClick={() => void refresh(range)}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {data?.storage === 'unavailable' && (
        <div className="info-callout analytics-database-warning">
          <Database size={18} />
          <div>
            <strong>Analytics storage is not ready</strong>
            <p>
              {onOpenStorage
                ? `${data.error || 'Initialize the Relay tables before loading usage metrics.'} Your requests will continue to work; analytics are not persisted until the hosted migration is complete.`
                : 'The shared workspace analytics database is not ready. Contact the administrator to restore analytics.'}
            </p>
            {onOpenStorage && (
              <button className="button small" onClick={onOpenStorage}>
                Open Settings → Database
              </button>
            )}
          </div>
        </div>
      )}
      {data?.storage === 'memory' && (
        <div className="subtle-note">
          <Activity size={15} />
          {data.notes?.storage}
        </div>
      )}
      <div className="analytics-metrics-grid">
        {cards.map((card) => (
          <article className="analytics-metric-card" key={card.label}>
            <div className="analytics-metric-label">
              {card.label}
              <span>
                <Activity size={14} />
              </span>
            </div>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>
      <section className="analytics-trend-panel">
        <div className="analytics-panel-heading">
          <BarChart3 size={16} />
          <h2>Requests over time</h2>
          <span>{range}</span>
        </div>
        {busy && !data ? (
          <div className="analytics-loading">
            <LoaderCircle className="spin" size={18} /> Loading measured analytics…
          </div>
        ) : (
          <TrendChart buckets={buckets} />
        )}
      </section>
      <div className="analytics-breakdown-grid">
        {!hideProviders && (
          <BreakdownTable
            title="Provider performance"
            rows={data?.providers || []}
            showModel={false}
          />
        )}
        <BreakdownTable
          title="Model performance"
          rows={data?.models || []}
          showModel
          showProvider={!hideProviders}
        />
      </div>
      <p className="analytics-footnote">
        Counts and timings are recorded per upstream chat-completion API call; catalog refreshes and
        connection tests are excluded. Token totals use provider-reported usage only. TTFT and
        savings show as unavailable unless Relay can measure them from real streamed responses and
        verified prices; no estimates are fabricated.
      </p>
    </div>
  );
}
