import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';

function equal(a, b) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
function reply(response, status, error) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify({ error: { message: error } }));
}

/** A deliberately small, non-streaming, authenticated proxy to ONE local Ollama model. */
export function createGateway({
  token,
  model = 'qwen2.5:7b',
  upstream = 'http://127.0.0.1:11434',
  timeoutMs = 55000,
  requestsPerMinute = 30,
}) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256 || /\s/.test(token))
    throw new Error(
      'Set a random OLLAMA_GATEWAY_TOKEN of 32–256 characters. Run npm run ollama:setup to generate one.',
    );
  const target = new URL(upstream);
  if (
    target.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== '/'
  )
    throw new Error(
      'Ollama upstream must be a plain loopback HTTP origin, e.g. http://127.0.0.1:11434.',
    );
  if (!model || typeof model !== 'string' || model.length > 100)
    throw new Error('Choose one model using OLLAMA_GATEWAY_MODEL.');
  const maxBody = 300_000;
  let active = false;
  let requests = [];
  const server = http.createServer(async (request, response) => {
    request.on('error', () => {});
    const authorization = request.headers.authorization || '';
    if (!equal(authorization, `Bearer ${token}`)) {
      reply(response, 401, 'A valid Bearer API key is required.');
      request.resume();
      return;
    }
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(
        JSON.stringify({
          gateway: 'ready',
          model,
          note: 'This checks authentication, not model availability.',
        }),
      );
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      reply(response, 404, 'This gateway only exposes POST /v1/chat/completions.');
      request.resume();
      return;
    }
    if (
      !request.headers['content-type']?.toLowerCase().startsWith('application/json') ||
      (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity')
    ) {
      reply(response, 415, 'Send uncompressed JSON.');
      request.resume();
      return;
    }
    requests = requests.filter((time) => time > Date.now() - 60000);
    if (active || requests.length >= requestsPerMinute) {
      response.setHeader('Retry-After', active ? '2' : '60');
      reply(
        response,
        429,
        'The local model is busy or the request limit was reached. Try again shortly.',
      );
      request.resume();
      return;
    }
    if (Number(request.headers['content-length']) > maxBody) {
      reply(response, 413, 'Request too large.');
      request.resume();
      return;
    }
    requests.push(Date.now());
    active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onClose = () => {
      if (!response.writableEnded) controller.abort();
    };
    response.on('close', onClose);
    // Stop slow/abandoned uploads too, not just inference requests.
    const onAbort = () => {
      if (!request.complete) request.destroy();
    };
    controller.signal.addEventListener('abort', onAbort, { once: true });
    try {
      let length = 0;
      const chunks = [];
      for await (const chunk of request) {
        length += chunk.length;
        if (length > maxBody) {
          reply(response, 413, 'Request too large.');
          return;
        }
        chunks.push(chunk);
      }
      let input;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        reply(response, 400, 'Invalid JSON.');
        return;
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        reply(response, 400, 'Expected a JSON object.');
        return;
      }
      if (input.model !== model) {
        reply(response, 403, 'Only the configured gateway model is allowed.');
        return;
      }
      if (input.stream === true) {
        reply(response, 400, 'Streaming is disabled. Relay uses complete JSON responses.');
        return;
      }
      if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > 100) {
        reply(response, 400, 'Provide 1–100 chat messages.');
        return;
      }
      if (
        input.max_tokens !== undefined &&
        (!Number.isInteger(input.max_tokens) || input.max_tokens < 1)
      ) {
        reply(response, 400, 'max_tokens must be a positive integer.');
        return;
      }
      const payload = {
        model,
        messages: input.messages,
        stream: false,
        max_tokens: Math.min(input.max_tokens || 3000, 3000),
      };
      // Forward only fields Relay uses. Never forward a user's arbitrary Ollama options or URLs.
      for (const field of ['tools', 'tool_choice', 'temperature'])
        if (input[field] !== undefined) payload[field] = input[field];
      const result = await fetch(`${target.origin}/v1/chat/completions`, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!result.ok) {
        await result.body?.cancel();
        reply(
          response,
          502,
          `Ollama returned ${result.status}. Check that the configured model is downloaded and running.`,
        );
        return;
      }
      const reader = result.body?.getReader();
      if (!reader) {
        reply(response, 502, 'Ollama returned no response.');
        return;
      }
      const output = [];
      let outputSize = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        outputSize += value.byteLength;
        if (outputSize > 2_000_000) {
          await reader.cancel();
          reply(response, 502, 'Model response exceeded the gateway limit.');
          return;
        }
        output.push(Buffer.from(value));
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(output).toString('utf8'));
      } catch {
        reply(response, 502, 'Ollama returned invalid JSON.');
        return;
      }
      if (!body.choices?.[0]?.message) {
        reply(response, 502, 'Ollama did not return a compatible chat response.');
        return;
      }
      if (!response.destroyed) {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(JSON.stringify(body));
      }
    } catch {
      if (!response.destroyed && !response.writableEnded)
        reply(
          response,
          controller.signal.aborted ? 504 : 502,
          controller.signal.aborted
            ? 'Local inference timed out. Try a smaller model or shorter request.'
            : 'Cannot reach local Ollama. Start Ollama and check the configured model.',
        );
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', onAbort);
      response.off('close', onClose);
      active = false;
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 30;
  return server;
}
