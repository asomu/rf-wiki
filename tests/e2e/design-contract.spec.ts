import { expect, test } from '@playwright/test';
import { appRoutes } from './routes';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('mobile lab DOM, visual order, and focus follow settings → prediction → results', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn/vna-smith/');
  const lab = page.locator('[data-lab-id="smith"]');
  await expect(lab).toBeAttached({ timeout: 15_000 });

  const sequence = await lab.locator('.lab-shell__workbench').evaluate((workbench) => (
    Array.from(workbench.children).map((element) => {
      const item = element as HTMLElement;
      return {
        className: item.className,
        top: item.getBoundingClientRect().top + window.scrollY,
      };
    })
  ));

  expect(sequence.map(({ className }) => className)).toEqual([
    'lab-controls',
    'lab-prediction',
    'lab-views',
  ]);
  expect(sequence.map(({ top }) => top)).toEqual(
    [...sequence.map(({ top }) => top)].sort((a, b) => a - b),
  );

  const firstControl = lab.getByRole('spinbutton', { name: 'Resistance R' });
  await expect(firstControl).toBeDisabled();
  await expect(lab.locator('.lab-controls__state')).toContainText('예측 전에는 설정이 잠겨');

  await lab.getByRole('radio', { name: 'VSWR 같음 · center의 서로 반대쪽' }).check();
  await lab.getByRole('button', { name: '예측 고정' }).click();
  await expect(firstControl).toBeEnabled();
  await expect(firstControl).toBeFocused();
});

for (const route of appRoutes.filter((entry) => entry.labId !== undefined)) {
  test(`${route.path} lab controls expose at least 44 × 44 CSS px hit targets`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route.path);
    const rail = page.locator('.lesson-lab-rail');
    await rail.scrollIntoViewIfNeeded();
    await expect(page.locator(`[data-lab-id="${route.labId}"]`)).toBeAttached({ timeout: 15_000 });

    const failures = await rail.locator([
      'button',
      'input:not([type="radio"])',
      'select',
      'textarea',
      'summary',
      '[tabindex="0"]',
      '.lab-prediction__choices span',
    ].join(', ')).evaluateAll((elements) => elements.flatMap((element) => {
      const target = element as HTMLElement;
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
      if (rect.width >= 44 && rect.height >= 44) return [];
      return [{
        target: target.outerHTML.slice(0, 180),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      }];
    }));

    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });
}

test('mobile breadcrumb and reference links expose 44 px touch height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn/vna-smith/');
  const targets = page.locator('.breadcrumbs a, .lesson-references a');
  await expect(targets.first()).toBeVisible();
  await page.locator('.lesson-references').scrollIntoViewIfNeeded();

  const failures = await targets.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44 ? [] : [{
      text: element.textContent?.trim(),
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    }];
  }));
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});
