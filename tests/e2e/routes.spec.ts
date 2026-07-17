import { expect, test } from '@playwright/test';
import { appRoutes, cellularRoutes, smokeViewports } from './routes';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe(`all ${cellularRoutes.length} cellular lesson routes`, () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const route of cellularRoutes) {
    test(`${route.path} is generated and readable`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth + 1),
      );
    });
  }
});

const staticEducationalVisuals = [
  { path: '/cellular/foundations/bits-to-iq-rf/', selector: '.signal-journey' },
  { path: '/cellular/foundations/coding-rate-matching-scrambling/', selector: '.coding-transform' },
  { path: '/cellular/foundations/iq-magnitude-phase-psd-papr/', selector: '.envelope-papr' },
  { path: '/cellular/pamid/dpd-cfr/', selector: '.dpd-flow' },
  { path: '/cellular/lte/qam-modulations/', selector: '.constellation-guide' },
  { path: '/cellular/nr/pi2-bpsk-qam/', selector: '.constellation-guide' },
] as const;

test.describe('static educational visuals', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const scenario of staticEducationalVisuals) {
    test(`${scenario.path} keeps its visual static, linked and table-backed`, async ({ page, request }) => {
      await page.goto(scenario.path);
      const visual = page.locator(scenario.selector);
      await expect(visual).toBeVisible();
      await expect(visual.locator('table')).toHaveCount(1);
      await expect(visual.locator('astro-island')).toHaveCount(0);

      const internalLinks = await visual.locator('a[href^="/"]').evaluateAll((anchors) => (
        anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[]
      ));
      for (const href of internalLinks) {
        expect((await request.get(href)).ok(), `${href} should resolve from ${scenario.path}`).toBe(true);
      }
    });
  }
});

test.describe('static route and responsive smoke', () => {
  for (const viewport of smokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of appRoutes) {
        test(`${route.path} renders without document overflow`, async ({ page }) => {
          const response = await page.goto(route.path);
          expect(response?.ok(), `${route.path} should return a successful document`).toBe(true);
          await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
          await expect(page.locator('main')).toBeVisible();

          const dimensions = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          expect(
            dimensions.scrollWidth,
            `${route.path} overflows at ${viewport.width}px`,
          ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
        });
      }
    });
  }
});
