import { guard, errorResponse } from '@/lib/security';
import { databaseHealth } from '@/lib/db';
import { accountDbQuery, accountDatabaseHealth } from '@/lib/tenant-database';
import {
  analyticsRanges,
  bucketEvents,
  groupAnalyticsEvents,
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

function groupedRows(rows: Record<string, unknown>[], includeModel: boolean) {
  return rows.map((row) => ({
    providerId: String(row.provider_id || ''),
    modelId: includeModel ? String(row.model_id || '') : null,
    requests: Number(row.requests) || 0,
    successes: Number(row.successes) || 0,
    failures: Number(row.failures) || 0,
    successRate: numeric(row.success_rate),
    inputTokens: numeric(row.input_tokens),
    outputTokens: numeric(row.output_tokens),
    averageLatencyMs: numeric(row.average_latency_ms),
    p50LatencyMs: numeric(row.p50_latency_ms),
    p95LatencyMs: numeric(row.p95_latency_ms),
  }));
}

export async function GET(request: Request) {
  try {
    const principal = await guard();
    const hideProviderInfo = principal.role === 'user' && principal.plan === 'premium';
    const accountFilter = principal.role === 'user' ? ' AND account_id = $2' : '';
    const accountParams = principal.role === 'user' ? [principal.id] : [];
    const url = new URL(request.url);
    const range = toAnalyticsRange(url.searchParams.get('range'));
    const config = analyticsRanges[range];
    const dbHealth =
      principal.role === 'user'
        ? await accountDatabaseHealth(principal.id)
        : await databaseHealth();
    if (dbHealth.configured) {
      if (!dbHealth.ready)
        return Response.json(
          {
            range,
            storage: 'unavailable',
            error:
              'Your workspace database is not ready. Check its connection and initialize Relay tables if needed.',
            summary: summarizeEvents([]),
            buckets: bucketEvents([], range),
            providers: [],
            models: [],
          },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      const summaryResult = await accountDbQuery(
        `SELECT
          count(*)::int AS requests,
          count(*) FILTER (WHERE succeeded)::int AS successes,
          count(*) FILTER (WHERE NOT succeeded)::int AS failures,
          CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE succeeded) / count(*) END AS success_rate,
          sum(input_tokens) AS input_tokens,
          sum(output_tokens) AS output_tokens,
          avg(latency_ms) AS average_latency_ms,
          percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
          avg(ttft_ms) AS average_ttft_ms
        FROM relay_analytics
        WHERE created_at >= now() - ($1::int * interval '1 hour') AND created_at <= now()${accountFilter}`,
        [config.hours, ...accountParams],
      );
      const startAt = Date.now() - config.hours * 60 * 60 * 1000;
      const bucketResult = await accountDbQuery(
        `SELECT
          floor((extract(epoch FROM created_at) * 1000 - $3::double precision) / $2::double precision)
            * $2::double precision + $3::double precision AS at,
          count(*) FILTER (WHERE succeeded)::int AS success,
          count(*) FILTER (WHERE NOT succeeded)::int AS failure
        FROM relay_analytics
        WHERE created_at >= now() - ($1::int * interval '1 hour') AND created_at <= now()${principal.role === 'user' ? ' AND account_id = $4' : ''}
        GROUP BY 1 ORDER BY 1`,
        [config.hours, config.stepMs, startAt, ...accountParams],
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
      const [providerResult, modelResult] = await Promise.all([
        accountDbQuery(
          `SELECT provider_id,
            count(*)::int AS requests,
            count(*) FILTER (WHERE succeeded)::int AS successes,
            count(*) FILTER (WHERE NOT succeeded)::int AS failures,
            100.0 * count(*) FILTER (WHERE succeeded) / count(*) AS success_rate,
            sum(input_tokens) AS input_tokens,
            sum(output_tokens) AS output_tokens,
            avg(latency_ms) AS average_latency_ms,
            percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
          FROM relay_analytics
          WHERE created_at >= now() - ($1::int * interval '1 hour') AND created_at <= now()${accountFilter}
          GROUP BY provider_id ORDER BY requests DESC, provider_id LIMIT 100`,
          [config.hours, ...accountParams],
        ),
        accountDbQuery(
          `SELECT provider_id, model_id,
            count(*)::int AS requests,
            count(*) FILTER (WHERE succeeded)::int AS successes,
            count(*) FILTER (WHERE NOT succeeded)::int AS failures,
            100.0 * count(*) FILTER (WHERE succeeded) / count(*) AS success_rate,
            sum(input_tokens) AS input_tokens,
            sum(output_tokens) AS output_tokens,
            avg(latency_ms) AS average_latency_ms,
            percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
          FROM relay_analytics
          WHERE created_at >= now() - ($1::int * interval '1 hour') AND created_at <= now()${accountFilter}
          GROUP BY provider_id, model_id ORDER BY requests DESC, provider_id, model_id LIMIT 200`,
          [config.hours, ...accountParams],
        ),
      ]);
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
            p50LatencyMs: numeric(row.p50_latency_ms),
            p95LatencyMs: numeric(row.p95_latency_ms),
            // No fake TTFT: the current provider calls are non-streaming.
            averageTtftMs: null,
            estimatedSavingsUsd: null,
          },
          buckets,
          providers: hideProviderInfo ? [] : groupedRows(providerResult.rows, false),
          models: groupedRows(modelResult.rows, true).map((row) =>
            hideProviderInfo ? { ...row, providerId: undefined } : row,
          ),
          notes: {
            ttft: 'Not measured: Relay currently requests non-streaming provider responses.',
            savings: 'Unavailable: no verified model-price baseline is configured.',
          },
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const now = Date.now();
    const events = inMemoryAnalytics(
      now - config.hours * 60 * 60 * 1000,
      principal.role === 'user' ? principal.id : undefined,
    );
    return Response.json(
      {
        range,
        storage: 'memory',
        summary: summarizeEvents(events),
        buckets: bucketEvents(events, range, now),
        providers: hideProviderInfo ? [] : groupAnalyticsEvents(events, 'provider'),
        models: groupAnalyticsEvents(events, 'model').map((row) =>
          hideProviderInfo ? { ...row, providerId: undefined } : row,
        ),
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
