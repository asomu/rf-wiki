import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function waitForHydratedLab(page: Page, selector: string) {
  const lab = page.locator(selector);
  await expect(lab).toBeAttached({ timeout: 15_000 });
  const island = lab.locator('xpath=ancestor::astro-island[1]');
  await expect(island).not.toHaveAttribute('ssr', '', { timeout: 15_000 });
  return lab;
}

test('keyboard skip link and search preserve a visible focus path', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const search = page.getByRole('search').first();
  await search.getByRole('searchbox').focus();
  await page.keyboard.type('RBW');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\/\?q=RBW$/);
  await expect(page.locator('#search-status')).toContainText(/RBW.*결과 [1-9]/, {
    timeout: 10_000,
  });
  await expect(page.locator('[data-search-entry]:visible').first()).toBeVisible();
});

test('SA RBW keyboard change updates the control, ledger, and linked plot', async ({ page }) => {
  await page.goto('/learn/spectrum-iq/');
  const lab = await waitForHydratedLab(page, '[data-lab-id="spectrum"]');

  await lab.getByRole('radio', { name: 'tone 거의 동일 · noise 약 −10 dB' }).check();
  await lab.getByRole('button', { name: '예측 고정' }).click();
  const rbw = lab.getByRole('slider', { name: 'Resolution bandwidth' });
  await expect(rbw).toHaveValue('100');
  await rbw.focus();
  await page.keyboard.press('Home');
  await expect(rbw).toHaveValue('5');

  await expect(lab.locator('.cause-ledger')).toContainText('RBW 5 kHz');
  await expect(lab.locator('.cause-ledger')).toContainText('noise bandwidth가 5 kHz');
  await expect(lab.locator('svg desc').first()).toContainText('5 kHz RBW filter');
  await expect(lab.getByText(/Displayed noise/).locator('..')).toContainText('-122.0 dBm');
});

test('SA and IQ tabs switch through the keyboard and preserve tab semantics', async ({ page }) => {
  await page.goto('/learn/spectrum-iq/');
  const spectrumLab = await waitForHydratedLab(page, '[data-lab-id="spectrum"]');
  const iqTab = page.getByRole('tab', { name: 'IQ capture' });
  const spectrumTab = page.getByRole('tab', { name: 'SA trace' });
  await expect(spectrumTab).toHaveAttribute('aria-selected', 'true');
  await expect(spectrumTab).toHaveAttribute('tabindex', '0');

  await spectrumLab.getByRole('radio', { name: 'tone 거의 동일 · noise 약 −10 dB' }).check();
  await spectrumLab.getByRole('button', { name: '예측 고정' }).click();
  const detector = spectrumLab.getByRole('combobox', { name: 'Detector' });
  await detector.selectOption('positive-peak');

  await spectrumTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(iqTab).toHaveAttribute('aria-selected', 'true');
  await expect(iqTab).toBeFocused();
  await expect(iqTab).toHaveAttribute('tabindex', '0');
  await expect(spectrumTab).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('[data-lab-id="iq"]')).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'IQ capture' })).toBeVisible();

  await page.keyboard.press('Home');
  await expect(spectrumTab).toHaveAttribute('aria-selected', 'true');
  await expect(spectrumTab).toBeFocused();
  await expect(page.locator('[data-lab-id="spectrum"]')).toBeVisible();
  await expect(detector).toHaveValue('positive-peak');
});

test('VNA tabs preserve one-port state and expose the two-port completion lab', async ({ page }) => {
  await page.goto('/learn/vna-smith/');
  const smithLab = await waitForHydratedLab(page, '[data-lab-id="smith"]');
  const onePortTab = page.getByRole('tab', { name: /1-port/ });
  const twoPortTab = page.getByRole('tab', { name: /2-port/ });

  await smithLab.getByRole('radio', { name: 'VSWR 같음 · center의 서로 반대쪽' }).check();
  await smithLab.getByRole('button', { name: '예측 고정' }).click();
  const resistance = smithLab.getByRole('spinbutton', { name: 'Resistance R' });
  await resistance.fill('100');

  await onePortTab.focus();
  await page.keyboard.press('End');
  await expect(twoPortTab).toBeFocused();
  await expect(twoPortTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-lab-id="network"]')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(onePortTab).toBeFocused();
  await expect(onePortTab).toHaveAttribute('aria-selected', 'true');
  await expect(resistance).toHaveValue('100');
});

test('mobile lesson follows map → context → depth → intuition primer → lab → bench', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn/spectrum-iq/');
  await expect(page.locator('[data-lab-id="spectrum"]')).toBeAttached({ timeout: 15_000 });

  const sections = await page.locator('.lesson-shell').evaluate((shell) => {
    const selectors = [
      '.learning-map',
      '.lesson-intro',
      '.layer-rail',
      '.lesson-article',
    ];

    return selectors.map((selector) => {
      const element = shell.querySelector<HTMLElement>(`:scope > ${selector}`);
      if (!element) throw new Error(`Missing lesson section: ${selector}`);
      return {
        selector,
        domIndex: Array.from(shell.children).indexOf(element),
        top: element.getBoundingClientRect().top + window.scrollY,
      };
    });
  });

  expect(sections.map(({ selector }) => selector)).toEqual([
    '.learning-map',
    '.lesson-intro',
    '.layer-rail',
    '.lesson-article',
  ]);
  expect(sections.map(({ domIndex }) => domIndex)).toEqual([...sections.map(({ domIndex }) => domIndex)].sort((a, b) => a - b));
  expect(sections.map(({ top }) => top)).toEqual([...sections.map(({ top }) => top)].sort((a, b) => a - b));

  const learningSequence = await page.locator('.lesson-content').evaluate((content) => {
    const intuition = content.querySelector<HTMLElement>('#intuition');
    const lab = content.querySelector<HTMLElement>('.lesson-lab-block');
    const bench = content.querySelector<HTMLElement>('#bench');
    if (!intuition || !lab || !bench) throw new Error('Missing inline lesson sequence');
    const box = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
    };
    return { intuition: box(intuition), lab: box(lab), bench: box(bench) };
  });
  expect(learningSequence.lab.top).toBeGreaterThan(learningSequence.intuition.top);
  expect(learningSequence.lab.bottom).toBeLessThanOrEqual(learningSequence.intuition.bottom);
  expect(learningSequence.bench.top).toBeGreaterThanOrEqual(learningSequence.intuition.bottom);
});

test('desktop lesson uses compact navigation and a full-width inline lab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/learn/spectrum-iq/');

  const layout = await page.locator('.lesson-shell').evaluate((shell) => {
    const box = (selector: string) => {
      const element = shell.querySelector<HTMLElement>(`:scope > ${selector}`);
      if (!element) throw new Error(`Missing lesson section: ${selector}`);
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    };
    return {
      map: box('.learning-map'),
      intro: box('.lesson-intro'),
      heading: box('.lesson-intro .lesson-heading'),
      layers: box('.layer-rail'),
      article: box('.lesson-article'),
    };
  });

  const readingBand = await page.locator('.lesson-layer__body > :not(.lesson-lab-block)').first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  });

  const lab = await page.locator('.lesson-lab-block').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width };
  });

  expect(layout.map.x).toBeLessThan(layout.intro.x);
  expect(layout.heading.width).toBeCloseTo(layout.intro.width, 0);
  expect(layout.layers.x).toBeCloseTo(layout.intro.x, 0);
  expect(layout.layers.width).toBeCloseTo(layout.intro.width, 0);
  expect(layout.article.x).toBeCloseTo(layout.intro.x, 0);
  expect(readingBand.x).toBeCloseTo(layout.article.x, 0);
  expect(readingBand.width).toBeGreaterThan(900);
  expect(readingBand.width).toBeLessThan(layout.article.width);
  expect(lab.x).toBeCloseTo(layout.article.x, 0);
  expect(lab.width).toBeCloseTo(layout.article.width, 0);
  expect(lab.width).toBeGreaterThan(900);
  expect(lab.y).toBeGreaterThan(layout.intro.y);
});

test('tablet lesson fills structural width and centers the reading band', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/learn/spectrum-iq/');

  const layout = await page.locator('.lesson-shell').evaluate((shell) => {
    const box = (selector: string) => {
      const element = shell.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing lesson section: ${selector}`);
      const rect = element.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    };
    return {
      intro: box('.lesson-intro'),
      heading: box('.lesson-heading'),
      layers: box('.layer-rail'),
      reading: box('.lesson-layer__body > :not(.lesson-lab-block)'),
    };
  });

  expect(layout.heading.width).toBeCloseTo(layout.intro.width, 0);
  expect(layout.layers.width).toBeCloseTo(layout.intro.width, 0);
  expect(layout.reading.width).toBeCloseTo(960, 0);
  expect(layout.reading.x).toBeGreaterThan(layout.intro.x);
  expect(layout.intro.x + layout.intro.width - (layout.reading.x + layout.reading.width)).toBeCloseTo(
    layout.reading.x - layout.intro.x,
    0,
  );
});

test('lab completion requires prediction, a real control change, and explanation', async ({ page }) => {
  await page.goto('/learn/spectrum-iq/');
  const lab = await waitForHydratedLab(page, '[data-lab-id="spectrum"]');

  const finish = lab.getByRole('button', { name: '설명으로 완료하기' });
  const explanation = lab.getByRole('textbox', { name: '내 원인 설명' });
  await expect(explanation).toBeDisabled();
  await lab.getByRole('radio', { name: 'tone 거의 동일 · noise 약 −10 dB' }).check();
  await lab.getByRole('button', { name: '예측 고정' }).click();
  await expect(finish).toBeDisabled();

  await lab.getByRole('slider', { name: 'Resolution bandwidth' }).press('Home');
  await expect(explanation).toBeEnabled();
  await explanation.fill('너무 짧다');
  await expect(finish).toBeDisabled();
  const explanationText = 'RBW를 줄였기 때문에 DSP filter 폭이 감소해 화면 noise가 내려갔지만 sweep 시간 비용이 늘었다.';
  await explanation.fill(explanationText);
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(lab.getByText(/완료가 저장되었습니다/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}');
    return Object.keys(progress.spectrum ?? {}).sort();
  })).toEqual(['completed', 'completedAt']);
  await expect.poll(() => page.evaluate((text) => (
    localStorage.getItem('rf-wiki:v1:progress') ?? ''
  ).includes(text), explanationText)).toBe(false);

  await lab.getByRole('slider', { name: 'Resolution bandwidth' }).press('ArrowRight');
  await expect(explanation).toHaveValue('');
  await expect(finish).toBeDisabled();
  await expect(lab.getByText(/완료가 저장되었습니다/)).toHaveCount(0);

  await explanation.fill('새 설정 때문에 DSP filter 폭이 줄어 화면 noise가 감소했지만 sweep 시간 한계가 늘었다.');
  await finish.click();
  await expect(lab.getByText(/완료가 저장되었습니다/)).toBeVisible();

  await lab.getByRole('button', { name: '다시 선택' }).click();
  await expect(finish).toBeDisabled();
  await expect(explanation).toBeDisabled();
  await expect(explanation).toHaveValue('');
  await expect(lab.getByText(/완료가 저장되었습니다/)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}');
    return Boolean(progress.spectrum);
  })).toBe(false);
});

test('home restores module progress and requires both Spectrum and IQ labs', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rf-wiki:v1:progress', JSON.stringify({
      frequency: { completed: true, completedAt: '2026-07-11T00:00:00.000Z' },
      spectrum: { completed: true, completedAt: '2026-07-11T00:01:00.000Z' },
    }));
  });
  await page.goto('/');

  const progress = page.locator('[data-home-progress]');
  await expect(progress.locator('[data-progress-count]')).toHaveText('1');
  await expect(progress.locator('[data-progress-title]')).toHaveText(/SA의 trace와 IQ capture/);
  await expect(progress.locator('[data-progress-action]')).toHaveAttribute('href', '/learn/spectrum-iq/');
  await expect(progress.getByText(/SA trace와 IQ capture 두 실험을 모두 완료/)).toBeVisible();

  await page.evaluate(() => {
    const key = 'rf-wiki:v1:progress';
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({
      ...stored,
      iq: { completed: true, completedAt: '2026-07-11T00:02:00.000Z' },
    }));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });

  await expect(progress.locator('[data-progress-count]')).toHaveText('2');
  await expect(progress.locator('[data-progress-title]')).toHaveText(/RB range와 location/);
  await expect(progress.locator('[data-progress-action]')).toHaveAttribute('href', '/learn/ofdm-lte-nr/');
});

test('lesson hydration restores a saved lab completion', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rf-wiki:v1:progress', JSON.stringify({
      spectrum: { completed: true, completedAt: '2026-07-11T00:00:00.000Z' },
    }));
  });
  await page.goto('/learn/spectrum-iq/');

  const lab = await waitForHydratedLab(page, '[data-lab-id="spectrum"]');
  await expect(lab.locator('.lab-explain__done')).toContainText('이전 세션에서 완료');
});
