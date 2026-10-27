import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { parseSignedFreeLlmCatalog } from '../lib/freellmapi-catalog';

const model = {
  platform: 'groq',
  modelId: 'llama-3.3-70b-versatile',
  displayName: 'Llama 3.3 70B',
  intelligenceRank: 20,
  speedRank: 2,
  sizeLabel: 'Large',
  limits: { rpm: 30, rpd: null, tpm: 6000, tpd: 100000 },
  monthlyTokenBudget: '1M tokens/month',
  contextWindow: 128000,
  enabled: true,
  supportsVision: false,
  supportsTools: true,
};

function signedCatalog(payload: unknown) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const bytes = Buffer.from(JSON.stringify(payload));
  const signature = sign(null, bytes, privateKey).toString('base64');
  return {
    bytes,
    signature,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

test('signed FreeLLMAPI catalog loads monthly budgets and chat model metadata', () => {
  const signed = signedCatalog({
    version: '2026.10.28',
    generatedAt: '2026-10-28T00:00:00.000Z',
    tier: 'monthly',
    models: [model],
  });
  const parsed = parseSignedFreeLlmCatalog(signed.bytes, signed.signature, signed.publicKey);
  assert.equal(parsed.models.length, 1);
  assert.equal(parsed.models[0].platform, 'groq');
  assert.equal(parsed.models[0].monthlyTokenBudget, '1M tokens/month');
  assert.equal(parsed.models[0].contextWindow, 128000);
  assert.equal(parsed.models[0].supportsTools, true);
});

test('signed catalog rejects an altered payload and malformed model metadata', () => {
  const signed = signedCatalog({
    version: '2026.10.28',
    generatedAt: '2026-10-28T00:00:00.000Z',
    tier: 'monthly',
    models: [model],
  });
  assert.throws(
    () =>
      parseSignedFreeLlmCatalog(
        Buffer.from(signed.bytes).fill(0),
        signed.signature,
        signed.publicKey,
      ),
    /signature verification failed/i,
  );

  const malformed = signedCatalog({
    version: '2026.10.28',
    generatedAt: '2026-10-28T00:00:00.000Z',
    tier: 'monthly',
    models: [{ ...model, limits: { ...model.limits, rpm: -3 } }],
  });
  assert.throws(
    () => parseSignedFreeLlmCatalog(malformed.bytes, malformed.signature, malformed.publicKey),
    /invalid model entry/i,
  );
});

test('signed catalog excludes media-only rows from chat model metadata', () => {
  const signed = signedCatalog({
    version: '2026.10.28',
    generatedAt: '2026-10-28T00:00:00.000Z',
    tier: 'monthly',
    models: [
      model,
      { ...model, modelId: 'image-model', modality: 'image' },
      { ...model, modelId: 'audio-model', modality: 'audio' },
    ],
  });
  const parsed = parseSignedFreeLlmCatalog(signed.bytes, signed.signature, signed.publicKey);
  assert.deepEqual(
    parsed.models.map((entry) => entry.modelId),
    [model.modelId],
  );
});
