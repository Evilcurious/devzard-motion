import { test, expect } from '@playwright/test';

test('database setup recommends Neon without claiming a connection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Database', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Neon Postgres', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Neon Console' })).toHaveAttribute(
    'href',
    'https://console.neon.tech',
  );
  await expect(page.getByText('Not configured', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check database connection' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'DATABASE_URL' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('Neon status shows provider, pooling and TLS without exposing credentials (mocked metadata)', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        passwordProtected: true,
        secureSettings: true,
        databaseConfigured: true,
        databaseReady: true,
        databaseProvider: 'neon',
        databasePooled: true,
        databaseTLS: true,
        deployment: 'self-hosted',
      },
    }),
  );
  await page.route('**/api/workspace', (route) =>
    route.fulfill({
      json: {
        storage: 'postgresql',
        revision: 1,
        data: { conversations: [], activities: [], workflows: [], theme: 'green' },
      },
    }),
  );
  await page.route('**/api/database', (route) =>
    route.fulfill({
      json: { configured: true, ready: true, provider: 'neon', pooled: true, tls: true },
    }),
  );
  await page.goto('/');
  await expect(page.getByText('Saved to Neon Postgres', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Database', exact: true }).click();
  await expect(page.locator('.database-facts')).toContainText('Neon Postgres');
  await expect(page.locator('.database-facts')).toContainText('Pooled');
  await expect(page.locator('.database-facts')).toContainText('Verified TLS required');
  await page.getByRole('button', { name: 'Check database connection' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Neon Postgres is connected and all tables are ready.' }),
  ).toBeVisible();
});
