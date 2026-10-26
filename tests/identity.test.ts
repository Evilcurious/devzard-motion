import test from 'node:test';
import assert from 'node:assert/strict';
import { isRelayIdentityQuestion } from '../lib/identity';

test('recognizes direct questions about Relay’s creator or founder', () => {
  for (const question of [
    'Who made you?',
    'Who created Relay?',
    'Who is your founder?',
    'Who founded this agent?',
    'Who developed you?',
  ])
    assert.equal(isRelayIdentityQuestion(question), true, question);
});

test('does not mistake other people or organizations for Relay identity questions', () => {
  for (const question of ['Who founded Google?', 'Who is the creator of this document?', 'Hello'])
    assert.equal(isRelayIdentityQuestion(question), false, question);
});
