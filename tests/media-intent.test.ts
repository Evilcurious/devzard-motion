import test from 'node:test';
import assert from 'node:assert/strict';
import { isImageGenerationPrompt } from '../lib/media-intent';

test('direct image creation requests route to image generation even from Chat mode', () => {
  assert.equal(isImageGenerationPrompt('create a image of a parrot'), true);
  assert.equal(
    isImageGenerationPrompt('Please draw a watercolor picture of a mountain lake'),
    true,
  );
  assert.equal(isImageGenerationPrompt('Generate an image showing a lunar garden'), true);
});

test('questions, prompt-writing and website/code requests remain in Chat mode', () => {
  assert.equal(isImageGenerationPrompt('How do I create an image?'), false);
  assert.equal(isImageGenerationPrompt('Write a prompt to generate an image of a parrot'), false);
  assert.equal(isImageGenerationPrompt('Create a website with an image gallery'), false);
  assert.equal(isImageGenerationPrompt('Write code to generate a picture'), false);
  assert.equal(isImageGenerationPrompt('What does image generation mean?'), false);
});
