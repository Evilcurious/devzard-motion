import { test, expect } from '@playwright/test';
import { OPENROUTER_BASE_URL, OPENROUTER_FREE_MODEL } from '../../lib/ai-presets';

test('OpenRouter preset fills the unified endpoint and saves the private API key', async ({
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
  await page.route('**/api/config', async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Use OpenRouter settings', exact: true }).click();
  await expect(page.getByLabel('Model name')).toHaveValue(OPENROUTER_FREE_MODEL);
  await expect(page.getByLabel('API endpoint')).toHaveValue(OPENROUTER_BASE_URL);
  await expect(page.getByText(/no AI_ALLOWED_ORIGINS entry is needed/i)).toBeVisible();
  await page.getByRole('textbox', { name: /^API key/ }).fill('test-only-openrouter-key');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'API connection saved' })).toBeVisible();
  expect(saved).toEqual({
    provider: 'compatible',
    model: OPENROUTER_FREE_MODEL,
    baseURL: OPENROUTER_BASE_URL,
    key: 'test-only-openrouter-key',
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'test-only-openrouter-key',
  );
});
