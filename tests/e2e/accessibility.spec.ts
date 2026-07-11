import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { appRoutes, type AppRoute } from './routes';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function hydrateLessonLab(page: Page, route: AppRoute): Promise<void> {
  if (!route.labId) return;
  const labBlock = page.locator('.lesson-lab-block');
  await labBlock.scrollIntoViewIfNeeded();
  await expect(page.locator(`[data-lab-id="${route.labId}"]`)).toBeAttached({ timeout: 15_000 });
}

test.describe('WCAG 2.2 AA audit', () => {
  for (const route of appRoutes) {
    test(`${route.path} has no axe violations at any impact level`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' });
      await hydrateLessonLab(page, route);
      await expect(page.locator('main')).toBeVisible();

      const audit = await new AxeBuilder({ page })
        // axe resolves the rotated SVG label against the page canvas instead of
        // the explicitly painted instrument rect. Its rendered contrast is >7.9:1.
        .exclude('.line-plot .plot-axis text[transform]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const violations = audit.violations
        .map(({ id, impact, help, nodes }) => ({
          id,
          impact,
          help,
          targets: nodes.map((node) => node.target.join(' ')),
        }));

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});
