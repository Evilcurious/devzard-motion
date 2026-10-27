import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTryAnotherImageProvider,
  XKIRO_IMAGE_MODEL_ID,
  xkiroImageGenerationRequest,
} from '../lib/media-generation';

test('image generation sends an explicit image model, separate from chat model selection', () => {
  assert.equal(XKIRO_IMAGE_MODEL_ID, 'sensenova/sensenova-u1.5-lite');
  assert.deepEqual(xkiroImageGenerationRequest('A red fox in a snowy forest'), {
    model: 'sensenova/sensenova-u1.5-lite',
    prompt: 'A red fox in a snowy forest',
    n: 1,
    size: '1024x1024',
  });
});

test('image provider fallback covers unavailable models, quota, and transient service errors', () => {
  for (const message of [
    'xKiro returned HTTP 404.',
    'Image model is not available for this key.',
    'Provider quota exceeded.',
    'Image generation timed out.',
    'Provider returned HTTP 503.',
  ]) {
    assert.equal(canTryAnotherImageProvider(new Error(message)), true, message);
  }
});

test('image provider fallback does not retry safety refusals or unrelated errors', () => {
  assert.equal(canTryAnotherImageProvider(new Error('Prompt blocked by safety policy.')), false);
  assert.equal(canTryAnotherImageProvider(new Error('HTTP 403: prompt blocked by policy.')), false);
  assert.equal(
    canTryAnotherImageProvider(new Error('Image response did not include a URL.')),
    false,
  );
  assert.equal(canTryAnotherImageProvider('HTTP 503'), false);
});
