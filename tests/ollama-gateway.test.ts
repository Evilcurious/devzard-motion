import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createGateway } from '../scripts/ollama/gateway.mjs';

const token = 'test-only-gateway-key-with-at-least-32-characters';
async function listen(server: http.Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
async function close(server: http.Server) {
  const stopped = new Promise<void>((resolve) => server.close(() => resolve()));
  server.closeAllConnections();
  await stopped;
}
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const body = { model: 'test-model', messages: [{ role: 'user', content: 'hello' }], stream: false };

test('gateway requires authentication, restricts routes/model, and strips the key and unsupported options', async () => {
  const requests: { path: string; authorization?: string; payload: Record<string, unknown> }[] = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      path: req.url!,
      authorization: req.headers.authorization,
      payload: JSON.parse(Buffer.concat(chunks).toString()),
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'From local model' } }],
      }),
    );
  });
  const upstreamURL = await listen(upstream);
  const gateway = createGateway({ token, model: 'test-model', upstream: upstreamURL });
  const url = await listen(gateway);
  try {
    assert.equal((await fetch(url + '/health')).status, 401);
    assert.equal(
      (await fetch(url + '/health', { headers: { Authorization: 'Bearer incorrect' } })).status,
      401,
    );
    const health = await fetch(url + '/health', { headers });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).gateway, 'ready');
    for (const path of [
      '/api/pull',
      '/api/delete',
      '/api/create',
      '/api/chat',
      '/v1/chat/completions?bypass=1',
    ])
      assert.equal((await fetch(url + path, { method: 'POST', headers, body: '{}' })).status, 404);
    assert.equal(requests.length, 0);
    const post = (data: unknown) =>
      fetch(url + '/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(data) });
    assert.equal((await post({ ...body, model: 'other-model' })).status, 403);
    assert.equal((await post({ ...body, stream: true })).status, 400);
    assert.equal((await post({ ...body, messages: [] })).status, 400);
    assert.equal((await post({ ...body, max_tokens: -1 })).status, 400);
    assert.equal((await post(null)).status, 400);
    assert.equal(
      (await fetch(url + '/v1/chat/completions', { method: 'POST', headers, body: '{invalid' }))
        .status,
      400,
    );
    assert.equal(
      (await post({ ...body, messages: [{ role: 'user', content: 'a'.repeat(300_001) }] })).status,
      413,
    );
    const response = await post({
      ...body,
      max_tokens: 100000,
      temperature: 0.4,
      tools: [],
      tool_choice: 'auto',
      options: { dangerous: true },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).choices[0].message.content, 'From local model');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].path, '/v1/chat/completions');
    assert.equal(requests[0].authorization, undefined);
    assert.equal(requests[0].payload.options, undefined);
    assert.equal(requests[0].payload.max_tokens, 3000);
    assert.deepEqual(requests[0].payload.tools, []);
    assert.equal(requests[0].payload.tool_choice, 'auto');
  } finally {
    await close(gateway);
    await close(upstream);
  }
});

test('gateway rejects weak tokens and non-loopback upstreams', () => {
  assert.throws(() => createGateway({ token: 'short' }));
  assert.throws(() => createGateway({ token, upstream: 'http://external.example' }));
  assert.throws(() => createGateway({ token, upstream: 'http://127.0.0.1:11434/path' }));
  assert.throws(() => createGateway({ token, upstream: 'http://user:pass@localhost:11434' }));
});

test('gateway bounds concurrent inference and enforces a request budget', async () => {
  let release: (() => void) | undefined;
  let reached: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const upstream = http.createServer(async (req, res) => {
    req.resume();
    reached!();
    await waiting;
    res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
  });
  const origin = await listen(upstream);
  const gateway = createGateway({
    token,
    model: 'test-model',
    upstream: origin,
    requestsPerMinute: 1,
  });
  const url = await listen(gateway);
  try {
    const first = fetch(url + '/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    await started;
    const concurrent = await fetch(url + '/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(concurrent.status, 429);
    assert.equal(concurrent.headers.get('retry-after'), '2');
    release!();
    assert.equal((await first).status, 200);
    assert.equal(
      (
        await fetch(url + '/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      ).status,
      429,
    );
  } finally {
    release!();
    await close(gateway);
    await close(upstream);
  }
});

test('gateway times out inference and does not follow upstream redirects', async () => {
  const upstream = http.createServer((req, res) => {
    req.resume();
    if (req.headers['content-type'] === 'application/json') {
      /* deliberately wait for cancellation */
    } else res.end();
  });
  const origin = await listen(upstream);
  const gateway = createGateway({ token, model: 'test-model', upstream: origin, timeoutMs: 60 });
  const url = await listen(gateway);
  try {
    assert.equal(
      (
        await fetch(url + '/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      ).status,
      504,
    );
  } finally {
    await close(gateway);
    await close(upstream);
  }
  const redirectServer = http.createServer((req, res) => {
    req.resume();
    res.writeHead(302, { Location: 'http://169.254.169.254/' });
    res.end();
  });
  const redirectOrigin = await listen(redirectServer);
  const gateway2 = createGateway({ token, model: 'test-model', upstream: redirectOrigin });
  const url2 = await listen(gateway2);
  try {
    assert.equal(
      (
        await fetch(url2 + '/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      ).status,
      502,
    );
  } finally {
    await close(gateway2);
    await close(redirectServer);
  }
});
