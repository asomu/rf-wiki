import { expect, test } from '@playwright/test';
import { appRoutes } from './routes';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const route of appRoutes.filter((entry) => entry.labId !== undefined)) {
  test(`${route.path} hydrates its React lab without console or page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await page.goto(route.path);
    await page.locator('.lesson-lab-block').scrollIntoViewIfNeeded();
    const lab = page.locator(`[data-lab-id="${route.labId}"]`);
    await expect(lab).toBeAttached({
      timeout: 15_000,
    });
    const island = lab.locator('xpath=ancestor::astro-island[1]');
    await expect(island).not.toHaveAttribute('ssr', '', { timeout: 15_000 });

    // The spectrum wrapper mounts the IQ view on first visit. Exercise that
    // post-hydration path so a pre-hydration SSR button cannot absorb the click.
    if (route.labId === 'spectrum') {
      await page.getByRole('tab', { name: 'IQ capture' }).click();
      await expect(page.locator('[data-lab-id="iq"]')).toBeVisible({ timeout: 15_000 });
    }

    expect(errors, errors.join('\n')).toEqual([]);
  });
}
