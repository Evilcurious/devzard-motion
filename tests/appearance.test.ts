import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, fontOptions, defaultAppearance } from '../lib/appearance';
import { workspaceSchema } from '../lib/workspace-data';

test('appearance preferences accept safe colors, eight preset fonts and a bounded uploaded font', () => {
  assert.equal(fontOptions.length, 8);
  const preferences = {
    accentColor: '#AABBCC',
    fontId: 'georgia',
    customFont: { name: 'My Font', format: 'woff2', data: 'd09GMg==' },
  };
  assert.deepEqual(normalizeAppearance(preferences), preferences);
  assert.deepEqual(
    normalizeAppearance({ accentColor: 'red', fontId: 'arbitrary', customFont: null }),
    {
      ...defaultAppearance,
    },
  );
});

test('workspace accepts appearance upgrades for existing workspaces and rejects unsafe font payloads', () => {
  const base = {
    conversations: [],
    activities: [],
    workflows: [],
    theme: 'green',
  };
  assert.deepEqual(workspaceSchema.parse(base).appearance, defaultAppearance);
  assert.throws(() =>
    workspaceSchema.parse({
      ...base,
      appearance: {
        accentColor: '#315944',
        fontId: 'georgia',
        customFont: { name: 'bad', format: 'woff2', data: '<script>' },
      },
    }),
  );
});
