import { test, expect } from '@playwright/test';
import { FREELLMAPI_BASE_URL } from '../../lib/ai-presets';

test('local FreeLLMAPI preset accepts a model and key without exposing the key', async ({
  page,
}) => {
  let saved: Record<string, string> | undefined;
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        secureSettings: true,
        databaseConfigured: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
        baseURL: 'https://api.openai.com/v1',
        aiConfigured: false,
        keySaved: false,
      },
    }),
  );
  await page.route('**/api/model/local-models', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ key: 'test-only-local-llmapi-key' });
    await route.fulfill({ json: { models: ['configured-local-model'] } });
  });
  await page.route('**/api/config', async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Use FreeLLMAPI settings', exact: true }).click();
  await expect(page.getByLabel('API endpoint')).toHaveValue(FREELLMAPI_BASE_URL);
  await expect(page.getByLabel('Model name')).toHaveValue('');
  await expect(page.getByText(/will not reach your computer from Vercel/i)).toBeVisible();
  await page.getByRole('textbox', { name: /^API key/ }).fill('test-only-local-llmapi-key');
  await page.getByRole('button', { name: 'Load FreeLLMAPI models', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Models on this server' })
    .selectOption('configured-local-model');
  await expect(page.getByLabel('Model name')).toHaveValue('configured-local-model');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'API connection saved' })).toBeVisible();
  expect(saved).toEqual({
    provider: 'compatible',
    model: 'configured-local-model',
    baseURL: FREELLMAPI_BASE_URL,
    key: 'test-only-local-llmapi-key',
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'test-only-local-llmapi-key',
  );
});
