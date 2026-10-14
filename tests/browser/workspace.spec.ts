import { test, expect } from '@playwright/test';

test('welcome, workflow creation, persistence and search', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Big ideas. Less busywork.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore workflows' }).click();
  await page.getByRole('button', { name: 'New workflow', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Friday review');
  await page.getByLabel('Description').fill('Reflect on the week');
  await page
    .getByLabel('Instructions')
    .fill('Ask me about my highlights and help me plan next week.');
  await page.getByRole('button', { name: 'Create workflow' }).click();
  await expect(page.getByRole('heading', { name: 'Friday review' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Search workspace' }).click();
  await page.getByPlaceholder('Search your workspace…').fill('Friday');
  await page.getByRole('button', { name: 'Friday review' }).click();
  await expect(page.getByRole('textbox', { name: 'Message your agent' })).toHaveValue(
    'Ask me about my highlights and help me plan next week.',
  );
});

test('unconfigured AI gives an honest error and keeps the message', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Message your agent' }).fill('Hello Relay');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByText('Connect an AI model in Settings to start chatting.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Hello Relay', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Connect your AI model' }).click();
  await expect(page.getByRole('heading', { name: 'A brain for your agent' })).toBeVisible();
});

test('text upload extracts content and records an activity', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'customers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name,Amount\nAlice,42'),
  });
  await expect(page.getByText('customers.csv', { exact: false })).toBeVisible();
  await expect(page.getByText('20 characters ready')).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Document ready' })).toBeVisible();
  await expect(page.getByText('customers.csv', { exact: true })).toBeVisible();
});

test('action review requires click and prevents repeat approval in UI (mocked API)', async ({
  page,
}) => {
  let executed = 0;
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      json: {
        content: 'Please review your email.',
        proposals: [
          {
            id: 'test-proposal',
            name: 'send_email',
            args: {
              to: 'alice@example.com',
              subject: 'Project update',
              body: 'The draft is ready for review.',
            },
            token: 'test-only',
          },
        ],
      },
    }),
  );
  await page.route('**/api/actions', (route) => {
    executed++;
    return route.fulfill({ json: { message: 'Email sent to alice@example.com.' } });
  });
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Message your agent' })
    .fill('Prepare a project update for Alice.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Approval needed', { exact: true })).toBeVisible();
  expect(executed).toBe(0);
  await expect(
    page.locator('.email-preview').getByText('alice@example.com', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Approve & send' }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  expect(executed).toBe(1);
  await expect(page.getByRole('button', { name: 'Approve & send' })).toHaveCount(0);
});

test('cancelling an approval never calls the action endpoint (mocked model)', async ({ page }) => {
  let executed = 0;
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      json: {
        content: 'Review these rows.',
        proposals: [
          {
            id: 'sheet-proposal',
            name: 'append_to_sheet',
            args: {
              spreadsheetId: 'test-spreadsheet-id-123',
              range: 'Sheet1!A:B',
              values: [['Alice', 42]],
            },
            token: 'test-only',
          },
        ],
      },
    }),
  );
  await page.route('**/api/actions', (route) => {
    executed++;
    return route.fulfill({ json: { message: 'Unexpected execution' } });
  });
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Message your agent' })
    .fill('Prepare a spreadsheet row.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  expect(executed).toBe(0);
});

test('mobile navigation and content do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Big ideas. Less busywork.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A more connected workspace' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('API rejects cross-origin mutations and invalid approvals', async ({ request }) => {
  const badOrigin = await request.post('/api/chat', {
    headers: { origin: 'https://attacker.invalid' },
    data: { messages: [{ role: 'user', content: 'hello' }] },
  });
  expect(badOrigin.status()).toBe(400);
  expect((await badOrigin.json()).error).toContain('origin');
  const badAction = await request.post('/api/actions', {
    headers: { origin: 'http://localhost:3000' },
    data: { token: 'tampered' },
  });
  expect(badAction.status()).toBe(400);
  expect((await badAction.json()).error).toContain('expired');
});

test('extracts a real PDF without storing the original file', async ({ page, context }) => {
  const document = await context.newPage();
  await document.setContent(
    '<h1>Invoice INV-042</h1><p>Customer: Alice Smith</p><p>Total: 125 USD</p>',
  );
  const pdf = await document.pdf();
  await document.close();
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByText('invoice.pdf', { exact: false })).toBeVisible();
  await expect(page.getByText(/characters ready/)).toBeVisible();
  let extracted = '';
  await page.route('**/api/chat', async (route) => {
    extracted = route.request().postDataJSON().messages[0].content;
    await route.fulfill({ json: { content: 'This invoice totals 125 USD.' } });
  });
  await page.getByRole('textbox', { name: 'Message your agent' }).fill('Summarize this invoice');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('This invoice totals 125 USD.', { exact: true })).toBeVisible();
  expect(extracted).toContain('INV-042');
  expect(extracted).toContain('125 USD');
  expect(extracted).toContain('untrusted_document');
});

test('rejects unsupported document types', async ({ request }) => {
  const response = await request.post('/api/upload', {
    headers: { origin: 'http://localhost:3000' },
    multipart: {
      file: {
        name: 'script.exe',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('not a document'),
      },
    },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain('Supported files');
});
