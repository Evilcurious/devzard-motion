import { randomUUID } from 'node:crypto';
import { databaseConfigured } from './db';
import { accountDbQuery } from './tenant-database';
import { getPrincipal } from './security';
import { rememberUnpersistedUsage } from './usage-memory';

export type AnalyticsEvent = {
  accountId?: string;
  providerId: string;
  modelId: string;
  success: boolean;
  statusCode: number | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  // Relay uses non-streaming completions; true time-to-first-token is therefore unknown.
  ttftMs: number | null;
  createdAt: string;
};

type AnalyticsGlobal = typeof globalThis & { relayAnalyticsEvents?: AnalyticsEvent[] };
const eventBuffer = globalThis as AnalyticsGlobal;

function safeTokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function recordAnalyticsEvent(
  event: Omit<AnalyticsEvent, 'createdAt' | 'accountId'> & { accountId?: string },
): Promise<boolean> {
  let accountId = event.accountId;
  if (!accountId) {
    try {
      accountId = (await getPrincipal())?.id || 'owner';
    } catch {
      accountId = 'owner';
    }
  }
  const safe: AnalyticsEvent = {
    ...event,
    accountId,
    providerId: event.providerId.slice(0, 40),
    modelId: event.modelId.slice(0, 200),
    latencyMs: Math.max(0, Math.min(600_000, Math.round(event.latencyMs))),
    inputTokens: safeTokens(event.inputTokens),
    outputTokens: safeTokens(event.outputTokens),
    ttftMs: null,
    createdAt: new Date().toISOString(),
  };
  const recent = (eventBuffer.relayAnalyticsEvents ||= []);
  recent.push(safe);
  if (recent.length > 5000) recent.splice(0, recent.length - 5000);

  if (!databaseConfigured()) {
    rememberUnpersistedUsage(safe.accountId || 'owner', safe.inputTokens, safe.outputTokens);
    return safe.accountId === 'owner';
  }
  try {
    await accountDbQuery(
      `INSERT INTO relay_analytics
        (id, account_id, provider_id, model_id, succeeded, status_code, latency_ms, ttft_ms, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        safe.accountId || 'owner',
        safe.providerId,
        safe.modelId,
        safe.success,
        safe.statusCode,
        safe.latencyMs,
        safe.ttftMs,
        safe.inputTokens,
        safe.outputTokens,
      ],
    );
    return true;
  } catch {
    // Capped user usage remains in a volatile ledger if the durable insert fails; no response is served.
    rememberUnpersistedUsage(safe.accountId || 'owner', safe.inputTokens, safe.outputTokens);
    return false;
  }
}

export function inMemoryAnalytics(since: number, accountId?: string): AnalyticsEvent[] {
  return (eventBuffer.relayAnalyticsEvents || []).filter(
    (event) =>
      Date.parse(event.createdAt) >= since && (!accountId || event.accountId === accountId),
  );
}

export type ObservedRoutingMetric = {
  requests: number;
  successRate: number;
  averageLatencyMs: number | null;
};
const observedRoutingMetricsCache = new Map<
  string,
  {
    at: number;
    metrics: Map<string, ObservedRoutingMetric>;
  }
>();
const OBSERVED_ROUTING_METRICS_CACHE_MS = 15_000;

export async function observedModelMetricsByTarget(): Promise<Map<string, ObservedRoutingMetric>> {
  const principal = await getPrincipal();
  const accountId = principal?.role === 'user' ? principal.id : undefined;
  const cacheKey = accountId || 'all';
  const cached = observedRoutingMetricsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OBSERVED_ROUTING_METRICS_CACHE_MS)
    return new Map(cached.metrics);
  const recent = inMemoryAnalytics(Date.now() - 30 * 24 * 60 * 60 * 1000, accountId);
  const totals = new Map<
    string,
    { requests: number; successes: number; latencyTotal: number; latencyCount: number }
  >();
  for (const event of recent) {
    const key = `${event.providerId}::${event.modelId}`;
    const current = totals.get(key) || {
      requests: 0,
      successes: 0,
      latencyTotal: 0,
      latencyCount: 0,
    };
    current.requests++;
    if (event.success) {
      current.successes++;
      current.latencyTotal += event.latencyMs;
      current.latencyCount++;
    }
    totals.set(key, current);
  }
  const metrics = new Map<string, ObservedRoutingMetric>();
  for (const [key, value] of totals) {
    metrics.set(key, {
      requests: value.requests,
      successRate: (value.successes / value.requests) * 100,
      averageLatencyMs: value.latencyCount ? value.latencyTotal / value.latencyCount : null,
    });
  }
  if (!databaseConfigured()) {
    observedRoutingMetricsCache.set(cacheKey, { at: Date.now(), metrics });
    return new Map(metrics);
  }
  try {
    const result = await accountDbQuery(
      accountId
        ? `SELECT provider_id, model_id, count(*)::int AS requests,
             100.0 * count(*) FILTER (WHERE succeeded) / count(*) AS success_rate,
             avg(latency_ms) FILTER (WHERE succeeded) AS average_latency
           FROM relay_analytics WHERE account_id = $1 AND created_at >= now() - interval '30 days'
           GROUP BY provider_id, model_id`
        : `SELECT provider_id, model_id, count(*)::int AS requests,
             100.0 * count(*) FILTER (WHERE succeeded) / count(*) AS success_rate,
             avg(latency_ms) FILTER (WHERE succeeded) AS average_latency
           FROM relay_analytics WHERE created_at >= now() - interval '30 days'
           GROUP BY provider_id, model_id`,
      accountId ? [accountId] : [],
    );
    for (const row of result.rows) {
      const requests = Number(row.requests);
      const successRate = Number(row.success_rate);
      const average = row.average_latency === null ? null : Number(row.average_latency);
      if (Number.isFinite(requests) && requests > 0 && Number.isFinite(successRate))
        metrics.set(`${row.provider_id}::${row.model_id}`, {
          requests,
          successRate,
          averageLatencyMs: average !== null && Number.isFinite(average) ? average : null,
        });
    }
  } catch {
    // Routing remains available when analytics storage is not initialized.
  }
  observedRoutingMetricsCache.set(cacheKey, { at: Date.now(), metrics });
  return new Map(metrics);
}

export async function observedLatencyByTarget(): Promise<Map<string, number>> {
  const metrics = await observedModelMetricsByTarget();
  return new Map(
    [...metrics]
      .filter(([, metric]) => metric.averageLatencyMs !== null)
      .map(([key, metric]) => [key, metric.averageLatencyMs!]),
  );
}

export const analyticsRanges = {
  '24h': { hours: 24, stepMs: 60 * 60 * 1000, buckets: 24 },
  '7d': { hours: 24 * 7, stepMs: 24 * 60 * 60 * 1000, buckets: 7 },
  '30d': { hours: 24 * 30, stepMs: 24 * 60 * 60 * 1000, buckets: 30 },
  '90d': { hours: 24 * 90, stepMs: 24 * 60 * 60 * 1000, buckets: 90 },
} as const;
export type AnalyticsRange = keyof typeof analyticsRanges;

export function toAnalyticsRange(value: string | null): AnalyticsRange {
  return value && value in analyticsRanges ? (value as AnalyticsRange) : '7d';
}

function percentile(sortedValues: number[], quantile: number): number | null {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

export function summarizeEvents(events: AnalyticsEvent[]) {
  const successCount = events.filter((event) => event.success).length;
  const latencies = events.map((event) => event.latencyMs).sort((a, b) => a - b);
  const inputValues = events.flatMap((event) =>
    event.inputTokens === null ? [] : [event.inputTokens],
  );
  const outputValues = events.flatMap((event) =>
    event.outputTokens === null ? [] : [event.outputTokens],
  );
  return {
    requests: events.length,
    successes: successCount,
    failures: events.length - successCount,
    successRate: events.length ? (successCount / events.length) * 100 : null,
    inputTokens: inputValues.length ? inputValues.reduce((sum, n) => sum + n, 0) : null,
    outputTokens: outputValues.length ? outputValues.reduce((sum, n) => sum + n, 0) : null,
    averageLatencyMs: latencies.length
      ? latencies.reduce((sum, n) => sum + n, 0) / latencies.length
      : null,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    averageTtftMs: null,
    estimatedSavingsUsd: null,
  };
}

export type AnalyticsGroup = {
  providerId: string;
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

export function groupAnalyticsEvents(
  events: AnalyticsEvent[],
  dimension: 'provider' | 'model',
): AnalyticsGroup[] {
  const groups = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const key =
      dimension === 'provider' ? event.providerId : `${event.providerId}::${event.modelId}`;
    const items = groups.get(key) || [];
    items.push(event);
    groups.set(key, items);
  }
  return [...groups.values()]
    .map((items) => {
      const summary = summarizeEvents(items);
      const first = items[0];
      return {
        providerId: first.providerId,
        modelId: dimension === 'model' ? first.modelId : null,
        requests: summary.requests,
        successes: summary.successes,
        failures: summary.failures,
        successRate: summary.successRate,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
        averageLatencyMs: summary.averageLatencyMs,
        p50LatencyMs: summary.p50LatencyMs,
        p95LatencyMs: summary.p95LatencyMs,
      };
    })
    .sort((a, b) => b.requests - a.requests || a.providerId.localeCompare(b.providerId));
}

export function bucketEvents(events: AnalyticsEvent[], range: AnalyticsRange, now = Date.now()) {
  const config = analyticsRanges[range];
  const firstBucket = now - config.hours * 60 * 60 * 1000;
  const counts = new Map<number, { success: number; failure: number }>();
  for (const event of events) {
    const timestamp = Date.parse(event.createdAt);
    if (timestamp < firstBucket || timestamp > now) continue;
    const index = Math.min(
      config.buckets - 1,
      Math.floor((timestamp - firstBucket) / config.stepMs),
    );
    const bucket = firstBucket + index * config.stepMs;
    const count = counts.get(bucket) || { success: 0, failure: 0 };
    if (event.success) count.success++;
    else count.failure++;
    counts.set(bucket, count);
  }
  return Array.from({ length: config.buckets }, (_, index) => {
    const at = firstBucket + index * config.stepMs;
    return { at: new Date(at).toISOString(), ...(counts.get(at) || { success: 0, failure: 0 }) };
  });
}
