import test from 'node:test';
import assert from 'node:assert/strict';
import { fitChatMessagesToContext } from '../lib/chat-context';

test('context fitting preserves the system prompt and newest request while dropping old turns', () => {
  const messages = [
    { role: 'system', content: 'Keep system instructions.' },
    { role: 'user', content: 'Old request '.repeat(700) },
    { role: 'assistant', content: 'Old answer '.repeat(700) },
    { role: 'user', content: 'Newest request: please use the current details.' },
  ];
  const fitted = fitChatMessagesToContext(messages, 4096, 1024);
  assert.equal(fitted.messages[0].content, 'Keep system instructions.');
  assert.equal(fitted.messages.at(-1)?.content, messages.at(-1)?.content);
  assert.ok(fitted.omittedMessages >= 1);
  assert.ok(fitted.sentTokens < fitted.originalTokens);
});

test('context fitting leaves messages alone when model context is unknown or already fits', () => {
  const messages = [
    { role: 'system', content: 'Rules.' },
    { role: 'user', content: 'Short question.' },
  ];
  assert.deepEqual(fitChatMessagesToContext(messages, null, 1024).messages, messages);
  assert.deepEqual(fitChatMessagesToContext(messages, 16000, 1024).messages, messages);
});

test('oversized latest user content is shortened without losing its beginning and ending', () => {
  const message = { role: 'user', content: `START ${'x'.repeat(20000)} END` };
  const fitted = fitChatMessagesToContext([message], 2048, 512);
  assert.equal(fitted.messages[0].content?.startsWith('START'), true);
  assert.equal(fitted.messages[0].content?.endsWith('END'), true);
  assert.match(fitted.messages[0].content || '', /shortened to fit/);
  assert.ok(fitted.sentTokens < fitted.originalTokens);
});
