import { test, expect } from '@playwright/test';
const baseURL = process.env.TEST_DB_APP_URL || 'http://localhost:3001';
const password = process.env.TEST_APP_PASSWORD;
test.use({ baseURL });
test.skip(
  !process.env.TEST_DB_APP_URL || !password,
  'Requires a separate PostgreSQL test app and workspace password.',
);

test('chats, workflows and theme survive in a completely new browser session', async ({
  page,
  context,
  browser,
}) => {
  const login = await context.request.post('/api/auth/login', {
    headers: { origin: baseURL },
    data: { password },
  });
  expect(login.ok()).toBeTruthy();
  await page.route('**/api/chat', (route) =>
    route.fulfill({ json: { content: 'This reply should be saved in PostgreSQL.' } }),
  );
  await page.goto('/');
  const question = `Persistent chat ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Message your agent' }).fill(question);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByText('This reply should be saved in PostgreSQL.', { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const data = await (await context.request.get('/api/workspace')).json();
      return data.data?.conversations.some((c: { messages: { content: string }[] }) =>
        c.messages.some((m) => m.content === question),
      );
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Blue & white', exact: true }).click();
  await expect
    .poll(async () => (await (await context.request.get('/api/workspace')).json()).data.theme)
    .toBe('blue');
  await page.getByRole('button', { name: 'Workflows', exact: true }).click();
  await page.getByRole('button', { name: 'New workflow', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Database shortcut');
  await page.getByLabel('Instructions').fill('Help me review my saved work.');
  await page.getByRole('button', { name: 'Create workflow', exact: true }).click();
  await expect
    .poll(async () =>
      (await (await context.request.get('/api/workspace')).json()).data.workflows.some(
        (w: { title: string }) => w.title === 'Database shortcut',
      ),
    )
    .toBe(true);
  const fresh = await browser.newContext({ baseURL });
  try {
    await fresh.request.post('/api/auth/login', {
      headers: { origin: baseURL },
      data: { password },
    });
    const newPage = await fresh.newPage();
    await newPage.goto('/');
    await expect(newPage.locator('html')).toHaveAttribute('data-theme', 'blue');
    await newPage.getByRole('button', { name: question, exact: true }).click();
    await expect(
      newPage.getByText('This reply should be saved in PostgreSQL.', { exact: true }),
    ).toBeVisible();
    await newPage.getByRole('button', { name: 'Workflows', exact: true }).click();
    await expect(
      newPage.getByRole('heading', { name: 'Database shortcut', exact: true }),
    ).toBeVisible();
  } finally {
    await fresh.close();
  }
});

test('model and Google secrets save through the forms and are not returned to another browser', async ({
  page,
  context,
  browser,
}) => {
  await context.request.post('/api/auth/login', {
    headers: { origin: baseURL },
    data: { password },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Other API OpenAI-compatible endpoint' }).click();
  await page.getByLabel('Model name').fill('local-test-model');
  await page.getByLabel('API endpoint').fill('http://localhost:4010/v1');
  await page.getByLabel('API key', { exact: false }).fill('ui-test-key-not-real');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'API connection encrypted and saved to PostgreSQL.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Google APIs', exact: true }).click();
  await page.getByLabel('Client ID', { exact: true }).fill('ui-test.apps.googleusercontent.com');
  await page.getByLabel('Client secret', { exact: false }).fill('ui-test-google-secret');
  await page.getByRole('button', { name: 'Save Google credentials', exact: true }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Google OAuth credentials encrypted and saved to PostgreSQL.' }),
  ).toBeVisible();
  const fresh = await browser.newContext({ baseURL });
  try {
    await fresh.request.post('/api/auth/login', {
      headers: { origin: baseURL },
      data: { password },
    });
    const model = await (await fresh.request.get('/api/config')).json();
    expect(model.model).toBe('local-test-model');
    expect(model.keySaved).toBe(true);
    expect(model.key).toBeUndefined();
    const google = await (await fresh.request.get('/api/google/config')).json();
    expect(google.clientId).toBe('ui-test.apps.googleusercontent.com');
    expect(google.secretSaved).toBe(true);
    expect(google.clientSecret).toBeUndefined();
  } finally {
    await fresh.close();
  }
});
