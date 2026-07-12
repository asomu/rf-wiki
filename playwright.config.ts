import { defineConfig, devices } from '@playwright/test';

const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 4347);
const baseURL = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'output/playwright/test-results',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  // Two workers keep visual captures deterministic without over-subscribing
  // Chromium on developer laptops and CI runners.
  workers: 2,
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
    // Exercise the same static artifacts that are published. Using Astro's
    // preview server also removes dev-only, route-by-route Vite compilation
    // from hydration and accessibility timing.
    command: `npm run preview -- --host 127.0.0.1 --port ${serverPort}`,
    env: {
      ASTRO_TELEMETRY_DISABLED: '1',
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
