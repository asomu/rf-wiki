import { expect, test } from '@playwright/test';
import { appRoutes, smokeViewports } from './routes';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
