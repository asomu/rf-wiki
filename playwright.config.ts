import { defineConfig, devices } from '@playwright/test';

const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 4321);
const baseURL = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'output/playwright/test-results',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: 4,
  timeout: 30_000,
  expect: {
    timeout: 7_500,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: 'list',
  use: {
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        launchOptions: {
          // Stable software compositing prevents intermittent unpainted black
          // tiles in macOS headless visual-regression captures.
          args: ['--disable-gpu'],
        },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${serverPort}`,
    env: {
      ASTRO_TELEMETRY_DISABLED: '1',
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
