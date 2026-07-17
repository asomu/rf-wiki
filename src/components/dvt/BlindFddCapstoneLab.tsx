import { useMemo, useState } from 'react';
import {
  advanceDiagnosticCase,
  buildConclusionEvidenceLinkage,
  DVT_BUILT_IN_CASES,
  validateConclusionSourceRecords,
  validateDiagnosticPlan,
  validateEvidenceClassification,
} from '@/lib/rf/dvt';
import { CAPSTONE_SOURCE_RECORDS } from '@/data/dvt-capstone';
import type {
  DvtCaseHypothesis,
  DvtConclusionEvidenceLinkage,
  DvtConclusionSourceRecords,
  DvtDiagnosticCase,
  DvtDiagnosticProgress,
  DvtEvidenceClassification,
  DvtExpectedEvidence,
  DvtHypothesisEffect,
} from '@/types/dvt';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { LabShell } from '../lab/LabShell';
import type { LedgerEntry } from '../lab/types';
import {
  DVT_CONCLUSION_SECTION_LABELS,
  describeTxNoiseAnalyzerFrontEndSetup,
  DvtConclusionReport,
  validateDvtConclusion,
  type DvtConclusionFields,
  type DvtConclusionSectionId,
  type DvtConclusionValidation,
} from './DvtConclusionReport';
import type { DvtLabProps } from './StationQualificationLab';

interface CaseReview {
  readonly caseId: string;
  readonly reportLabel: string;
  readonly initialHypothesisId: string;
  readonly plannedStepId: string;
  readonly firstHypothesisId: string;
  readonly secondHypothesisId: string;
  readonly remainingUncertainty: string;
  readonly confidence: ConfidenceLabel;
  readonly classifications: readonly DvtEvidenceClassification[];
  readonly acceptedEvidenceIds: readonly string[];
}

type PendingClassificationMatrix = Readonly<Record<string, DvtHypothesisEffect | undefined>>;

export type ConfidenceLabel = 'Confirmed' | 'Strongly indicated' | 'Unresolved';

const CASE_REPORT_LABELS: Readonly<Record<string, string>> = {
  'gain-pae-fail': 'Gain·PAE fail',
  'evm-aclr-fail': 'EVM·ACLR fail',
  'desense-risk-budget': 'desense risk budget',
};

const EFFECT_LABELS: Readonly<Record<DvtHypothesisEffect, string>> = {
  support: '지지',
  contradict: '반증',
  neutral: '중립',
};

export const CAPSTONE_EVIDENCE_LINKAGE = buildConclusionEvidenceLinkage(CAPSTONE_SOURCE_RECORDS);

export function validateCapstoneCommit(
  fields: DvtConclusionFields,
  linkage: DvtConclusionEvidenceLinkage,
  sourceRecords: DvtConclusionSourceRecords = CAPSTONE_SOURCE_RECORDS,
): DvtConclusionValidation {
  const base = validateDvtConclusion(fields, linkage);
  const provenance = validateConclusionSourceRecords(fields, sourceRecords, linkage);
  const missing = [...new Set([...base.missing, ...provenance.reasons])];
  return { complete: base.complete && provenance.valid, missing };
}

const EMPTY_SECTIONS: DvtConclusionFields['sections'] = {
  scope: '',
  station: '',
  symptom: '',
  validity: '',
  decision: '',
  hypotheses: '',
  evidence: '',
  conclusion: '',
  residualRisk: '',
};

const EMPTY_CONCLUSION: DvtConclusionFields = {
  reportId: 'dvt-fdd-evidence-bounded-ready-01',
  stationId: CAPSTONE_EVIDENCE_LINKAGE.stationId,
  measurementPointId: CAPSTONE_EVIDENCE_LINKAGE.measurementPointId,
  decisionIds: CAPSTONE_EVIDENCE_LINKAGE.decisions.map(({ metricId }) => metricId),
  acceptedDiagnosticEvidenceIds: [],
  sections: EMPTY_SECTIONS,
  cleanup: CAPSTONE_EVIDENCE_LINKAGE.cleanup,
  nextAction: '',
  owner: '',
};

function newProgress(diagnosticCase: DvtDiagnosticCase): DvtDiagnosticProgress {
  return {
    caseId: diagnosticCase.id,
    nextStepIndex: 0,
    acceptedEvidenceIds: [],
    accepted: false,
    complete: false,
  };
}

function evidenceSummary(evidence: DvtExpectedEvidence): string {
  switch (evidence.metric) {
    case 'typed-signature':
      return `${evidence.signature} · ${evidence.expectedObservation}`;
    case 'pae':
      return `PAE ${evidence.valuePercent.toFixed(1)}% · tolerance ±${evidence.tolerancePercent.toFixed(1)}%p`;
    case 'p1db-input':
      return `P1dB input ${evidence.valueDbm.toFixed(2)} dBm · tolerance ±${evidence.toleranceDb.toFixed(2)} dB`;
    case 'im3':
      return `IM3 ${evidence.valueDbc.toFixed(1)} dBc · tolerance ±${evidence.toleranceDb.toFixed(1)} dB`;
    case 'synchronized-kpi':
      return `Pin·Pout·VDD·IDD ${evidence.acquisitionMode} · trigger repeatability ≤${(evidence.maximumTriggerRepeatabilitySeconds * 1e6).toFixed(2)} µs · ${evidence.observedSupplyRegulationMode} · gain droop ${evidence.gainDroopDbAcrossAperture.toFixed(2)} dB · fixture temperature ${evidence.fixtureTemperatureEvidence}; thermal claim ${evidence.thermalMechanismClaimAllowed ? 'allowed' : 'blocked'}`;
    case 'analyzer-attenuation-step':
      return `Attenuation +${evidence.attenuationStepDeltaDb.toFixed(0)} dB · corrected ACLR Δ${evidence.correctedAclrDeltaDb.toFixed(2)} dB · repeatability ${evidence.repeatabilityDb.toFixed(2)} dB · U ${evidence.expandedUncertaintyDb.toFixed(2)} dB · mixer/noise headroom ${evidence.mixerHeadroomAfterDb.toFixed(1)}/${evidence.noiseFloorHeadroomAfterDb.toFixed(1)} dB`;
    case 'desense-risk-budget':
      return `Point ${evidence.measurementPointId} · TX ${(evidence.txCarrierFrequencyHz / 1e9).toFixed(3)} GHz ${evidence.txWaveformId} ${evidence.txOutputPowerDbm.toFixed(1)} dBm ${evidence.txModeId}/${evidence.supplyStateId} · RX ${(evidence.rxFrequencyRangeHz.startHz / 1e9).toFixed(3)}…${(evidence.rxFrequencyRangeHz.stopHz / 1e9).toFixed(3)} GHz · noise ${evidence.noiseMeasurement.convention === 'density' ? `${evidence.noiseMeasurement.densityDbmPerHz.toFixed(1)} dBm/Hz` : `${evidence.noiseMeasurement.integratedNoisePowerDbm.toFixed(1)} dBm in ${evidence.noiseMeasurement.equivalentNoiseBandwidthHz.toFixed(0)} Hz ENBW`} at ${(evidence.noiseMeasurementFrequencyHz / 1e9).toFixed(3)} GHz · isolation ${evidence.txToRxIsolationDb.toFixed(0)} dB vs educational ${evidence.educationalIsolationTargetDb.toFixed(0)} dB target (${evidence.isolationEvidenceId}) · floor ${evidence.floorEvidenceId} · U(noise/isolation) ${evidence.noiseExpandedUncertaintyDb.toFixed(1)}/${evidence.isolationExpandedUncertaintyDb.toFixed(1)} dB · risk-budget-only`;
  }
}

function hypothesisLabel(diagnosticCase: DvtDiagnosticCase, hypothesisId: string): string {
  return diagnosticCase.hypotheses.find((hypothesis) => hypothesis.hypothesisId === hypothesisId)?.label
    ?? hypothesisId;
}

function classificationMatrixIsComplete(
  diagnosticCase: DvtDiagnosticCase,
  classifications: readonly DvtEvidenceClassification[],
): boolean {
  const expectedKeys = new Set(diagnosticCase.steps.flatMap((step) => (
    diagnosticCase.hypotheses.map(({ hypothesisId }) => `${step.expectedEvidenceId}:${hypothesisId}`)
  )));
  const actualKeys = new Set(classifications.map(({ evidenceId, hypothesisId }) => `${evidenceId}:${hypothesisId}`));
  return classifications.length === expectedKeys.size
    && actualKeys.size === expectedKeys.size
    && [...expectedKeys].every((key) => actualKeys.has(key));
}

function evidenceScores(
  diagnosticCase: DvtDiagnosticCase,
  classifications: readonly DvtEvidenceClassification[],
): ReadonlyMap<string, number> {
  const scores = new Map(diagnosticCase.hypotheses.map(({ hypothesisId }) => [hypothesisId, 0]));
  for (const classification of classifications) {
    if (!scores.has(classification.hypothesisId)) continue;
    const delta = classification.effect === 'support' ? 1 : classification.effect === 'contradict' ? -1 : 0;
    scores.set(classification.hypothesisId, (scores.get(classification.hypothesisId) ?? 0) + delta);
  }
  return scores;
}

export function deriveEvidenceConfidence(
  diagnosticCase: DvtDiagnosticCase,
  classifications: readonly DvtEvidenceClassification[],
  firstHypothesisId: string,
): ConfidenceLabel {
  if (!classificationMatrixIsComplete(diagnosticCase, classifications)) return 'Unresolved';
  if (classifications.every(({ effect }) => effect === 'neutral')) return 'Unresolved';
  const scores = evidenceScores(diagnosticCase, classifications);
  const leadScore = scores.get(firstHypothesisId) ?? 0;
  const otherScores = [...scores.entries()]
    .filter(([hypothesisId]) => hypothesisId !== firstHypothesisId)
    .map(([, score]) => score);
  const runnerUp = Math.max(...otherScores, Number.NEGATIVE_INFINITY);
  const supportCount = classifications.filter(({ hypothesisId, effect }) => (
    hypothesisId === firstHypothesisId && effect === 'support'
  )).length;
  const allAlternativesContradicted = diagnosticCase.hypotheses
    .filter(({ hypothesisId }) => hypothesisId !== firstHypothesisId)
    .every(({ hypothesisId }) => (scores.get(hypothesisId) ?? 0) < 0);
  if (supportCount >= 2 && allAlternativesContradicted) return 'Confirmed';
  if (leadScore > 0 && leadScore > runnerUp) return 'Strongly indicated';
  return 'Unresolved';
}

function validateRankedReview(
  diagnosticCase: DvtDiagnosticCase,
  classifications: readonly DvtEvidenceClassification[],
  firstHypothesisId: string,
  secondHypothesisId: string,
  confidence: ConfidenceLabel,
): { valid: boolean; reason: string } {
  if (!classificationMatrixIsComplete(diagnosticCase, classifications)) {
    return { valid: false, reason: '모든 evidence와 competing hypothesis의 effect matrix를 기록해야 ranking을 닫을 수 있습니다.' };
  }
  const scores = evidenceScores(diagnosticCase, classifications);
  const ranked = [...diagnosticCase.hypotheses].sort((left, right) => (
    (scores.get(right.hypothesisId) ?? 0) - (scores.get(left.hypothesisId) ?? 0)
  ));
  const expectedFirst = ranked[0];
  const expectedScore = expectedFirst ? scores.get(expectedFirst.hypothesisId) ?? 0 : 0;
  const selectedScore = scores.get(firstHypothesisId) ?? 0;
  if (expectedFirst && selectedScore < expectedScore) {
    return {
      valid: false,
      reason: `${hypothesisLabel(diagnosticCase, firstHypothesisId)}의 evidence score는 ${selectedScore}, ${expectedFirst.label}는 ${expectedScore}입니다. 지지·반증 결과와 맞도록 1순위를 수정하세요.`,
    };
  }
  const remainingRanked = ranked.filter(({ hypothesisId }) => hypothesisId !== firstHypothesisId);
  const expectedSecond = remainingRanked[0];
  const expectedSecondScore = expectedSecond ? scores.get(expectedSecond.hypothesisId) ?? 0 : 0;
  const selectedSecondScore = scores.get(secondHypothesisId) ?? 0;
  if (expectedSecond && selectedSecondScore < expectedSecondScore) {
    return {
      valid: false,
      reason: `${hypothesisLabel(diagnosticCase, secondHypothesisId)}의 evidence score는 ${selectedSecondScore}, 남은 경쟁 가설 ${expectedSecond.label}는 ${expectedSecondScore}입니다. 2순위도 지지·반증 결과에 맞춰 수정하세요.`,
    };
  }
  const expectedConfidence = deriveEvidenceConfidence(diagnosticCase, classifications, firstHypothesisId);
  if (confidence !== expectedConfidence) {
    return {
      valid: false,
      reason: `현재 evidence 분리력은 ${expectedConfidence}입니다. ${confidence}는 대체 가설 제거 수준과 맞지 않으므로 confidence를 수정하세요.`,
    };
  }
  return { valid: true, reason: 'Evidence score와 confidence가 일치합니다.' };
}

function buildConclusion(
  reviews: readonly CaseReview[],
  linkage: DvtConclusionEvidenceLinkage,
): DvtConclusionFields {
  const hypothesisSummary = reviews.map((review) => {
    const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === review.caseId)!;
    return `${review.reportLabel}: initial ${hypothesisLabel(diagnosticCase, review.initialHypothesisId)} → 1) ${hypothesisLabel(diagnosticCase, review.firstHypothesisId)}, 2) ${hypothesisLabel(diagnosticCase, review.secondHypothesisId)} · ${review.confidence} · remaining ${review.remainingUncertainty}`;
  }).join(' / ');
  const evidenceSummaryText = reviews.map((review) => {
    const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === review.caseId)!;
    const observations = review.acceptedEvidenceIds.map((evidenceId) => {
      const step = diagnosticCase.steps.find(({ expectedEvidenceId }) => expectedEvidenceId === evidenceId)!;
      const matrix = step.expectedEffects.map((contract) => {
        const classification = review.classifications.find(({ evidenceId: classifiedId, hypothesisId }) => (
          classifiedId === evidenceId && hypothesisId === contract.hypothesisId
        ));
        return `${hypothesisLabel(diagnosticCase, contract.hypothesisId)}:${classification?.effect ?? 'unrecorded'} (${contract.rationale})`;
      }).join(', ');
      return `${evidenceId} [${evidenceSummary(step.expectedEvidence)}] → ${matrix}`;
    }).join('; ');
    return `${review.reportLabel}: plan ${review.plannedStepId}; ${observations}`;
  }).join(' / ');
  return {
    ...EMPTY_CONCLUSION,
    stationId: linkage.stationId,
    measurementPointId: linkage.measurementPointId,
    decisionIds: linkage.decisions.map(({ metricId }) => metricId),
    acceptedDiagnosticEvidenceIds: reviews.flatMap(({ acceptedEvidenceIds }) => acceptedEvidenceIds),
    cleanup: linkage.cleanup,
    sections: {
      scope: 'One requalified LTE FDD PAMiD multi-metric point with three investigation threads; compliance waveform or product disposition is out of scope.',
      station: `Requalified station ${linkage.stationId} · revision ${linkage.stationRevisionId} · ${linkage.stationReadiness.state.toUpperCase()} · ${linkage.stationReadiness.evidence.join(', ')}. 이전 BLOCKED qualification revision과 혼동하지 않는다.`,
      symptom: '같은 multi-metric point에서 Gain·PAE, EVM·ACLR과 TX-noise/RX-branch risk의 세 investigation thread를 분리했다.',
      validity: `Measurement point ${linkage.measurementPointId} · ${linkage.measurementValidation.validity.toUpperCase()}. Paired plan 3개와 ordered evidence 9개의 full effect matrix가 validator를 통과했지만 실제 DUT raw trace와 조직 sign-off를 대신하지 않는다.`,
      decision: `Guardband linkage · ${linkage.decisions.map(({ metricId, verdict }) => `${metricId}:${verdict.toUpperCase()}`).join(', ')}. INCONCLUSIVE는 유효한 측정의 uncertainty overlap으로 보고하고 residual risk와 next action을 닫는다. TX-noise decision은 sensitivity/BLER가 아닌 RX-branch risk budget으로만 사용한다.`,
      hypotheses: hypothesisSummary,
      evidence: evidenceSummaryText,
      conclusion: '',
      residualRisk: '',
    },
  };
}

function HypothesisChoices({
  legend,
  name,
  hypotheses,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  hypotheses: readonly DvtCaseHypothesis[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="dvt-choice-field">
      <legend>{legend}</legend>
      {hypotheses.map((hypothesis) => (
        <label key={hypothesis.hypothesisId}>
          <input
            type="radio"
            name={name}
            value={hypothesis.hypothesisId}
            checked={value === hypothesis.hypothesisId}
            onChange={() => onChange(hypothesis.hypothesisId)}
          />
          <span>{hypothesis.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

interface BlindControlsProps {
  currentCase: DvtDiagnosticCase | undefined;
  caseIndex: number;
  progress: DvtDiagnosticProgress | null;
  initialHypothesisId: string;
  plannedStepId: string;
  planLocked: boolean;
  pendingEvidenceId: string;
  pendingClassification: PendingClassificationMatrix;
  classifications: readonly DvtEvidenceClassification[];
  firstHypothesisId: string;
  secondHypothesisId: string;
  remainingUncertainty: string;
  confidence: ConfidenceLabel | '';
  conclusionFields: DvtConclusionFields;
  evidenceLinkage: DvtConclusionEvidenceLinkage;
  sourceRecords: DvtConclusionSourceRecords;
  cleanupAcknowledged: boolean;
  committed: boolean;
  message: string;
  onInitialHypothesisChange: (value: string) => void;
  onPlannedStepChange: (value: string) => void;
  onLockPlan: () => void;
  onEvidence: (evidenceId: string) => void;
  onPendingClassificationChange: (hypothesisId: string, effect: DvtHypothesisEffect) => void;
  onRecordClassification: () => void;
  onReviewChange: (field: 'firstHypothesisId' | 'secondHypothesisId' | 'remainingUncertainty' | 'confidence', value: string) => void;
  onCloseCase: () => void;
  onConclusionChange: (fields: DvtConclusionFields) => void;
  onCleanupAcknowledgedChange: (acknowledged: boolean) => void;
  onCommit: () => void;
}

function BlindControls(props: BlindControlsProps) {
  const reportInteraction = useLabControlInteraction();
  const {
    currentCase, caseIndex, progress, initialHypothesisId, plannedStepId, planLocked,
    pendingEvidenceId, pendingClassification, classifications, firstHypothesisId,
    secondHypothesisId, remainingUncertainty, confidence, conclusionFields,
    evidenceLinkage, sourceRecords, cleanupAcknowledged, committed, message,
  } = props;
  const conclusionValidation = validateCapstoneCommit(conclusionFields, evidenceLinkage, sourceRecords);
  const commitReady = conclusionValidation.complete && cleanupAcknowledged;
  const planReady = initialHypothesisId.length > 0 && plannedStepId.length > 0;
  const pendingMatrixReady = currentCase?.hypotheses.every(({ hypothesisId }) => (
    pendingClassification[hypothesisId] !== undefined
  )) ?? false;
  const reviewReady = progress?.complete === true
    && currentCase !== undefined
    && classificationMatrixIsComplete(currentCase, classifications)
    && firstHypothesisId.length > 0
    && secondHypothesisId.length > 0
    && firstHypothesisId !== secondHypothesisId
    && remainingUncertainty.trim().length >= 12
    && confidence.length > 0;

  if (!currentCase || !progress) {
    return (
      <div className="dvt-capstone-controls">
        <p className="dvt-case-progress">3/3 case evidence chains closed</p>
        <div className="dvt-conclusion-fields">
          <label className="dvt-field"><span>Report ID</span><input readOnly value={conclusionFields.reportId} /></label>
          <label className="dvt-field"><span>Station ID</span><input readOnly value={conclusionFields.stationId} /></label>
          <label className="dvt-field"><span>Station revision ID</span><input readOnly value={evidenceLinkage.stationRevisionId} /></label>
          <label className="dvt-field"><span>Measurement point ID</span><input readOnly value={conclusionFields.measurementPointId} /></label>
          <label className="dvt-field"><span>Decision IDs</span><input readOnly value={conclusionFields.decisionIds.join(', ')} /></label>
          <label className="dvt-field"><span>Accepted diagnostic evidence IDs</span><textarea readOnly rows={3} value={conclusionFields.acceptedDiagnosticEvidenceIds.join('\n')} /></label>
          <label className="dvt-field"><span>Station readiness linkage</span><input readOnly value={`${evidenceLinkage.stationReadiness.state.toUpperCase()} · ${evidenceLinkage.stationReadiness.evidence.join(', ')}`} /></label>
          <label className="dvt-field"><span>Measurement point linkage</span><input readOnly value={`${evidenceLinkage.measurementValidation.validity.toUpperCase()} · ${evidenceLinkage.measurementValidation.reasons.join(', ') || 'all validity gates closed'}`} /></label>
          <label className="dvt-field"><span>Guardband decision linkages</span><textarea readOnly rows={5} value={evidenceLinkage.decisions.map(({ metricId, verdict, measured, expandedUncertainty }, index) => {
            const source = evidenceLinkage.decisionSources[index];
            return `${metricId}: ${verdict.toUpperCase()} · measured ${JSON.stringify(measured)} · U ${JSON.stringify(expandedUncertainty)} · point ${source?.sourceMeasurementPointId ?? 'missing'} · metric ${source?.sourceMetricEvidenceIds.join('+') ?? 'missing'} · external ${source?.sourceExternalEvidenceIds.join('+') ?? 'missing'} · uncertainty ${source?.uncertaintySourceEvidenceIds.join('+') ?? 'missing'}`;
          }).join('\n')} /></label>
          <label className="dvt-field"><span>9-step source mapping</span><textarea readOnly rows={9} value={evidenceLinkage.diagnosticEvidenceSources.map((source) => `${source.caseId}/${source.evidenceId} → point ${source.sourceMeasurementPointId} · metric ${source.sourceMetricEvidenceIds.join('+') || 'none'} · external ${source.sourceExternalEvidenceIds.join('+') || 'none'} · decision ${source.decisionMetricId ?? 'none'}`).join('\n')} /></label>
          <label className="dvt-field"><span>N9020B RX-band noise recorded setup</span><textarea readOnly rows={3} value={describeTxNoiseAnalyzerFrontEndSetup(sourceRecords)} /></label>
          {(Object.entries(DVT_CONCLUSION_SECTION_LABELS) as [DvtConclusionSectionId, string][]).map(([sectionId, label]) => (
            <label key={sectionId} className="dvt-field">
              <span>{label}</span>
              <textarea
                rows={sectionId === 'conclusion' || sectionId === 'residualRisk' ? 5 : 3}
                maxLength={1200}
                value={conclusionFields.sections[sectionId]}
                disabled={committed}
                onChange={(event) => props.onConclusionChange({
                  ...conclusionFields,
                  sections: { ...conclusionFields.sections, [sectionId]: event.currentTarget.value },
                })}
              />
            </label>
          ))}
          <label className="dvt-field"><span>Linked cleanup evidence (read-only)</span><textarea readOnly rows={4} value={([
            ['RF output', conclusionFields.cleanup.rfOutput],
            ['Acquisition', conclusionFields.cleanup.acquisition],
            ['DUT bias', conclusionFields.cleanup.bias],
            ['DC output', conclusionFields.cleanup.dcOutput],
          ] as const).map(([label, record]) => `${label}: ${record.status.toUpperCase()} · ${record.atIso} · ${record.evidenceId}`).join('\n')} /></label>
          <label className="dvt-cleanup-acknowledgement">
            <input
              type="checkbox"
              checked={cleanupAcknowledged}
              disabled={committed}
              onChange={(event) => props.onCleanupAcknowledgedChange(event.currentTarget.checked)}
            />
            <span>Linked measurement-point cleanup evidence를 검토했습니다</span>
          </label>
          <label className="dvt-field"><span>Next action</span><textarea rows={3} value={conclusionFields.nextAction} onChange={(event) => props.onConclusionChange({ ...conclusionFields, nextAction: event.currentTarget.value })} /></label>
          <label className="dvt-field"><span>Owner</span><input value={conclusionFields.owner} onChange={(event) => props.onConclusionChange({ ...conclusionFields, owner: event.currentTarget.value })} /></label>
        </div>
        <p className="dvt-capstone-status" aria-live="polite">
          {commitReady
            ? '9개 section과 source-derived ID·decision·cleanup·next action/owner가 준비됐습니다.'
            : `남은 필드 · ${[...conclusionValidation.missing, ...(cleanupAcknowledged ? [] : ['linked cleanup evidence acknowledgement'])].join(' · ')}`}
        </p>
        <button
          type="button"
          className="lab-button lab-button--primary"
          disabled={!commitReady || committed}
          onClick={() => {
            reportInteraction('blind-fdd-commit');
            props.onCommit();
          }}
        >
          Blind case 결론 확정
        </button>
      </div>
    );
  }

  const reportLabel = CASE_REPORT_LABELS[currentCase.id] ?? currentCase.title;
  const plannedStep = currentCase.steps.find((step) => step.stepId === plannedStepId);
  const pendingStep = currentCase.steps.find((step) => step.expectedEvidenceId === pendingEvidenceId);

  return (
    <div className="dvt-capstone-controls">
      <div className="dvt-case-header"><span>Case {caseIndex + 1}/{DVT_BUILT_IN_CASES.length}</span><strong>{reportLabel}</strong></div>
      {!planLocked ? (
        <section className="dvt-case-section" aria-labelledby={`${currentCase.id}-plan-title`}>
          <h4 id={`${currentCase.id}-plan-title`}>Evidence 전 사전 계획</h4>
          <HypothesisChoices legend="Initial hypothesis" name={`${currentCase.id}-initial`} hypotheses={currentCase.hypotheses} value={initialHypothesisId} onChange={props.onInitialHypothesisChange} />
          <fieldset className="dvt-choice-field">
            <legend>Next measurement + Expected signature</legend>
            {currentCase.steps.map((step) => (
              <label key={step.stepId}>
                <input type="radio" name={`${currentCase.id}-planned-step`} checked={plannedStepId === step.stepId} onChange={() => props.onPlannedStepChange(step.stepId)} />
                <span><strong>{step.prompt}</strong><small>{evidenceSummary(step.expectedEvidence)}</small></span>
              </label>
            ))}
          </fieldset>
          {plannedStep && <p>Paired plan · {plannedStep.stepId} → {plannedStep.expectedEvidenceId}</p>}
          <button type="button" className="lab-button lab-button--secondary" disabled={!planReady} onClick={props.onLockPlan}>사전 계획 고정</button>
        </section>
      ) : (
        <>
          <section className="dvt-case-section" aria-labelledby={`${currentCase.id}-evidence-title`}>
            <h4 id={`${currentCase.id}-evidence-title`}>Ordered deterministic evidence</h4>
            <p>Evidence를 순서대로 공개한 뒤, 다음 evidence 전에 한 hypothesis에 대한 지지·반증·중립을 기록합니다.</p>
            <div className="dvt-evidence-controls__actions">
              {currentCase.steps.map((step) => (
                <button
                  key={step.expectedEvidenceId}
                  type="button"
                  className="lab-button lab-button--secondary"
                  aria-pressed={progress.acceptedEvidenceIds.includes(step.expectedEvidenceId)}
                  disabled={progress.acceptedEvidenceIds.includes(step.expectedEvidenceId) || pendingEvidenceId.length > 0}
                  onClick={() => props.onEvidence(step.expectedEvidenceId)}
                >Evidence {step.order}: {step.expectedEvidenceId}</button>
              ))}
            </div>
            <ol className="dvt-evidence-list">
              {currentCase.steps.slice(0, progress.nextStepIndex).map((step) => {
                const matrix = classifications.filter(({ evidenceId }) => evidenceId === step.expectedEvidenceId);
                return <li key={step.expectedEvidenceId}><strong>{step.expectedEvidenceId}</strong><span>{evidenceSummary(step.expectedEvidence)}</span>{matrix.length > 0 && <span>판정 matrix · {matrix.map((classification) => `${hypothesisLabel(currentCase, classification.hypothesisId)}:${EFFECT_LABELS[classification.effect]}`).join(' · ')}</span>}</li>;
              })}
            </ol>
          </section>

          {pendingStep && (
            <section className="dvt-case-section" aria-labelledby={`${currentCase.id}-classification-title`}>
              <h4 id={`${currentCase.id}-classification-title`}>{pendingEvidenceId} competing-hypothesis effect matrix</h4>
              <p>한 evidence가 모든 competing hypothesis를 지지·반증·중립 중 어떻게 바꾸는지 rationale과 함께 기록합니다.</p>
              {pendingStep.expectedEffects.map((contract) => (
                <fieldset className="dvt-choice-field" key={contract.hypothesisId}>
                  <legend>{hypothesisLabel(currentCase, contract.hypothesisId)} effect</legend>
                  <small>{contract.rationale}</small>
                  {(['support', 'contradict', 'neutral'] as const).map((effect) => (
                    <label key={effect}>
                      <input
                        type="radio"
                        name={`${currentCase.id}-${pendingEvidenceId}-${contract.hypothesisId}-effect`}
                        checked={pendingClassification[contract.hypothesisId] === effect}
                        onChange={() => props.onPendingClassificationChange(contract.hypothesisId, effect)}
                      />
                      <span>{EFFECT_LABELS[effect]}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <button type="button" className="lab-button lab-button--primary" disabled={!pendingMatrixReady} onClick={props.onRecordClassification}>Evidence matrix 기록</button>
            </section>
          )}

          {progress.complete && classificationMatrixIsComplete(currentCase, classifications) && (
            <section className="dvt-case-section" aria-labelledby={`${currentCase.id}-review-title`}>
              <h4 id={`${currentCase.id}-review-title`}>Evidence 후 ranked hypothesis update</h4>
              <HypothesisChoices legend="1순위 hypothesis" name={`${currentCase.id}-rank-one`} hypotheses={currentCase.hypotheses} value={firstHypothesisId} onChange={(value) => props.onReviewChange('firstHypothesisId', value)} />
              <HypothesisChoices legend="2순위 competing hypothesis" name={`${currentCase.id}-rank-two`} hypotheses={currentCase.hypotheses} value={secondHypothesisId} onChange={(value) => props.onReviewChange('secondHypothesisId', value)} />
              <label className="dvt-field"><span>False-positive / remaining uncertainty</span><textarea rows={3} value={remainingUncertainty} onChange={(event) => props.onReviewChange('remainingUncertainty', event.currentTarget.value)} /></label>
              <fieldset className="dvt-choice-field"><legend>Confidence</legend>{(['Confirmed', 'Strongly indicated', 'Unresolved'] as const).map((label) => <label key={label}><input type="radio" name={`${currentCase.id}-confidence`} checked={confidence === label} onChange={() => props.onReviewChange('confidence', label)} /><span>{label}</span></label>)}</fieldset>
              {firstHypothesisId === secondHypothesisId && firstHypothesisId.length > 0 && <p role="alert">1순위와 2순위 가설은 달라야 합니다.</p>}
              <button type="button" className="lab-button lab-button--primary" disabled={!reviewReady} onClick={props.onCloseCase}>Case 결론 기록</button>
            </section>
          )}
        </>
      )}
      <p className="dvt-capstone-status" aria-live="polite">{message}</p>
    </div>
  );
}

export interface BlindFddCapstoneLabProps extends DvtLabProps {
  readonly evidenceLinkage?: DvtConclusionEvidenceLinkage;
  readonly sourceRecords?: DvtConclusionSourceRecords;
}

export function BlindFddCapstoneLab({
  progressId,
  evidenceLinkage = CAPSTONE_EVIDENCE_LINKAGE,
  sourceRecords = CAPSTONE_SOURCE_RECORDS,
}: BlindFddCapstoneLabProps) {
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const currentCase = DVT_BUILT_IN_CASES[currentCaseIndex];
  const [progress, setProgress] = useState<DvtDiagnosticProgress | null>(() => DVT_BUILT_IN_CASES[0] ? newProgress(DVT_BUILT_IN_CASES[0]) : null);
  const [initialHypothesisId, setInitialHypothesisId] = useState('');
  const [plannedStepId, setPlannedStepId] = useState('');
  const [planLocked, setPlanLocked] = useState(false);
  const [pendingEvidenceId, setPendingEvidenceId] = useState('');
  const [pendingClassification, setPendingClassification] = useState<PendingClassificationMatrix>({});
  const [classifications, setClassifications] = useState<readonly DvtEvidenceClassification[]>([]);
  const [firstHypothesisId, setFirstHypothesisId] = useState('');
  const [secondHypothesisId, setSecondHypothesisId] = useState('');
  const [remainingUncertainty, setRemainingUncertainty] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceLabel | ''>('');
  const [caseReviews, setCaseReviews] = useState<readonly CaseReview[]>([]);
  const [conclusionFields, setConclusionFields] = useState<DvtConclusionFields>(EMPTY_CONCLUSION);
  const [cleanupAcknowledged, setCleanupAcknowledged] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [message, setMessage] = useState('Case 1의 evidence를 보기 전에 사전 계획을 고정하세요.');
  const acceptedEvidenceCount = caseReviews.reduce((count, review) => count + review.acceptedEvidenceIds.length, 0) + (progress?.acceptedEvidenceIds.length ?? 0);
  const totalEvidenceCount = useMemo(() => DVT_BUILT_IN_CASES.reduce((count, diagnosticCase) => count + diagnosticCase.steps.length, 0), []);

  function resetCaseState(nextIndex: number) {
    setCurrentCaseIndex(nextIndex);
    setProgress(DVT_BUILT_IN_CASES[nextIndex] ? newProgress(DVT_BUILT_IN_CASES[nextIndex]) : null);
    setInitialHypothesisId(''); setPlannedStepId(''); setPlanLocked(false);
    setPendingEvidenceId(''); setPendingClassification({}); setClassifications([]);
    setFirstHypothesisId(''); setSecondHypothesisId(''); setRemainingUncertainty(''); setConfidence('');
  }

  function lockPlan() {
    if (!currentCase) return;
    const step = currentCase.steps.find(({ stepId }) => stepId === plannedStepId);
    if (!step) return;
    const validation = validateDiagnosticPlan(currentCase.id, { nextStepId: step.stepId, expectedEvidenceId: step.expectedEvidenceId });
    if (!validation.valid) { setMessage(validation.reason); return; }
    setPlanLocked(true); setMessage(`사전 계획 고정 · ${step.stepId} → ${step.expectedEvidenceId}`);
  }

  function revealEvidence(evidenceId: string) {
    if (!currentCase || !progress || !planLocked || progress.complete || pendingEvidenceId) return;
    const next = advanceDiagnosticCase(currentCase.id, progress, evidenceId);
    if (next.nextStepIndex === progress.nextStepIndex) { setMessage('현재 evidence 순서가 아닙니다. Evidence 1부터 실행하세요.'); return; }
    setProgress(next); setPendingEvidenceId(evidenceId); setPendingClassification({});
    setMessage(`${evidenceId} 공개 · 다음 evidence 전에 hypothesis effect를 판정하세요.`);
  }

  function recordClassification() {
    if (!currentCase || !pendingEvidenceId) return;
    const matrix: DvtEvidenceClassification[] = [];
    for (const { hypothesisId } of currentCase.hypotheses) {
      const effect = pendingClassification[hypothesisId];
      if (!effect) return;
      matrix.push({ evidenceId: pendingEvidenceId, hypothesisId, effect });
    }
    for (const classification of matrix) {
      const validation = validateEvidenceClassification(currentCase.id, classification);
      if (!validation.valid) { setMessage(validation.reason); return; }
    }
    setClassifications((current) => [...current, ...matrix]);
    setPendingEvidenceId(''); setPendingClassification({});
    setMessage(`${pendingEvidenceId} effect matrix accepted · ${matrix.map((classification) => `${hypothesisLabel(currentCase, classification.hypothesisId)}:${EFFECT_LABELS[classification.effect]}`).join(' · ')}`);
  }

  function closeCurrentCase() {
    if (!currentCase || !progress?.complete || !confidence) return;
    const validation = validateRankedReview(currentCase, classifications, firstHypothesisId, secondHypothesisId, confidence);
    if (!validation.valid) { setMessage(validation.reason); return; }
    const review: CaseReview = { caseId: currentCase.id, reportLabel: CASE_REPORT_LABELS[currentCase.id] ?? currentCase.title, initialHypothesisId, plannedStepId, firstHypothesisId, secondHypothesisId, remainingUncertainty: remainingUncertainty.trim(), confidence, classifications, acceptedEvidenceIds: progress.acceptedEvidenceIds };
    const nextReviews = [...caseReviews, review];
    const nextIndex = currentCaseIndex + 1;
    setCaseReviews(nextReviews);
    resetCaseState(nextIndex);
    if (nextIndex < DVT_BUILT_IN_CASES.length) setMessage(`Case ${nextIndex + 1}의 사전 계획을 고정하세요.`);
    else { setConclusionFields(buildConclusion(nextReviews, evidenceLinkage)); setMessage('3/3 case closed · 9-section DVT conclusion을 완성하세요.'); }
  }

  const ledger: LedgerEntry[] = [
    { label: '변경', value: committed ? `세 blind case의 classified evidence와 9-section conclusion commit · ${acceptedEvidenceCount}/${totalEvidenceCount} evidence accepted` : `${caseReviews.length}/3 case closed · ${acceptedEvidenceCount}/${totalEvidenceCount} evidence accepted` },
    { label: '직접 효과', value: committed ? 'Plan pairing·evidence effect·ranking·confidence·cleanup를 구조화해 보존' : pendingEvidenceId ? `${pendingEvidenceId} effect 판정 대기` : planLocked ? 'Paired plan 고정 · ordered evidence 진행 중' : 'Hypothesis와 step-paired signature 필요', tone: committed ? 'active' : 'neutral' },
    { label: '화면 결과', value: committed ? 'Evidence-bounded DVT conclusion 생성' : '최종 report 잠김', tone: committed ? 'active' : 'neutral' },
    { label: '비용·한계', value: 'Built-in evidence는 실제 DUT raw data, compliance verdict, receiver sensitivity 또는 BLER 결론을 대신하지 않음', tone: 'warning' },
  ];

  return (
    <LabShell
      labId={progressId}
      title="Single-point blind FDD DVT capstone"
      question="결과가 FAIL처럼 보일 때, DUT를 원인으로 닫기 전에 어떤 evidence chain을 남겨야 할까?"
      description="한 requalified multi-metric point의 Gain·PAE, EVM·ACLR, TX-noise/RX-branch risk를 세 investigation thread로 나눠 사전 가설 → paired plan → classified evidence → ranked update → 9-section conclusion으로 닫습니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{ 'blind-fdd-commit': ['source', 'dut', 'acquisition', 'dsp', 'display'] }}
      controls={<BlindControls currentCase={currentCase} caseIndex={currentCaseIndex} progress={progress} initialHypothesisId={initialHypothesisId} plannedStepId={plannedStepId} planLocked={planLocked} pendingEvidenceId={pendingEvidenceId} pendingClassification={pendingClassification} classifications={classifications} firstHypothesisId={firstHypothesisId} secondHypothesisId={secondHypothesisId} remainingUncertainty={remainingUncertainty} confidence={confidence} conclusionFields={conclusionFields} evidenceLinkage={evidenceLinkage} sourceRecords={sourceRecords} cleanupAcknowledged={cleanupAcknowledged} committed={committed} message={message} onInitialHypothesisChange={setInitialHypothesisId} onPlannedStepChange={setPlannedStepId} onLockPlan={lockPlan} onEvidence={revealEvidence} onPendingClassificationChange={(hypothesisId, effect) => setPendingClassification((current) => ({ ...current, [hypothesisId]: effect }))} onRecordClassification={recordClassification} onReviewChange={(field, value) => { if (field === 'firstHypothesisId') setFirstHypothesisId(value); if (field === 'secondHypothesisId') setSecondHypothesisId(value); if (field === 'remainingUncertainty') setRemainingUncertainty(value); if (field === 'confidence') setConfidence(value as ConfidenceLabel); }} onCloseCase={closeCurrentCase} onConclusionChange={setConclusionFields} onCleanupAcknowledgedChange={setCleanupAcknowledged} onCommit={() => setCommitted(true)} />}
      ledger={ledger}
      prediction={{ id: 'blind-fdd-method', prompt: '익명 FDD module에서 동시에 여러 KPI가 나빠졌다면 첫 원칙은?', options: ['측정 유효성을 먼저 확인하고 경쟁 가설을 유지한 채 다음 evidence를 설계한다', '가장 나쁜 KPI 하나만 보고 DUT 불량으로 확정한다', 'Receiver sensitivity와 BLER까지 이 bench 결과로 직접 확정한다'], correctIndex: 0, explanation: 'Senior DVT conclusion은 measurement transaction 유효성을 먼저 닫고 competing hypothesis를 evidence로 줄입니다. TX-noise 결과는 desense risk budget이지 sensitivity나 BLER 판정이 아닙니다.' }}
      note="세 case는 서로 다른 point가 아니라 한 built-in deterministic multi-metric point의 investigation thread입니다. 실제 station capability, calibrated reference plane, raw trace, limit source와 조직 decision rule을 연결하기 전에는 DUT disposition이나 compliance verdict로 사용할 수 없습니다."
    >
      {committed ? <DvtConclusionReport fields={conclusionFields} linkage={evidenceLinkage} sourceRecords={sourceRecords} /> : <section className="dvt-evidence-placeholder" aria-live="polite"><h3>Blind DVT conclusion 잠김</h3><p>{acceptedEvidenceCount}/{totalEvidenceCount} evidence accepted · {caseReviews.length}/3 case conclusions recorded</p></section>}
    </LabShell>
  );
}
