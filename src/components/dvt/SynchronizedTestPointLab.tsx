import { useMemo, useState } from 'react';
import { validateMeasurementPoint } from '@/lib/rf/dvt';
import type {
  DvtMeasurementPoint,
  DvtMeasurementValidationContext,
  DvtStationManifest,
} from '@/types/dvt';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { LabShell } from '../lab/LabShell';
import type { LedgerEntry } from '../lab/types';
import { DvtReportPanel } from './DvtReportPanel';
import type { DvtLabProps } from './StationQualificationLab';

const MEASUREMENT_ASSETS = [
  ['edu-source-n5182b', 'signal-source', 'N5182B', 'n5182b-qb-1842', ['506', '656']],
  ['edu-analyzer-n9020b', 'analyzer', 'N9020B', 'n9020b-qb-1842', ['526', 'B1X', 'MPB', 'P26']],
  ['edu-sensor-u2061xa', 'power-sensor', 'U2061XA', 'u2061xa-qb-1842', []],
  ['edu-psu-n6705c', 'power-supply', 'N6705C', 'n6705c-n6752a-qb-1842', []],
  ['edu-vna-e5080b', 'network-analyzer', 'E5080B', 'e5080b-qb-1842', ['2K0']],
] as const satisfies readonly (readonly [
  string,
  DvtStationManifest['assets'][number]['role'],
  string,
  string,
  readonly string[],
])[];

const MEASUREMENT_STATION: DvtStationManifest = {
  stationId: 'pa-bench-a-qualified-fixture',
  revisionId: 'measurement-fixture-2026-07-17',
  assets: MEASUREMENT_ASSETS.map(([assetId, role, model, evidenceId, optionIds]) => ({
    assetId: assetId!,
    role,
    manufacturer: 'Keysight',
    model: model!,
    serialOrRedactedId: `EDU-${model}-1842`,
    firmwareVersion: 'EDU-VERIFIED-1842',
    installedOptionIds: [...optionIds],
    ...(assetId === 'edu-psu-n6705c' ? {
      installedModules: [{
        moduleAssetId: 'edu-psu-module-n6752a', model: 'N6752A',
        serialOrRedactedId: 'EDU-N6752A-1842', firmwareVersion: 'EDU-VERIFIED-1842',
        installedOptionIds: ['761'], queryBackModel: 'N6752A',
        queryBackSerialOrRedactedId: 'EDU-N6752A-1842', queryBackFirmwareVersion: 'EDU-VERIFIED-1842',
        queryBackOptionIds: ['761'],
        queryBackEvidenceId: 'n6752a-slot1-qb-1842', queryBackStatus: 'verified' as const,
        unverifiedConditions: [],
      }],
    } : {}),
    queryBack: {
      evidenceId: evidenceId!, acquiredAtIso: '2026-07-17T07:59:50.000Z', model: model!,
      serialOrRedactedId: `EDU-${model}-1842`, firmwareVersion: 'EDU-VERIFIED-1842',
      optionIds: [...optionIds], status: 'verified' as const,
    },
    unverifiedConditions: [],
  })),
  applications: [{
    applicationEvidenceId: 'edu-lte-analysis-app', assetId: 'edu-analyzer-n9020b',
    applicationName: 'LTE analysis application', version: 'EDU-VERIFIED-1842',
    licenseState: 'verified', queryBackEvidenceId: 'n9020b-qb-1842',
    acquiredAtIso: '2026-07-17T07:59:50.000Z', unverifiedConditions: [],
  }],
  accessories: [
    {
      accessoryEvidenceId: 'forward-coupler-1842', assetId: 'edu-sensor-u2061xa',
      label: '30 dB forward directional coupler', model: 'EDU-COUPLER-30',
      serialOrRedactedId: 'EDU-COUPLER-1842', maximumFrequencyHz: 6_000_000_000,
      maximumInputPowerDbm: 47, impedanceOhms: 50, ratingEvidenceId: 'coupler-rating-1842',
      ratingState: 'verified', unverifiedConditions: [],
    },
    {
      accessoryEvidenceId: 'output-attenuator-1842', assetId: 'edu-analyzer-n9020b',
      label: '30 dB analyzer protection attenuator', model: 'EDU-ATT-30',
      serialOrRedactedId: 'EDU-ATT-1842', maximumFrequencyHz: 6_000_000_000,
      maximumInputPowerDbm: 47, impedanceOhms: 50, ratingEvidenceId: 'attenuator-rating-1842',
      ratingState: 'verified', unverifiedConditions: [],
    },
  ],
  calibrations: [
    ['source-cal-1842', 'edu-source-n5182b', 'source-level-verification-1842'],
    ['sensor-cal-1842', 'edu-sensor-u2061xa', 'input-coupler-path-verification-1842'],
    ['analyzer-cal-1842', 'edu-analyzer-n9020b', 'output-path-verification-1842'],
    ['psu-cal-1842', 'edu-psu-n6705c', 'psu-readback-verification-1842'],
    ['vna-cal-1842', 'edu-vna-e5080b', 'vna-path-verification-1842'],
  ].map(([calibrationEvidenceId, assetId, verificationId]) => ({
    calibrationEvidenceId: calibrationEvidenceId!, assetId: assetId!,
    certificateOrEducationalId: `EDU-${calibrationEvidenceId}`,
    validFromIso: '2026-01-01T00:00:00.000Z', validThroughIso: '2026-12-31T23:59:59.000Z',
    scope: 'Built-in educational 1.740 GHz measurement fixture only', state: 'valid' as const,
    verificationId: verificationId!, unverifiedConditions: [],
  })),
  verificationIds: [
    'input-coupler-path-verification-1842', 'output-path-verification-1842',
    'rx-noise-path-verification-1842', 'psu-readback-verification-1842',
    'lte-b3-sequence-settling-1842', 'lte-b3-state-repeatability-1842',
    'n9020b-rx-noise-front-end-setup-1842',
  ],
  unverifiedConditions: [],
  capabilities: [{
    id: 'lte-b3-sequential-kpi', label: 'LTE Band 3 repeatable KPI sequence', state: 'ready',
    evidence: 'Verified educational source, measurement instruments, correction provider, coupler and calibrations',
    requiredAssetIds: [
      'edu-source-n5182b', 'edu-analyzer-n9020b', 'edu-sensor-u2061xa',
      'edu-psu-n6705c', 'edu-vna-e5080b',
    ],
    requiredAssetConfigurations: [
      { assetId: 'edu-source-n5182b', requiredModel: 'N5182B', requiredOptionIds: ['506', '656'], requiredModules: [] },
      { assetId: 'edu-analyzer-n9020b', requiredModel: 'N9020B', requiredOptionIds: ['526', 'B1X', 'MPB', 'P26'], requiredModules: [] },
      { assetId: 'edu-sensor-u2061xa', requiredModel: 'U2061XA', requiredOptionIds: [], requiredModules: [] },
      {
        assetId: 'edu-psu-n6705c', requiredModel: 'N6705C', requiredOptionIds: [],
        requiredModules: [{ moduleAssetId: 'edu-psu-module-n6752a', model: 'N6752A', requiredOptionIds: ['761'] }],
      },
      { assetId: 'edu-vna-e5080b', requiredModel: 'E5080B', requiredOptionIds: ['2K0'], requiredModules: [] },
    ],
    requiredAccessoryIds: ['forward-coupler-1842', 'output-attenuator-1842'],
    requiredApplicationIds: ['edu-lte-analysis-app'],
    requiredCalibrationIds: [
      'source-cal-1842', 'sensor-cal-1842', 'analyzer-cal-1842', 'psu-cal-1842', 'vna-cal-1842',
    ],
  }],
};

const MEASUREMENT_CONTEXT: DvtMeasurementValidationContext = {
  stationManifest: MEASUREMENT_STATION,
  sourceAssetId: 'edu-source-n5182b',
  requiredCapabilityIds: ['lte-b3-sequential-kpi'],
  asOfIso: '2026-07-17T08:00:01.000Z',
};

const TEST_POINT: DvtMeasurementPoint = {
  pointId: 'fdd-b3-pout-01',
  waveform: {
    waveformId: 'LTE_FDD_B3_20M_QPSK',
    waveformSha256: 'b'.repeat(64),
    rat: 'LTE',
    bandId: '3',
    duplexMode: 'FDD',
    direction: 'UL',
    centerFrequencyHz: 1_740_000_000,
    channelBandwidthHz: 20_000_000,
    allocationId: 'full-rb-qpsk-01',
    resourceBlockStart: 0,
    resourceBlockCount: 100,
    modulation: 'QPSK',
    sourceSetpointDbm: -6.6,
  },
  dutState: {
    stateId: 'pamid-mode-high-gain-01',
    intendedMode: 'generic-high-gain',
    queriedMode: 'generic-high-gain',
    queryBackAtIso: '2026-07-17T08:00:00.400Z',
    biasState: 'on',
    fixtureTemperatureC: 46.5,
  },
  supplyStateId: '4p2v-cv-1p86a',
  requiredEvidenceIds: ['pin', 'pout', 'dc', 'spectrum', 'aclr', 'evm', 'tx-noise'],
  metricEvidence: [
    {
      evidenceId: 'pin', metric: 'pin', measurementMethod: 'forward-coupled-power-sensor',
      instrumentAssetId: 'edu-sensor-u2061xa', instrumentQueryBackEvidenceId: 'u2061xa-qb-1842',
      measurementCalibrationEvidenceId: 'sensor-cal-1842', acquisitionId: 'record-1842-pin',
      acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 1,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT input', correctionId: 'forward-coupler-in-path-2026-07',
      correctionProviderAssetId: 'edu-vna-e5080b', correctionCalibrationEvidenceId: 'vna-cal-1842',
      correctionVerificationId: 'input-coupler-path-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:00.900Z', status: 'valid', overload: false, errors: [],
      rawPowerDbm: -37, correctedPowerDbm: -7,
      coupler: {
        accessoryEvidenceId: 'forward-coupler-1842', direction: 'forward', inputPort: 'source-input',
        throughPort: 'dut-input-through', coupledPort: 'forward-coupled-sensor', couplingFactorDb: 30,
        signedCorrectionDb: 30, expandedUncertaintyDb: 0.35,
        verificationId: 'input-coupler-path-verification-1842',
      },
    },
    {
      evidenceId: 'pout', metric: 'pout', measurementMethod: 'analyzer-channel-power',
      instrumentAssetId: 'edu-analyzer-n9020b', instrumentQueryBackEvidenceId: 'n9020b-qb-1842',
      measurementCalibrationEvidenceId: 'analyzer-cal-1842', acquisitionId: 'record-1842-pout',
      acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 2,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT output', correctionId: 'n9020b-output-path-2026-07',
      correctionProviderAssetId: 'edu-vna-e5080b', correctionCalibrationEvidenceId: 'vna-cal-1842',
      correctionVerificationId: 'output-path-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:01.000Z', status: 'valid', overload: false, errors: [],
      rawPowerDbm: -4.7, correctedPowerDbm: 25.3, channelPowerBandwidthHz: 18_000_000,
      outputPath: {
        accessoryEvidenceIds: ['output-attenuator-1842'], signedCorrectionDb: 30,
        expandedUncertaintyDb: 0.4, verificationId: 'output-path-verification-1842',
      },
    },
    {
      evidenceId: 'dc', metric: 'dc', instrumentAssetId: 'edu-psu-n6705c',
      instrumentQueryBackEvidenceId: 'n6705c-n6752a-qb-1842', measurementCalibrationEvidenceId: 'psu-cal-1842',
      acquisitionId: 'record-1842-dc', acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 3,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT supply/sense terminals', correctionId: 'n6705c-readback-2026-07',
      correctionProviderAssetId: 'edu-psu-n6705c', correctionCalibrationEvidenceId: 'psu-cal-1842',
      correctionVerificationId: 'psu-readback-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:01.100Z', status: 'valid', overload: false, errors: [],
      rawVoltageV: 4.19, rawCurrentA: 1.85, correctedVoltageV: 4.2, correctedCurrentA: 1.86,
    },
    {
      evidenceId: 'spectrum', metric: 'spectrum', instrumentAssetId: 'edu-analyzer-n9020b',
      instrumentQueryBackEvidenceId: 'n9020b-qb-1842', measurementCalibrationEvidenceId: 'analyzer-cal-1842',
      acquisitionId: 'record-1842-spectrum', acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 4,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT output', correctionId: 'n9020b-spectrum-path-2026-07',
      correctionProviderAssetId: 'edu-vna-e5080b', correctionCalibrationEvidenceId: 'vna-cal-1842',
      correctionVerificationId: 'output-path-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:01.200Z', status: 'valid', overload: false, errors: [],
      rawChannelPowerDbm: -4.7, correctedChannelPowerDbm: 25.3,
    },
    {
      evidenceId: 'aclr', metric: 'aclr', instrumentAssetId: 'edu-analyzer-n9020b',
      instrumentQueryBackEvidenceId: 'n9020b-qb-1842', measurementCalibrationEvidenceId: 'analyzer-cal-1842',
      acquisitionId: 'record-1842-aclr', acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 5,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT output', correctionId: 'n9020b-aclr-path-2026-07',
      correctionProviderAssetId: 'edu-vna-e5080b', correctionCalibrationEvidenceId: 'vna-cal-1842',
      correctionVerificationId: 'output-path-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:01.300Z', status: 'valid', overload: false, errors: [],
      rawAclrDbc: -30.4, correctedAclrDbc: -30.8, rawPositiveAclrDb: 30.4, correctedPositiveAclrDb: 30.8,
      integrationConditions: { mainChannelBandwidthHz: 18_000_000, adjacentChannelBandwidthHz: 18_000_000, channelSpacingHz: 20_000_000, detector: 'rms', filterId: 'lte-aclr-filter-001' },
    },
    {
      evidenceId: 'evm', metric: 'evm', instrumentAssetId: 'edu-analyzer-n9020b',
      instrumentQueryBackEvidenceId: 'n9020b-qb-1842', measurementCalibrationEvidenceId: 'analyzer-cal-1842',
      acquisitionId: 'record-1842-evm', acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 6,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT output', correctionId: 'n9020b-vsa-path-2026-07',
      correctionProviderAssetId: 'edu-vna-e5080b', correctionCalibrationEvidenceId: 'vna-cal-1842',
      correctionVerificationId: 'output-path-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:01.400Z', status: 'valid', overload: false, errors: [],
      rawEvmPercent: 3.2, correctedEvmPercent: 3.1, applicationEvidenceId: 'edu-lte-analysis-app',
      licenseState: 'verified', referenceWaveformId: 'LTE_FDD_B3_20M_QPSK', equalizationMode: 'pilot-based',
      normalizationReference: 'equalized reference RMS', residualEvmPercent: 0.6, residualEvidenceId: 'through-evm-residual-001',
    },
    {
      evidenceId: 'tx-noise', metric: 'tx-noise', instrumentAssetId: 'edu-analyzer-n9020b',
      instrumentQueryBackEvidenceId: 'n9020b-qb-1842', measurementCalibrationEvidenceId: 'analyzer-cal-1842',
      acquisitionId: 'record-1842-tx-noise', acquisitionGroupId: 'lte-b3-sequence-1842', acquisitionSequenceIndex: 7,
      triggerReferenceId: 'rf-burst-marker-1', triggerRepeatabilitySeconds: 2.4e-6, settlingSeconds: 0.02,
      referencePlane: 'DUT output', correctionId: 'rx-noise-corr-001',
      correctionProviderAssetId: 'edu-vna-e5080b', correctionCalibrationEvidenceId: 'vna-cal-1842',
      correctionVerificationId: 'rx-noise-path-verification-1842',
      apertureSeconds: 0.5, acquiredAtIso: '2026-07-17T08:00:01.500Z', status: 'valid', overload: false, errors: [],
      rawNoise: { convention: 'rbw-integrated', integratedNoisePowerDbm: -95.4, equivalentNoiseBandwidthHz: 100_000 },
      correctedNoise: { convention: 'rbw-integrated', integratedNoisePowerDbm: -95, equivalentNoiseBandwidthHz: 100_000 },
      resolutionBandwidthHz: 100_000, equivalentNoiseBandwidthHz: 100_000,
      analyzerFloorDensityDbmPerHz: -165, floorEvidenceId: 'terminated-floor-001',
      analyzerFrontEndSetup: {
        setupEvidenceId: 'n9020b-rx-noise-front-end-setup-1842',
        inputAttenuationDb: 10,
        preamplifierEnabled: false,
        referenceLevelDbm: -70,
        detector: 'rms',
        measurementMode: 'swept-spectrum',
      },
    },
  ],
  acquisitionPolicy: {
    mode: 'repeatable-sequence',
    requiredAcquisitionGroupId: 'lte-b3-sequence-1842',
    maximumTriggerRepeatabilitySeconds: 1e-6,
    minimumSettlingSeconds: 0.01,
    settlingEvidenceId: 'lte-b3-sequence-settling-1842',
    stateRepeatabilityEvidenceId: 'lte-b3-state-repeatability-1842',
  },
  configuredAtIso: '2026-07-17T08:00:00.000Z',
  acquiredAtIso: '2026-07-17T08:00:01.500Z',
  triggerId: 'rf-burst-marker-1',
  triggerDelaySeconds: 2.4e-6,
  dwellSeconds: 1,
  sourceState: 'leveled',
  analyzerState: 'in-range',
  acquisitionState: 'fresh',
  calibrationState: 'valid',
  triggerAlignment: 'misaligned',
  psuRegulationMode: 'CV',
  instrumentErrors: [],
  cleanup: {
    rfOutput: { status: 'off', atIso: '2026-07-17T08:00:02.100Z', evidenceId: 'sg-rf-off-1842' },
    acquisition: { status: 'aborted', atIso: '2026-07-17T08:00:02.100Z', evidenceId: 'sa-abort-1842' },
    bias: { status: 'safe-down', atIso: '2026-07-17T08:00:02.500Z', evidenceId: 'dut-safe-down-1842' },
    dcOutput: { status: 'off', atIso: '2026-07-17T08:00:02.500Z', evidenceId: 'psu-off-1842' },
  },
};

const EVIDENCE = [
  { id: 'sg', label: 'N5182B SG query-back', value: 'Waveform/checksum/frequency/allocation 일치 · LEVELED · error 0 · 08:00:00.400Z' },
  { id: 'sa', label: 'N9020B corrected channel-power Pout', value: 'Mixer/ADC IN RANGE · 18 MHz channel power · output correction +30.0 dB · sequence record 2 · error 0' },
  { id: 'psu', label: 'N6705C PSU query-back', value: 'CV · 4.20 V / 1.86 A · sequence record 3 · 0.50 s aperture · error 0' },
  { id: 'sensor', label: 'U2061XA forward-coupler Pin', value: 'Coupled port −37.0 dBm · signed correction +30.0 dB · DUT-input Pin −7.0 dBm · U 0.35 dB' },
  { id: 'vna', label: 'E5080B path verification provider', value: 'Correction provider only · coupler/output correction IDs verified at 1.740 GHz · waveform power 측정 장비 아님' },
  { id: 'transaction', label: 'Repeatable acquisition-sequence contract', value: '서로 다른 record 7개 · group lte-b3-sequence-1842 · common trigger reference · settling ≥10 ms · state evidence lte-b3-state-repeatability-1842 · 최대 trigger repeatability 1.0 µs' },
  { id: 'aclr', label: 'ACLR native/normalized pair', value: 'Native corrected −30.8 dBc adjacent−main · normalized positive main/adjacent ratio 30.8 dB' },
  { id: 'evm', label: 'Qualified EVM evidence', value: '3.1% · verified application · reference, equalization, normalization과 residual 조건 기록' },
  { id: 'tx-noise-frontend', label: 'N9020B Tx-noise front-end setup', value: 'Input attenuation 10 dB · preamplifier OFF · reference level −70 dBm · RMS swept-spectrum · setup evidence n9020b-rx-noise-front-end-setup-1842' },
  { id: 'trigger', label: 'Trigger overlay', value: 'Trigger edge가 RF gate보다 2.4 µs 늦음 · MISALIGNED' },
  { id: 'errors', label: 'All instrument error queues', value: 'N5182B/N9020B/N6705C/U2061XA/E5080B error count 0' },
  { id: 'rf-abort', label: 'RF OFF and acquisition abort', value: 'RF OFF CONFIRMED · acquisition ABORTED · result 08:00:02.100Z' },
  { id: 'bias-down', label: 'DUT safe bias-down', value: 'Approved generic safe-down complete · DC OFF CONFIRMED · result 08:00:02.500Z' },
] as const;

function EvidenceRevealControls({ onCommit }: { onCommit: () => void }) {
  const reportInteraction = useLabControlInteraction();
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const allRevealed = revealed.size === EVIDENCE.length;

  return (
    <div className="dvt-evidence-controls">
      <p>장비·metric·cleanup validity evidence를 모두 확인한 뒤 point validity를 확정하세요.</p>
      <div className="dvt-evidence-controls__actions">
        {EVIDENCE.map((item) => (
          <button
            key={item.id}
            type="button"
            className="lab-button lab-button--secondary"
            aria-pressed={revealed.has(item.id)}
            onClick={() => setRevealed((current) => new Set([...current, item.id]))}
          >
            증거 확인: {item.label}
          </button>
        ))}
      </div>
      <ol className="dvt-evidence-list" aria-live="polite">
        {EVIDENCE.filter(({ id }) => revealed.has(id)).map((item) => (
          <li key={item.id}><strong>{item.label}</strong><span>{item.value}</span></li>
        ))}
      </ol>
      <button
        type="button"
        className="lab-button lab-button--primary"
        disabled={!allRevealed}
        onClick={() => {
          reportInteraction('synchronized-point-commit');
          onCommit();
        }}
      >
        Test point 유효성 확정
      </button>
    </div>
  );
}

export function SynchronizedTestPointLab({ progressId }: DvtLabProps) {
  const [committed, setCommitted] = useState(false);
  const validation = useMemo(() => validateMeasurementPoint(TEST_POINT, MEASUREMENT_CONTEXT), []);
  const status = validation.validity.toUpperCase();
  const reasons = validation.reasons.length > 0 ? validation.reasons.join(' · ') : '모든 validity gate 통과';
  const ledger: LedgerEntry[] = [
    { label: '변경', value: committed ? `${EVIDENCE.length}개 장비·metric·cleanup evidence를 결합해 point validity를 commit` : 'Validity evidence를 아직 모두 확인하지 않음' },
    { label: '직접 효과', value: committed ? `Validation state → ${status}` : 'Point state 미확정', tone: committed && validation.validity !== 'valid' ? 'warning' : 'neutral' },
    { label: '화면 결과', value: committed ? reasons : '보고서와 KPI 계산이 잠겨 있음' },
    { label: '비용·한계', value: '이 fixture는 물리적 동시 acquisition이 아니라 동일 operating point를 반복 재현하는 sequence · trigger repeatability와 settling evidence 필요', tone: 'warning' },
  ];
  const conclusion = `Test point ${TEST_POINT.pointId}는 ${status}다. Pin/Pout/DC/spectrum/ACLR/EVM/Tx-noise는 같은 acquisition group의 독립 record와 공통 trigger reference로 연결됐고 cleanup도 기록됐지만 ${reasons}. 이 point를 승인 KPI 추세에 포함하지 않고 trigger path를 정렬한 뒤 새 sequence group으로 재측정해야 한다.`;

  return (
    <LabShell
      labId={progressId}
      title="Synchronized test-point transaction"
      question="Pin·Pout·current가 모두 숫자로 저장돼도 trigger가 어긋난 point를 분석에 넣어도 될까?"
      description="Source, analyzer, acquisition, calibration, trigger와 error queue evidence가 같은 operating state를 나타내는지 검증합니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{ 'synchronized-point-commit': ['source', 'dut', 'acquisition', 'dsp', 'display'] }}
      controls={<EvidenceRevealControls onCommit={() => setCommitted(true)} />}
      ledger={ledger}
      prediction={{
        id: 'synchronized-point-validity',
        prompt: 'RF/DC 값은 정상 범위지만 trigger alignment가 실패했다면?',
        options: [
          '평균값이 있으므로 VALID',
          'INVALID로 보존하고 DUT KPI 계산에서 제외',
          'Timestamp가 가까우면 trigger evidence는 불필요',
        ],
        correctIndex: 1,
        explanation: '서로 다른 시간 구간의 RF와 DC를 한 point로 결합하면 원인과 결과가 섞입니다. Raw record는 diagnostic evidence로 보존하되 정상 KPI에는 포함하지 않습니다.',
      }}
      note="Built-in FDD PA point와 결정론적 state validation만 사용합니다. 46.5 °C는 pinned 장비가 제공하지 않는 optional educational fixture-sensor metadata이며 junction temperature가 아닙니다. 실제 latency, cable delay, trigger jitter와 invalid-data policy를 대체하지 않습니다."
    >
      {committed ? (
        <DvtReportPanel
          title="Synchronized test-point 보고서"
          status={status}
          summary={reasons}
          conclusion={conclusion}
          rows={[
            { label: 'Required metric subset', value: 'Pin · Pout · DC · spectrum · ACLR · EVM · Tx-noise', evidence: '7 sequential records · group lte-b3-sequence-1842 · point trigger match · settling ≥10 ms · state-repeatability evidence · 1.0 µs trigger-repeatability limit' },
            { label: 'RF condition', value: '1.740 GHz · Pin −7.0 dBm · Pout 25.3 dBm', evidence: 'U2061XA forward-coupler Pin · N9020B corrected channel-power Pout · E5080B path-verification provider only' },
            { label: 'DC / optional fixture sensor', value: '4.2 V · 1.86 A · 46.5 °C', evidence: 'N6705C CV · fixture sensor metadata · junction temperature 아님' },
            { label: 'ACLR convention pair', value: '−30.8 dBc native · 30.8 dB normalized ratio', evidence: 'adjacent−main negative dBc preserved; positive main/adjacent ratio named separately' },
            { label: 'Qualified EVM', value: '3.1% · VALID', evidence: 'Verified VSA application·reference·equalization·normalization·residual recorded' },
            { label: 'Tx-noise analyzer front end', value: '10 dB attenuation · preamplifier OFF · reference −70 dBm', evidence: 'RMS swept-spectrum · n9020b-rx-noise-front-end-setup-1842 registered' },
            { label: 'Instrument status', value: 'SG/SA/PSU/Sensor/VNA error 0', evidence: 'Query-back, aperture, timestamp와 correction IDs reviewed' },
            { label: 'Trigger alignment', value: 'MISALIGNED', evidence: 'RF gate 기준 +2.4 µs' },
            { label: 'Cleanup', value: 'RF OFF · acquisition ABORTED · DUT safe bias-down', evidence: '08:00:02.100Z / 08:00:02.500Z · results confirmed' },
            { label: 'Validation reason', value: status, evidence: reasons },
          ]}
        />
      ) : (
        <section className="dvt-evidence-placeholder" aria-live="polite">
          <h3>Test-point validity 잠김</h3>
          <p>장비·metric·cleanup evidence를 공개해 같은 acquisition state인지 확인하세요.</p>
        </section>
      )}
    </LabShell>
  );
}
