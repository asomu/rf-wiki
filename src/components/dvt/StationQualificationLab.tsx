import { useMemo, useState } from 'react';
import { evaluateStationReadiness } from '@/lib/rf/dvt';
import type { DvtStationManifest } from '@/types/dvt';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { LabShell } from '../lab/LabShell';
import type { LedgerEntry } from '../lab/types';
import { DvtReportPanel } from './DvtReportPanel';
import './dvt.css';

export interface DvtLabProps {
  progressId: string;
}

const STATION_MANIFEST: DvtStationManifest = {
  stationId: 'pa-bench-a',
  revisionId: 'qualification-2026-07',
  assets: [
    {
      assetId: 'edu-source-n5182b',
      role: 'signal-source',
      manufacturer: 'Keysight',
      model: 'N5182B',
      serialOrRedactedId: 'EDU-REDACTED-SG',
      firmwareVersion: 'unverified',
      installedOptionIds: [],
      queryBack: {
        evidenceId: 'edu-source-query-back-pending',
        acquiredAtIso: '2026-07-17T07:00:00.000Z',
        model: 'N5182B',
        serialOrRedactedId: 'EDU-REDACTED-SG',
        firmwareVersion: 'unverified',
        optionIds: [],
        status: 'unverified',
      },
      unverifiedConditions: ['Actual serial, firmware and installed options require bench query-back.'],
    },
    {
      assetId: 'edu-analyzer-n9020b',
      role: 'analyzer',
      manufacturer: 'Keysight',
      model: 'N9020B',
      serialOrRedactedId: 'EDU-REDACTED-SA',
      firmwareVersion: 'unverified',
      installedOptionIds: [],
      queryBack: {
        evidenceId: 'edu-analyzer-query-back-pending',
        acquiredAtIso: '2026-07-17T07:00:01.000Z',
        model: 'N9020B',
        serialOrRedactedId: 'EDU-REDACTED-SA',
        firmwareVersion: 'unverified',
        optionIds: [],
        status: 'unverified',
      },
      unverifiedConditions: ['LTE application and license state require direct query-back.'],
    },
    {
      assetId: 'edu-sensor-u2061xa',
      role: 'power-sensor',
      manufacturer: 'Keysight',
      model: 'U2061XA',
      serialOrRedactedId: 'EDU-REDACTED-PM',
      firmwareVersion: 'unverified',
      installedOptionIds: [],
      queryBack: {
        evidenceId: 'edu-sensor-query-back-pending',
        acquiredAtIso: '2026-07-17T07:00:02.000Z',
        model: 'U2061XA',
        serialOrRedactedId: 'EDU-REDACTED-PM',
        firmwareVersion: 'unverified',
        optionIds: [],
        status: 'unverified',
      },
      unverifiedConditions: ['Actual sensor identity and zero/calibration state are not asserted.'],
    },
    {
      assetId: 'edu-psu-n6705c',
      role: 'power-supply',
      manufacturer: 'Keysight',
      model: 'N6705C',
      serialOrRedactedId: 'EDU-REDACTED-PSU',
      firmwareVersion: 'unverified',
      installedOptionIds: ['N6752A-EDU-UNVERIFIED'],
      installedModules: [{
        moduleAssetId: 'edu-psu-module-n6752a',
        model: 'N6752A',
        serialOrRedactedId: 'EDU-REDACTED-PSU-MODULE',
        firmwareVersion: 'unverified',
        installedOptionIds: [],
        queryBackModel: 'N6752A',
        queryBackSerialOrRedactedId: 'EDU-REDACTED-PSU-MODULE',
        queryBackFirmwareVersion: 'unverified',
        queryBackOptionIds: [],
        queryBackEvidenceId: 'edu-n6752a-query-back-pending',
        queryBackStatus: 'unverified',
        unverifiedConditions: ['Actual N6752A module identity, firmware and rating require direct query-back.'],
      }],
      queryBack: {
        evidenceId: 'edu-psu-query-back-pending',
        acquiredAtIso: '2026-07-17T07:00:03.000Z',
        model: 'N6705C',
        serialOrRedactedId: 'EDU-REDACTED-PSU',
        firmwareVersion: 'unverified',
        optionIds: ['N6752A-EDU-UNVERIFIED'],
        status: 'unverified',
      },
      unverifiedConditions: ['N6752A module identity, serial and rating require direct query-back.'],
    },
    {
      assetId: 'edu-vna-e5080b',
      role: 'network-analyzer',
      manufacturer: 'Keysight',
      model: 'E5080B',
      serialOrRedactedId: 'EDU-REDACTED-VNA',
      firmwareVersion: 'unverified',
      installedOptionIds: [],
      queryBack: {
        evidenceId: 'edu-vna-query-back-pending',
        acquiredAtIso: '2026-07-17T07:00:04.000Z',
        model: 'E5080B',
        serialOrRedactedId: 'EDU-REDACTED-VNA',
        firmwareVersion: 'unverified',
        optionIds: [],
        status: 'unverified',
      },
      unverifiedConditions: ['Actual E5080B firmware, options and calibration kit require direct query-back.'],
    },
  ],
  applications: [{
    applicationEvidenceId: 'edu-lte-analysis-app',
    assetId: 'edu-analyzer-n9020b',
    applicationName: 'LTE analysis application',
    version: 'unverified',
    licenseState: 'unverified',
    queryBackEvidenceId: 'edu-analyzer-query-back-pending',
    acquiredAtIso: '2026-07-17T07:00:01.000Z',
    unverifiedConditions: ['Application version and license are conditional until queried.'],
  }],
  accessories: [
    {
      accessoryEvidenceId: 'edu-forward-coupler', assetId: 'edu-sensor-u2061xa',
      label: 'Forward directional coupler', model: 'EDU-COUPLER-30', serialOrRedactedId: 'EDU-REDACTED-COUPLER',
      maximumFrequencyHz: 6_000_000_000, maximumInputPowerDbm: 47, impedanceOhms: 50,
      ratingEvidenceId: 'edu-coupler-rating-sheet', ratingState: 'unverified',
      unverifiedConditions: ['Coupling factor, directivity, port direction and power derating require inspection and verification.'],
    },
    {
      accessoryEvidenceId: 'edu-output-attenuator', assetId: 'edu-analyzer-n9020b',
      label: 'Output path attenuator', model: 'EDU-ATT-30', serialOrRedactedId: 'EDU-REDACTED-ATT',
      maximumFrequencyHz: 6_000_000_000, maximumInputPowerDbm: 47, impedanceOhms: 50,
      ratingEvidenceId: 'edu-attenuator-rating-sheet', ratingState: 'unverified',
      unverifiedConditions: ['Actual installed accessory identity and power derating require inspection.'],
    },
    {
      accessoryEvidenceId: 'edu-dc-block', assetId: 'edu-analyzer-n9020b',
      label: 'DC block', model: 'EDU-DC-BLOCK', serialOrRedactedId: 'EDU-REDACTED-DCB',
      maximumFrequencyHz: 6_000_000_000, maximumInputPowerDbm: 36, impedanceOhms: 50,
      ratingEvidenceId: 'edu-dc-block-rating-sheet', ratingState: 'unverified',
      unverifiedConditions: ['Frequency range, voltage rating and insertion loss require inspection and verification.'],
    },
    {
      accessoryEvidenceId: 'edu-50ohm-load', assetId: 'edu-source-n5182b',
      label: '50 Ω termination', model: 'EDU-LOAD-50', serialOrRedactedId: 'EDU-REDACTED-LOAD',
      maximumFrequencyHz: 6_000_000_000, maximumInputPowerDbm: 30, impedanceOhms: 50,
      ratingEvidenceId: 'edu-load-rating-sheet', ratingState: 'unverified',
      unverifiedConditions: ['Return loss and safe continuous-power rating require verification.'],
    },
    {
      accessoryEvidenceId: 'edu-rf-cable-set', assetId: 'edu-vna-e5080b',
      label: 'RF cable set', model: 'EDU-CABLE-SET', serialOrRedactedId: 'EDU-REDACTED-CABLES',
      maximumFrequencyHz: 6_000_000_000, maximumInputPowerDbm: 47, impedanceOhms: 50,
      ratingEvidenceId: 'edu-cable-inspection-record', ratingState: 'unverified',
      unverifiedConditions: ['Cable identity, flex state, connector wear and phase stability require inspection.'],
    },
    {
      accessoryEvidenceId: 'edu-cal-kit', assetId: 'edu-vna-e5080b',
      label: 'VNA calibration kit', model: 'EDU-CAL-KIT', serialOrRedactedId: 'EDU-REDACTED-CALKIT',
      maximumFrequencyHz: 6_000_000_000, impedanceOhms: 50,
      ratingEvidenceId: 'edu-cal-kit-definition', ratingState: 'unverified',
      unverifiedConditions: ['Cal-kit model, serial, definition and connector condition require query-back and inspection.'],
    },
    {
      accessoryEvidenceId: 'edu-torque-tool', assetId: 'edu-vna-e5080b',
      label: 'RF connector torque tool', model: 'EDU-TORQUE', serialOrRedactedId: 'EDU-REDACTED-TORQUE',
      ratingEvidenceId: 'edu-torque-calibration-record', ratingState: 'unverified',
      unverifiedConditions: ['Torque setting, tool calibration status and connector-family applicability require inspection.'],
    },
  ],
  calibrations: [{
    calibrationEvidenceId: 'edu-station-cal-001',
    assetId: 'edu-sensor-u2061xa',
    certificateOrEducationalId: 'EDU-CAL-REDACTED',
    validFromIso: '2026-01-01T00:00:00.000Z',
    validThroughIso: '2026-12-31T23:59:59.000Z',
    scope: 'Educational 1.740 GHz power-path scenario only',
    state: 'unverified',
    verificationId: 'edu-golden-through-001',
    unverifiedConditions: ['This educational ID is not an actual calibration certificate.'],
  }],
  verificationIds: ['edu-golden-through-001'],
  unverifiedConditions: ['Built-in manifest does not assert actual equipment possession or readiness.'],
  capabilities: [
    {
      id: 'calibration-artifact',
      label: 'Calibration artifact',
      state: 'ready',
      evidence: 'Artifact ID, 적용 frequency·level 범위와 timestamp가 test contract에 연결됨',
      requiredAssetIds: ['edu-sensor-u2061xa'],
      requiredAssetConfigurations: [{ assetId: 'edu-sensor-u2061xa', requiredModel: 'U2061XA', requiredOptionIds: [], requiredModules: [] }],
      requiredAccessoryIds: ['edu-rf-cable-set', 'edu-cal-kit', 'edu-torque-tool'],
      requiredApplicationIds: [],
      requiredCalibrationIds: ['edu-station-cal-001'],
    },
    {
      id: 'verification-trace',
      label: 'Verification trace',
      state: 'blocked',
      evidence: 'Golden through drift 0.42 dB · station tolerance ±0.20 dB 초과',
      requiredAssetIds: ['edu-vna-e5080b'],
      requiredAssetConfigurations: [{ assetId: 'edu-vna-e5080b', requiredModel: 'E5080B', requiredOptionIds: [], requiredModules: [] }],
      requiredAccessoryIds: ['edu-rf-cable-set', 'edu-cal-kit', 'edu-torque-tool'],
      requiredApplicationIds: [],
      requiredCalibrationIds: [],
    },
    {
      id: 'working-headroom',
      label: 'Working-limit headroom',
      state: 'ready',
      evidence: 'Worst-case peak가 connector·mixer working limit보다 6.0 dB 낮음',
      requiredAssetIds: ['edu-analyzer-n9020b', 'edu-sensor-u2061xa'],
      requiredAssetConfigurations: [
        { assetId: 'edu-analyzer-n9020b', requiredModel: 'N9020B', requiredOptionIds: ['526', 'B1X', 'MPB', 'P26'], requiredModules: [] },
        { assetId: 'edu-sensor-u2061xa', requiredModel: 'U2061XA', requiredOptionIds: [], requiredModules: [] },
      ],
      requiredAccessoryIds: ['edu-forward-coupler', 'edu-output-attenuator', 'edu-dc-block'],
      requiredApplicationIds: ['edu-lte-analysis-app'],
      requiredCalibrationIds: ['edu-station-cal-001'],
    },
    {
      id: 'interlock-cleanup',
      label: 'Interlock and cleanup',
      state: 'ready',
      evidence: 'RF inhibit, DUT-specific bias safe-down과 abort record 확인',
      requiredAssetIds: ['edu-source-n5182b', 'edu-psu-n6705c'],
      requiredAssetConfigurations: [
        { assetId: 'edu-source-n5182b', requiredModel: 'N5182B', requiredOptionIds: ['506', '656'], requiredModules: [] },
        {
          assetId: 'edu-psu-n6705c', requiredModel: 'N6705C', requiredOptionIds: [],
          requiredModules: [{ moduleAssetId: 'edu-psu-module-n6752a', model: 'N6752A', requiredOptionIds: ['761'] }],
        },
      ],
      requiredAccessoryIds: ['edu-50ohm-load'],
      requiredApplicationIds: [],
      requiredCalibrationIds: [],
    },
  ],
};

const REQUIRED_CAPABILITIES = STATION_MANIFEST.capabilities.map(({ id }) => id);

function QualificationControls({ onCommit }: { onCommit: () => void }) {
  const reportInteraction = useLabControlInteraction();
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());
  const allReviewed = reviewed.size === REQUIRED_CAPABILITIES.length;

  function toggle(id: string) {
    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="dvt-control-list">
      <p>각 evidence를 실제 판정값과 함께 확인해야 station 결론을 확정할 수 있습니다.</p>
      {STATION_MANIFEST.capabilities.map((capability) => (
        <label key={capability.id}>
          <input
            type="checkbox"
            checked={reviewed.has(capability.id)}
            onChange={() => toggle(capability.id)}
          />
          <span>
            <strong>{capability.label}</strong>
            <small>{capability.evidence}</small>
          </span>
        </label>
      ))}
      <button
        type="button"
        className="lab-button lab-button--primary"
        disabled={!allReviewed}
        onClick={() => {
          reportInteraction('station-qualification-commit');
          onCommit();
        }}
      >
        Station 판정 확정
      </button>
    </div>
  );
}

export function StationQualificationLab({ progressId }: DvtLabProps) {
  const [committed, setCommitted] = useState(false);
  const result = useMemo(
    () => evaluateStationReadiness(
      STATION_MANIFEST,
      REQUIRED_CAPABILITIES,
      '2026-07-17T07:00:00.000Z',
    ),
    [],
  );
  const resultLabel = result.state === 'ready'
    ? 'READY'
    : result.state === 'conditional'
      ? 'CONDITIONAL'
      : 'BLOCKED';
  const blocker = result.effectiveCapabilities.find(({ effectiveState }) => effectiveState === 'blocked');
  const provenanceRows = [
    ...STATION_MANIFEST.assets.map((asset) => ({
      label: `${asset.role} · ${asset.model}`,
      value: `${asset.serialOrRedactedId} · firmware ${asset.firmwareVersion}`,
      evidence: `Options ${asset.installedOptionIds.join(', ') || 'unverified/none'} · modules ${asset.installedModules?.map((module) => `${module.model}/${module.serialOrRedactedId}/${module.queryBackStatus}/${module.queryBackEvidenceId}`).join(', ') || 'none'} · query-back ${asset.queryBack.status} (${asset.queryBack.evidenceId}) · ${asset.unverifiedConditions.join('; ') || 'No open condition'}`,
    })),
    ...STATION_MANIFEST.applications.map((application) => ({
      label: `Application · ${application.applicationName}`,
      value: `${application.version} · license ${application.licenseState}`,
      evidence: `${application.queryBackEvidenceId} · ${application.unverifiedConditions.join('; ') || 'No open condition'}`,
    })),
    ...STATION_MANIFEST.accessories.map((accessory) => ({
      label: `Accessory · ${accessory.label}`,
      value: `${accessory.model} · ${accessory.maximumFrequencyHz ? `${(accessory.maximumFrequencyHz / 1e9).toFixed(1)} GHz` : 'frequency unverified'} · ${accessory.maximumInputPowerDbm ?? 'power unverified'} dBm`,
      evidence: `${accessory.ratingEvidenceId} · rating ${accessory.ratingState} · ${accessory.unverifiedConditions.join('; ') || 'No open condition'}`,
    })),
    ...STATION_MANIFEST.calibrations.map((calibration) => ({
      label: `Calibration · ${calibration.assetId}`,
      value: `${calibration.certificateOrEducationalId} · ${calibration.state}`,
      evidence: `${calibration.verificationId} · ${calibration.scope} · ${calibration.unverifiedConditions.join('; ') || 'No open condition'}`,
    })),
    {
      label: 'Station verification IDs',
      value: STATION_MANIFEST.verificationIds.join(', '),
      evidence: STATION_MANIFEST.unverifiedConditions.join('; ') || 'No station-level open condition',
    },
  ];
  const ledger: LedgerEntry[] = [
    { label: '변경', value: '네 capability evidence를 순서대로 검토하고 station 판정을 commit' },
    { label: '직접 효과', value: `Required capability reduction → ${resultLabel} · 5 asset query-back provenance records`, tone: result.state === 'ready' ? 'active' : 'warning' },
    { label: '화면 결과', value: blocker ? `${blocker.label}: ${blocker.reasons.join('; ')}` : '모든 required capability의 effective state가 ready' },
    { label: '비용·한계', value: '교육용 station manifest · 실제 calibration certificate, safety policy와 장비 option query를 대신하지 않음', tone: 'warning' },
  ];
  const conclusion = result.state === 'blocked'
    ? `Station ${STATION_MANIFEST.stationId} rev ${STATION_MANIFEST.revisionId}는 PA DVT 측정에 BLOCKED다. ${blocker?.label ?? 'required capability'}의 effective dependency state가 실패했으므로 다른 capability의 nominal READY 표시는 유효 판정으로 승격하지 않는다. DUT를 연결하기 전에 option/module query-back, verification, calibration과 path 상태를 다시 검증해야 한다.`
    : `Station ${STATION_MANIFEST.stationId} rev ${STATION_MANIFEST.revisionId}는 선택한 required capability에 대해 ${resultLabel}다. 모든 evidence ID와 적용 범위를 test result에 연결해야 한다.`;

  return (
    <LabShell
      labId={progressId}
      title="Station qualification 실험"
      question="세 항목이 통과해도 verification 하나가 실패하면 이 station은 준비된 것일까?"
      description="Calibration, verification, working-limit headroom과 abort protection을 독립 capability evidence로 검토한 뒤 station 사용 가능 여부를 판정합니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{ 'station-qualification-commit': ['source', 'dut', 'acquisition', 'dsp', 'display'] }}
      controls={<QualificationControls onCommit={() => setCommitted(true)} />}
      ledger={ledger}
      prediction={{
        id: 'station-readiness-gate',
        prompt: '필수 capability 네 개 중 verification만 허용 범위를 벗어나면?',
        options: [
          '나머지가 통과했으므로 READY',
          '검증 실패가 하나라도 있으면 해당 측정은 BLOCKED',
          'DUT 결과가 좋으면 station evidence는 생략',
        ],
        correctIndex: 1,
        explanation: '필수 capability는 평균 점수가 아니라 gate입니다. 하나의 blocker도 DUT 결과의 유효성을 무너뜨리므로 재검증 전에는 측정을 commit하지 않습니다.',
      }}
      note="이 manifest는 built-in 교육 시나리오입니다. 실제 calibration certificate, golden device limit, station safety interlock와 조직의 승인 절차를 대체하지 않습니다."
    >
      {committed ? (
        <DvtReportPanel
          title="Station qualification 보고서"
          status={resultLabel}
          summary={blocker ? `Effective blocker: ${blocker.reasons.join(' · ')}` : '필수 dependency evidence가 effective READY입니다.'}
          conclusion={conclusion}
          rows={[
            ...result.effectiveCapabilities.map((capability) => ({
              label: capability.label,
              value: capability.effectiveState.toUpperCase(),
              evidence: `Nominal ${capability.nominalState?.toUpperCase() ?? 'MISSING'} · ${capability.reasons.join('; ') || capability.evidence}`,
            })),
            ...provenanceRows,
          ]}
        />
      ) : (
        <section className="dvt-evidence-placeholder" aria-live="polite">
          <h3>Station evidence 잠김</h3>
          <p>예측을 고정하고 네 capability evidence를 모두 검토한 뒤 보고서를 생성하세요.</p>
        </section>
      )}
    </LabShell>
  );
}
