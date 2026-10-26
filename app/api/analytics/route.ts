import { guard, errorResponse } from '@/lib/security';
import { databaseHealth, dbQuery } from '@/lib/db';
import {
  analyticsRanges,
  bucketEvents,
  inMemoryAnalytics,
  summarizeEvents,
  toAnalyticsRange,
} from '@/lib/analytics';
export const dynamic = 'force-dynamic';

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    await guard();
    const url = new URL(request.url);
    const range = toAnalyticsRange(url.searchParams.get('range'));
    const config = analyticsRanges[range];
    const dbHealth = await databaseHealth();
    if (dbHealth.configured) {
      if (!dbHealth.ready)
        return Response.json(
          {
            range,
            storage: 'unavailable',
            error: dbHealth.error,
            summary: summarizeEvents([]),
            buckets: bucketEvents([], range),
          },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      const summaryResult = await dbQuery(
        `SELECT
          count(*)::int AS requests,
          count(*) FILTER (WHERE succeeded)::int AS successes,
          count(*) FILTER (WHERE NOT succeeded)::int AS failures,
          CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE succeeded) / count(*) END AS success_rate,
          sum(input_tokens) AS input_tokens,
          sum(output_tokens) AS output_tokens,
          avg(latency_ms) AS average_latency_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
          avg(ttft_ms) AS average_ttft_ms
        FROM relay_analytics
        WHERE created_at >= now() - ($1::int * interval '1 hour') AND created_at <= now()`,
        [config.hours],
      );
      const startAt = Date.now() - config.hours * 60 * 60 * 1000;
      const bucketResult = await dbQuery(
        `SELECT
          floor((extract(epoch FROM created_at) * 1000 - $3::double precision) / $2::double precision)
            * $2::double precision + $3::double precision AS at,
          count(*) FILTER (WHERE succeeded)::int AS success,
          count(*) FILTER (WHERE NOT succeeded)::int AS failure
        FROM relay_analytics
        WHERE created_at >= now() - ($1::int * interval '1 hour') AND created_at <= now()
        GROUP BY 1 ORDER BY 1`,
        [config.hours, config.stepMs, startAt],
      );
      const raw = new Map<number, { success: number; failure: number }>();
      for (const row of bucketResult.rows) {
        const at = Number(row.at);
        if (Number.isFinite(at))
          raw.set(at, { success: Number(row.success) || 0, failure: Number(row.failure) || 0 });
      }
      const buckets = Array.from({ length: config.buckets }, (_, index) => {
        const at = startAt + index * config.stepMs;
        return {
          at: new Date(at).toISOString(),
          ...(raw.get(at) || { success: 0, failure: 0 }),
        };
      });
      const row = summaryResult.rows[0] || {};
      return Response.json(
        {
          range,
          storage: 'postgresql',
          summary: {
            requests: Number(row.requests) || 0,
            successes: Number(row.successes) || 0,
            failures: Number(row.failures) || 0,
            successRate: numeric(row.success_rate),
            inputTokens: numeric(row.input_tokens),
            outputTokens: numeric(row.output_tokens),
            averageLatencyMs: numeric(row.average_latency_ms),
            p95LatencyMs: numeric(row.p95_latency_ms),
            // No fake TTFT: the current provider calls are non-streaming.
            averageTtftMs: null,
            estimatedSavingsUsd: null,
          },
          buckets,
          notes: {
            ttft: 'Not measured: Relay currently requests non-streaming provider responses.',
            savings: 'Unavailable: no verified model-price baseline is configured.',
          },
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const now = Date.now();
    const events = inMemoryAnalytics(now - config.hours * 60 * 60 * 1000);
    return Response.json(
      {
        range,
        storage: 'memory',
        summary: summarizeEvents(events),
        buckets: bucketEvents(events, range, now),
        notes: {
          storage: 'Metrics are held in server memory and may reset when the server restarts.',
          ttft: 'Not measured: Relay currently requests non-streaming provider responses.',
          savings: 'Unavailable: no verified model-price baseline is configured.',
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
