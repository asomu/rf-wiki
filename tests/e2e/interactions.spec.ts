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

test('home exposes all 88 learning items and PvT is discoverable from search and glossary', async ({ page }) => {
  await page.goto('/');

  const trackIndex = page.locator('.home-track-index');
  await expect(trackIndex).toContainText('6 RF');
  await expect(trackIndex).toContainText('25 장비');
  await expect(trackIndex).toContainText('59 Cellular');
  await expect(trackIndex.getByRole('link', { name: /RF 6축 전체 보기/ })).toHaveAttribute('href', '#curriculum');
  await expect(trackIndex.getByRole('link', { name: /Cellular 59개 전체 보기/ })).toHaveAttribute('href', '/cellular/');
  await expect(trackIndex.getByRole('link', { name: /장비 25개 전체 보기/ })).toHaveAttribute('href', '/instruments/');

  await page.goto('/search/?q=PvT');
  await expect(page.locator('#search-status')).toContainText(/PvT.*결과 [1-9]/, { timeout: 10_000 });
  await expect(
    page.locator('[data-search-entry]:visible').filter({ hasText: 'GSM PA+ASM module' }).first(),
  ).toBeVisible();

  await page.goto('/glossary/');
  await page.getByRole('searchbox', { name: '용어·기호·설명에서 찾기' }).fill('PvT');
  await expect(page.locator('#glossary-count')).toContainText('결과 1개');
  await expect(page.locator('[data-glossary-entry]:visible')).toContainText('PvT (Power versus Time)');
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

test('MXG SCPI console drives the deterministic N5182B state and error queue', async ({ page }) => {
  await page.goto('/instruments/sg-mxg/scpi-pyvisa/');
  const lab = await waitForHydratedLab(page, '[data-lab-id="instrument:sg:mxg-scpi-pyvisa"]');

  await lab.getByRole('radio', { name: '*OPC? 응답과 error queue를 확인' }).check();
  await lab.getByRole('button', { name: '예측 고정' }).click();
  const command = lab.getByRole('textbox', { name: 'SCPI program message' });
  await command.fill('SOUR:FREQ:CW 2.4GHz');
  await lab.getByRole('button', { name: 'WRITE만' }).click();
  await expect(lab.locator('.mxg-state-diff')).toContainText('2.400 GHz');
  await expect(lab.locator('.mxg-state-diff')).toContainText('RF OFF');

  await command.fill('BAD:COMMAND');
  await lab.getByRole('button', { name: 'WRITE만' }).click();
  await expect(lab.locator('.mxg-transcript')).toContainText('-113');
  await expect(lab.locator('.mxg-state-diff')).toContainText('errors 1');

  await command.fill('*IDN?');
  await lab.getByRole('button', { name: 'WRITE만' }).click();
  await expect(lab.locator('.mxg-state-diff')).toContainText('output 1');

  await command.fill('FREQ 2.5GHz');
  await lab.getByRole('button', { name: 'WRITE만' }).click();
  await expect(lab.locator('.mxg-state-diff')).toContainText('output 0');
  await expect(lab.locator('.mxg-state-diff')).toContainText('errors 2');

  await command.fill('SYST:ERR?');
  await lab.getByRole('button', { name: 'QUERY + READ' }).click();
  await expect(lab.locator('.mxg-transcript')).toContainText('-113,"Undefined header"');
  await expect(lab.locator('.mxg-state-diff')).toContainText('errors 1');

  await lab.getByRole('button', { name: 'QUERY + READ' }).click();
  await expect(lab.locator('.mxg-transcript')).toContainText('-410,"Query INTERRUPTED"');
  await expect(lab.locator('.mxg-state-diff')).toContainText('errors 0');

  await command.fill('*OPC?');
  await lab.getByRole('button', { name: 'QUERY + READ' }).click();
  await expect(lab.locator('.mxg-transcript')).toContainText('1');

  await command.fill('*OPT?');
  await lab.getByRole('button', { name: 'WRITE만' }).click();
  await expect(lab.locator('.mxg-state-diff')).toContainText('output 1');
  await lab.getByRole('button', { name: 'READ queue' }).click();
  await expect(lab.locator('.mxg-transcript')).toContainText('506,656');
  await expect(lab.locator('.mxg-state-diff')).toContainText('output 0');

  await command.fill('RAD:ARB:WAV "WFM1:OFDM_LIKE"');
  await lab.getByRole('button', { name: 'WRITE만' }).click();
  await expect(lab.locator('.mxg-queue-strip')).toContainText('OPERATIONS 1');
  await expect(lab.locator('.mxg-pending-operations')).toContainText('Select WFM1:OFDM_LIKE');

  await command.fill('*OPC?');
  await lab.getByRole('button', { name: 'QUERY + READ' }).click();
  await expect(lab.locator('.mxg-queue-strip')).toContainText('OPERATIONS 0');
});

test('MXG Option 656 caps sample rate and ARB selection changes the linked timeline', async ({ page }) => {
  await page.goto('/instruments/sg-mxg/waveform-iq/');
  const waveformLab = await waitForHydratedLab(
    page,
    '[data-lab-id="instrument:sg:mxg-waveform-iq"]',
  );
  const sampleRate = waveformLab.getByRole('slider', { name: 'Sample rate · Option 656' });
  await expect(sampleRate).toHaveAttribute('max', '100');
  await expect(waveformLab.locator('.cause-ledger')).toContainText('656+657');

  await page.goto('/instruments/sg-mxg/arb-playback/');
  const arbLab = await waitForHydratedLab(
    page,
    '[data-lab-id="instrument:sg:mxg-arb-playback"]',
  );
  await arbLab.getByRole('radio', { name: 'armed 상태에서 재생을 기다림' }).check();
  await arbLab.getByRole('button', { name: '예측 고정' }).click();
  await arbLab.getByRole('combobox', { name: 'Waveform segment' }).selectOption('Two-tone');
  await expect(arbLab.locator('svg').first()).toContainText('WFM1:TWO_TONE');
});

test('instrument progress is namespaced per device and does not change the six-axis RF progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rf-wiki:v1:progress', JSON.stringify({
      frequency: { completed: true, completedAt: '2026-07-12T00:00:00.000Z' },
      'instrument:sg:mxg-safe-cw': { completed: true, completedAt: '2026-07-12T00:01:00.000Z' },
      'instrument:sa:mxa-safe-input': { completed: true, completedAt: '2026-07-12T00:02:00.000Z' },
      'instrument:vna:ena-safe-sweep': { completed: true, completedAt: '2026-07-12T00:03:00.000Z' },
      'instrument:sensor:sensor-safe-power': { completed: true, completedAt: '2026-07-12T00:04:00.000Z' },
      'instrument:psu:psu-safe-bias': { completed: true, completedAt: '2026-07-12T00:05:00.000Z' },
    }));
  });

  const expected = [
    ['/instruments/sg-mxg/', 'Waveform 파일', '/instruments/sg-mxg/waveform-iq/'],
    ['/instruments/sa-mxa/', 'SA는 입력 RF를', '/instruments/sa-mxa/sweep-rbw-detector/'],
    ['/instruments/vna-ena/', 'Calibration을 하면', '/instruments/vna-ena/calibration-reference-plane/'],
    ['/instruments/power-sensor/', '같은 burst가', '/instruments/power-sensor/average-peak-burst/'],
    ['/instruments/power-supply/', '설정한 voltage가', '/instruments/power-supply/cv-cc-protection/'],
  ] as const;
  for (const [route, title, href] of expected) {
    await page.goto(route);
    const instrumentProgress = page.locator('[data-instrument-progress]');
    await expect(instrumentProgress.locator('[data-progress-count]')).toHaveText('1');
    await expect(instrumentProgress.locator('[data-progress-title]')).toContainText(title);
    await expect(instrumentProgress.locator('[data-progress-action]')).toHaveAttribute('href', href);
  }

  await page.goto('/');
  await expect(page.locator('[data-home-progress] [data-progress-count]')).toHaveText('1');
  await expect(page.locator('[data-home-progress] [data-progress-title]')).toContainText('SA의 trace');
});

test('GSM PvT keeps the next trace hidden until prediction and reports the first fail region', async ({ page }) => {
  await page.goto('/cellular/gsm/gsm-module-measurement/');
  const lab = page.locator('[data-lab-id="cellular:gsm:pvt-lab"]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toBeVisible({ timeout: 15_000 });

  const run = lab.getByRole('button', { name: '예측 제출 후 trace 실행' });
  await lab.getByRole('button', { name: /CASE 04 · Hot start/ }).click();
  await expect(lab.getByText('TRACE ARMED')).toBeVisible();
  await expect(run).toBeDisabled();

  await lab.getByRole('button', { name: /PLATEAU.*Settling 포함/ }).click();
  await run.click();

  await expect(lab).toHaveAttribute('data-result', 'fail');
  await expect(lab.locator('.gsm-pvt__feedback')).toContainText('예측이 맞았습니다');
  await expect(lab.locator('.gsm-pvt__ledger')).toContainText('EARLY SETTLING · upper');
  await expect(lab.getByRole('img')).toHaveAttribute('aria-label', /EARLY SETTLING 영역/);
});

test('mobile GSM PvT shows the full burst without a horizontal chart scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cellular/gsm/gsm-module-measurement/');

  const chartWrap = page.locator('[data-lab-id="cellular:gsm:pvt-lab"] .gsm-pvt__chart-wrap');
  await expect(chartWrap).toBeVisible({ timeout: 15_000 });
  const dimensions = await chartWrap.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(chartWrap.locator('.gsm-pvt__trace')).toBeVisible();
  await expect(chartWrap.locator('.gsm-pvt__burst-marker')).toHaveCount(2);
});

test('cellular completion keeps RF and instrument progress intact', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rf-wiki:v1:progress', JSON.stringify({
      frequency: { completed: true, completedAt: '2026-07-15T00:00:00.000Z' },
      'instrument:sg:mxg-safe-cw': { completed: true, completedAt: '2026-07-15T00:01:00.000Z' },
    }));
  });

  await page.goto('/cellular/');
  await expect(page.locator('[data-cellular-progress] [data-progress-title]')).toHaveText('신호 분류 네 층');
  await expect(page.locator('[data-cellular-progress] [data-progress-action]')).toHaveAttribute(
    'href',
    '/cellular/foundations/modulation-waveform-multiple-access-duplex/',
  );

  await page.goto('/cellular/gsm/tdma-frame-timeslots/');
  const check = page.locator('[data-lab-id="cellular:gsm:tdma-frame-timeslots"]');
  await check.getByRole('radio', { name: 'Frame 안의 burst 시간 위치' }).check();
  await check.getByRole('button', { name: '예측 확인' }).click();
  await expect(check.getByRole('status').first()).toContainText('맞습니다.');

  await check.getByLabel('내 원인 설명').fill(
    'timeslot을 바꿨기 때문에 PA stage의 burst 시간이 이동해서 power 화면 위치가 바뀌지만 trigger 오차 한계가 있다.',
  );
  await check.getByRole('button', { name: '이 페이지 완료' }).click();
  await expect(check.getByRole('status', { name: '' }).last()).toContainText('cellular 진도');

  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}'));
  expect(progress.frequency?.completed).toBe(true);
  expect(progress['instrument:sg:mxg-safe-cw']?.completed).toBe(true);
  expect(progress['cellular:gsm:tdma-frame-timeslots']?.completed).toBe(true);
});

test('receiver recovery completes prediction, keyboard control, ledger and explanation flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cellular/foundations/receiver-iq-to-bits/');
  await page.locator('.lesson-lab-block').scrollIntoViewIfNeeded();

  const lab = page.locator('[data-lab-id="cellular:foundations:receiver-iq-to-bits"]');
  await expect(lab).toBeAttached({ timeout: 15_000 });
  const island = lab.locator('xpath=ancestor::astro-island[1]');
  await expect(island).not.toHaveAttribute('ssr', '', { timeout: 15_000 });

  const frequencyOffset = lab.getByRole('slider', { name: 'Residual frequency offset' });
  await expect(frequencyOffset).toBeDisabled();

  const prediction = lab.getByRole('radio', { name: /고정 gain·phase는 보정되고 residual rotation·noise는 남는다/ });
  await prediction.focus();
  await page.keyboard.press('Space');
  const lockPrediction = lab.getByRole('button', { name: '예측 고정' });
  await lockPrediction.focus();
  await page.keyboard.press('Enter');

  const firstControl = lab.getByRole('combobox', { name: 'QPSK transmitted dibit' });
  await expect(firstControl).toBeFocused();
  await lab.getByRole('slider', { name: 'Channel magnitude |H|' }).fill('1.1');
  await lab.getByRole('slider', { name: 'Channel phase' }).fill('45');
  await lab.getByRole('slider', { name: 'Deterministic noise-vector magnitude' }).fill('0.12');
  await frequencyOffset.focus();
  await page.keyboard.press('End');

  await expect(frequencyOffset).toHaveValue('200');
  await expect(lab.getByText('Decided dibit').locator('..')).toContainText('01');
  await expect(lab.getByText('Bit errors').locator('..')).toContainText('1 bit');
  await expect(lab.locator('.cause-ledger')).toContainText('72.0° phase drift');
  const decisionPlane = lab.locator('.plot-frame').filter({ hasText: 'QPSK decision plane' });
  await expect(decisionPlane).toContainText('|H| 1.10 V/V · phase 45°');
  await expect(decisionPlane).toContainText('200 Hz · known common H equalization');
  await expect(decisionPlane).toContainText('|n| 0.12 normalized · direction -32°');
  for (const tick of ['-1.0', '-0.5', '0.5', '1.0']) {
    await expect(decisionPlane.locator('svg').getByText(tick, { exact: true })).toHaveCount(2);
  }
  await expect(lab.locator('.signal-spine__flow-indicator').first()).toHaveCSS('animation-duration', '0s');

  const explanation = lab.getByRole('textbox', { name: '내 원인 설명' });
  await explanation.fill('frequency offset을 바꿨기 때문에 acquisition DSP의 phase drift가 72도로 늘어 decision 화면이 01로 바뀌었지만 noise와 scalar channel 모델 한계가 있다.');
  const finish = lab.getByRole('button', { name: '설명으로 완료하기' });
  await expect(finish).toBeEnabled();
  await finish.focus();
  await page.keyboard.press('Enter');
  await expect(lab.locator('.lab-explain__done')).toContainText('완료가 저장되었습니다.');

  const completion = await page.evaluate(() => JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}'));
  expect(completion['cellular:foundations:receiver-iq-to-bits']?.completed).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('mobile primary navigation keeps one current track label and reveals four destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cellular/nr/100mhz-rb100-location0/');

  const mobileNav = page.locator('.mobile-primary-nav');
  await expect(mobileNav.getByText('3GPP·PAMiD', { exact: true }).first()).toBeVisible();
  await mobileNav.getByText('탐색', { exact: true }).click();
  await expect(mobileNav.getByRole('navigation', { name: '모바일 주요 탐색' })).toBeVisible();
  await expect(mobileNav.getByRole('link')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
