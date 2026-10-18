import { test, expect } from '@playwright/test';

test('all six themes change the app and persist after reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const colors = new Set<string>();
  for (const [id, label] of [
    ['green', 'Green & white'],
    ['black', 'Black & white'],
    ['red', 'Red & white'],
    ['blue', 'Blue & white'],
    ['yellow', 'Yellow & white'],
    ['gold', 'Gold & white'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    colors.add(
      await page
        .locator('.new-chat')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    );
  }
  expect(colors.size).toBe(6);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gold');
});

test('Google and database settings expose setup without claiming a connection', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Google APIs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gmail & Google Sheets APIs' })).toBeVisible();
  await expect(page.getByLabel('Client ID', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Connect Google account', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Database', exact: true }).click();
  await page.getByRole('button', { name: 'Check database connection' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'DATABASE_URL' })).toContainText(
    'DATABASE_URL',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('custom accent, eight font choices and uploaded font preferences persist in this workspace', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const font = page.getByLabel('Workspace font');
  await expect(font.locator('option')).toHaveCount(8);
  await font.selectOption('georgia');
  await page.getByLabel('Choose accent color').fill('#aabbcc');
  await expect(page.locator('html')).toHaveAttribute('style', /--user-accent: #aabbcc/i);
  await expect(page.locator('html')).toHaveAttribute('style', /--font: Georgia, serif/i);

  await page.getByLabel('Upload a custom font').setInputFiles({
    name: 'My Legacy Font.ttf',
    mimeType: 'font/ttf',
    buffer: Buffer.from([0, 1, 0, 0, 0, 0, 0, 0]),
  });
  await expect(font).toHaveValue('custom');
  await expect(font.getByRole('option', { name: 'My Legacy Font (uploaded)' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove uploaded font' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(page.getByLabel('Choose accent color')).toHaveValue('#aabbcc');
  await expect(page.getByLabel('Workspace font')).toHaveValue('custom');
});

test('Relay answers its creator consistently without needing a configured model', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Message your agent' }).fill('Who made you?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Faizan made me.', { exact: true })).toBeVisible();
});
