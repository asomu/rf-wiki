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

for (const viewportWidth of [1025, 1200]) {
  test(`MXG lab stacks by its container at ${viewportWidth}px and keeps actions inside`, async ({ page }) => {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.goto('/instruments/sg-mxg/safe-cw/');
    const lab = page.locator('[data-lab-id="instrument:sg:mxg-safe-cw"]');
    await expect(lab).toBeAttached({ timeout: 15_000 });

    const layout = await lab.locator('.lab-shell__workbench').evaluate((workbench) => {
      const bounds = workbench.getBoundingClientRect();
      const children = Array.from(workbench.children).map((element) => {
        const item = element as HTMLElement;
        const rect = item.getBoundingClientRect();
        return { className: item.className, top: rect.top, bottom: rect.bottom };
      });
      return { width: bounds.width, children };
    });

    expect(layout.width).toBeLessThanOrEqual(1024);
    expect(layout.children.map(({ className }) => className)).toEqual([
      'lab-controls',
      'lab-prediction',
      'lab-views',
    ]);
    expect(layout.children[1]!.top).toBeGreaterThanOrEqual(layout.children[0]!.bottom - 1);
    expect(layout.children[2]!.top).toBeGreaterThanOrEqual(layout.children[1]!.bottom - 1);

    const clippedActions = await lab.locator('.lab-prediction button, .lab-explain button').evaluateAll((buttons) => (
      buttons.flatMap((button) => {
        const action = button.getBoundingClientRect();
        const shell = button.closest('.lab-shell')?.getBoundingClientRect();
        if (!shell || (action.left >= shell.left && action.right <= shell.right)) return [];
        return [{ label: button.textContent?.trim(), left: action.left, right: action.right, shellLeft: shell.left, shellRight: shell.right }];
      })
    ));
    expect(clippedActions, JSON.stringify(clippedActions, null, 2)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

for (const route of appRoutes.filter((entry) => entry.labId !== undefined)) {
  test(`${route.path} lab controls expose at least 44 × 44 CSS px hit targets`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route.path);
    const labBlock = page.locator('.lesson-lab-block');
    await labBlock.scrollIntoViewIfNeeded();
    await expect(page.locator(`[data-lab-id="${route.labId}"]`)).toBeAttached({ timeout: 15_000 });

    const failures = await labBlock.locator([
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

for (const scenario of [
  {
    name: 'receiver decision',
    path: '/cellular/foundations/receiver-iq-to-bits/',
    labId: 'cellular:foundations:receiver-iq-to-bits',
    selector: '.receiver-decision-plot',
  },
  {
    name: 'PA constellation',
    path: '/learn/pa-pull/',
    labId: 'load-pull',
    selector: '.pa-constellation',
  },
] as const) {
  for (const viewport of [
    { name: '390px mobile', width: 390, height: 844 },
    { name: '1440px at 200% effective width', width: 720, height: 900 },
  ] as const) {
    test(`${scenario.name} SVG labels stay legible at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(scenario.path);
      const lab = page.locator(`[data-lab-id="${scenario.labId}"]`);
      await expect(lab).toBeAttached({ timeout: 15_000 });
      const plot = lab.locator(scenario.selector);
      await plot.scrollIntoViewIfNeeded();
      await expect(plot).toBeVisible({ timeout: 15_000 });

      const failures = await plot.locator('text').evaluateAll((labels) => labels.flatMap((label) => {
        const rect = label.getBoundingClientRect();
        const style = getComputedStyle(label);
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
        if (rect.height >= 10) return [];
        return [{ text: label.textContent?.trim(), height: Number(rect.height.toFixed(2)) }];
      }));

      expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    });
  }
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
