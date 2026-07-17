import { useMemo, useState } from 'react';
import { combineUncertaintyBudget, decideWithGuardband } from '@/lib/rf/dvt';
import type { DvtUncertaintyComponent } from '@/types/dvt';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { LabShell } from '../lab/LabShell';
import type { LedgerEntry } from '../lab/types';
import { DvtReportPanel } from './DvtReportPanel';
import type { DvtLabProps } from './StationQualificationLab';

const MEASURED_ACLR_DBC = -30.8;
const ACLR_UPPER_LIMIT_DBC = -30;
const COVERAGE_FACTOR = 2;

export interface TeachingUncertaintyComponent extends DvtUncertaintyComponent {
  readonly sourceDescription: string;
  readonly divisorDescription: string;
  readonly correlationDescription: string;
}

export const ACLR_UNCERTAINTY_COMPONENTS: readonly TeachingUncertaintyComponent[] = [
  {
    id: 'repeatability-type-a',
    label: 'Repeated ACLR point mean',
    evaluationType: 'A',
    sourceType: 'repeatability-study',
    sourceEvidenceId: 'aclr-repeat-study-001',
    reportedUncertainty: { unit: 'dB', valueDb: 0.3 },
    distribution: 'normal',
    divisor: 1,
    sampleCount: 10,
    degreesOfFreedom: 9,
    referencePlane: 'dut-output',
    sensitivityCoefficient: 1,
    correlations: [],
    sourceDescription: '10 independent repeat acquisitions at one locked state',
    divisorDescription: 'Sample mean result already expressed as standard uncertainty',
    correlationDescription: 'Independent repeat term',
  },
  {
    id: 'main-common-amplitude',
    label: 'Main-channel common amplitude source',
    evaluationType: 'B',
    sourceType: 'calibration-certificate',
    sourceEvidenceId: 'edu-analyzer-amplitude-cert-001',
    reportedUncertainty: { unit: 'dB', valueDb: 0.2 * Math.sqrt(3) },
    distribution: 'rectangular',
    divisor: Math.sqrt(3),
    referencePlane: 'dut-output-main-channel',
    sensitivityCoefficient: -1,
    correlations: [{ withComponentId: 'adjacent-common-amplitude', correlationCoefficient: 1, evidenceId: 'common-amplitude-rho-001' }],
    sourceDescription: 'One analyzer amplitude certificate and shared acquisition state',
    divisorDescription: '√3 rectangular bound to standard uncertainty',
    correlationDescription: 'ρ=+1 with adjacent term; same source and acquisition',
  },
  {
    id: 'adjacent-common-amplitude',
    label: 'Adjacent-channel common amplitude source',
    evaluationType: 'B',
    sourceType: 'calibration-certificate',
    sourceEvidenceId: 'edu-analyzer-amplitude-cert-001',
    reportedUncertainty: { unit: 'dB', valueDb: 0.2 * Math.sqrt(3) },
    distribution: 'rectangular',
    divisor: Math.sqrt(3),
    referencePlane: 'dut-output-adjacent-channel',
    sensitivityCoefficient: 1,
    correlations: [],
    sourceDescription: 'Same analyzer amplitude certificate and shared acquisition state',
    divisorDescription: '√3 rectangular bound to standard uncertainty',
    correlationDescription: 'ρ=+1; opposite ACLR ratio sensitivity cancels common mode',
  },
  {
    id: 'differential-path-type-b',
    label: 'Differential path/integration response',
    evaluationType: 'B',
    sourceType: 'manufacturer-specification',
    sourceEvidenceId: 'main-adjacent-response-bound-001',
    reportedUncertainty: { unit: 'dB', valueDb: 0.4 * Math.sqrt(3) },
    distribution: 'rectangular',
    divisor: Math.sqrt(3),
    referencePlane: 'dut-output',
    sensitivityCoefficient: 1,
    correlations: [],
    sourceDescription: 'Verified main-to-adjacent response bound',
    divisorDescription: '√3 rectangular bound to standard uncertainty',
    correlationDescription: 'Independent of repeat mean and common-amplitude pair',
  },
];

function componentStandardUncertaintyDb(component: TeachingUncertaintyComponent): number {
  return component.reportedUncertainty.unit === 'dB'
    ? component.reportedUncertainty.valueDb / component.divisor
    : 0;
}

function formatSignedDbc(value: number): string {
  return value.toFixed(1).replace('-', '−');
}

function UncertaintyControls({
  expandedUncertaintyDb,
  calculated,
  onCalculate,
  onCommit,
}: {
  expandedUncertaintyDb: number;
  calculated: boolean;
  onCalculate: () => void;
  onCommit: () => void;
}) {
  const reportInteraction = useLabControlInteraction();

  return (
    <div className="dvt-uncertainty-controls">
      <dl className="dvt-uncertainty-components">
        <div><dt>Measured ACLR</dt><dd>{MEASURED_ACLR_DBC.toFixed(1)} dBc</dd></div>
        <div><dt>Upper limit</dt><dd>{ACLR_UPPER_LIMIT_DBC.toFixed(1)} dBc</dd></div>
        {ACLR_UNCERTAINTY_COMPONENTS.map((component) => (
          <div key={component.id}>
            <dt>{component.label}</dt>
            <dd>
              <strong>{componentStandardUncertaintyDb(component).toFixed(2)} dB standard</strong>
              <span>Type {component.evaluationType} · {component.sourceDescription}</span>
              <span>{component.distribution} / divisor {component.divisorDescription}</span>
              <span>c={component.sensitivityCoefficient} · {component.correlationDescription}</span>
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="lab-button lab-button--secondary"
        onClick={onCalculate}
      >
        불확도 budget 계산
      </button>
      <p className="dvt-budget-result" aria-live="polite">
        {calculated
          ? `Expanded uncertainty ${expandedUncertaintyDb.toFixed(2)} dB · k=${COVERAGE_FACTOR}`
          : 'Standard uncertainty를 결합하기 전입니다.'}
      </p>
      <button
        type="button"
        className="lab-button lab-button--primary"
        disabled={!calculated}
        onClick={() => {
          reportInteraction('uncertainty-decision-commit');
          onCommit();
        }}
      >
        Guardband 판정 확정
      </button>
    </div>
  );
}

export function UncertaintyDecisionLab({ progressId }: DvtLabProps) {
  const [committed, setCommitted] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const budget = useMemo(
    () => combineUncertaintyBudget(ACLR_UNCERTAINTY_COMPONENTS, COVERAGE_FACTOR),
    [],
  );
  const expandedUncertaintyDb = budget.expandedUncertainty.unit === 'dB'
    ? budget.expandedUncertainty.valueDb
    : 0;
  const decision = useMemo(() => decideWithGuardband({
    metricId: 'fdd-aclr-upper',
    validity: 'valid',
    direction: 'upper-bound',
    measured: { unit: 'dBc', valueDbc: MEASURED_ACLR_DBC },
    expandedUncertainty: { unit: 'dB', valueDb: expandedUncertaintyDb },
    upperLimit: { unit: 'dBc', valueDbc: ACLR_UPPER_LIMIT_DBC },
    valueConvention: 'analyzer-negative-dbc',
  }), [expandedUncertaintyDb]);
  const marginDb = decision.normalizedMargin?.unit === 'dB'
    ? decision.normalizedMargin.valueDb
    : null;
  const commonCovariance = budget.correlationCovarianceContributions[
    'adjacent-common-amplitude|main-common-amplitude'
  ];
  const commonCovarianceDbSquared = commonCovariance?.unit === 'dB-squared'
    ? commonCovariance.signedValueDbSquared
    : 0;
  const verdict = decision.verdict.toUpperCase();
  const ledger: LedgerEntry[] = [
    { label: '변경', value: committed ? '표준 불확도를 결합하고 negative-dBc upper limit에 guardband 적용' : calculated ? `불확도 budget 계산 완료 · interval ${formatSignedDbc(MEASURED_ACLR_DBC - expandedUncertaintyDb)}…${formatSignedDbc(MEASURED_ACLR_DBC + expandedUncertaintyDb)} dBc` : 'Raw ACLR와 limit만 비교 중' },
    { label: '직접 효과', value: committed ? `Native ACLR=adjacent−main · c_main=−1, c_adjacent=+1 · common covariance ${commonCovarianceDbSquared.toFixed(2)} dB² → expanded ±${expandedUncertaintyDb.toFixed(2)} dB` : 'Distribution·divisor·sensitivity·correlation 해석 전', tone: committed ? 'active' : 'neutral' },
    { label: '화면 결과', value: committed ? `${verdict} · normalized margin ${marginDb?.toFixed(2) ?? '—'} dB` : 'Decision report 잠김', tone: committed && decision.verdict !== 'pass' ? 'warning' : 'neutral' },
    { label: '비용·한계', value: 'Evidence-backed general ρ covariance 교육 모델 · 실제 distribution, degrees of freedom와 조직 decision rule은 별도 검토', tone: 'warning' },
  ];
  const conclusion = `FDD ACLR ${MEASURED_ACLR_DBC.toFixed(1)} dBc는 nominal limit ${ACLR_UPPER_LIMIT_DBC.toFixed(1)} dBc보다 낮아 raw comparison은 통과한다. 그러나 expanded uncertainty ±${expandedUncertaintyDb.toFixed(2)} dB를 적용한 interval이 limit과 겹치므로 verdict는 ${verdict}다. Station uncertainty를 축소하거나 margin이 충분한 조건에서 재측정해야 한다.`;

  return (
    <LabShell
      labId={progressId}
      title="Uncertainty and decision 실험"
      question="ACLR −30.8 dBc가 −30 dBc limit보다 좋아 보여도 바로 PASS라고 말할 수 있을까?"
      description="Type A/B source, divisor, signed sensitivity와 evidence-backed ρ covariance를 결합하고 expanded uncertainty를 negative-dBc 결과에 올바른 방향으로 적용합니다."
      activeStages={['acquisition', 'dsp', 'display']}
      stageMap={{ 'uncertainty-decision-commit': ['acquisition', 'dsp', 'display'] }}
      controls={<UncertaintyControls expandedUncertaintyDb={expandedUncertaintyDb} calculated={calculated} onCalculate={() => setCalculated(true)} onCommit={() => setCommitted(true)} />}
      layoutVariant="prediction-first"
      controlsTitle="불확도 예산"
      controlsHint="상관 항 검토"
      ledger={ledger}
      prediction={{
        id: 'aclr-guardband-direction',
        prompt: 'Expanded uncertainty가 ±1.0 dB일 때 −30.8 dBc ACLR의 판정은?',
        options: [
          'Raw ACLR은 통과하지만 uncertainty interval이 limit과 겹쳐 INCONCLUSIVE',
          'Negative 값이므로 uncertainty를 무시하고 PASS',
          '항상 measured value에서 1 dB를 빼서 PASS',
        ],
        correctIndex: 0,
        explanation: 'Analyzer-native ACLR에서 더 큰 값, 즉 덜 negative한 값이 나쁜 방향입니다. Interval −31.8…−29.8 dBc가 −30 dBc limit와 겹치므로 PASS나 FAIL로 닫지 않습니다.',
      }}
      note="Built-in additive logarithmic uncertainty와 k=2 예제입니다. 실제 ISO/IEC 17025 decision rule, probability distribution, degrees of freedom, correlation evidence와 계약상 guardband를 대신하지 않습니다."
    >
      {committed ? (
        <DvtReportPanel
          title="Uncertainty decision 보고서"
          status={verdict}
          summary={decision.explanation}
          conclusion={conclusion}
          rows={[
            { label: 'Measured ACLR', value: `${MEASURED_ACLR_DBC.toFixed(1)} dBc`, evidence: 'Analyzer-negative-dBc convention' },
            { label: 'Upper limit', value: `${ACLR_UPPER_LIMIT_DBC.toFixed(1)} dBc`, evidence: '적용 condition의 nominal limit' },
            { label: 'Standard uncertainty', value: budget.standardUncertainty.unit === 'dB' ? `${budget.standardUncertainty.valueDb.toFixed(2)} dB` : '—', evidence: budget.method },
            { label: 'Expanded uncertainty', value: `${expandedUncertaintyDb.toFixed(2)} dB`, evidence: `Coverage factor k=${COVERAGE_FACTOR}` },
            ...ACLR_UNCERTAINTY_COMPONENTS.map((component) => ({
              label: `Type ${component.evaluationType} · ${component.label}`,
              value: `${componentStandardUncertaintyDb(component).toFixed(2)} dB · c=${component.sensitivityCoefficient}`,
              evidence: `${component.sourceEvidenceId} · ${component.sourceDescription} · ${component.distribution} / ${component.divisorDescription} · ${component.correlationDescription}`,
            })),
            { label: 'Native ACLR sensitivity', value: 'c_main=−1 · c_adjacent=+1', evidence: 'ACLR dBc = adjacent-channel power − main-channel power' },
            { label: 'Common-amplitude covariance', value: `${commonCovarianceDbSquared.toFixed(2)} dB²`, evidence: 'ρ=+1 terms with native −1/+1 ACLR sensitivities produce a negative covariance term without representing negative uncertainty' },
            { label: 'Guardbanded verdict', value: verdict, evidence: `Normalized margin ${marginDb?.toFixed(2) ?? '—'} dB` },
          ]}
        />
      ) : (
        <section className="dvt-evidence-placeholder" aria-live="polite">
          <h3>Guardbanded decision 잠김</h3>
          <p>{calculated ? `계산된 interval ${formatSignedDbc(MEASURED_ACLR_DBC - expandedUncertaintyDb)}…${formatSignedDbc(MEASURED_ACLR_DBC + expandedUncertaintyDb)} dBc를 limit과 비교해 판정을 확정하세요.` : '불확도 budget을 계산한 뒤 negative-dBc 결과의 worst-case 방향을 적용하세요.'}</p>
        </section>
      )}
    </LabShell>
  );
}
