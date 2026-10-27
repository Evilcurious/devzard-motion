import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBranding, normalizeBranding } from '../lib/branding';

test('workspace branding defaults to green and validates uploaded logo data URLs', () => {
  assert.equal(defaultBranding.theme, 'green');
  assert.equal(defaultBranding.logoDataUrl, null);
  const image = `data:image/png;base64,${Buffer.from('logo').toString('base64')}`;
  assert.deepEqual(normalizeBranding({ theme: 'black', logoDataUrl: image }).logoDataUrl, image);
  assert.equal(
    normalizeBranding({ theme: 'missing', logoDataUrl: 'javascript:alert(1)' }).theme,
    'green',
  );
  assert.equal(
    normalizeBranding({ theme: 'black', logoDataUrl: 'data:image/svg+xml;base64,AAAA' })
      .logoDataUrl,
    null,
  );
});
