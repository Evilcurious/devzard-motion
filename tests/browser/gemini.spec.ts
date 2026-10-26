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
  await expect(page.getByLabel('Model name')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Save connection', exact: true })).toBeDisabled();
  await page.getByLabel('Model name').fill(GEMINI_MODEL_EXAMPLE);
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

test('Gemini catalog selection updates the model and requires explicit save and test (mocked provider)', async ({
  page,
}) => {
  let saved: Record<string, string> | undefined;
  let tested = false;
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
  await page.route('**/api/model/models', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ key: 'test-only-catalog-key' });
    await route.fulfill({ json: { models: ['gemini-test-flash', 'gemini-test-pro'] } });
  });
  await page.route('**/api/config', async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/model/test', async (route) => {
    tested = true;
    expect(saved?.model).toBe('gemini-test-flash');
    await route.fulfill({ json: { message: 'Connected to gemini-test-flash.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Use Gemini settings', exact: true }).click();
  await page.getByRole('textbox', { name: /^API key/ }).fill('test-only-catalog-key');
  await page.getByRole('button', { name: 'Load Gemini models', exact: true }).click();
  await page
    .getByRole('combobox', { name: /^Gemini generation models/ })
    .selectOption('gemini-test-flash');
  await expect(page.getByLabel('Model name')).toHaveValue('gemini-test-flash');
  expect(saved).toBeUndefined();
  expect(tested).toBe(false);
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'API connection saved' })).toBeVisible();
  expect(saved).toEqual({
    provider: 'compatible',
    baseURL: GEMINI_BASE_URL,
    model: 'gemini-test-flash',
    key: 'test-only-catalog-key',
  });
  await page.getByRole('button', { name: 'Test saved connection', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Connected to gemini-test-flash.' }),
  ).toBeVisible();
  expect(tested).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'test-only-catalog-key',
  );
});

test('Gemini catalog can use a saved key without returning it and displays failures (mocked provider)', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        secureSettings: true,
        databaseConfigured: false,
        provider: 'compatible',
        baseURL: GEMINI_BASE_URL,
        model: 'gemini-old',
        aiConfigured: true,
        keySaved: true,
      },
    }),
  );
  await page.route('**/api/model/models', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ key: '' });
    await route.fulfill({
      status: 400,
      json: { error: 'The AI provider rate limit or quota was exceeded (429).' },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Load Gemini models', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'quota was exceeded (429)' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^API key/ })).toHaveValue('');
  await expect(page.getByLabel('Model name')).toHaveValue('gemini-old');
  await expect(page.getByRole('button', { name: 'Load Gemini models', exact: true })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: /^Gemini generation models/ })).toHaveCount(0);
});

test('catalog endpoint rejects a missing key and cross-origin requests before contacting Google', async ({
  request,
}) => {
  const missingKey = await request.post('/api/model/models', {
    headers: { origin: process.env.TEST_BASE_URL || 'http://localhost:3000' },
    data: { key: '' },
  });
  expect(missingKey.status()).toBe(400);
  expect((await missingKey.json()).error).toContain('Enter a Gemini API key');
  const crossOrigin = await request.post('/api/model/models', {
    headers: { origin: 'https://attacker.invalid' },
    data: { key: 'test-only-key' },
  });
  expect(crossOrigin.status()).toBe(400);
  expect((await crossOrigin.json()).error).toContain('Invalid request origin');
});
