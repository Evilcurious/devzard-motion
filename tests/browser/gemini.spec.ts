import { test, expect } from '@playwright/test';
import { GEMINI_BASE_URL, GEMINI_MODEL_EXAMPLE } from '../../lib/ai-presets';

test('Gemini preset fills the compatible endpoint and submits the key only to the server (mocked save)', async ({
  page,
}) => {
  let saved: Record<string, string> | undefined;
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        secureSettings: true,
        databaseConfigured: false,
        provider: saved?.provider || 'openai',
        model: saved?.model || 'gpt-4o-mini',
        baseURL: saved?.baseURL || 'https://api.openai.com/v1',
        aiConfigured: !!saved,
        keySaved: !!saved,
      },
    }),
  );
  await page.route('**/api/config', async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, storage: 'cookie' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Use Gemini settings', exact: true }).click();
  await expect(page.getByLabel('API endpoint')).toHaveValue(GEMINI_BASE_URL);
  await expect(page.getByLabel('Model name')).toHaveValue(GEMINI_MODEL_EXAMPLE);
  await page.getByRole('textbox', { name: /^API key/ }).fill('test-only-gemini-key');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'API connection saved' })).toBeVisible();
  expect(saved).toEqual({
    provider: 'compatible',
    model: GEMINI_MODEL_EXAMPLE,
    baseURL: GEMINI_BASE_URL,
    key: 'test-only-gemini-key',
  });
  await expect(page.getByRole('textbox', { name: /^API key/ })).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('relay.workspace.v1'))).not.toContain(
    'test-only-gemini-key',
  );
});

test('Gemini official URL reaches credential setup instead of the origin allowlist error', async ({
  request,
}) => {
  const result = await request.post('/api/config', {
    headers: { origin: process.env.TEST_BASE_URL || 'http://localhost:3000' },
    data: {
      provider: 'compatible',
      model: GEMINI_MODEL_EXAMPLE,
      baseURL: GEMINI_BASE_URL,
      key: 'test-only-gemini-key',
    },
  });
  // The default browser-test server has no SESSION_SECRET: the remaining requirement is secure storage.
  expect(result.status()).toBe(400);
  const data = await result.json();
  expect(data.error).toContain('npm run setup');
  expect(data.error).not.toContain('origin is not allowed');
});
