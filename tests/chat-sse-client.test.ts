import assert from 'node:assert/strict';
import test from 'node:test';
import { readChatEventStream } from '../lib/chat-sse-client';

function responseFrom(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

test('reads deltas, resets and final JSON across chunks', async () => {
  const text: string[] = [];
  let resets = 0;
  const result = await readChatEventStream<{ content: string }>(
    responseFrom([
      'data: {"type":"delta","text":"partial"}\n\n',
      'data: {"type":"reset"}\r\n\r\n',
      'data: {"type":"delta","text":"complete"}\n\n',
      'data: {"type":"final","status":200,"result":{"content":"complete"}}\n\n',
    ]),
    (part) => text.push(part),
    () => resets++,
  );
  assert.deepEqual(text, ['partial', 'complete']);
  assert.equal(resets, 1);
  assert.deepEqual(result, { content: 'complete' });
});

test('routes streamed project chunks to the browser artifact assembler before the final metadata', async () => {
  const received: string[] = [];
  const result = await readChatEventStream<{ artifacts: unknown[] }>(
    responseFrom([
      'data: {"type":"artifact_chunk","artifactId":"a1","name":"demo","path":"src/app.js","chunkIndex":0,"chunkCount":2,"content":"console."}\n\n',
      'data: {"type":"artifact_chunk","artifactId":"a1","name":"demo","path":"src/app.js","chunkIndex":1,"chunkCount":2,"content":"log(1)"}\n\n',
      'data: {"type":"final","status":200,"result":{"artifacts":[{"id":"a1","name":"demo"}]}}\n\n',
    ]),
    () => undefined,
    () => undefined,
    (chunk) => received.push(chunk.content),
  );
  assert.deepEqual(received, ['console.', 'log(1)']);
  assert.deepEqual(result.artifacts, [{ id: 'a1', name: 'demo' }]);
});

test('surfaces final route errors', async () => {
  await assert.rejects(
    readChatEventStream(
      responseFrom(['data: {"type":"final","status":429,"result":{"error":"quota reached"}}\n\n']),
      () => undefined,
      () => undefined,
    ),
    /quota reached/,
  );
});
