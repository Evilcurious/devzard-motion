import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--use-gl=angle',
            '--use-angle=swiftshader',
          ],
        }
      : {},
  },
});
