import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function activateWithKeyboard(page: Page, target: Locator, key: 'Enter' | 'Space' = 'Enter') {
  await target.focus();
  await page.keyboard.press(key);
}

async function typeWithKeyboard(page: Page, target: Locator, value: string) {
  await target.focus();
  await page.keyboard.type(value);
}

async function openLab(page: Page, path: string, progressId: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  const lab = page.locator(`[data-lab-id="${progressId}"]`);
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toBeAttached({ timeout: 15_000 });
  const island = lab.locator('xpath=ancestor::astro-island[1]');
  await expect(island).not.toHaveAttribute('ssr', '', { timeout: 15_000 });
  return lab;
}

async function expectNoPostInteractionAxeViolations(page: Page, progressId: string) {
  const audit = await new AxeBuilder({ page })
    .include(`[data-lab-id="${progressId}"]`)
    .analyze();
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
}

async function expectActualChoiceCarriersAtLeast44(lab: Locator) {
  const undersized = await lab.locator('input[type="radio"], input[type="checkbox"]').evaluateAll((inputs) => (
    inputs.flatMap((input) => {
      const rect = input.getBoundingClientRect();
      if (rect.width >= 44 && rect.height >= 44) return [];
      return [{ type: input.getAttribute('type'), width: rect.width, height: rect.height }];
    })
  ));
  expect(undersized).toEqual([]);
}

async function finishLabWithKeyboard(
  page: Page,
  lab: Locator,
  progressId: string,
  explanation: string,
) {
  await typeWithKeyboard(page, lab.getByRole('textbox', { name: '내 원인 설명' }), explanation);
  const finish = lab.getByRole('button', { name: '설명으로 완료하기' });
  await expect(finish).toBeEnabled();
  await activateWithKeyboard(page, finish);
  await expect(lab.getByText(/완료가 저장되었습니다/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}'));
  expect(stored[progressId]).toMatchObject({ completed: true });
}

const CASE_FLOWS = [
  {
    classifications: [
      [
        ['DUT gain-mode state mismatch', '중립'],
        ['RF path correction error', '반증'],
        ['RF/DC acquisition misalignment', '중립'],
        ['Supply CC or thermal droop', '중립'],
      ],
      [
        ['DUT gain-mode state mismatch', '지지'],
        ['RF path correction error', '중립'],
        ['RF/DC acquisition misalignment', '중립'],
        ['Supply CC or thermal droop', '중립'],
      ],
      [
        ['DUT gain-mode state mismatch', '중립'],
        ['RF path correction error', '중립'],
        ['RF/DC acquisition misalignment', '반증'],
        ['Supply CC or thermal droop', '중립'],
      ],
    ],
    first: 'DUT gain-mode state mismatch',
    second: 'Supply CC or thermal droop',
    confidence: 'Strongly indicated',
  },
  {
    classifications: [
      [
        ['DUT compression/nonlinearity', '중립'],
        ['Source waveform residual', '반증'],
        ['Analyzer ACLR input-range artifact', '중립'],
        ['EVM demodulation artifact', '중립'],
      ],
      [
        ['DUT compression/nonlinearity', '중립'],
        ['Source waveform residual', '중립'],
        ['Analyzer ACLR input-range artifact', '반증'],
        ['EVM demodulation artifact', '중립'],
      ],
      [
        ['DUT compression/nonlinearity', '지지'],
        ['Source waveform residual', '반증'],
        ['Analyzer ACLR input-range artifact', '중립'],
        ['EVM demodulation artifact', '중립'],
      ],
    ],
    first: 'DUT compression/nonlinearity',
    second: 'EVM demodulation artifact',
    confidence: 'Strongly indicated',
  },
  {
    classifications: [
      [
        ['PA-on TX noise contribution', '중립'],
        ['Bench leakage contribution', '중립'],
        ['Analyzer floor contribution', '반증'],
        ['Duplexer or fixture isolation shortfall', '중립'],
      ],
      [
        ['PA-on TX noise contribution', '중립'],
        ['Bench leakage contribution', '중립'],
        ['Analyzer floor contribution', '중립'],
        ['Duplexer or fixture isolation shortfall', '중립'],
      ],
      [
        ['PA-on TX noise contribution', '지지'],
        ['Bench leakage contribution', '중립'],
        ['Analyzer floor contribution', '반증'],
        ['Duplexer or fixture isolation shortfall', '지지'],
      ],
    ],
    first: 'PA-on TX noise contribution',
    second: 'Duplexer or fixture isolation shortfall',
    confidence: 'Unresolved',
  },
] as const;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.removeItem('rf-wiki:v1:progress'));
});

test('station qualification completes prediction, evidence review, report, and progress with keyboard-only controls', async ({ page }) => {
  const lab = await openLab(page, '/dvt/station-qualification/', 'dvt:station-qualification');
  await activateWithKeyboard(page, lab.getByRole('radio', { name: /검증 실패가 하나라도 있으면/ }), 'Space');
  await activateWithKeyboard(page, lab.getByRole('button', { name: '예측 고정' }));
  await expectActualChoiceCarriersAtLeast44(lab);
  const stationCheckboxes = await lab.getByRole('checkbox').all();
  await expect(stationCheckboxes[0]!).toBeFocused();
  for (const checkbox of stationCheckboxes) {
    await activateWithKeyboard(page, checkbox, 'Space');
  }
  await expect(lab.getByText(/현재 4\/4 검토/)).toBeVisible();
  await activateWithKeyboard(page, lab.getByRole('button', { name: 'Station 판정 확정' }));
  await expect(lab.getByRole('heading', { name: 'Station qualification 보고서' })).toBeVisible();
  await expect(lab.locator('[data-status="BLOCKED"]')).toBeVisible();
  await expectNoPostInteractionAxeViolations(page, 'dvt:station-qualification');
  await finishLabWithKeyboard(
    page,
    lab,
    'dvt:station-qualification',
    'Because verification evidence affected the source and acquisition stages, the displayed power result is BLOCKED, but calibration uncertainty requires requalification.',
  );
});

test('synchronized point reviews all equipment, metric, and cleanup evidence with keyboard-only controls', async ({ page }) => {
  const lab = await openLab(page, '/dvt/synchronized-test-point/', 'dvt:synchronized-test-point');
  await activateWithKeyboard(page, lab.getByRole('radio', { name: /INVALID로 보존하고 DUT KPI 계산에서 제외/ }), 'Space');
  await activateWithKeyboard(page, lab.getByRole('button', { name: '예측 고정' }));
  await expectActualChoiceCarriersAtLeast44(lab);
  const evidenceButtons = lab.getByRole('button', { name: /^증거 확인:/ });
  await expect(evidenceButtons).toHaveCount(14);
  await expect(evidenceButtons.first()).toBeFocused();
  for (const button of await evidenceButtons.all()) {
    await activateWithKeyboard(page, button);
  }
  await expect(lab.getByText(/현재 14\/14 확인/)).toBeVisible();
  await activateWithKeyboard(page, lab.getByRole('button', { name: 'Test point 유효성 확정' }));
  await expect(lab.getByRole('heading', { name: 'Synchronized test-point 보고서' })).toBeVisible();
  await expect(lab.locator('[data-status="INVALID"]')).toBeVisible();
  await expect(lab.getByText(/RF OFF · acquisition ABORTED · DUT safe bias-down/)).toBeVisible();
  await expect(lab.getByText(/n9020b-rx-noise-front-end-setup-1842/).first()).toBeVisible();
  await expect(lab.getByText(/Connector total −4\.7 dBm → input attenuation 10\.0 dB → mixer total −14\.7 dBm → station-verified boundary −10\.0 dBm/)).toBeVisible();
  await expectNoPostInteractionAxeViolations(page, 'dvt:synchronized-test-point');
  await finishLabWithKeyboard(
    page,
    lab,
    'dvt:synchronized-test-point',
    'Because trigger alignment affected the acquisition stage, the displayed ACLR point became INVALID, but latency uncertainty requires a repeat.',
  );
});

test('uncertainty decision calculates and closes a guardband verdict with keyboard-only controls', async ({ page }) => {
  const lab = await openLab(page, '/dvt/uncertainty-guardband/', 'dvt:uncertainty-guardband');
  await activateWithKeyboard(page, lab.getByRole('radio', { name: /Raw ACLR은 통과하지만 uncertainty interval이 limit과 겹쳐 INCONCLUSIVE/ }), 'Space');
  await activateWithKeyboard(page, lab.getByRole('button', { name: '예측 고정' }));
  await expectActualChoiceCarriersAtLeast44(lab);
  const calculateBudget = lab.getByRole('button', { name: '불확도 budget 계산' });
  await expect(calculateBudget).toBeFocused();
  await activateWithKeyboard(page, calculateBudget);
  await expect(lab.getByText(/Expanded uncertainty 1.00 dB · k=2/)).toBeVisible();
  await expect(lab.getByText(/계산된 interval −31\.8…−29\.8 dBc/)).toBeVisible();
  await activateWithKeyboard(page, lab.getByRole('button', { name: 'Guardband 판정 확정' }));
  await expect(lab.getByRole('heading', { name: 'Uncertainty decision 보고서' })).toBeVisible();
  await expect(lab.locator('[data-status="INCONCLUSIVE"]')).toBeVisible();
  await expectNoPostInteractionAxeViolations(page, 'dvt:uncertainty-guardband');
  await finishLabWithKeyboard(
    page,
    lab,
    'dvt:uncertainty-guardband',
    'Because the DSP uncertainty calculation changed the displayed ACLR verdict to INCONCLUSIVE, correlation uncertainty remains a measurement limit.',
  );
});

test('blind FDD capstone completes all three evidence chains with keyboard-only controls', async ({ page }) => {
  test.setTimeout(60_000);
  const lab = await openLab(page, '/dvt/fdd-dvt-conclusion/', 'dvt:fdd-dvt-conclusion');

  await activateWithKeyboard(
    page,
    lab.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/ }),
    'Space',
  );
  await activateWithKeyboard(page, lab.getByRole('button', { name: '예측 고정' }));
  await expectActualChoiceCarriersAtLeast44(lab);

  for (const [caseIndex, caseFlow] of CASE_FLOWS.entries()) {
    const initialGroup = lab.getByRole('group', { name: 'Initial hypothesis' });
    await activateWithKeyboard(page, initialGroup.getByRole('radio').first(), 'Space');
    const planGroup = lab.getByRole('group', { name: 'Next measurement + Expected signature' });
    await activateWithKeyboard(page, planGroup.getByRole('radio').first(), 'Space');
    await activateWithKeyboard(page, lab.getByRole('button', { name: '사전 계획 고정' }));

    for (const [classificationIndex, matrix] of caseFlow.classifications.entries()) {
      const evidenceOrder = classificationIndex + 1;
      await activateWithKeyboard(
        page,
        lab.getByRole('button', { name: new RegExp(`^Evidence ${evidenceOrder}:`) }),
      );
      for (const [hypothesis, effect] of matrix) {
        const effectGroup = lab.getByRole('group', { name: `${hypothesis} effect` });
        await activateWithKeyboard(page, effectGroup.getByRole('radio', { name: effect, exact: true }), 'Space');
      }
      await activateWithKeyboard(page, lab.getByRole('button', { name: 'Evidence matrix 기록' }));
    }

    const firstGroup = lab.getByRole('group', { name: '1순위 hypothesis' });
    await activateWithKeyboard(page, firstGroup.getByRole('radio', { name: caseFlow.first }), 'Space');
    const secondGroup = lab.getByRole('group', { name: '2순위 competing hypothesis' });
    await activateWithKeyboard(page, secondGroup.getByRole('radio', { name: caseFlow.second }), 'Space');
    const remaining = lab.getByRole('textbox', { name: 'False-positive / remaining uncertainty' });
    await typeWithKeyboard(page, remaining, 'Independent thermal evidence, fixture repeatability, and receiver tests remain open.');
    const confidenceGroup = lab.getByRole('group', { name: 'Confidence' });
    await activateWithKeyboard(page, confidenceGroup.getByRole('radio', { name: caseFlow.confidence }), 'Space');
    await activateWithKeyboard(page, lab.getByRole('button', { name: 'Case 결론 기록' }));
    if (caseIndex < CASE_FLOWS.length - 1) await expect(lab.getByText(`Case ${caseIndex + 2}/3`)).toBeVisible();
  }

  await typeWithKeyboard(page, lab.getByRole('textbox', { name: 'Conclusion' }), 'Gain-mode state and PA nonlinearity are evidence-bounded conclusions only.');
  await typeWithKeyboard(page, lab.getByRole('textbox', { name: 'Residual risk' }), 'Fixture temperature, radiated leakage, and receiver performance require follow-up tests.');
  await expectActualChoiceCarriersAtLeast44(lab);
  await activateWithKeyboard(
    page,
    lab.getByRole('checkbox', { name: 'Linked measurement-point cleanup evidence를 검토했습니다' }),
    'Space',
  );
  await typeWithKeyboard(page, lab.getByRole('textbox', { name: 'Next action' }), 'Repeat all cases with fixture-temperature and independent leakage evidence.');
  await typeWithKeyboard(page, lab.getByRole('textbox', { name: 'Owner' }), 'RF DVT engineer');
  await activateWithKeyboard(page, lab.getByRole('button', { name: 'Blind case 결론 확정' }));

  await expect(lab.getByRole('heading', { name: 'Blind FDD capstone 보고서' })).toBeVisible();
  await expect(lab.getByText(/desense risk budget/).first()).toBeVisible();
  await expect(lab.getByText(/9\/9 evidence accepted/)).toBeVisible();
  await expect(lab.getByText(/READY · capstone-lte-b3-fdd-sequence/).first()).toBeVisible();
  await expect(lab.getByText(/aclr-guardband-2026-07-r2: INCONCLUSIVE/).first()).toBeVisible();
  await expect(lab.getByText(/desense-isolation-risk-guardband-2026-07-r2: FAIL/).first()).toBeVisible();
  await expect(lab.getByText(/gain-pae-fail\/known-path-recheck/).first()).toBeVisible();
  await expect(lab.getByText(/capstone-independent-isolation.*risk supporting metric evidence tx-noise/i).first()).toBeVisible();
  await expect(lab.getByText(/capstone-n9020b-rx-noise-front-end-setup/).first()).toBeVisible();
  await expect(lab.getByText(/input attenuation 10\.0 dB.*preamp OFF.*reference level 0\.0 dBm/i).first()).toBeVisible();
  await expect(lab.getByText(/recorded educational setup, not an instrument performance claim/i).first()).toBeVisible();
  await expect(lab.getByText(/connector total -2\.7 dBm.*input attenuation 10\.0 dB.*mixer total -12\.7 dBm.*station-verified mixer operating boundary -10\.0 dBm/i).first()).toBeVisible();
  await expectNoPostInteractionAxeViolations(page, 'dvt:fdd-dvt-conclusion');

  await finishLabWithKeyboard(
    page,
    lab,
    'dvt:fdd-dvt-conclusion',
    'Because the evidence plan changed, the acquisition and DUT stages updated the displayed gain and ACLR report, but thermal uncertainty remains.',
  );
});
