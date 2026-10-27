import test from 'node:test';
import assert from 'node:assert/strict';
import { needsDynamicModelRouting, shouldLoadRepositoryContext } from '../lib/chat-performance';

test('manual model selection skips automatic provider discovery', () => {
  assert.equal(needsDynamicModelRouting({ strategy: 'auto', autoPick: false }), false);
  assert.equal(needsDynamicModelRouting({ strategy: 'fallback', autoPick: false }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'fusion', autoPick: false }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'auto-fusion', autoPick: false }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'auto', autoPick: true }), true);
  assert.equal(needsDynamicModelRouting({ strategy: 'auto' }), true);
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
