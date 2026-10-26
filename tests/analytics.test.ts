import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketEvents,
  summarizeEvents,
  toAnalyticsRange,
  type AnalyticsEvent,
} from '../lib/analytics';

const event = (overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  providerId: 'openrouter',
  modelId: 'test-model',
  success: true,
  statusCode: 200,
  latencyMs: 1000,
  inputTokens: 12,
  outputTokens: 8,
  ttftMs: null,
  createdAt: '2026-10-26T12:15:00.000Z',
  ...overrides,
});

test('analytics aggregates only actual counts, provider-reported usage and measured latencies', () => {
  const summary = summarizeEvents([
    event(),
    event({
      success: false,
      statusCode: 429,
      latencyMs: 3000,
      inputTokens: null,
      outputTokens: null,
    }),
  ]);
  assert.equal(summary.requests, 2);
  assert.equal(summary.successes, 1);
  assert.equal(summary.failures, 1);
  assert.equal(summary.successRate, 50);
  assert.equal(summary.inputTokens, 12);
  assert.equal(summary.outputTokens, 8);
  assert.equal(summary.averageLatencyMs, 2000);
  assert.equal(summary.p95LatencyMs, 3000);
  assert.equal(summary.averageTtftMs, null);
  assert.equal(summary.estimatedSavingsUsd, null);
});

test('analytics buckets count only events within the selected range and fill empty periods', () => {
  const now = Date.parse('2026-10-26T12:30:00.000Z');
  const buckets = bucketEvents(
    [
      event({ createdAt: '2026-10-26T12:10:00.000Z' }),
      event({ success: false, createdAt: '2026-10-26T12:35:00.000Z' }),
      event({ createdAt: '2026-10-25T12:00:00.000Z' }),
    ],
    '24h',
    now,
  );
  assert.equal(buckets.length, 24);
  assert.equal(
    buckets.reduce((sum, bucket) => sum + bucket.success + bucket.failure, 0),
    1,
  );
  assert.equal(buckets.at(-1)?.success, 1);
});

test('analytics range accepts only the supported date filters', () => {
  assert.equal(toAnalyticsRange('24h'), '24h');
  assert.equal(toAnalyticsRange('30d'), '30d');
  assert.equal(toAnalyticsRange('custom'), '7d');
  assert.equal(toAnalyticsRange(null), '7d');
});
