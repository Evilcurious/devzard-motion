import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptTargetsSequentially,
  fallbackAttemptTimeout,
  isFileBundleRequest,
  needsDynamicModelRouting,
  shouldLoadRepositoryContext,
  shouldPersistAutoSelectedTarget,
  shouldRouteTurnThroughCandidates,
} from '../lib/chat-performance';

test('a timed-out primary advances through configured fallback candidates in order', async () => {
  const attempted: string[] = [];
  const result = await attemptTargetsSequentially(
    ['primary', 'backup-one', 'backup-two'],
    async (target) => {
      attempted.push(target);
      if (target === 'primary') {
        const timeout = new Error('provider timeout');
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      return `response from ${target}`;
    },
  );

  assert.deepEqual(attempted, ['primary', 'backup-one']);
  assert.deepEqual(result, {
    ok: true,
    target: 'backup-one',
    value: 'response from backup-one',
    index: 1,
    attemptsMade: 2,
  });
});

test('fallback candidates are available for every follow-up after a tool round trip', () => {
  assert.equal(shouldRouteTurnThroughCandidates(0, 'fallback', false), true);
  assert.equal(shouldRouteTurnThroughCandidates(1, 'fallback', false), true);
  assert.equal(shouldRouteTurnThroughCandidates(3, 'fallback', false), true);
  assert.equal(shouldRouteTurnThroughCandidates(1, 'auto', false), false);
  assert.equal(shouldRouteTurnThroughCandidates(0, 'auto', true), true);
  assert.equal(shouldRouteTurnThroughCandidates(0, 'fusion', false), false);
});

test('fallback success never rewrites the saved chain as a one-model auto selection', () => {
  assert.equal(shouldPersistAutoSelectedTarget('fallback', true, 1, true), false);
  assert.equal(shouldPersistAutoSelectedTarget('auto', true, 1, true), true);
  assert.equal(shouldPersistAutoSelectedTarget('auto', true, 0, false), true);
  assert.equal(shouldPersistAutoSelectedTarget('auto', false, 1, true), false);
});

test('fallback attempts share remaining time so one timeout cannot consume the entire chain', () => {
  assert.equal(fallbackAttemptTimeout(52000, 4, 20000), 13000);
  assert.equal(fallbackAttemptTimeout(22000, 2, 20000), 11000);
  assert.equal(fallbackAttemptTimeout(5000, 3, 20000), 2000);
  assert.equal(fallbackAttemptTimeout(500, 2, 20000), 500);
  assert.equal(fallbackAttemptTimeout(5000, 0, 20000), 0);
});

test('manual model selection skips automatic provider discovery', () => {
  assert.equal(needsDynamicModelRouting({ strategy: 'auto', autoPick: false }), false);
  assert.equal(needsDynamicModelRouting({ strategy: 'fallback', autoPick: false }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'fusion', autoPick: false }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'auto-fusion', autoPick: false }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'auto', autoPick: true }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'auto' }), true);
});

test('explicit ZIP and website creation requests are routed through the file bundle tool', () => {
  assert.equal(
    isFileBundleRequest([{ role: 'user', content: 'Create a ZIP file of a todo app.' }]),
    true,
  );
  assert.equal(
    isFileBundleRequest([{ role: 'user', content: 'Build me a website for my bakery.' }]),
    true,
  );
  assert.equal(
    isFileBundleRequest([{ role: 'user', content: 'I need a ZIP file of my project.' }]),
    true,
  );
  assert.equal(isFileBundleRequest([{ role: 'user', content: 'Create a small todo app.' }]), true);
  assert.equal(
    isFileBundleRequest([{ role: 'user', content: 'Explain how ZIP compression works.' }]),
    false,
  );
  assert.equal(
    isFileBundleRequest([{ role: 'user', content: 'My agent is not making ZIP files.' }]),
    false,
  );
});

test('repository context is only requested for recent repository-oriented chats', () => {
  assert.equal(
    shouldLoadRepositoryContext([
      {
        role: 'user',
        content: 'Please inspect the selected playground repo and explain its API routes.',
      },
    ]),
    true,
  );
  assert.equal(
    shouldLoadRepositoryContext([
      { role: 'user', content: 'What is a good way to organize my day?' },
      { role: 'assistant', content: 'Try three priorities.' },
      { role: 'user', content: 'Can you make that more concise?' },
    ]),
    false,
  );
  assert.equal(
    shouldLoadRepositoryContext([
      { role: 'user', content: 'Look at the failing tests.' },
      { role: 'assistant', content: 'I found a likely cause.' },
      { role: 'user', content: 'Now fix it.' },
    ]),
    true,
  );
});
