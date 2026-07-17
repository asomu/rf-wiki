import { useId, useState } from 'react';
import {
  DVT_EVIDENCE_CANONICAL_PAYLOAD_VERSION,
  DVT_EVIDENCE_CHECKSUM_DESCRIPTION,
  validateConclusionEvidenceLinkage,
  validateConclusionReportCompleteness,
} from '@/lib/rf/dvt';
import type {
  DvtConclusionEvidenceLinkage,
  DvtConclusionReport as DvtConclusionReportData,
  DvtConclusionSourceRecords,
  DvtDeltaQuantity,
  DvtQuantity,
} from '@/types/dvt';

export const DVT_CONCLUSION_SECTION_LABELS = {
  scope: 'Scope',
  station: 'Station',
  symptom: 'Symptom',
  validity: 'Validity',
  decision: 'Decision',
  hypotheses: 'Hypotheses',
  evidence: 'Evidence',
  conclusion: 'Conclusion',
  residualRisk: 'Residual risk',
} as const;

export type DvtConclusionSectionId = keyof typeof DVT_CONCLUSION_SECTION_LABELS;

export type DvtConclusionFields = DvtConclusionReportData;

export interface DvtConclusionValidation {
  readonly complete: boolean;
  readonly missing: readonly string[];
}

function formatQuantity(quantity: DvtQuantity | DvtDeltaQuantity): string {
  switch (quantity.unit) {
    case 'dB': return `${quantity.valueDb.toFixed(2)} dB`;
    case 'dBc': return `${quantity.valueDbc.toFixed(2)} dBc`;
    case 'dBm': return `${quantity.valueDbm.toFixed(2)} dBm`;
    case 'percent': return `${quantity.valuePercent.toFixed(2)}%`;
  }
}

function causalConfidenceSummary(fields: DvtConclusionFields): string {
  const labels = [...fields.sections.hypotheses.matchAll(/· (Confirmed|Strongly indicated|Unresolved) ·/g)]
    .map((match) => match[1]!)
    .filter((label, index, all) => all.indexOf(label) === index);
  return labels.length > 0 ? labels.join(' · ') : 'Not separately recorded';
}

export function validateDvtConclusion(
  fields: DvtConclusionFields,
  linkage: DvtConclusionEvidenceLinkage,
): DvtConclusionValidation {
  const completeness = validateConclusionReportCompleteness(fields);
  const evidenceLinkage = validateConclusionEvidenceLinkage(fields, linkage);
  const missing = [...completeness.missingFields, ...evidenceLinkage.reasons];
  return { complete: completeness.complete && evidenceLinkage.valid, missing };
}

export function describeTxNoiseAnalyzerFrontEndSetup(
  sourceRecords: DvtConclusionSourceRecords,
): string {
  const txNoiseEvidence = sourceRecords.measurementPoint.metricEvidence.find(
    (evidence) => evidence.metric === 'tx-noise',
  );
  if (txNoiseEvidence === undefined) {
    return 'Missing N9020B RX-band noise front-end setup · recorded educational setup required; no instrument performance claim';
  }
  const setup = txNoiseEvidence.analyzerFrontEndSetup;
  return `${setup.setupEvidenceId} · input attenuation ${setup.inputAttenuationDb.toFixed(1)} dB · preamp ${setup.preamplifierEnabled ? 'ON' : 'OFF'} · reference level ${setup.referenceLevelDbm.toFixed(1)} dBm · ${setup.detector.toUpperCase()} detector · ${setup.measurementMode} · recorded educational setup, not an instrument performance claim`;
}

export function describeAnalyzerHeadroomLevelPlan(
  sourceRecords: DvtConclusionSourceRecords,
): string {
  const headroom = sourceRecords.measurementPoint.analyzerHeadroom;
  return `${headroom.strongestConnectorSignalRole} ${headroom.strongestConnectorSignalSourceId} = strongest connector signal ${headroom.strongestConnectorSignalDbm.toFixed(1)} dBm · connector total ${headroom.connectorTotalPowerDbm.toFixed(1)} dBm → input attenuation ${headroom.inputAttenuationDb.toFixed(1)} dB → mixer total ${headroom.mixerTotalPowerDbm.toFixed(1)} dBm → station-verified mixer operating boundary ${headroom.stationVerifiedMixerOperatingLimitDbm.toFixed(1)} dBm (${headroom.operatingLimitEvidenceId}) · mixer headroom ${headroom.mixerHeadroomDb.toFixed(1)} dB · ${headroom.residualState.kind} ${headroom.residualState.status} (${headroom.residualState.evidenceId}) · reference level ${headroom.referenceLevelDbm.toFixed(1)} dBm is display/setup only; boundary is station verification, not a vendor accuracy claim`;
}

export function serializeDvtConclusion(
  fields: DvtConclusionFields,
  linkage: DvtConclusionEvidenceLinkage,
  sourceRecords: DvtConclusionSourceRecords,
): string {
  const sectionText = (Object.entries(DVT_CONCLUSION_SECTION_LABELS) as [DvtConclusionSectionId, string][])
    .map(([id, label]) => `[${label}]\n${fields.sections[id].trim()}`)
    .join('\n\n');
  return [
    'DVT CONCLUSION',
    `Report ID: ${fields.reportId}`,
    `Station ID: ${fields.stationId}`,
    `Station revision ID: ${linkage.stationRevisionId}`,
    `Measurement point ID: ${fields.measurementPointId}`,
    `Decision IDs: ${fields.decisionIds.join(', ')}`,
    `Accepted diagnostic evidence IDs: ${fields.acceptedDiagnosticEvidenceIds.join(', ')}`,
    `Station readiness: ${linkage.stationReadiness.state.toUpperCase()} · ${linkage.stationReadiness.evidence.join('; ')}`,
    `Measurement point validity: ${linkage.measurementValidation.validity.toUpperCase()} · ${linkage.measurementValidation.reasons.join('; ') || 'no open reason'}`,
    `Three-axis summary: measurement validity=${linkage.measurementValidation.validity.toUpperCase()} · allocation decision=${linkage.decisions.map(({ metricId, verdict }) => `${metricId}:${verdict.toUpperCase()}`).join(', ')} · causal confidence=${causalConfidenceSummary(fields)}`,
    `Provenance checksum contract: ${DVT_EVIDENCE_CHECKSUM_DESCRIPTION} · canonical payload ${DVT_EVIDENCE_CANONICAL_PAYLOAD_VERSION} · detects accidental educational-record drift only; not a security control`,
    `Guardband decisions: ${linkage.decisions.map(({ metricId, verdict, measured, expandedUncertainty }, index) => {
      const source = linkage.decisionSources[index];
      return `${metricId}=${verdict.toUpperCase()} · measured ${formatQuantity(measured)} · U ${formatQuantity(expandedUncertainty)} · source point ${source?.sourceMeasurementPointId ?? 'missing'} · metric evidence ${source?.sourceMetricEvidenceIds.join('+') ?? 'missing'} · external evidence ${source?.sourceExternalEvidenceIds.join('+') ?? 'missing'} · uncertainty evidence ${source?.uncertaintySourceEvidenceIds.join('+') ?? 'missing'} · value educational checksum ${source?.valueDigest ?? 'missing'} · source educational checksum ${source?.sourceDigest ?? 'missing'}`;
    }).join(' | ')}`,
    `Diagnostic source mapping: ${linkage.diagnosticEvidenceSources.map((source) => `${source.caseId}/${source.evidenceId}=point:${source.sourceMeasurementPointId};metrics:${source.sourceMetricEvidenceIds.join('+') || 'none'};external:${source.sourceExternalEvidenceIds.join('+') || 'none'};decision:${source.decisionMetricId ?? 'none'};observed-educational-checksum:${source.observedValueDigest ?? 'missing'};source-educational-checksum:${source.sourceDigest ?? 'missing'}`).join(' | ')}`,
    `Isolation measurement source: ${linkage.decisionSources.find(({ metricId }) => metricId.includes('desense-isolation'))?.sourceExternalEvidenceIds.join('+') || 'missing'} · risk supporting metric evidence: ${linkage.decisionSources.find(({ metricId }) => metricId.includes('desense-isolation'))?.sourceMetricEvidenceIds.join('+') || 'missing'}`,
    `Recorded N9020B RX-band noise setup: ${describeTxNoiseAnalyzerFrontEndSetup(sourceRecords)}`,
    `N9020B connector-to-mixer level plan: ${describeAnalyzerHeadroomLevelPlan(sourceRecords)}`,
    `Desense evaluation: ${linkage.desenseEvaluation === undefined ? 'not linked' : `${linkage.desenseEvaluation.validity.toUpperCase()} · risk-budget-only · ${linkage.desenseEvaluation.reasons.join('; ') || 'all risk-evidence gates closed'}`}`,
    'Isolation state-equivalence residual: small-signal passive-path, bias-OFF isolation is not state-equivalent to PA-ON TX-noise acquisition; bias/control-state dependence remains an explicit residual risk.',
    `Cleanup: RF=${fields.cleanup.rfOutput.status}@${fields.cleanup.rfOutput.atIso} (${fields.cleanup.rfOutput.evidenceId}) · acquisition=${fields.cleanup.acquisition.status}@${fields.cleanup.acquisition.atIso} (${fields.cleanup.acquisition.evidenceId}) · bias=${fields.cleanup.bias.status}@${fields.cleanup.bias.atIso} (${fields.cleanup.bias.evidenceId}) · DC=${fields.cleanup.dcOutput.status}@${fields.cleanup.dcOutput.atIso} (${fields.cleanup.dcOutput.evidenceId})`,
    `Next action: ${fields.nextAction}`,
    `Owner: ${fields.owner}`,
    '',
    sectionText,
  ].join('\n');
}

export function DvtConclusionReport({
  fields,
  linkage,
  sourceRecords,
}: {
  fields: DvtConclusionFields;
  linkage: DvtConclusionEvidenceLinkage;
  sourceRecords: DvtConclusionSourceRecords;
}) {
  const id = useId();
  const [copyStatus, setCopyStatus] = useState('구조화된 결론을 선택하거나 복사할 수 있습니다.');
  const serialized = serializeDvtConclusion(fields, linkage, sourceRecords);

  async function copyConclusion() {
    if (!navigator.clipboard) {
      setCopyStatus('자동 복사를 사용할 수 없습니다. 아래 결론을 직접 선택하세요.');
      return;
    }
    try {
      await navigator.clipboard.writeText(serialized);
      setCopyStatus('구조화된 결론을 클립보드에 복사했습니다.');
    } catch {
      setCopyStatus('자동 복사를 사용할 수 없습니다. 아래 결론을 직접 선택하세요.');
    }
  }

  return (
    <article className="dvt-report dvt-conclusion-report" aria-labelledby={`${id}-title`}>
      <header>
        <div>
          <p>Evidence-bounded HTML report</p>
          <h3 id={`${id}-title`}>Blind FDD capstone 보고서</h3>
        </div>
        <strong data-status="EVIDENCE-BOUNDED" data-tone="reference">EVIDENCE-BOUNDED</strong>
      </header>

      <dl className="dvt-conclusion-report__metadata">
        <div><dt>Measurement validity</dt><dd>{linkage.measurementValidation.validity.toUpperCase()}</dd></div>
        <div><dt>Allocation decision</dt><dd>{linkage.decisions.map(({ metricId, verdict }) => `${metricId}: ${verdict.toUpperCase()}`).join(' · ')}</dd></div>
        <div><dt>Causal confidence</dt><dd>{causalConfidenceSummary(fields)}</dd></div>
        <div><dt>Report ID</dt><dd>{fields.reportId}</dd></div>
        <div><dt>Station ID</dt><dd>{fields.stationId}</dd></div>
        <div><dt>Station revision ID</dt><dd>{linkage.stationRevisionId}</dd></div>
        <div><dt>Measurement point ID</dt><dd>{fields.measurementPointId}</dd></div>
        <div><dt>Decision IDs</dt><dd>{fields.decisionIds.join(' · ')}</dd></div>
        <div><dt>Accepted diagnostic evidence IDs</dt><dd>{fields.acceptedDiagnosticEvidenceIds.join(' · ')}</dd></div>
        <div><dt>Station linkage</dt><dd>{linkage.stationReadiness.state.toUpperCase()} · {linkage.stationReadiness.evidence.join(' · ')}</dd></div>
        <div><dt>Measurement point linkage</dt><dd>{linkage.measurementValidation.validity.toUpperCase()} · {linkage.measurementValidation.reasons.join(' · ') || 'all validity gates closed'}</dd></div>
        <div><dt>Provenance checksum contract</dt><dd>{DVT_EVIDENCE_CHECKSUM_DESCRIPTION} · canonical payload {DVT_EVIDENCE_CANONICAL_PAYLOAD_VERSION} · non-security drift detector only</dd></div>
        <div><dt>Guardband decisions</dt><dd>{linkage.decisions.map(({ metricId, verdict, measured, expandedUncertainty }, index) => {
          const source = linkage.decisionSources[index];
          return `${metricId}: ${verdict.toUpperCase()} · measured ${formatQuantity(measured)} · U ${formatQuantity(expandedUncertainty)} · ${source?.sourceMeasurementPointId ?? 'missing point'} / metric ${source?.sourceMetricEvidenceIds.join('+') ?? 'missing'} / external ${source?.sourceExternalEvidenceIds.join('+') ?? 'missing'} / value educational checksum ${source?.valueDigest ?? 'missing'} / source educational checksum ${source?.sourceDigest ?? 'missing'}`;
        }).join(' · ')}</dd></div>
        <div><dt>9-step source mapping</dt><dd>{linkage.diagnosticEvidenceSources.map((source) => `${source.caseId}/${source.evidenceId} → ${source.sourceMeasurementPointId} · metric ${source.sourceMetricEvidenceIds.join('+') || 'none'} · external ${source.sourceExternalEvidenceIds.join('+') || 'none'} · decision ${source.decisionMetricId ?? 'none'} · observed educational checksum ${source.observedValueDigest ?? 'missing'} · source educational checksum ${source.sourceDigest ?? 'missing'}`).join(' · ')}</dd></div>
        <div><dt>Isolation measurement source</dt><dd>{linkage.decisionSources.find(({ metricId }) => metricId.includes('desense-isolation'))?.sourceExternalEvidenceIds.join(' · ') || 'Missing'} · risk supporting metric evidence {linkage.decisionSources.find(({ metricId }) => metricId.includes('desense-isolation'))?.sourceMetricEvidenceIds.join(' · ') || 'Missing'}</dd></div>
        <div><dt>Isolation state-equivalence residual</dt><dd>Small-signal passive-path, bias-OFF isolation is not state-equivalent to the PA-ON TX-noise point; control/bias dependence remains open.</dd></div>
        <div><dt>N9020B RX-band noise recorded setup</dt><dd>{describeTxNoiseAnalyzerFrontEndSetup(sourceRecords)}</dd></div>
        <div><dt>N9020B connector → mixer level plan</dt><dd>{describeAnalyzerHeadroomLevelPlan(sourceRecords)}</dd></div>
        <div><dt>Desense source evaluation</dt><dd>{linkage.desenseEvaluation === undefined ? 'Not linked' : `${linkage.desenseEvaluation.validity.toUpperCase()} · risk-budget-only · ${linkage.desenseEvaluation.reasons.join(' · ') || 'all risk-evidence gates closed'}`}</dd></div>
        <div><dt>Cleanup</dt><dd>{([
          ['RF', fields.cleanup.rfOutput],
          ['acquisition', fields.cleanup.acquisition],
          ['bias', fields.cleanup.bias],
          ['DC', fields.cleanup.dcOutput],
        ] as const).map(([label, record]) => `${label} ${record.status.toUpperCase()} @${record.atIso} (${record.evidenceId})`).join(' · ')}</dd></div>
        <div><dt>Next action / owner</dt><dd>{fields.nextAction} · {fields.owner}</dd></div>
      </dl>

      <div className="dvt-conclusion-report__sections">
        {(Object.entries(DVT_CONCLUSION_SECTION_LABELS) as [DvtConclusionSectionId, string][]).map(([sectionId, label]) => (
          <section key={sectionId} aria-labelledby={`${id}-${sectionId}`}>
            <h4 id={`${id}-${sectionId}`}>{label}</h4>
            <p>{fields.sections[sectionId]}</p>
          </section>
        ))}
      </div>

      <div className="dvt-report__conclusion">
        <label htmlFor={`${id}-conclusion`}>Copyable structured engineering conclusion</label>
        <textarea
          id={`${id}-conclusion`}
          rows={12}
          readOnly
          value={serialized}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="lab-button lab-button--secondary" onClick={copyConclusion}>
          결론 복사
        </button>
        <p role="status" aria-live="polite">{copyStatus}</p>
      </div>
    </article>
  );
}
