import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFileBundleRequest,
  needsDynamicModelRouting,
  shouldLoadRepositoryContext,
} from '../lib/chat-performance';

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
