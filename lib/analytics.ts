import { randomUUID } from 'node:crypto';
import { databaseConfigured, dbQuery } from './db';

export type AnalyticsEvent = {
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
  event: Omit<AnalyticsEvent, 'createdAt'>,
): Promise<void> {
  const safe: AnalyticsEvent = {
    ...event,
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

  if (!databaseConfigured()) return;
  try {
    await dbQuery(
      `INSERT INTO relay_analytics
        (id, provider_id, model_id, succeeded, status_code, latency_ms, ttft_ms, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
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
  } catch {
    // Analytics must never make model requests fail. The in-memory buffer remains available.
  }
}

export function inMemoryAnalytics(since: number): AnalyticsEvent[] {
  return (eventBuffer.relayAnalyticsEvents || []).filter(
    (event) => Date.parse(event.createdAt) >= since,
  );
}

export async function observedLatencyByTarget(): Promise<Map<string, number>> {
  const recent = inMemoryAnalytics(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const totals = new Map<string, { total: number; count: number }>();
  for (const event of recent) {
    if (!event.success) continue;
    const key = `${event.providerId}::${event.modelId}`;
    const current = totals.get(key) || { total: 0, count: 0 };
    current.total += event.latencyMs;
    current.count++;
    totals.set(key, current);
  }
  const latencies = new Map([...totals].map(([key, value]) => [key, value.total / value.count]));
  if (!databaseConfigured()) return latencies;
  try {
    const result = await dbQuery(
      `SELECT provider_id, model_id, avg(latency_ms)::float AS average_latency
       FROM relay_analytics
       WHERE succeeded = true AND created_at >= now() - interval '30 days'
       GROUP BY provider_id, model_id`,
    );
    for (const row of result.rows) {
      const average = Number(row.average_latency);
      if (Number.isFinite(average)) latencies.set(`${row.provider_id}::${row.model_id}`, average);
    }
  } catch {
    // Routing remains available when analytics storage is not initialized.
  }
  return latencies;
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
    p95LatencyMs: latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)]
      : null,
    averageTtftMs: null,
    estimatedSavingsUsd: null,
  };
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
