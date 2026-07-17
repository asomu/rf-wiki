import { expect, test, type Page } from '@playwright/test';

interface VisualScenario {
  readonly name: string;
  readonly path: string;
  readonly readySelector: string;
  readonly labId?: string;
  readonly captureSelector?: string;
}

const visualScenarios: readonly VisualScenario[] = [
  {
    name: 'home-bench',
    path: '/',
    readySelector: '.home-bench',
  },
  {
    name: 'home-track-index',
    path: '/',
    readySelector: '.home-track-index',
    captureSelector: '.home-track-index',
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
    name: 'pa-load-pull-linearity',
    path: '/learn/pa-pull/',
    readySelector: '[data-lab-id="load-pull"] [data-visual-target="pa-linearity"]',
    labId: 'load-pull',
    captureSelector: '[data-lab-id="load-pull"] [data-visual-target="pa-linearity"]',
  },
  {
    name: 'search-glossary',
    path: '/glossary/',
    readySelector: '.glossary-page .glossary-list',
  },
  {
    name: 'cellular-hub',
    path: '/cellular/',
    readySelector: '.cellular-atlas',
  },
  {
    name: 'cellular-signal-journey',
    path: '/cellular/foundations/bits-to-iq-rf/',
    readySelector: '.signal-journey',
    captureSelector: '.signal-journey',
  },
  {
    name: 'cellular-coding-chain',
    path: '/cellular/foundations/coding-rate-matching-scrambling/',
    readySelector: '.coding-transform',
    captureSelector: '.coding-transform',
  },
  {
    name: 'cellular-envelope-papr',
    path: '/cellular/foundations/iq-magnitude-phase-psd-papr/',
    readySelector: '.envelope-papr',
    captureSelector: '.envelope-papr',
  },
  {
    name: 'cellular-dpd-flow',
    path: '/cellular/pamid/dpd-cfr/',
    readySelector: '.dpd-flow',
    captureSelector: '.dpd-flow',
  },
  {
    name: 'cellular-lte-constellation',
    path: '/cellular/lte/qam-modulations/',
    readySelector: '.constellation-guide',
    captureSelector: '.constellation-guide',
  },
  {
    name: 'cellular-nr-pi2-bpsk',
    path: '/cellular/nr/pi2-bpsk-qam/',
    readySelector: '.constellation-guide',
    captureSelector: '.constellation-guide',
  },
  {
    name: 'cellular-receiver-recovery',
    path: '/cellular/foundations/receiver-iq-to-bits/',
    readySelector: '[data-lab-id="cellular:foundations:receiver-iq-to-bits"] .plot-frame',
    labId: 'cellular:foundations:receiver-iq-to-bits',
    captureSelector: '[data-lab-id="cellular:foundations:receiver-iq-to-bits"] .receiver-recovery__views',
  },
  {
    name: 'cellular-gsm-timeslot',
    path: '/cellular/gsm/tdma-frame-timeslots/',
    readySelector: '.gsm-frame',
  },
  {
    name: 'cellular-gsm-pvt',
    path: '/cellular/gsm/gsm-module-measurement/',
    readySelector: '[data-lab-id="cellular:gsm:pvt-lab"] .gsm-pvt__chart',
    labId: 'cellular:gsm:pvt-lab',
    captureSelector: '[data-lab-id="cellular:gsm:pvt-lab"] .gsm-pvt__linked',
  },
  {
    name: 'cellular-nr-allocation',
    path: '/cellular/nr/100mhz-rb100-location0/',
    readySelector: '.resource-strip',
  },
  {
    name: 'cellular-evm-diagnostic',
    path: '/cellular/diagnostics/evm-fail/',
    readySelector: '.diagnostic-fingerprint',
  },
  {
    name: 'dvt-station-qualification',
    path: '/dvt/station-qualification/',
    readySelector: '[data-lab-id="dvt:station-qualification"]',
    labId: 'dvt:station-qualification',
    captureSelector: '[data-lab-id="dvt:station-qualification"]',
  },
  {
    name: 'dvt-uncertainty-decision',
    path: '/dvt/uncertainty-guardband/',
    readySelector: '[data-lab-id="dvt:uncertainty-guardband"]',
    labId: 'dvt:uncertainty-guardband',
    captureSelector: '[data-lab-id="dvt:uncertainty-guardband"]',
  },
  {
    name: 'dvt-blind-capstone',
    path: '/dvt/fdd-dvt-conclusion/',
    readySelector: '[data-lab-id="dvt:fdd-dvt-conclusion"]',
    labId: 'dvt:fdd-dvt-conclusion',
    captureSelector: '[data-lab-id="dvt:fdd-dvt-conclusion"]',
  },
  {
    name: 'instrument-mxg',
    path: '/instruments/sg-mxg/',
    readySelector: '.mxg-chapters',
  },
  {
    name: 'mxg-scpi',
    path: '/instruments/sg-mxg/scpi-pyvisa/',
    readySelector: '[data-lab-id="instrument:sg:mxg-scpi-pyvisa"] .plot-frame',
    labId: 'instrument:sg:mxg-scpi-pyvisa',
  },
  {
    name: 'instrument-mxa',
    path: '/instruments/sa-mxa/',
    readySelector: '.mxg-chapters',
  },
  {
    name: 'mxa-sweep',
    path: '/instruments/sa-mxa/sweep-rbw-detector/',
    readySelector: '[data-lab-id="instrument:sa:mxa-sweep-rbw"] .plot-frame',
    labId: 'instrument:sa:mxa-sweep-rbw',
  },
  {
    name: 'instrument-ena',
    path: '/instruments/vna-ena/',
    readySelector: '.mxg-chapters',
  },
  {
    name: 'ena-calibration',
    path: '/instruments/vna-ena/calibration-reference-plane/',
    readySelector: '[data-lab-id="instrument:vna:ena-calibration"] .plot-frame',
    labId: 'instrument:vna:ena-calibration',
  },
  {
    name: 'instrument-power-sensor',
    path: '/instruments/power-sensor/',
    readySelector: '.mxg-chapters',
  },
  {
    name: 'power-sensor-burst',
    path: '/instruments/power-sensor/average-peak-burst/',
    readySelector: '[data-lab-id="instrument:sensor:sensor-average-peak"] .plot-frame',
    labId: 'instrument:sensor:sensor-average-peak',
  },
  {
    name: 'instrument-psu',
    path: '/instruments/power-supply/',
    readySelector: '.mxg-chapters',
  },
  {
    name: 'psu-cv-cc',
    path: '/instruments/power-supply/cv-cc-protection/',
    readySelector: '[data-lab-id="instrument:psu:psu-cv-cc"] .plot-frame',
    labId: 'instrument:psu:psu-cv-cc',
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
    await lab.scrollIntoViewIfNeeded();
    const island = lab.locator('xpath=ancestor::astro-island[1]');
    await expect(island).not.toHaveAttribute('ssr', '', { timeout: 15_000 });
  }

  await waitForDesignFonts(page);
  // Stabilize the header at scroll zero before selecting a deeper capture target.
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function stabilizeInitialViewportCapture(page: Page) {
  // At scroll position zero, a sticky header and a static header have the same
  // layout. Capturing it as a normal flow layer avoids intermittent unpainted
  // black compositor tiles in macOS headless Chromium without changing the
  // product CSS or the pixels users see at the top of the page.
  await page.addStyleTag({ content: '.site-header { position: static !important; }' });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
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
          await stabilizeInitialViewportCapture(page);
          if (scenario.captureSelector) {
            await placeBelowStickyHeader(page, scenario.captureSelector);
          }
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
    await waitForScenario(page, visualScenarios.find(({ name }) => name === 'spectrum-iq')!);
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
    await waitForScenario(page, visualScenarios.find(({ name }) => name === 'vna-smith')!);
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
