import { expect, test, type Page } from '@playwright/test';

interface VisualScenario {
  readonly name: string;
  readonly path: string;
  readonly readySelector: string;
  readonly labId?: string;
}

const visualScenarios: readonly VisualScenario[] = [
  {
    name: 'home-bench',
    path: '/',
    readySelector: '.home-bench',
  },
  {
    name: 'spectrum-iq',
    path: '/learn/spectrum-iq/',
    readySelector: '[data-lab-id="spectrum"] .plot-frame',
    labId: 'spectrum',
  },
  {
    name: 'nr-resource-grid',
    path: '/learn/ofdm-lte-nr/',
    readySelector: '[data-lab-id="resource-grid"] .plot-frame',
    labId: 'resource-grid',
  },
  {
    name: 'vna-smith',
    path: '/learn/vna-smith/',
    readySelector: '[data-lab-id="smith"] .plot-frame',
    labId: 'smith',
  },
  {
    name: 'power-coupler',
    path: '/learn/power-coupling/',
    readySelector: '[data-lab-id="coupler"] .plot-frame',
    labId: 'coupler',
  },
  {
    name: 'pa-load-pull',
    path: '/learn/pa-pull/',
    readySelector: '[data-lab-id="load-pull"] .plot-frame',
    labId: 'load-pull',
  },
  {
    name: 'search-glossary',
    path: '/glossary/',
    readySelector: '.glossary-page .glossary-list',
  },
] as const;

const visualViewports = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '1024', width: 1024, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

async function waitForDesignFonts(page: Page) {
  await page.waitForFunction(() => Array.from(document.styleSheets).some(
    (sheet) => sheet.href?.includes('/fonts.'),
  ));
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 1em "IBM Plex Sans KR"', '설정 신호'),
      document.fonts.load('600 1em "IBM Plex Sans KR"', '학습 질문'),
      document.fonts.load('400 1em "IBM Plex Mono"', 'RBW S21'),
    ]);
    await document.fonts.ready;
  });
}

async function waitForScenario(page: Page, scenario: VisualScenario) {
  const ready = page.locator(scenario.readySelector).first();
  await expect(ready).toBeVisible({ timeout: 15_000 });

  if (scenario.labId) {
    const lab = page.locator(`[data-lab-id="${scenario.labId}"]`).first();
    await expect(lab).toBeVisible({ timeout: 15_000 });
    const island = lab.locator('xpath=ancestor::astro-island[1]');
    await expect(island).not.toHaveAttribute('ssr', '', { timeout: 15_000 });
  }

  await waitForDesignFonts(page);
  // Keep page scroll at zero so the first viewport verifies the lesson context
  // before the inline lab, and avoids headless compositor artifacts after scroll.
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function placeBelowStickyHeader(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    const stickyOffset = 128;
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY - stickyOffset,
      behavior: 'auto',
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.removeItem('rf-wiki:v1:progress');
  });
});

// Video capture and pixel capture compete for Chromium compositor surfaces on
// macOS headless. The visual suite keeps the baseline itself as the artifact.
test.use({ video: 'off', trace: 'off', screenshot: 'off' });

// macOS headless Chromium can return unpainted compositor tiles when many
// screenshot pages share the GPU process concurrently. Visual baselines run
// serially; interaction and accessibility suites remain parallel.
test.describe.configure({ mode: 'serial' });

test.describe('representative responsive visual regression', () => {
  for (const viewport of visualViewports) {
    test.describe(`${viewport.width}px`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const scenario of visualScenarios) {
        test(`${scenario.name} at ${viewport.width}px`, async ({ page }) => {
          const response = await page.goto(scenario.path, { waitUntil: 'networkidle' });
          expect(response?.ok(), `${scenario.path} should return a successful document`).toBe(true);
          await waitForScenario(page, scenario);
          // page.screenshot avoids the transient compositor tiles observed
          // when toHaveScreenshot injects an animation stylesheet into nested
          // sticky panes. Reduced motion and deterministic state above remove
          // the product's moving pixels.
          const screenshot = await page.screenshot({ caret: 'hide' });
          expect(screenshot).toMatchSnapshot(`${scenario.name}-${viewport.name}.png`, {
            maxDiffPixelRatio: 0.01,
          });
        });
      }
    });
  }
});

test.describe('interactive state visual regression', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('IQ linked results after prediction and phase change', async ({ page }) => {
    await page.goto('/learn/spectrum-iq/');
    await waitForScenario(page, visualScenarios[1]!);
    await page.getByRole('tab', { name: 'IQ capture' }).click();
    const lab = page.locator('[data-lab-id="iq"]');
    await lab.getByRole('radio', { name: 'spectrum magnitude 유지 · constellation 30° 회전' }).check();
    await lab.getByRole('button', { name: '예측 고정' }).click();
    await lab.getByRole('slider', { name: 'Common IQ phase' }).fill('90');
    await placeBelowStickyHeader(page, '[data-lab-id="iq"] .lab-views');
    const screenshot = await page.screenshot({ caret: 'hide' });
    expect(screenshot).toMatchSnapshot('iq-linked-results-390.png', { maxDiffPixelRatio: 0.01 });
  });

  test('VNA two-port gain and stability results', async ({ page }) => {
    await page.goto('/learn/vna-smith/');
    await waitForScenario(page, visualScenarios[3]!);
    await page.getByRole('tab', { name: /2-port/ }).click();
    const lab = page.locator('[data-lab-id="network"]');
    await lab.getByRole('radio', { name: '입출력 mismatch와 feedback 때문에 달라짐' }).check();
    await lab.getByRole('button', { name: '예측 고정' }).click();
    await lab.getByRole('slider', { name: 'Source |ΓS|' }).fill('0.5');
    await placeBelowStickyHeader(page, '[data-lab-id="network"] .lab-views');
    const screenshot = await page.screenshot({ caret: 'hide' });
    expect(screenshot).toMatchSnapshot('vna-network-results-390.png', { maxDiffPixelRatio: 0.01 });
  });

  test('search results for an RF setting', async ({ page }) => {
    await page.goto('/search/?q=RBW', { waitUntil: 'networkidle' });
    await expect(page.locator('#search-status')).toContainText(/RBW.*결과 [1-9]/, { timeout: 10_000 });
    await expect(page.locator('[data-search-entry]:visible').first()).toBeVisible();
    await waitForDesignFonts(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const screenshot = await page.screenshot({ caret: 'hide' });
    expect(screenshot).toMatchSnapshot('search-results-390.png', { maxDiffPixelRatio: 0.01 });
  });
});
