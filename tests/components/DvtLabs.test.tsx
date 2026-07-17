import { fireEvent, render, screen, within } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRESS_STORAGE_KEY, readLearningProgress } from '../../src/lib/progress';
import {
  BlindFddCapstoneLab,
  StationQualificationLab,
  SynchronizedTestPointLab,
  UncertaintyDecisionLab,
} from '../../src/components/dvt';
import {
  CAPSTONE_EVIDENCE_LINKAGE,
  capstoneDraftStorageKey,
  deriveEvidenceConfidence,
  validateCapstoneCommit,
} from '../../src/components/dvt/BlindFddCapstoneLab';
import { CAPSTONE_SOURCE_RECORDS } from '../../src/data/dvt-capstone';
import { DVT_BUILT_IN_CASES } from '../../src/lib/rf/dvt';
import type {
  DvtConclusionEvidenceLinkage,
  DvtConclusionReport,
  DvtConclusionSourceRecords,
  DvtEvidenceClassification,
} from '../../src/types/dvt';

const EFFECT_LABELS = {
  support: '지지',
  contradict: '반증',
  neutral: '중립',
} as const;

function lockCurrentCasePlan(caseIndex: number) {
  const diagnosticCase = DVT_BUILT_IN_CASES[caseIndex]!;
  const initialGroup = screen.getByRole('group', { name: 'Initial hypothesis' });
  fireEvent.click(within(initialGroup).getByRole('radio', { name: diagnosticCase.hypotheses[0]!.label }));
  const planGroup = screen.getByRole('group', { name: 'Next measurement + Expected signature' });
  fireEvent.click(within(planGroup).getAllByRole('radio')[0]!);
  fireEvent.click(screen.getByRole('button', { name: '사전 계획 고정' }));
}

function classifyCurrentEvidence(caseIndex: number, evidenceOrder: number, tryWrongEffect = false) {
  const diagnosticCase = DVT_BUILT_IN_CASES[caseIndex]!;
  const step = diagnosticCase.steps[evidenceOrder - 1]!;
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Evidence ${evidenceOrder}:`) }));
  const wrongTarget = step.expectedEffects.find(({ effect }) => effect !== 'neutral') ?? step.expectedEffects[0]!;

  for (const expected of step.expectedEffects) {
    const hypothesisLabel = diagnosticCase.hypotheses.find(({ hypothesisId }) => hypothesisId === expected.hypothesisId)!.label;
    const effectGroup = screen.getByRole('group', { name: `${hypothesisLabel} effect` });
    const effect = tryWrongEffect && expected.hypothesisId === wrongTarget.hypothesisId
      ? expected.effect === 'support' ? 'contradict' : 'support'
      : expected.effect;
    expect(within(effectGroup).getByText(expected.rationale)).toBeVisible();
    fireEvent.click(within(effectGroup).getByRole('radio', { name: EFFECT_LABELS[effect] }));
  }

  if (tryWrongEffect) {
    fireEvent.click(screen.getByRole('button', { name: 'Evidence matrix 기록' }));
    expect(screen.getByText(/classification conflicts with built-in evidence semantics/i)).toBeVisible();
    const hypothesisLabel = diagnosticCase.hypotheses.find(({ hypothesisId }) => hypothesisId === wrongTarget.hypothesisId)!.label;
    const effectGroup = screen.getByRole('group', { name: `${hypothesisLabel} effect` });
    fireEvent.click(within(effectGroup).getByRole('radio', { name: EFFECT_LABELS[wrongTarget.effect] }));
  }

  fireEvent.click(screen.getByRole('button', { name: 'Evidence matrix 기록' }));
}

function closeCurrentCase(caseIndex: number) {
  const rankedChoices = [
    ['dut-mode-state', 'supply-thermal', 'Strongly indicated'],
    ['dut-nonlinearity', 'evm-demod-artifact', 'Strongly indicated'],
    ['pa-tx-noise', 'isolation-shortfall', 'Unresolved'],
  ] as const;
  const [firstId, secondId, confidence] = rankedChoices[caseIndex]!;
  const diagnosticCase = DVT_BUILT_IN_CASES[caseIndex]!;
  const firstLabel = diagnosticCase.hypotheses.find(({ hypothesisId }) => hypothesisId === firstId)!.label;
  const secondLabel = diagnosticCase.hypotheses.find(({ hypothesisId }) => hypothesisId === secondId)!.label;
  fireEvent.click(within(screen.getByRole('group', { name: '1순위 hypothesis' })).getByRole('radio', { name: firstLabel }));
  fireEvent.click(within(screen.getByRole('group', { name: '2순위 competing hypothesis' })).getByRole('radio', { name: secondLabel }));
  fireEvent.change(screen.getByRole('textbox', { name: /False-positive \/ remaining uncertainty/i }), {
    target: { value: 'Fixture repeatability와 thermal drift가 남아 있어 독립 재측정이 필요하다.' },
  });
  fireEvent.click(within(screen.getByRole('group', { name: 'Confidence' })).getByRole('radio', { name: confidence }));
  fireEvent.click(screen.getByRole('button', { name: 'Case 결론 기록' }));
}

function completeBlindCases() {
  fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
  fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
  for (let caseIndex = 0; caseIndex < DVT_BUILT_IN_CASES.length; caseIndex += 1) {
    lockCurrentCasePlan(caseIndex);
    for (let evidenceOrder = 1; evidenceOrder <= 3; evidenceOrder += 1) {
      classifyCurrentEvidence(caseIndex, evidenceOrder);
    }
    closeCurrentCase(caseIndex);
  }
}

function fillCompleteConclusion() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Conclusion' }), { target: { value: 'Gain-mode state와 PA nonlinearity만 evidence-bounded 수준으로 판정한다.' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Residual risk' }), { target: { value: 'Fixture temperature, radiated leakage와 실제 receiver 성능은 후속 검증이 필요하다.' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Linked measurement-point cleanup evidence를 검토했습니다' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Next action' }), { target: { value: 'Repeat the three cases with fixture-temperature and independent leakage evidence.' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Owner' }), { target: { value: 'RF DVT engineer' } });
}

function completeSourceReport(): DvtConclusionReport {
  return {
    reportId: 'dvt-capstone-source-validator-test',
    stationId: CAPSTONE_EVIDENCE_LINKAGE.stationId,
    measurementPointId: CAPSTONE_EVIDENCE_LINKAGE.measurementPointId,
    decisionIds: CAPSTONE_EVIDENCE_LINKAGE.decisions.map(({ metricId }) => metricId),
    acceptedDiagnosticEvidenceIds: DVT_BUILT_IN_CASES.flatMap((diagnosticCase) => (
      diagnosticCase.steps.map(({ expectedEvidenceId }) => expectedEvidenceId)
    )),
    sections: {
      scope: 'Built-in LTE FDD education fixture.',
      station: 'Verified manifest and revision.',
      symptom: 'Three independent DVT symptoms.',
      validity: 'Source point is valid.',
      decision: 'PASS, INCONCLUSIVE and FAIL are source-derived.',
      hypotheses: 'Competing hypotheses remain recorded.',
      evidence: 'Metric and uncertainty evidence IDs are linked.',
      conclusion: 'Only evidence-bounded conclusions are recorded.',
      residualRisk: 'Receiver performance remains open and requires a follow-up measurement.',
    },
    cleanup: CAPSTONE_EVIDENCE_LINKAGE.cleanup,
    nextAction: 'Repeat the unresolved ACLR decision with lower uncertainty.',
    owner: 'RF DVT engineer',
  };
}

describe('DVT senior labs', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps station controls locked until prediction and commits only after every qualification check', () => {
    render(<StationQualificationLab progressId="dvt:station-qualification" />);

    const calibration = screen.getByRole('checkbox', { name: /calibration artifact/i });
    const commit = screen.getByRole('button', { name: 'Station 판정 확정' });

    expect(calibration).toBeDisabled();
    expect(commit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /검증 실패가 하나라도 있으면/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));

    expect(calibration).toBeEnabled();
    expect(commit).toBeDisabled();

    fireEvent.click(calibration);
    expect(screen.getByText(/현재 1\/4 검토/)).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: /verification trace/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /working-limit headroom/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /interlock and cleanup/i }));

    expect(commit).toBeEnabled();
    fireEvent.click(commit);

    expect(screen.getByRole('heading', { name: 'Station qualification 보고서' })).toBeVisible();
    expect(screen.getByText('BLOCKED', { selector: '[data-status]' })).toHaveAttribute('data-tone', 'reverse');
    for (const model of ['N5182B', 'N9020B', 'U2061XA', 'N6705C', 'E5080B']) {
      expect(screen.getAllByText(new RegExp(model)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/N6752A.*query-back/i)).toBeVisible();
    expect(screen.getByText(/LTE analysis application/i)).toBeVisible();
    expect(screen.getByRole('textbox', { name: '내 원인 설명' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '결론 복사' })).toBeEnabled();
  });

  it('reveals synchronized evidence deterministically before validating a test point', () => {
    render(<SynchronizedTestPointLab progressId="dvt:synchronized-test-point" />);

    const revealButtons = screen.getAllByRole('button', { name: /^증거 확인:/ });
    const commit = screen.getByRole('button', { name: 'Test point 유효성 확정' });
    expect(revealButtons).toHaveLength(14);
    expect(revealButtons[0]).toBeDisabled();
    expect(commit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /INVALID로 보존하고 DUT KPI 계산에서 제외/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.click(revealButtons[0]!);
    expect(screen.getByText(/현재 1\/14 확인/)).toBeVisible();
    revealButtons.forEach((button) => fireEvent.click(button));

    expect(screen.getByText(/Trigger edge가 RF gate보다 2.4 µs 늦음/)).toBeVisible();
    expect(screen.getAllByText(/n9020b-rx-noise-front-end-setup-1842/).length).toBeGreaterThan(0);
    expect(commit).toBeEnabled();
    fireEvent.click(commit);

    expect(screen.getByRole('heading', { name: 'Synchronized test-point 보고서' })).toBeVisible();
    expect(screen.getAllByText('INVALID').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/trigger is misaligned/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: '내 원인 설명' })).toBeEnabled();
  });

  it('requires an uncertainty budget before making a guardbanded ACLR decision', () => {
    render(<UncertaintyDecisionLab progressId="dvt:uncertainty-guardband" />);

    const calculate = screen.getByRole('button', { name: '불확도 budget 계산' });
    const decide = screen.getByRole('button', { name: 'Guardband 판정 확정' });
    expect(calculate).toBeDisabled();
    expect(decide).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Raw ACLR은 통과하지만 uncertainty interval이 limit과 겹쳐 INCONCLUSIVE/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.click(calculate);

    expect(screen.getByText(/Expanded uncertainty 1.00 dB · k=2/)).toBeVisible();
    expect(screen.getByText(/계산된 interval −31\.8…−29\.8 dBc/)).toBeVisible();
    expect(decide).toBeEnabled();
    fireEvent.click(decide);

    expect(screen.getByRole('heading', { name: 'Uncertainty decision 보고서' })).toBeVisible();
    expect(screen.getAllByText('INCONCLUSIVE').length).toBeGreaterThan(0);
    expect(screen.getByText('INCONCLUSIVE', { selector: '[data-status]' })).toHaveAttribute('data-tone', 'reference');
    expect(screen.getByRole('textbox', { name: '내 원인 설명' })).toBeEnabled();
  });

  it('closes all three blind FDD cases only after paired plans, classified evidence, ranked reviews, and a complete report', () => {
    render(<BlindFddCapstoneLab progressId="dvt:fdd-dvt-conclusion" />);

    fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));

    for (let caseIndex = 0; caseIndex < DVT_BUILT_IN_CASES.length; caseIndex += 1) {
      lockCurrentCasePlan(caseIndex);

      if (caseIndex === 0) {
        fireEvent.click(screen.getByRole('button', { name: /^Evidence 2:/ }));
        expect(screen.getByText(/순서가 아닙니다/)).toBeVisible();
      }

      for (let evidenceOrder = 1; evidenceOrder <= 3; evidenceOrder += 1) {
        classifyCurrentEvidence(caseIndex, evidenceOrder, caseIndex === 0 && evidenceOrder === 1);
      }
      closeCurrentCase(caseIndex);
    }

    fillCompleteConclusion();
    const commit = screen.getByRole('button', { name: 'Blind case 결론 확정' });
    expect(commit).toBeEnabled();
    fireEvent.click(commit);
    expect(window.sessionStorage.getItem(capstoneDraftStorageKey('dvt:fdd-dvt-conclusion'))).toBeNull();

    expect(screen.getByRole('heading', { name: 'Blind FDD capstone 보고서' })).toBeVisible();
    expect(screen.getByText(/9\/9 evidence accepted/)).toBeVisible();
    expect(screen.getAllByText(/desense risk budget/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Strongly indicated/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/capstone-source-rf-off/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/The known path remains inside correction uncertainty/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/requalified-ready-2026-07-r2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/aclr-guardband-2026-07-r2: INCONCLUSIVE/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/desense-isolation-risk-guardband-2026-07-r2: FAIL/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/gain-pae-fail\/known-path-recheck/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/capstone-independent-isolation.*risk supporting metric evidence tx-noise/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/capstone-n9020b-rx-noise-front-end-setup/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/input attenuation 10\.0 dB.*preamp OFF.*reference level 0\.0 dBm/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/recorded educational setup, not an instrument performance claim/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/connector total -2\.7 dBm.*input attenuation 10\.0 dB.*mixer total -12\.7 dBm.*station-verified mixer operating boundary -10\.0 dBm/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/capstone-analyzer-mixer-limit-2026-07-r2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/capstone-analyzer-attenuation-step-status-2026-07-r2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FNV-1a 32-bit deterministic educational checksum \(non-security\).*dvt-evidence-canonical-v1/i).length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue('pa-bench-a/qualification-2026-07')).not.toBeInTheDocument();

    const explanation = screen.getByRole('textbox', { name: '내 원인 설명' });
    fireEvent.change(explanation, {
      target: { value: '측정 유효성을 확인했기 때문에 DUT와 acquisition stage의 ACLR 결과를 구분했지만 uncertainty 한계가 남는다.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '설명으로 완료하기' }));
    expect(readLearningProgress(window.localStorage)['dvt:fdd-dvt-conclusion']).toMatchObject({ completed: true });
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toContain('dvt:fdd-dvt-conclusion');
  }, 15_000);

  it('restores, explicitly resets, and rejects schema-mismatched capstone drafts', async () => {
    const progressId = 'dvt:fdd-draft-contract';
    const storageKey = capstoneDraftStorageKey(progressId);
    const first = render(<BlindFddCapstoneLab progressId={progressId} />);

    fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    lockCurrentCasePlan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Evidence 1:/ }));
    await waitFor(() => expect(JSON.parse(window.sessionStorage.getItem(storageKey) ?? '{}')).toMatchObject({
      schemaVersion: 1,
      progressId,
      currentCaseIndex: 0,
      planLocked: true,
      pendingEvidenceId: 'known-path-recheck',
    }));

    first.unmount();
    const second = render(<BlindFddCapstoneLab progressId={progressId} />);
    expect(await screen.findByRole('heading', { name: /known-path-recheck competing-hypothesis effect matrix/i })).toBeVisible();
    expect(screen.getByText(/path-correction-stable/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '초안 초기화' }));
    expect(screen.getByText(/초안을 초기화했습니다/)).toBeVisible();
    expect(screen.getByText('Case 1/3')).toBeVisible();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();

    second.unmount();
    window.sessionStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 0, progressId }));
    render(<BlindFddCapstoneLab progressId={progressId} />);
    expect(await screen.findByText(/호환되지 않거나 손상된 초안을 폐기/)).toBeVisible();
    expect(screen.getByText('Case 1/3')).toBeVisible();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('rejects malformed nested capstone draft state and source-derived conclusion drift', async () => {
    const progressId = 'dvt:nested-draft-contract';
    const storageKey = capstoneDraftStorageKey(progressId);
    const initial = render(<BlindFddCapstoneLab progressId={progressId} />);
    fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    lockCurrentCasePlan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Evidence 1:/ }));
    await waitFor(() => expect(window.sessionStorage.getItem(storageKey)).not.toBeNull());
    const validDraft = JSON.parse(window.sessionStorage.getItem(storageKey)!);
    initial.unmount();

    const malformedDrafts = [
      { ...validDraft, pendingClassification: { 'unknown-hypothesis': 'support' } },
      { ...validDraft, progress: { ...validDraft.progress, acceptedEvidenceIds: ['same-id-wrong-step'] } },
      { ...validDraft, classifications: [{ evidenceId: 'known-path-recheck', hypothesisId: 'path-correction', effect: 'contradict' }] },
      { ...validDraft, conclusionFields: { ...validDraft.conclusionFields, decisionIds: ['tampered-decision'] } },
      {
        ...validDraft,
        conclusionFields: {
          ...validDraft.conclusionFields,
          cleanup: {
            ...validDraft.conclusionFields.cleanup,
            rfOutput: { ...validDraft.conclusionFields.cleanup.rfOutput, atIso: '2026-07-17T09:00:00.000Z' },
          },
        },
      },
    ];
    for (const malformed of malformedDrafts) {
      window.sessionStorage.setItem(storageKey, JSON.stringify(malformed));
      const view = render(<BlindFddCapstoneLab progressId={progressId} />);
      expect(await screen.findByText(/호환되지 않거나 손상된 초안을 폐기/)).toBeVisible();
      expect(screen.getByText('Case 1/3')).toBeVisible();
      view.unmount();
    }
  });

  it('keeps the capstone usable when sessionStorage get, set, or remove throws SecurityError', async () => {
    const getMock = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const getView = render(<BlindFddCapstoneLab progressId="dvt:storage-get-error" />);
    expect(await screen.findByText(/초안 persistence만 비활성화/)).toBeVisible();
    expect(screen.getByText('Case 1/3')).toBeVisible();
    getView.unmount();
    getMock.mockRestore();

    const setMock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const setView = render(<BlindFddCapstoneLab progressId="dvt:storage-set-error" />);
    expect(await screen.findByText(/session storage 쓰기를 차단해 초안 persistence만 비활성화/)).toBeVisible();
    expect(screen.getByText('Case 1/3')).toBeVisible();
    setView.unmount();
    setMock.mockRestore();

    const removeView = render(<BlindFddCapstoneLab progressId="dvt:storage-remove-error" />);
    const removeMock = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    fireEvent.click(screen.getByRole('button', { name: '초안 초기화' }));
    expect(screen.getByText(/초안을 초기화했습니다/)).toBeVisible();
    expect(screen.getByText('Case 1/3')).toBeVisible();
    removeMock.mockRestore();
    removeView.unmount();
  });

  it('blocks a contradictory capstone ranking even when every field is non-empty', () => {
    render(<BlindFddCapstoneLab progressId="dvt:fdd-dvt-conclusion" />);
    fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    lockCurrentCasePlan(0);
    for (let evidenceOrder = 1; evidenceOrder <= 3; evidenceOrder += 1) classifyCurrentEvidence(0, evidenceOrder);

    const diagnosticCase = DVT_BUILT_IN_CASES[0]!;
    const weakLabel = diagnosticCase.hypotheses.find(({ hypothesisId }) => hypothesisId === 'supply-thermal')!.label;
    const secondLabel = diagnosticCase.hypotheses.find(({ hypothesisId }) => hypothesisId === 'path-correction')!.label;
    fireEvent.click(within(screen.getByRole('group', { name: '1순위 hypothesis' })).getByRole('radio', { name: weakLabel }));
    fireEvent.click(within(screen.getByRole('group', { name: '2순위 competing hypothesis' })).getByRole('radio', { name: secondLabel }));
    fireEvent.change(screen.getByRole('textbox', { name: /False-positive \/ remaining uncertainty/i }), { target: { value: 'Fixture temperature evidence가 없어 thermal mechanism은 아직 열려 있다.' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Confidence' })).getByRole('radio', { name: 'Unresolved' }));
    fireEvent.click(screen.getByRole('button', { name: 'Case 결론 기록' }));

    expect(screen.getByText(/evidence score는 0.*DUT gain-mode state mismatch는 1/)).toBeVisible();
    expect(screen.getByText('Case 1/3')).toBeVisible();
  });

  it('blocks same-ID signature and tolerance mismatches before effect classification', () => {
    const signatureRecords: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      observedCaseEvidence: CAPSTONE_SOURCE_RECORDS.observedCaseEvidence.map((record) => (
        record.evidenceId === 'known-path-recheck' && record.payload?.metric === 'typed-signature'
          ? { ...record, payload: { ...record.payload, observedSignature: 'gain-mode-query-mismatch' } }
          : record
      )),
    };
    const signatureView = render(<BlindFddCapstoneLab progressId="dvt:signature-mismatch" sourceRecords={signatureRecords} />);
    fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    lockCurrentCasePlan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Evidence 1:/ }));
    expect(screen.getByText(/locked contract와 일치하지 않아 진행과 effect classification을 차단/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: /competing-hypothesis effect matrix/i })).not.toBeInTheDocument();
    signatureView.unmount();

    const toleranceRecords: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      observedCaseEvidence: CAPSTONE_SOURCE_RECORDS.observedCaseEvidence.map((record) => (
        record.evidenceId === 'synchronized-rf-dc' && record.payload?.metric === 'synchronized-kpi'
          ? { ...record, payload: { ...record.payload, observedPaePercent: record.payload.observedPaePercent + 1 } }
          : record
      )),
    };
    render(<BlindFddCapstoneLab progressId="dvt:tolerance-mismatch" sourceRecords={toleranceRecords} />);
    fireEvent.click(screen.getByRole('radio', { name: /측정 유효성을 먼저 확인하고 경쟁 가설을 유지/i }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    lockCurrentCasePlan(0);
    classifyCurrentEvidence(0, 1);
    classifyCurrentEvidence(0, 2);
    fireEvent.click(screen.getByRole('button', { name: /^Evidence 3:/ }));
    expect(screen.getByText(/locked contract와 일치하지 않아 진행과 effect classification을 차단/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: /synchronized-rf-dc competing-hypothesis/i })).not.toBeInTheDocument();
  });

  it('cannot derive Strongly indicated or Confirmed from incomplete or all-neutral stored classifications', () => {
    const diagnosticCase = DVT_BUILT_IN_CASES[0]!;
    const incomplete: DvtEvidenceClassification[] = [{
      evidenceId: diagnosticCase.steps[1]!.expectedEvidenceId,
      hypothesisId: 'dut-mode-state',
      effect: 'support',
    }];
    const allNeutral: DvtEvidenceClassification[] = diagnosticCase.steps.flatMap((step) => (
      diagnosticCase.hypotheses.map(({ hypothesisId }) => ({
        evidenceId: step.expectedEvidenceId,
        hypothesisId,
        effect: 'neutral' as const,
      }))
    ));

    expect(deriveEvidenceConfidence(diagnosticCase, incomplete, 'dut-mode-state')).toBe('Unresolved');
    expect(deriveEvidenceConfidence(diagnosticCase, allNeutral, 'dut-mode-state')).toBe('Unresolved');
  });

  it('keeps final commit unavailable for a blocked station and invalid measurement point linkage', () => {
    const invalidLinkage = {
      ...CAPSTONE_EVIDENCE_LINKAGE,
      stationReadiness: {
        ...CAPSTONE_EVIDENCE_LINKAGE.stationReadiness,
        state: 'blocked' as const,
        blockingCapabilityIds: ['golden-through-verification'],
      },
      measurementValidation: {
        validity: 'invalid' as const,
        reasons: ['trigger alignment is invalid'],
      },
      decisions: CAPSTONE_EVIDENCE_LINKAGE.decisions.slice(0, 2),
    };
    render(<BlindFddCapstoneLab progressId="dvt:fdd-dvt-conclusion" evidenceLinkage={invalidLinkage} />);
    completeBlindCases();
    fillCompleteConclusion();

    expect(screen.getByRole('button', { name: 'Blind case 결론 확정' })).toBeDisabled();
    expect(screen.getByText(/linked station readiness must be ready/)).toBeVisible();
    expect(screen.getByText(/linked measurement point validity must be valid/)).toBeVisible();
    expect(screen.getByText(/claimed conclusion linkage does not match recomputed source-record provenance/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Blind FDD capstone 보고서' })).not.toBeInTheDocument();
  });

  it('allows a valid INCONCLUSIVE source decision when residual risk and next action are present', () => {
    const report = completeSourceReport();
    const aclrDecision = CAPSTONE_EVIDENCE_LINKAGE.decisions.find(({ metricId }) => (
      metricId === 'aclr-guardband-2026-07-r2'
    ));

    expect(aclrDecision?.validity).toBe('valid');
    expect(aclrDecision?.verdict).toBe('inconclusive');
    expect(validateCapstoneCommit(report, CAPSTONE_EVIDENCE_LINKAGE, CAPSTONE_SOURCE_RECORDS)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('blocks same-ID measured, uncertainty, verdict, limit, and cleanup tampering', () => {
    const report = completeSourceReport();
    const firstDecision = CAPSTONE_EVIDENCE_LINKAGE.decisions[0]!;
    const replaceFirstDecision = (
      replacement: DvtConclusionEvidenceLinkage['decisions'][number],
    ): DvtConclusionEvidenceLinkage => ({
      ...CAPSTONE_EVIDENCE_LINKAGE,
      decisions: [replacement, ...CAPSTONE_EVIDENCE_LINKAGE.decisions.slice(1)],
    });
    const claimedMutations: readonly DvtConclusionEvidenceLinkage[] = [
      replaceFirstDecision({
        ...firstDecision,
        measured: { unit: 'percent', valuePercent: 49 },
      }),
      replaceFirstDecision({
        ...firstDecision,
        expandedUncertainty: { unit: 'percent', valuePercent: 0.5 },
      }),
      replaceFirstDecision({
        ...firstDecision,
        verdict: 'fail',
      }),
    ];

    for (const claimed of claimedMutations) {
      const validation = validateCapstoneCommit(report, claimed, CAPSTONE_SOURCE_RECORDS);
      expect(validation.complete).toBe(false);
      expect(validation.missing).toContain('claimed conclusion linkage does not match recomputed source-record provenance');
    }

    const limitTamperedRecords: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      decisionSources: CAPSTONE_SOURCE_RECORDS.decisionSources.map((source, index) => index === 0 ? {
        ...source,
        decisionRule: { ...source.decisionRule, lowerLimit: { unit: 'percent', valuePercent: 40 } },
      } : source),
    };
    const limitValidation = validateCapstoneCommit(report, CAPSTONE_EVIDENCE_LINKAGE, limitTamperedRecords);
    expect(limitValidation.complete).toBe(false);
    expect(limitValidation.missing).toContain('claimed conclusion linkage does not match recomputed source-record provenance');

    const cleanupTamperedReport: DvtConclusionReport = {
      ...report,
      cleanup: {
        ...report.cleanup,
        rfOutput: { ...report.cleanup.rfOutput, atIso: '2026-07-17T09:30:00.000Z' },
      },
    };
    const cleanupValidation = validateCapstoneCommit(
      cleanupTamperedReport,
      CAPSTONE_EVIDENCE_LINKAGE,
      CAPSTONE_SOURCE_RECORDS,
    );
    expect(cleanupValidation.complete).toBe(false);
    expect(cleanupValidation.missing).toContain('report cleanup does not exactly match linked point cleanup');
  });

  it('blocks same-ID observed payload, EVM provenance, accessory, headroom, baseline, cleanup, and isolation tampering', () => {
    const report = completeSourceReport();
    const expectBlocked = (records: DvtConclusionSourceRecords) => {
      const validation = validateCapstoneCommit(report, CAPSTONE_EVIDENCE_LINKAGE, records);
      expect(validation.complete).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
      return validation;
    };

    const observedTamper: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      observedCaseEvidence: CAPSTONE_SOURCE_RECORDS.observedCaseEvidence.map((record, index) => (
        index === 0 && record.payload?.metric === 'typed-signature'
          ? { ...record, payload: { ...record.payload, observation: 'Same ID, edited observed value.' } }
          : record
      )),
    };
    expect(expectBlocked(observedTamper).missing).toContain(
      'claimed conclusion linkage does not match recomputed source-record provenance',
    );

    const evmResidual = CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.find(({ metric }) => metric === 'evm-residual')!;
    const evmResidualMutations = [
      { value: (evmResidual.value ?? 0) + 0.1 },
      { instrumentQueryBackEvidenceId: 'same-id-edited-query-back' },
      { applicationEvidenceId: 'same-id-edited-application' },
      { waveformId: 'same-id-edited-waveform' },
    ] as const;
    for (const mutation of evmResidualMutations) {
      expectBlocked({
        ...CAPSTONE_SOURCE_RECORDS,
        externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
          record.evidenceId === evmResidual.evidenceId ? { ...record, ...mutation } : record
        )),
      });
    }

    const outputAccessory = CAPSTONE_SOURCE_RECORDS.stationManifest.accessories.find(({ role }) => role === 'output-attenuator')!;
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      stationManifest: {
        ...CAPSTONE_SOURCE_RECORDS.stationManifest,
        accessories: CAPSTONE_SOURCE_RECORDS.stationManifest.accessories.map((accessory) => (
          accessory.accessoryEvidenceId === outputAccessory.accessoryEvidenceId
            ? { ...accessory, maximumInputPowerDbm: 20 }
            : accessory
        )),
      },
    });
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      measurementPoint: {
        ...CAPSTONE_SOURCE_RECORDS.measurementPoint,
        analyzerHeadroom: {
          ...CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom,
          inputAttenuationDb: CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.inputAttenuationDb + 1,
        },
      },
    });
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.evidenceId
          ? { ...record, evidenceKind: 'station-verification' }
          : record
      )),
    });
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.operatingLimitEvidenceId
          ? { ...record, value: (record.value ?? 0) + 1 }
          : record
      )),
    });
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.residualState.evidenceId
          ? { ...record, observedAtIso: '2026-07-17T08:00:01.599Z' }
          : record
      )),
    });

    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      measurementPoint: {
        ...CAPSTONE_SOURCE_RECORDS.measurementPoint,
        analyzerHeadroom: {
          ...CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom,
          mixerTotalPowerDbm: CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.mixerTotalPowerDbm + 0.1,
        },
      },
    });

    const floorEvidenceId = CAPSTONE_SOURCE_RECORDS.desenseEvidence!.floorEvidenceId;
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === floorEvidenceId ? { ...record, value: (record.value ?? 0) + 1 } : record
      )),
    });
    const paeUncertainty = CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.find(({ evidenceId }) => (
      evidenceId === 'capstone-pae-repeatability-study'
    ))!;
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === paeUncertainty.evidenceId ? { ...record, value: (record.value ?? 0) + 0.1 } : record
      )),
    });
    const cleanupRecord = CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.find(({ evidenceId }) => (
      evidenceId === CAPSTONE_SOURCE_RECORDS.measurementPoint.cleanup.rfOutput.evidenceId
    ))!;
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === cleanupRecord.evidenceId ? { ...record, cleanupStatus: 'on' } : record
      )),
    });

    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.filter(({ evidenceId }) => (
        evidenceId !== CAPSTONE_SOURCE_RECORDS.measurementPoint.cleanup.rfOutput.evidenceId
      )),
    });
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: [
        ...CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry,
        CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry[0]!,
      ],
    });
    expectBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      independentIsolationEvidence: CAPSTONE_SOURCE_RECORDS.independentIsolationEvidence.map((record) => ({
        ...record,
        dutControlStateId: 'same-id-edited-control-state',
      })),
    });
  });

  it('rejects missing, expired, wrong-asset, and wrong-source independent isolation provenance', () => {
    const report = completeSourceReport();
    const expectIsolationBlocked = (records: DvtConclusionSourceRecords, reason: RegExp) => {
      const validation = validateCapstoneCommit(report, CAPSTONE_EVIDENCE_LINKAGE, records);
      expect(validation.complete).toBe(false);
      expect(validation.missing.join(' · ')).toMatch(reason);
    };
    expectIsolationBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      stationManifest: {
        ...CAPSTONE_SOURCE_RECORDS.stationManifest,
        calibrations: CAPSTONE_SOURCE_RECORDS.stationManifest.calibrations.filter(({ calibrationEvidenceId }) => (
          calibrationEvidenceId !== 'capstone-vna-cal'
        )),
      },
    }, /calibration is missing/i);
    expectIsolationBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      stationManifest: {
        ...CAPSTONE_SOURCE_RECORDS.stationManifest,
        calibrations: CAPSTONE_SOURCE_RECORDS.stationManifest.calibrations.map((calibration) => (
          calibration.calibrationEvidenceId === 'capstone-vna-cal'
            ? { ...calibration, validThroughIso: '2026-07-17T07:00:00.000Z' }
            : calibration
        )),
      },
    }, /outside its validity window/i);
    expectIsolationBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      stationManifest: {
        ...CAPSTONE_SOURCE_RECORDS.stationManifest,
        calibrations: CAPSTONE_SOURCE_RECORDS.stationManifest.calibrations.map((calibration) => (
          calibration.calibrationEvidenceId === 'capstone-vna-cal'
            ? { ...calibration, assetId: 'capstone-analyzer-n9020b' }
            : calibration
        )),
      },
    }, /wrong asset/i);
    expectIsolationBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      independentIsolationEvidence: CAPSTONE_SOURCE_RECORDS.independentIsolationEvidence.map((record) => ({
        ...record,
        excitation: { ...record.excitation, sourceAssetId: 'capstone-source-n5182b' },
      })),
    }, /network-analyzer stimulus-source role|wrong asset/i);
    expectIsolationBlocked({
      ...CAPSTONE_SOURCE_RECORDS,
      independentIsolationEvidence: CAPSTONE_SOURCE_RECORDS.independentIsolationEvidence.map((record) => ({
        ...record,
        excitation: { ...record.excitation, sourceQueryBackEvidenceId: 'wrong-query-back' },
      })),
    }, /query-back is not verified/i);
  });

  it('blocks accepted-step and diagnostic source-mapping drift', () => {
    const report = completeSourceReport();
    const missingStepReport: DvtConclusionReport = {
      ...report,
      acceptedDiagnosticEvidenceIds: report.acceptedDiagnosticEvidenceIds.slice(0, -1),
    };
    const missingStepValidation = validateCapstoneCommit(
      missingStepReport,
      CAPSTONE_EVIDENCE_LINKAGE,
      CAPSTONE_SOURCE_RECORDS,
    );
    expect(missingStepValidation.complete).toBe(false);
    expect(missingStepValidation.missing.length).toBeGreaterThan(0);

    const jointlyRemovedStepValidation = validateCapstoneCommit(
      missingStepReport,
      CAPSTONE_EVIDENCE_LINKAGE,
      {
        ...CAPSTONE_SOURCE_RECORDS,
        diagnosticEvidenceSources: CAPSTONE_SOURCE_RECORDS.diagnosticEvidenceSources.slice(0, -1),
      },
    );
    expect(jointlyRemovedStepValidation.complete).toBe(false);
    expect(jointlyRemovedStepValidation.missing).toContain(
      'diagnostic evidence sources must exactly cover the ordered nine-step contract',
    );

    const claimedMappingTamper: DvtConclusionEvidenceLinkage = {
      ...CAPSTONE_EVIDENCE_LINKAGE,
      diagnosticEvidenceSources: CAPSTONE_EVIDENCE_LINKAGE.diagnosticEvidenceSources.map((source, index) => index === 0 ? {
        ...source,
        sourceExternalEvidenceIds: ['capstone-unregistered-path-check'],
      } : source),
    };
    const mappingValidation = validateCapstoneCommit(
      report,
      claimedMappingTamper,
      CAPSTONE_SOURCE_RECORDS,
    );
    expect(mappingValidation.complete).toBe(false);
    expect(mappingValidation.missing).toContain(
      'claimed conclusion linkage does not match recomputed source-record provenance',
    );
  });

  it('blocks desense waveform, Pout, mode, supply, noise, and isolation-source tampering', () => {
    const report = completeSourceReport();
    const desense = CAPSTONE_SOURCE_RECORDS.desenseEvidence!;
    const tamperedDesenseRecords: readonly DvtConclusionSourceRecords[] = [
      { ...CAPSTONE_SOURCE_RECORDS, desenseEvidence: { ...desense, txWaveformId: 'TAMPERED_WAVEFORM' } },
      { ...CAPSTONE_SOURCE_RECORDS, desenseEvidence: { ...desense, txOutputPowerDbm: desense.txOutputPowerDbm + 1 } },
      { ...CAPSTONE_SOURCE_RECORDS, desenseEvidence: { ...desense, txModeId: 'tampered-mode' } },
      { ...CAPSTONE_SOURCE_RECORDS, desenseEvidence: { ...desense, supplyStateId: 'tampered-supply' } },
      {
        ...CAPSTONE_SOURCE_RECORDS,
        desenseEvidence: {
          ...desense,
          noiseMeasurement: { convention: 'density', densityDbmPerHz: -124 },
        },
      },
      { ...CAPSTONE_SOURCE_RECORDS, desenseEvidence: { ...desense, isolationEvidenceId: 'tampered-isolation' } },
    ];

    for (const records of tamperedDesenseRecords) {
      const validation = validateCapstoneCommit(report, CAPSTONE_EVIDENCE_LINKAGE, records);
      expect(validation.complete).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
    }
  });

  it('blocks TX-noise front-end setup drift through typed baseline linkage', () => {
    const report = completeSourceReport();
    const setupTamperedRecords: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      measurementPoint: {
        ...CAPSTONE_SOURCE_RECORDS.measurementPoint,
        metricEvidence: CAPSTONE_SOURCE_RECORDS.measurementPoint.metricEvidence.map((evidence) => (
          evidence.metric === 'tx-noise'
            ? {
                ...evidence,
                analyzerFrontEndSetup: {
                  ...evidence.analyzerFrontEndSetup,
                  setupEvidenceId: 'unregistered-front-end-setup',
                },
              }
            : evidence
        )),
      },
    };

    const validation = validateCapstoneCommit(
      report,
      CAPSTONE_EVIDENCE_LINKAGE,
      setupTamperedRecords,
    );
    expect(validation.complete).toBe(false);
    expect(validation.missing.join(' · ')).toMatch(/typed analyzer-floor baseline for the current setup/i);
  });
});
