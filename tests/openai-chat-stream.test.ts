import assert from 'node:assert/strict';
import test from 'node:test';
import { readOpenAIChatStream } from '../lib/openai-chat-stream';

function streamFrom(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test('reads streamed content across arbitrary chunk boundaries and captures usage', async () => {
  const pieces: string[] = [];
  const result = await readOpenAIChatStream(
    streamFrom([
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ]),
    (text) => pieces.push(text),
  );
  assert.equal(result.message.content, 'Hello world');
  assert.deepEqual(pieces, ['Hello', ' world']);
  assert.deepEqual(result.usage, { prompt_tokens: 4, completion_tokens: 2 });
});

test('assembles streamed tool-call fragments by index', async () => {
  const result = await readOpenAIChatStream(
    streamFrom([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"create_","arguments":"{\\"name\\":"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"file_bundle","arguments":"\\"demo\\"}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ]),
  );
  assert.equal(result.message.tool_calls?.[0].id, 'call_1');
  assert.equal(result.message.tool_calls?.[0].function.name, 'create_file_bundle');
  assert.equal(result.message.tool_calls?.[0].function.arguments, '{"name":"demo"}');
  assert.equal(result.message.content, null);
});

test('rejects streams with no content or tool call', async () => {
  await assert.rejects(
    readOpenAIChatStream(streamFrom(['data: {"choices":[{"delta":{}}]}\n\n', 'data: [DONE]\n\n'])),
    /empty response/i,
  );
});
