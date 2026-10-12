import { defineConfig, devices } from '@playwright/test';

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const video = process.env.PLAYWRIGHT_DISABLE_VIDEO === 'true' ? 'off' : 'retain-on-failure';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './output/playwright/test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: './output/playwright/report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './output/playwright/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video,
  },
  webServer: [
    {
      command: 'npm run start -w @slotty/api',
      url: 'http://localhost:3000/api/health/ready',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'PORT=5173 npm run preview:seo -w @slotty/web',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
      },
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 16 Pro Max'],
        viewport: { width: 440, height: 956 },
      },
    },
  ],
});
