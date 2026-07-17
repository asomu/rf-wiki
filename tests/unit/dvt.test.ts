import { describe, expect, it } from 'vitest';
import {
  advanceDiagnosticCase,
  buildConclusionEvidenceLinkage,
  calculateDvtPaExpectedValues,
  combineUncertaintyBudget,
  decideWithGuardband,
  DVT_BUILT_IN_CASES,
  DVT_CAPSTONE_OPERATING_PROFILE,
  evaluateDesenseRiskBudget,
  evaluateStationReadiness,
  validateDesenseEvidenceAgainstMeasurementPoint,
  validateConclusionReportCompleteness,
  validateConclusionEvidenceLinkage,
  validateConclusionSourceRecords,
  validateDiagnosticPlan,
  validateEvidenceClassification,
  validateMeasurementPoint,
} from '../../src/lib/rf/dvt';
import { DEFAULT_EDUCATIONAL_PA, evaluatePa, rappOneDbCompressionPoint } from '../../src/lib/rf/pa';
import { dbmToWatts } from '../../src/lib/rf/units';
import { ACLR_UNCERTAINTY_COMPONENTS } from '../../src/components/dvt/UncertaintyDecisionLab';
import { CAPSTONE_OBSERVED_CASE_EVIDENCE, CAPSTONE_SOURCE_RECORDS } from '../../src/data/dvt-capstone';
import type {
  DvtDiagnosticProgress,
  DvtConclusionEvidenceLinkage,
  DvtConclusionReport,
  DvtConclusionSourceRecords,
  DvtDesenseRiskEvidence,
  DvtMeasurementPoint,
  DvtMeasurementValidationContext,
  DvtStationManifest,
} from '../../src/types/dvt';

function makeCapstoneConclusionReport(linkage: DvtConclusionEvidenceLinkage): DvtConclusionReport {
  return {
    reportId: 'capstone-provenance-test-report',
    stationId: linkage.stationId,
    measurementPointId: linkage.measurementPointId,
    decisionIds: linkage.decisions.map(({ metricId }) => metricId),
    acceptedDiagnosticEvidenceIds: linkage.diagnosticEvidenceSources.map(({ evidenceId }) => evidenceId),
    sections: {
      scope: 'Built-in educational capstone provenance test scope.',
      station: 'Requalified station manifest and typed source registry are linked.',
      symptom: 'Historical observations are separated from current allocation results.',
      validity: 'The synchronized measurement point passes its validity gates.',
      decision: 'Guardband decisions are recomputed from the linked source records.',
      hypotheses: 'Evidence-bounded causal confidence remains explicitly recorded.',
      evidence: 'Metric, external, uncertainty, and cleanup evidence are linked.',
      conclusion: 'This report is used only to validate deterministic source linkage.',
      residualRisk: 'The educational model limitations and isolation state difference remain.',
    },
    cleanup: linkage.cleanup,
    nextAction: 'Repeat the built-in sequence if any canonical source record changes.',
    owner: 'RF DVT engineer',
  };
}

describe('DVT station decision models', () => {
  it('reduces required capability evidence to ready, conditional, or blocked', () => {
    const manifest: DvtStationManifest = {
      stationId: 'bench-a',
      revisionId: 'rev-1',
      assets: [{
        assetId: 'source-educational-a',
        role: 'signal-source',
        manufacturer: 'Educational vendor',
        model: 'Source model A',
        serialOrRedactedId: 'EDU-REDACTED-001',
        firmwareVersion: 'A.01.00',
        installedOptionIds: ['EDU-CW'],
        installedModules: [{
          moduleAssetId: 'arb-module-001', model: 'Educational ARB',
          serialOrRedactedId: 'EDU-ARB-001', firmwareVersion: 'A.01',
          installedOptionIds: ['ARB-OPT'], queryBackModel: 'Educational ARB',
          queryBackSerialOrRedactedId: 'EDU-ARB-001', queryBackFirmwareVersion: 'A.01',
          queryBackOptionIds: ['ARB-OPT'],
          queryBackEvidenceId: 'arb-qb-001', queryBackStatus: 'verified', unverifiedConditions: [],
        }],
        queryBack: {
          evidenceId: 'source-qb-001',
          acquiredAtIso: '2026-07-17T07:00:00.000Z',
          model: 'Source model A',
          serialOrRedactedId: 'EDU-REDACTED-001',
          firmwareVersion: 'A.01.00',
          optionIds: ['EDU-CW'],
          status: 'verified',
        },
        unverifiedConditions: [],
      }],
      applications: [],
      accessories: [],
      calibrations: [{
        calibrationEvidenceId: 'source-cal-001',
        assetId: 'source-educational-a',
        certificateOrEducationalId: 'EDU-CAL-001',
        validFromIso: '2026-01-01T00:00:00.000Z',
        validThroughIso: '2026-12-31T23:59:59.000Z',
        scope: 'Educational source level verification',
        state: 'valid',
        verificationId: 'verify-source-001',
        unverifiedConditions: [],
      }],
      verificationIds: ['verify-source-001'],
      unverifiedConditions: [],
      capabilities: [
        {
          id: 'cw', label: 'Calibrated CW', state: 'ready', evidence: 'SG and sensor verified',
          requiredAssetIds: ['source-educational-a'], requiredAccessoryIds: [], requiredApplicationIds: [],
          requiredAssetConfigurations: [{
            assetId: 'source-educational-a', requiredModel: 'Source model A', requiredOptionIds: ['EDU-CW'],
            requiredModules: [{ moduleAssetId: 'arb-module-001', model: 'Educational ARB', requiredOptionIds: ['ARB-OPT'] }],
          }],
          requiredCalibrationIds: ['source-cal-001'],
        },
        {
          id: 'evm', label: 'NR EVM', state: 'conditional', evidence: 'App license not yet queried',
          requiredAssetConfigurations: [],
          requiredAssetIds: [], requiredAccessoryIds: [], requiredApplicationIds: [], requiredCalibrationIds: [],
        },
        {
          id: 'nr100', label: '100 MHz NR source', state: 'blocked', evidence: 'Option 656 is nominal 80 MHz',
          requiredAssetConfigurations: [],
          requiredAssetIds: [], requiredAccessoryIds: [], requiredApplicationIds: [], requiredCalibrationIds: [],
        },
      ],
    };

    expect(evaluateStationReadiness(manifest, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'ready',
      blockingCapabilityIds: [],
      conditionalCapabilityIds: [],
      effectiveCapabilities: [{ id: 'cw', nominalState: 'ready', effectiveState: 'ready', reasons: [] }],
    });
    expect(evaluateStationReadiness(manifest, ['cw', 'evm'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'conditional',
      blockingCapabilityIds: [],
      conditionalCapabilityIds: ['evm'],
    });
    expect(evaluateStationReadiness(manifest, ['cw', 'nr100'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked',
      blockingCapabilityIds: ['nr100'],
      conditionalCapabilityIds: [],
    });
    expect(evaluateStationReadiness(manifest, ['missing'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked',
      blockingCapabilityIds: ['missing'],
    });
    expect(evaluateStationReadiness({
      ...manifest,
      assets: [{
        ...manifest.assets[0]!,
        queryBack: { ...manifest.assets[0]!.queryBack, status: 'unverified' },
        unverifiedConditions: ['Installed option query-back is not confirmed'],
      }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'conditional',
      conditionalCapabilityIds: ['cw'],
    });
    expect(evaluateStationReadiness({
      ...manifest,
      capabilities: [{ ...manifest.capabilities[0]!, requiredAssetIds: ['missing-source'] }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked', blockingCapabilityIds: ['cw'],
    });
    expect(evaluateStationReadiness(manifest, ['cw'], '2027-01-01T00:00:00.000Z')).toMatchObject({
      state: 'blocked', blockingCapabilityIds: ['cw'],
    });
    expect(evaluateStationReadiness({
      ...manifest,
      assets: [{
        ...manifest.assets[0]!,
        queryBack: { ...manifest.assets[0]!.queryBack, optionIds: [] },
      }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked',
      effectiveCapabilities: [{
        id: 'cw', effectiveState: 'blocked',
        reasons: expect.arrayContaining([
          'required asset source-educational-a installed options do not match option query-back',
          'required option EDU-CW is missing from asset source-educational-a',
        ]),
      }],
    });
    expect(evaluateStationReadiness({
      ...manifest,
      assets: [{ ...manifest.assets[0]!, installedModules: [] }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked',
      effectiveCapabilities: [{
        id: 'cw', effectiveState: 'blocked',
        reasons: ['required module arb-module-001 is missing from asset source-educational-a'],
      }],
    });
    expect(evaluateStationReadiness({
      ...manifest,
      assets: [{
        ...manifest.assets[0]!,
        installedModules: manifest.assets[0]!.installedModules!.map((module) => ({
          ...module, queryBackStatus: 'unverified' as const,
        })),
      }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'conditional',
      effectiveCapabilities: [{
        id: 'cw', effectiveState: 'conditional',
        reasons: ['required module arb-module-001 query-back is unverified'],
      }],
    });

    for (const queryBackTamper of [
      { model: 'tampered-model' },
      { serialOrRedactedId: 'tampered-serial' },
      { firmwareVersion: 'tampered-firmware' },
    ]) {
      expect(evaluateStationReadiness({
        ...manifest,
        assets: [{
          ...manifest.assets[0]!,
          queryBack: { ...manifest.assets[0]!.queryBack, ...queryBackTamper },
        }],
      }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
        state: 'blocked', blockingCapabilityIds: ['cw'],
      });
    }
    expect(evaluateStationReadiness({
      ...manifest,
      assets: [{
        ...manifest.assets[0]!,
        queryBack: { ...manifest.assets[0]!.queryBack, acquiredAtIso: '2026-07-17T07:00:00.001Z' },
      }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked', blockingCapabilityIds: ['cw'],
    });
    expect(evaluateStationReadiness({
      ...manifest,
      capabilities: [{
        ...manifest.capabilities[0]!,
        requiredAssetConfigurations: [{
          ...manifest.capabilities[0]!.requiredAssetConfigurations[0]!,
          requiredModel: 'wrong-required-model',
        }],
      }],
    }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
      state: 'blocked', blockingCapabilityIds: ['cw'],
    });

    const applicationManifest: DvtStationManifest = {
      ...manifest,
      applications: [{
        applicationEvidenceId: 'cw-app-001', assetId: 'source-educational-a',
        applicationName: 'Educational waveform app', version: '1.0', licenseState: 'verified',
        queryBackEvidenceId: 'source-qb-001', acquiredAtIso: '2026-07-17T06:59:59.000Z',
        unverifiedConditions: [],
      }],
      capabilities: [{
        ...manifest.capabilities[0]!, requiredApplicationIds: ['cw-app-001'],
      }],
    };
    expect(evaluateStationReadiness(
      applicationManifest, ['cw'], '2026-07-17T07:00:00.000Z',
    )).toMatchObject({ state: 'ready' });
    for (const applicationTamper of [
      { assetId: 'missing-asset' },
      { queryBackEvidenceId: 'wrong-query-back' },
      { version: '' },
      { acquiredAtIso: '2026-07-17T07:00:00.001Z' },
      { licenseState: 'not-required' as const },
    ]) {
      expect(evaluateStationReadiness({
        ...applicationManifest,
        applications: [{ ...applicationManifest.applications[0]!, ...applicationTamper }],
      }, ['cw'], '2026-07-17T07:00:00.000Z')).toMatchObject({
        state: 'blocked', blockingCapabilityIds: ['cw'],
      });
    }
  });

  it('classifies a measurement point as valid, inconclusive, or invalid with ordered reasons', () => {
    const validPoint: DvtMeasurementPoint = {
      pointId: 'p-001',
      waveform: {
        waveformId: 'LTE_FDD_B3_20M_QPSK_RB50',
        waveformSha256: 'a'.repeat(64),
        rat: 'LTE',
        bandId: '3',
        duplexMode: 'FDD',
        direction: 'UL',
        centerFrequencyHz: 1_740_000_000,
        channelBandwidthHz: 20_000_000,
        allocationId: 'RB_START_0_COUNT_50',
        resourceBlockStart: 0,
        resourceBlockCount: 50,
        modulation: 'QPSK',
        sourceSetpointDbm: -7.4,
      },
      dutState: {
        stateId: 'generic-high-power-mode',
        intendedMode: 'high-power',
        queriedMode: 'high-power',
        queryBackAtIso: '2026-07-17T08:00:00.500Z',
        biasState: 'on',
        fixtureTemperatureC: 42,
      },
      supplyStateId: '4p2v-cv-1p2a',
      requiredEvidenceIds: ['pin', 'pout', 'dc'],
      acquisitionPolicy: {
        mode: 'repeatable-sequence',
        requiredAcquisitionGroupId: 'sequence-001',
        maximumTriggerRepeatabilitySeconds: 1e-6,
        minimumSettlingSeconds: 0.01,
        settlingEvidenceId: 'settling-001',
        stateRepeatabilityEvidenceId: 'state-repeatability-001',
      },
      metricEvidence: [
        {
          evidenceId: 'pin',
          metric: 'pin',
          measurementMethod: 'forward-coupled-power-sensor',
          instrumentAssetId: 'sensor-in',
          instrumentQueryBackEvidenceId: 'sensor-in-qb-001',
          measurementCalibrationEvidenceId: 'sensor-in-cal',
          acquisitionId: 'acq-pin-001',
          acquisitionGroupId: 'sequence-001',
          acquisitionSequenceIndex: 1,
          triggerReferenceId: 'trigger-001',
          triggerRepeatabilitySeconds: 0.5e-6,
          settlingSeconds: 0.02,
          rawPowerDbm: -37,
          correctedPowerDbm: -7,
          referencePlane: 'dut-input',
          correctionId: 'input-path-cal-2026-07-17',
          correctionProviderAssetId: 'vna-path',
          correctionCalibrationEvidenceId: 'vna-path-cal',
          correctionVerificationId: 'input-path-verify-001',
          apertureSeconds: 0.5,
          acquiredAtIso: '2026-07-17T08:00:01.000Z',
          status: 'valid',
          overload: false,
          errors: [],
          coupler: {
            accessoryEvidenceId: 'coupler-001', direction: 'forward',
            inputPort: 'input', throughPort: 'through', coupledPort: 'coupled',
            couplingFactorDb: 30, signedCorrectionDb: 30, expandedUncertaintyDb: 0.3,
            verificationId: 'input-path-verify-001',
          },
        },
        {
          evidenceId: 'pout',
          metric: 'pout',
          measurementMethod: 'analyzer-channel-power',
          instrumentAssetId: 'analyzer-out',
          instrumentQueryBackEvidenceId: 'analyzer-out-qb-001',
          measurementCalibrationEvidenceId: 'analyzer-out-cal',
          acquisitionId: 'acq-pout-001',
          acquisitionGroupId: 'sequence-001',
          acquisitionSequenceIndex: 2,
          triggerReferenceId: 'trigger-001',
          triggerRepeatabilitySeconds: 0.5e-6,
          settlingSeconds: 0.02,
          rawPowerDbm: -4.7,
          correctedPowerDbm: 25.3,
          channelPowerBandwidthHz: 18_000_000,
          outputPath: {
            accessoryEvidenceIds: ['output-attenuator-001'], signedCorrectionDb: 30,
            expandedUncertaintyDb: 0.4, verificationId: 'output-path-verify-001',
          },
          referencePlane: 'dut-output',
          correctionId: 'output-path-cal-2026-07-17',
          correctionProviderAssetId: 'vna-path',
          correctionCalibrationEvidenceId: 'vna-path-cal',
          correctionVerificationId: 'output-path-verify-001',
          apertureSeconds: 0.5,
          acquiredAtIso: '2026-07-17T08:00:01.100Z',
          status: 'valid',
          overload: false,
          errors: [],
        },
        {
          evidenceId: 'dc',
          metric: 'dc',
          instrumentAssetId: 'psu-main',
          instrumentQueryBackEvidenceId: 'psu-main-qb-001',
          measurementCalibrationEvidenceId: 'psu-main-cal',
          acquisitionId: 'acq-dc-001',
          acquisitionGroupId: 'sequence-001',
          acquisitionSequenceIndex: 3,
          triggerReferenceId: 'trigger-001',
          triggerRepeatabilitySeconds: 0.5e-6,
          settlingSeconds: 0.02,
          rawVoltageV: 4.19,
          rawCurrentA: 1.19,
          correctedVoltageV: 4.2,
          correctedCurrentA: 1.2,
          referencePlane: 'dut-supply-terminal',
          correctionId: 'psu-lead-drop-2026-07-17',
          correctionProviderAssetId: 'psu-main',
          correctionCalibrationEvidenceId: 'psu-main-cal',
          correctionVerificationId: 'psu-verify-001',
          apertureSeconds: 0.5,
          acquiredAtIso: '2026-07-17T08:00:01.200Z',
          status: 'valid',
          overload: false,
          errors: [],
        },
      ],
      configuredAtIso: '2026-07-17T08:00:00.000Z',
      acquiredAtIso: '2026-07-17T08:00:01.200Z',
      triggerId: 'trigger-001',
      triggerDelaySeconds: 0,
      dwellSeconds: 1,
      sourceState: 'leveled',
      analyzerState: 'in-range',
      acquisitionState: 'fresh',
      calibrationState: 'valid',
      triggerAlignment: 'aligned',
      psuRegulationMode: 'CV',
      instrumentErrors: [],
      analyzerHeadroom: {
        strongestConnectorSignalDbm: -4.7,
        strongestConnectorSignalSourceId: 'pout',
        strongestConnectorSignalRole: 'dominant-off-screen-tx-carrier',
        connectorTotalPowerDbm: -4.7,
        inputAttenuationDb: 10,
        mixerTotalPowerDbm: -14.7,
        stationVerifiedMixerOperatingLimitDbm: -10,
        operatingLimitEvidenceId: 'analyzer-operating-limit-001',
        mixerHeadroomDb: 4.7,
        residualState: {
          kind: 'if-adc-status', status: 'verified-in-range', evidenceId: 'if-adc-in-range-001',
          observedAtIso: '2026-07-17T08:00:01.200Z',
        },
        referenceLevelDbm: 0,
        evidenceId: 'analyzer-headroom-001',
      },
      cleanup: {
        rfOutput: {
          status: 'off',
          atIso: '2026-07-17T08:00:02.000Z',
          evidenceId: 'rf-off-001',
        },
        acquisition: {
          status: 'aborted',
          atIso: '2026-07-17T08:00:02.050Z',
          evidenceId: 'abort-001',
        },
        bias: {
          status: 'safe-down',
          atIso: '2026-07-17T08:00:02.100Z',
          evidenceId: 'bias-safe-down-001',
        },
        dcOutput: {
          status: 'off',
          atIso: '2026-07-17T08:00:02.150Z',
          evidenceId: 'dc-off-001',
        },
      },
    };

    const context: DvtMeasurementValidationContext = {
      stationManifest: {
        stationId: 'bench-verified', revisionId: 'rev-verified',
        assets: [
          ['source-main', 'signal-source', 'source-qb-001'],
          ['sensor-in', 'power-sensor', 'sensor-in-qb-001'],
          ['analyzer-out', 'analyzer', 'analyzer-out-qb-001'],
          ['psu-main', 'power-supply', 'psu-main-qb-001'],
          ['vna-path', 'network-analyzer', 'vna-path-qb-001'],
        ].map(([assetId, role, evidenceId]) => ({
          assetId: assetId!, role: role as DvtStationManifest['assets'][number]['role'],
          manufacturer: 'Educational', model: assetId!, serialOrRedactedId: `serial-${assetId}`,
          firmwareVersion: 'verified', installedOptionIds: [],
          queryBack: {
            evidenceId: evidenceId!, acquiredAtIso: '2026-07-17T07:59:00.000Z', model: assetId!,
            serialOrRedactedId: `serial-${assetId}`, firmwareVersion: 'verified', optionIds: [], status: 'verified' as const,
          },
          unverifiedConditions: [],
        })),
        applications: [],
        accessories: [
          {
            accessoryEvidenceId: 'coupler-001', assetId: 'sensor-in', label: 'Forward coupler',
            model: 'coupler', serialOrRedactedId: 'coupler-serial', maximumFrequencyHz: 6e9,
            maximumInputPowerDbm: 40, impedanceOhms: 50, ratingEvidenceId: 'coupler-rating',
            role: 'forward-coupler', measurementPlane: 'dut-input-path',
            ratingState: 'verified', unverifiedConditions: [],
          },
          {
            accessoryEvidenceId: 'output-attenuator-001', assetId: 'analyzer-out', label: 'Output attenuator',
            model: 'attenuator', serialOrRedactedId: 'attenuator-serial', maximumFrequencyHz: 6e9,
            maximumInputPowerDbm: 47, impedanceOhms: 50, ratingEvidenceId: 'attenuator-rating',
            role: 'output-attenuator', measurementPlane: 'dut-output-path',
            ratingState: 'verified', unverifiedConditions: [],
          },
        ],
        calibrations: [
          ['source-main-cal', 'source-main', 'source-verify-001'],
          ['sensor-in-cal', 'sensor-in', 'input-path-verify-001'],
          ['analyzer-out-cal', 'analyzer-out', 'output-path-verify-001'],
          ['psu-main-cal', 'psu-main', 'psu-verify-001'],
          ['vna-path-cal', 'vna-path', 'vna-verify-001'],
        ].map(([calibrationEvidenceId, assetId, verificationId]) => ({
          calibrationEvidenceId: calibrationEvidenceId!, assetId: assetId!,
          certificateOrEducationalId: `cert-${calibrationEvidenceId}`,
          validFromIso: '2026-01-01T00:00:00.000Z', validThroughIso: '2026-12-31T23:59:59.000Z',
          scope: 'Educational fixture', state: 'valid' as const, verificationId: verificationId!,
          unverifiedConditions: [],
        })),
        verificationIds: [
          'input-path-verify-001', 'output-path-verify-001', 'psu-verify-001',
          'settling-001', 'state-repeatability-001', 'isolation-001',
          'analyzer-front-end-setup-001', 'analyzer-headroom-001',
          'analyzer-level-plan-qualification-001',
        ],
        unverifiedConditions: [],
        capabilities: [{
          id: 'measurement-ready', label: 'Measurement ready', state: 'ready', evidence: 'Verified fixture',
          requiredAssetIds: ['source-main', 'sensor-in', 'analyzer-out', 'psu-main', 'vna-path'],
          requiredAssetConfigurations: [
            { assetId: 'source-main', requiredModel: 'source-main', requiredOptionIds: [], requiredModules: [] },
            { assetId: 'sensor-in', requiredModel: 'sensor-in', requiredOptionIds: [], requiredModules: [] },
            { assetId: 'analyzer-out', requiredModel: 'analyzer-out', requiredOptionIds: [], requiredModules: [] },
            { assetId: 'psu-main', requiredModel: 'psu-main', requiredOptionIds: [], requiredModules: [] },
            { assetId: 'vna-path', requiredModel: 'vna-path', requiredOptionIds: [], requiredModules: [] },
          ],
          requiredAccessoryIds: ['coupler-001', 'output-attenuator-001'], requiredApplicationIds: [],
          requiredCalibrationIds: ['source-main-cal', 'sensor-in-cal', 'analyzer-out-cal', 'psu-main-cal', 'vna-path-cal'],
        }],
      },
      sourceAssetId: 'source-main', requiredCapabilityIds: ['measurement-ready'],
      asOfIso: '2026-07-17T08:00:01.000Z',
      externalEvidenceRegistry: [
        {
          evidenceId: validPoint.analyzerHeadroom.evidenceId,
          evidenceKind: 'analyzer-headroom',
          sourceAssetId: 'analyzer-out',
          sourceMeasurementPointId: validPoint.pointId,
          analyzerHeadroom: validPoint.analyzerHeadroom,
        },
        {
          evidenceId: validPoint.analyzerHeadroom.operatingLimitEvidenceId,
          evidenceKind: 'analyzer-operating-limit',
          sourceAssetId: 'analyzer-out',
          sourceMeasurementPointId: validPoint.pointId,
          metric: 'analyzer-operating-boundary',
          value: -10,
          unit: 'dBm',
          verificationStatus: 'verified',
          observedAtIso: '2026-07-15T09:00:00.000Z',
          validFromIso: '2026-01-01T00:00:00.000Z',
          validThroughIso: '2026-12-31T23:59:59.000Z',
          qualificationEvidenceId: 'analyzer-level-plan-qualification-001',
          applicability: 'mixer-operating-boundary',
          instrumentQueryBackEvidenceId: 'analyzer-out-qb-001',
          relatedEvidenceIds: ['analyzer-level-plan-qualification-001'],
        },
        {
          evidenceId: validPoint.analyzerHeadroom.residualState.evidenceId,
          evidenceKind: 'analyzer-residual-status',
          sourceAssetId: 'analyzer-out',
          sourceMeasurementPointId: validPoint.pointId,
          metric: 'analyzer-residual-status',
          value: 0,
          unit: 'state',
          verificationStatus: 'verified',
          observedAtIso: validPoint.acquiredAtIso,
          applicability: 'if-adc-input-range',
          analyzerResidualKind: 'if-adc-status',
          analyzerResidualStatus: 'verified-in-range',
          instrumentQueryBackEvidenceId: 'analyzer-out-qb-001',
        },
      ],
    };

    expect(validateMeasurementPoint(validPoint, context)).toEqual({ validity: 'valid', reasons: [] });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.filter(({ evidenceId }) => evidenceId !== 'pout'),
    }, context)).toEqual({
      validity: 'inconclusive',
      reasons: ['required evidence pout is missing'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.map((evidence) => (
        evidence.evidenceId === 'pout'
          ? { ...evidence, acquisitionGroupId: 'sequence-002' }
          : evidence
      )),
    }, context)).toEqual({
      validity: 'invalid',
      reasons: ['required evidence does not share the declared acquisition group'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.map((evidence) => (
        evidence.evidenceId === 'dc'
          ? { ...evidence, triggerRepeatabilitySeconds: 2e-6 }
          : evidence
      )),
    }, context)).toEqual({
      validity: 'invalid',
      reasons: ['trigger repeatability exceeds 0.000001 seconds'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.map((evidence) => ({
        ...evidence,
        triggerReferenceId: 'arbitrary-trigger',
      })),
    }, context)).toMatchObject({
      validity: 'invalid',
      reasons: ['required evidence trigger reference does not match the point trigger ID'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.map((evidence) => (
        evidence.evidenceId === 'dc' ? { ...evidence, acquisitionSequenceIndex: 4 } : evidence
      )),
    }, context)).toMatchObject({
      validity: 'invalid',
      reasons: ['required evidence sequence indices must be contiguous from 1 through N'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.map((evidence) => (
        evidence.evidenceId === 'dc'
          ? { ...evidence, acquiredAtIso: '2026-07-17T08:00:01.100Z' }
          : evidence
      )),
    }, context)).toMatchObject({
      validity: 'invalid',
      reasons: ['required evidence timestamps are not strictly increasing in sequence-index order'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      dutState: { ...validPoint.dutState, queryBackAtIso: '2026-07-17T07:59:59.999Z' },
    }, context)).toMatchObject({
      validity: 'invalid', reasons: ['DUT query-back timestamp falls outside the configured point window'],
    });
    expect(validateMeasurementPoint(validPoint, {
      ...context,
      stationManifest: {
        ...context.stationManifest,
        verificationIds: context.stationManifest.verificationIds.filter((id) => id !== 'settling-001'),
      },
    })).toMatchObject({
      validity: 'invalid', reasons: expect.arrayContaining(['settling evidence is not registered in the station manifest']),
    });
    expect(validateMeasurementPoint(validPoint, {
      ...context,
      stationManifest: {
        ...context.stationManifest,
        verificationIds: context.stationManifest.verificationIds.filter((id) => id !== 'state-repeatability-001'),
      },
    })).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining(['state-repeatability evidence is not registered in the station manifest']),
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      cleanup: {
        ...validPoint.cleanup,
        rfOutput: { ...validPoint.cleanup.rfOutput, atIso: '2026-07-17T08:00:01.000Z' },
      },
    }, context)).toMatchObject({
      validity: 'invalid', reasons: ['cleanup timestamp precedes point acquisition completion'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      requiredEvidenceIds: ['pin', 'pin'],
    }, context)).toEqual({
      validity: 'invalid',
      reasons: ['required evidence IDs must be unique'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      metricEvidence: validPoint.metricEvidence.map((evidence) => (
        evidence.evidenceId === 'pout'
          ? { ...evidence, status: 'corrupt' as const }
          : evidence
      )),
    }, context)).toEqual({
      validity: 'invalid',
      reasons: ['required evidence pout is corrupt'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      sourceState: 'unknown',
      calibrationState: 'unknown',
    }, context)).toEqual({
      validity: 'inconclusive',
      reasons: ['source leveling is unknown', 'calibration validity is unknown'],
    });
    expect(validateMeasurementPoint({
      ...validPoint,
      analyzerState: 'overload',
      acquisitionState: 'stale',
      calibrationState: 'expired',
    }, context)).toEqual({
      validity: 'invalid',
      reasons: [
        'analyzer overload is active',
        'acquisition data is stale',
        'calibration is expired',
      ],
    });
    expect(validateMeasurementPoint(validPoint, {
      ...context,
      stationManifest: {
        ...context.stationManifest,
        assets: context.stationManifest.assets.map((asset) => (
          asset.assetId === 'source-main'
            ? { ...asset, queryBack: { ...asset.queryBack, status: 'unverified' as const } }
            : asset
        )),
      },
    })).toMatchObject({
      validity: 'inconclusive',
      reasons: expect.arrayContaining([
        'station capability readiness is conditional',
        'source asset query-back is unverified',
      ]),
    });
    expect(validateMeasurementPoint(validPoint, {
      ...context,
      stationManifest: {
        ...context.stationManifest,
        accessories: context.stationManifest.accessories.filter(({ accessoryEvidenceId }) => (
          accessoryEvidenceId !== 'output-attenuator-001'
        )),
      },
    })).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining([
        'station capability readiness is blocked',
        'Pout output-path accessory output-attenuator-001 is not registered',
      ]),
    });

    const nineStepSourceBundle = DVT_BUILT_IN_CASES.flatMap(({ id: caseId, steps }) => (
      steps.map(({ expectedEvidenceId }) => ({
        caseId,
        evidenceId: expectedEvidenceId,
        sourceMeasurementPointId: 'p-001',
        sourceMetricEvidenceIds: ['pin'] as const,
        sourceExternalEvidenceIds: [],
        decisionMetricId: 'pae-derived-001',
      }))
    ));
    const sourceRecords: DvtConclusionSourceRecords = {
      stationManifest: context.stationManifest,
      requiredCapabilityIds: context.requiredCapabilityIds,
      stationAsOfIso: context.asOfIso!,
      measurementPoint: validPoint,
      sourceAssetId: context.sourceAssetId,
      decisionSources: [{
        metricId: 'pae-derived-001', metricKind: 'pae',
        sourceMetricEvidenceIds: ['pin', 'pout', 'dc'],
        sourceExternalEvidenceIds: [
          validPoint.analyzerHeadroom.evidenceId,
          validPoint.analyzerHeadroom.operatingLimitEvidenceId,
          validPoint.analyzerHeadroom.residualState.evidenceId,
        ],
        uncertaintyComponents: [{
          id: 'pae-repeatability', label: 'PAE repeatability', evaluationType: 'A',
          sourceType: 'repeatability-study', sourceEvidenceId: 'pae-repeatability-study-001',
          reportedUncertainty: { unit: 'percent', valuePercent: 0.5 }, distribution: 'normal',
          divisor: 1, sampleCount: 10, degreesOfFreedom: 9, referencePlane: 'operating-point-sequence',
          sensitivityCoefficient: 1, correlations: [],
        }],
        coverageFactor: 2,
        decisionRule: {
          direction: 'range', lowerLimit: { unit: 'percent', valuePercent: 0 },
          upperLimit: { unit: 'percent', valuePercent: 100 },
        },
      }],
      diagnosticEvidenceSources: nineStepSourceBundle,
      observedCaseEvidence: CAPSTONE_OBSERVED_CASE_EVIDENCE,
      externalEvidenceRegistry: [
        ...context.externalEvidenceRegistry!,
        {
          evidenceId: 'pae-repeatability-study-001', evidenceKind: 'uncertainty',
          sourceMeasurementPointId: 'p-001', metric: 'uncertainty-source', value: 0.5, unit: 'percent',
        },
        ...Object.values(validPoint.cleanup).map(({ evidenceId, status, atIso }) => ({
          evidenceId, evidenceKind: 'cleanup' as const, sourceMeasurementPointId: 'p-001',
          metric: 'cleanup-state' as const, value: 0, unit: 'state' as const,
          cleanupStatus: status, observedAtIso: atIso,
        })),
      ],
      independentIsolationEvidence: [],
    };
    const derivedLinkage = buildConclusionEvidenceLinkage(sourceRecords);
    expect(derivedLinkage).toMatchObject({
      stationId: 'bench-verified', stationRevisionId: 'rev-verified', measurementPointId: 'p-001',
      measurementValidation: { validity: 'valid', reasons: [] },
      decisionSources: [{
        metricId: 'pae-derived-001', sourceMeasurementPointId: 'p-001',
        sourceMetricEvidenceIds: ['pin', 'pout', 'dc'],
        sourceExternalEvidenceIds: [
          validPoint.analyzerHeadroom.evidenceId,
          validPoint.analyzerHeadroom.operatingLimitEvidenceId,
          validPoint.analyzerHeadroom.residualState.evidenceId,
        ],
        uncertaintySourceEvidenceIds: ['pae-repeatability-study-001'],
      }],
      diagnosticEvidenceSources: nineStepSourceBundle.map(({ evidenceId }) => ({ evidenceId })),
    });
    const derivedPae = derivedLinkage.decisions[0]?.measured;
    expect(derivedPae?.unit).toBe('percent');
    if (derivedPae?.unit === 'percent') {
      expect(derivedPae.valuePercent).toBeCloseTo(
        100 * (dbmToWatts(25.3) - dbmToWatts(-7)) / (4.2 * 1.2),
        12,
      );
    }
    const provenanceReport = {
      reportId: 'provenance-report-001', stationId: 'bench-verified', measurementPointId: 'p-001',
      decisionIds: ['pae-derived-001'],
      acceptedDiagnosticEvidenceIds: nineStepSourceBundle.map(({ evidenceId }) => evidenceId),
      sections: {
        scope: 'scope', station: 'station', symptom: 'symptom', validity: 'valid', decision: 'decision',
        hypotheses: 'hypotheses', evidence: 'evidence', conclusion: 'conclusion', residualRisk: 'risk',
      },
      cleanup: validPoint.cleanup, nextAction: 'repeat', owner: 'RF DVT engineer',
    } as const;
    expect(validateConclusionSourceRecords(provenanceReport, sourceRecords, derivedLinkage)).toEqual({
      valid: true, reasons: [],
    });
    expect(validateConclusionSourceRecords(provenanceReport, sourceRecords, {
      ...derivedLinkage,
      stationRevisionId: 'tampered-revision',
    })).toMatchObject({
      valid: false,
      reasons: ['claimed conclusion linkage does not match recomputed source-record provenance'],
    });
    expect(validateConclusionSourceRecords(provenanceReport, sourceRecords, {
      ...derivedLinkage,
      cleanup: {
        ...derivedLinkage.cleanup,
        rfOutput: { ...derivedLinkage.cleanup.rfOutput, evidenceId: 'tampered-cleanup' },
      },
    })).toMatchObject({
      valid: false,
      reasons: ['claimed conclusion linkage does not match recomputed source-record provenance'],
    });
    expect(validateConclusionSourceRecords({
      ...provenanceReport,
      cleanup: {
        ...provenanceReport.cleanup,
        rfOutput: { ...provenanceReport.cleanup.rfOutput, evidenceId: 'wrong-report-cleanup' },
      },
    }, sourceRecords)).toMatchObject({
      valid: false,
      reasons: ['report cleanup does not exactly match linked point cleanup'],
    });
    const invalidDesenseRecords: DvtConclusionSourceRecords = {
      ...sourceRecords,
      desenseEvidence: {
        measurementPointId: 'p-001', txCarrierFrequencyHz: 1_740_000_000,
        txWaveformId: validPoint.waveform.waveformId, txOutputPowerDbm: 25.3,
        txModeId: validPoint.dutState.stateId, supplyStateId: validPoint.supplyStateId,
        supplyMetricEvidenceId: 'dc', supplyVoltageV: 4.2, supplyCurrentA: 1.2,
        supplyRegulationMode: 'CV',
        frequencyHz: 1_840_000_000, rxFrequencyRangeHz: { startHz: 1_805_000_000, stopHz: 1_880_000_000 },
        noiseMeasurementFrequencyHz: 1_840_000_000, isolationMeasurementFrequencyHz: 1_840_000_000,
        noiseSourcePlane: 'tx-output', noiseMeasurementPlane: 'tx-output', rxBranchPlane: 'rx-branch',
        isolationTxPlane: 'tx-output', isolationRxPlane: 'rx-branch', isolationDirection: 'tx-to-rx',
        isolationDutPathState: 'small-signal-passive-path', isolationDutControlStateId: 'passive-isolation-state',
        isolationDutBiasState: 'off', isolationAcquiredAtIso: '2026-07-17T07:59:30.000Z',
        isolationCalibrationEvidenceId: 'vna-path-cal',
        isolationExcitation: { kind: 'small-signal-cw', sourceAssetId: 'vna-path', sourceRole: 'stimulus-source', sourceQueryBackEvidenceId: 'vna-path-qb-001', powerDbm: -20 },
        isolationApplicability: 'small-signal-path-isolation-only',
        txToRxIsolationDb: 45, noiseMeasurement: { convention: 'density', densityDbmPerHz: -125 },
        txNoiseMetricEvidenceId: 'tx-noise',
        terminationState: 'source-connected', dutPathState: 'pa-on', noiseIncludesTxToRxIsolation: true,
        noiseExpandedUncertaintyDb: 1, isolationExpandedUncertaintyDb: 1,
        isolationEvidenceId: 'isolation-001', analyzerFloorDensityDbmPerHz: -165,
        floorEvidenceId: 'floor-001', floorExpandedUncertaintyDb: 1, minimumFloorHeadroomDb: 6,
        terminatedBaselineEvidenceId: 'terminated-001', terminatedBaselineDensityDbmPerHz: -165,
        paOffLeakageEvidenceId: 'pa-off-001', paOffLeakageDensityDbmPerHz: -164,
        noiseCorrectionId: 'noise-correction-001',
      },
      decisionSources: [{
        metricId: 'isolation-derived-001', metricKind: 'desense-isolation',
        sourceMetricEvidenceIds: ['tx-noise'], sourceExternalEvidenceIds: ['isolation-001'],
        uncertaintyComponents: [{
          id: 'isolation-u', label: 'Isolation U', evaluationType: 'B', sourceType: 'model',
          sourceEvidenceId: 'isolation-u-001', reportedUncertainty: { unit: 'dB', valueDb: 1 },
          distribution: 'normal', divisor: 1, referencePlane: 'tx-to-rx', sensitivityCoefficient: 1,
          correlations: [],
        }],
        coverageFactor: 2,
        decisionRule: { direction: 'lower-bound', lowerLimit: { unit: 'dB', valueDb: 50 } },
      }],
      independentIsolationEvidence: [{
        evidenceId: 'isolation-001', measurementPointId: 'p-001', valueDb: 45, frequencyHz: 1_840_000_000,
        txPlane: 'tx-output', rxPlane: 'rx-branch', direction: 'tx-to-rx',
        dutPathState: 'small-signal-passive-path', dutControlStateId: 'passive-isolation-state',
        dutBiasState: 'off', acquiredAtIso: '2026-07-17T07:59:30.000Z',
        calibrationEvidenceId: 'vna-path-cal', expandedUncertaintyDb: 1,
        excitation: { kind: 'small-signal-cw', sourceAssetId: 'vna-path', sourceRole: 'stimulus-source', sourceQueryBackEvidenceId: 'vna-path-qb-001', powerDbm: -20 },
        applicability: 'small-signal-path-isolation-only',
      }],
    };
    expect(validateConclusionSourceRecords(provenanceReport, invalidDesenseRecords)).toEqual({
      valid: false,
      reasons: [expect.stringContaining('TX-noise metric evidence')],
    });

    const desensePoint: DvtMeasurementPoint = {
      ...validPoint,
      requiredEvidenceIds: [...validPoint.requiredEvidenceIds, 'tx-noise'],
      metricEvidence: [
        ...validPoint.metricEvidence,
        {
          evidenceId: 'tx-noise', metric: 'tx-noise', instrumentAssetId: 'analyzer-out',
          instrumentQueryBackEvidenceId: 'analyzer-out-qb-001',
          measurementCalibrationEvidenceId: 'analyzer-out-cal', acquisitionId: 'acq-noise-001',
          acquisitionGroupId: 'sequence-001', acquisitionSequenceIndex: 4,
          triggerReferenceId: 'trigger-001', triggerRepeatabilitySeconds: 0.5e-6,
          settlingSeconds: 0.02, referencePlane: 'dut-output', correctionId: 'noise-correction-001',
          correctionProviderAssetId: 'vna-path', correctionCalibrationEvidenceId: 'vna-path-cal',
          correctionVerificationId: 'output-path-verify-001', apertureSeconds: 0.5,
          acquiredAtIso: '2026-07-17T08:00:01.300Z', status: 'valid', overload: false, errors: [],
          rawNoise: { convention: 'density', densityDbmPerHz: -125.2 },
          correctedNoise: { convention: 'density', densityDbmPerHz: -125 },
          resolutionBandwidthHz: 100_000, equivalentNoiseBandwidthHz: 100_000,
          analyzerFloorDensityDbmPerHz: -165, floorEvidenceId: 'floor-001',
          analyzerFrontEndSetup: {
            setupEvidenceId: 'analyzer-front-end-setup-001', inputAttenuationDb: 10,
            preamplifierEnabled: false, referenceLevelDbm: -70, detector: 'rms',
            measurementMode: 'swept-spectrum',
          },
        },
      ],
      acquiredAtIso: '2026-07-17T08:00:01.300Z',
    };
    const desenseEvidence: DvtDesenseRiskEvidence = {
      measurementPointId: desensePoint.pointId,
      txCarrierFrequencyHz: desensePoint.waveform.centerFrequencyHz,
      txWaveformId: desensePoint.waveform.waveformId,
      txOutputPowerDbm: 25.3,
      txModeId: desensePoint.dutState.stateId,
      supplyStateId: desensePoint.supplyStateId,
      supplyMetricEvidenceId: 'dc', supplyVoltageV: 4.2, supplyCurrentA: 1.2,
      supplyRegulationMode: 'CV',
      frequencyHz: 1_840_000_000,
      rxFrequencyRangeHz: { startHz: 1_805_000_000, stopHz: 1_880_000_000 },
      noiseMeasurementFrequencyHz: 1_840_000_000,
      isolationMeasurementFrequencyHz: 1_840_000_000,
      noiseSourcePlane: 'tx-output', noiseMeasurementPlane: 'tx-output', rxBranchPlane: 'rx-branch',
      isolationTxPlane: 'tx-output', isolationRxPlane: 'rx-branch', isolationDirection: 'tx-to-rx',
      isolationDutPathState: 'small-signal-passive-path', isolationDutControlStateId: 'passive-isolation-state',
      isolationDutBiasState: 'off', isolationAcquiredAtIso: '2026-07-17T07:59:30.000Z',
      isolationCalibrationEvidenceId: 'vna-path-cal',
      isolationExcitation: { kind: 'small-signal-cw', sourceAssetId: 'vna-path', sourceRole: 'stimulus-source', sourceQueryBackEvidenceId: 'vna-path-qb-001', powerDbm: -20 },
      isolationApplicability: 'small-signal-path-isolation-only',
      txToRxIsolationDb: 45, noiseMeasurement: { convention: 'density', densityDbmPerHz: -125 },
      txNoiseMetricEvidenceId: 'tx-noise', terminationState: 'source-connected', dutPathState: 'pa-on',
      noiseIncludesTxToRxIsolation: false, noiseExpandedUncertaintyDb: 1,
      isolationExpandedUncertaintyDb: 1, isolationEvidenceId: 'isolation-001',
      analyzerFloorDensityDbmPerHz: -165, floorEvidenceId: 'floor-001',
      floorExpandedUncertaintyDb: 1, minimumFloorHeadroomDb: 6,
      terminatedBaselineEvidenceId: 'terminated-001', terminatedBaselineDensityDbmPerHz: -165,
      paOffLeakageEvidenceId: 'pa-off-001', paOffLeakageDensityDbmPerHz: -164,
      noiseCorrectionId: 'noise-correction-001',
    };
    const independentIsolationEvidence = {
      evidenceId: 'isolation-001', measurementPointId: 'p-001', valueDb: 45, frequencyHz: 1_840_000_000,
      txPlane: 'tx-output', rxPlane: 'rx-branch', direction: 'tx-to-rx' as const,
      dutPathState: 'small-signal-passive-path' as const, dutControlStateId: 'passive-isolation-state',
      dutBiasState: 'off' as const, acquiredAtIso: '2026-07-17T07:59:30.000Z',
      calibrationEvidenceId: 'vna-path-cal', expandedUncertaintyDb: 1,
      excitation: { kind: 'small-signal-cw' as const, sourceAssetId: 'vna-path', sourceRole: 'stimulus-source' as const, sourceQueryBackEvidenceId: 'vna-path-qb-001', powerDbm: -20 },
      applicability: 'small-signal-path-isolation-only' as const,
    };
    expect(validateDesenseEvidenceAgainstMeasurementPoint(
      desenseEvidence, desensePoint, context.stationManifest,
    )).toEqual({ valid: true, reasons: [] });
    expect(validateMeasurementPoint(desensePoint, context)).toEqual({ validity: 'valid', reasons: [] });
    expect(validateMeasurementPoint({
      ...desensePoint,
      metricEvidence: desensePoint.metricEvidence.map((evidence) => (
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
    }, context)).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining(['TX-noise analyzer front-end setup evidence is not registered']),
    });
    expect(validateMeasurementPoint({
      ...desensePoint,
      metricEvidence: desensePoint.metricEvidence.map((evidence) => (
        evidence.metric === 'tx-noise'
          ? {
              ...evidence,
              analyzerFrontEndSetup: {
                ...evidence.analyzerFrontEndSetup,
                inputAttenuationDb: -1,
                referenceLevelDbm: Number.NaN,
              },
            }
          : evidence
      )),
    }, context)).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining([
        'TX-noise analyzer input attenuation must be non-negative',
        'tx-noise contains a non-finite metric value',
      ]),
    });
    for (const tamperedEvidence of [
      { ...desenseEvidence, measurementPointId: 'wrong-point' },
      { ...desenseEvidence, txWaveformId: 'wrong-waveform' },
      { ...desenseEvidence, txCarrierFrequencyHz: desenseEvidence.txCarrierFrequencyHz + 1 },
      { ...desenseEvidence, txOutputPowerDbm: desenseEvidence.txOutputPowerDbm + 0.01 },
      { ...desenseEvidence, txModeId: 'wrong-mode' },
      { ...desenseEvidence, supplyStateId: 'wrong-supply-state' },
      { ...desenseEvidence, supplyCurrentA: desenseEvidence.supplyCurrentA + 0.001 },
      { ...desenseEvidence, noiseMeasurement: { convention: 'density' as const, densityDbmPerHz: -124 } },
      { ...desenseEvidence, noiseCorrectionId: 'wrong-noise-correction' },
      { ...desenseEvidence, floorEvidenceId: 'wrong-floor' },
      { ...desenseEvidence, isolationEvidenceId: 'unregistered-isolation' },
    ]) {
      expect(validateDesenseEvidenceAgainstMeasurementPoint(
        tamperedEvidence, desensePoint, context.stationManifest,
      ).valid).toBe(false);
    }

    const validDesenseRecords: DvtConclusionSourceRecords = {
      ...sourceRecords,
      measurementPoint: desensePoint,
      desenseEvidence,
      decisionSources: [
        ...sourceRecords.decisionSources,
        {
          metricId: 'isolation-derived-001', metricKind: 'desense-isolation',
          sourceMetricEvidenceIds: ['tx-noise'],
          sourceExternalEvidenceIds: [
            'isolation-001',
            desensePoint.analyzerHeadroom.evidenceId,
            desensePoint.analyzerHeadroom.operatingLimitEvidenceId,
            desensePoint.analyzerHeadroom.residualState.evidenceId,
          ],
          uncertaintyComponents: [{
            id: 'isolation-u', label: 'Isolation U', evaluationType: 'B', sourceType: 'model',
            sourceEvidenceId: 'isolation-u-001', reportedUncertainty: { unit: 'dB', valueDb: 1 },
            distribution: 'normal', divisor: 1, referencePlane: 'tx-to-rx',
            sensitivityCoefficient: 1, correlations: [],
          }],
          coverageFactor: 2,
          decisionRule: { direction: 'lower-bound', lowerLimit: { unit: 'dB', valueDb: 50 } },
        },
      ],
      externalEvidenceRegistry: [
        ...sourceRecords.externalEvidenceRegistry,
        {
          evidenceId: 'isolation-u-001', evidenceKind: 'uncertainty',
          sourceMeasurementPointId: 'p-001', metric: 'uncertainty-source', value: 1, unit: 'dB',
        },
        {
          evidenceId: 'floor-001', evidenceKind: 'baseline', sourceMeasurementPointId: 'p-001',
          sourceAssetId: 'analyzer-out', metric: 'analyzer-floor', value: -165, unit: 'dBm/Hz',
          relatedEvidenceIds: ['analyzer-front-end-setup-001'],
        },
        {
          evidenceId: 'terminated-001', evidenceKind: 'baseline', sourceMeasurementPointId: 'p-001',
          metric: 'analyzer-floor', value: -165, unit: 'dBm/Hz',
          relatedEvidenceIds: ['analyzer-front-end-setup-001'],
        },
        {
          evidenceId: 'pa-off-001', evidenceKind: 'baseline', sourceMeasurementPointId: 'p-001',
          metric: 'analyzer-floor', value: -164, unit: 'dBm/Hz',
          relatedEvidenceIds: ['analyzer-front-end-setup-001'],
        },
        { evidenceId: 'noise-correction-001', evidenceKind: 'correction', sourceMeasurementPointId: 'p-001', metric: 'noise-path-correction', value: 0.2, unit: 'dB' },
        { evidenceId: 'analyzer-front-end-setup-001', evidenceKind: 'station-verification', sourceAssetId: 'analyzer-out' },
      ],
      independentIsolationEvidence: [independentIsolationEvidence],
    };
    expect(buildConclusionEvidenceLinkage(validDesenseRecords).desenseEvaluation).toMatchObject({ validity: 'valid' });
    const sameIdTamperRecords: DvtConclusionSourceRecords = {
      ...validDesenseRecords,
      decisionSources: validDesenseRecords.decisionSources.map((source) => (
        source.metricKind === 'desense-isolation'
          ? { ...source, sourceExternalEvidenceIds: ['tampered-isolation'] }
          : source
      )),
      independentIsolationEvidence: [
        independentIsolationEvidence,
        { ...independentIsolationEvidence, evidenceId: 'tampered-isolation' },
      ],
    };
    expect(() => buildConclusionEvidenceLinkage(sameIdTamperRecords)).toThrow(
      'independent isolation evidence is not registered in the station manifest',
    );
    expect(() => buildConclusionEvidenceLinkage({
      ...sourceRecords,
      diagnosticEvidenceSources: sourceRecords.diagnosticEvidenceSources.slice(0, -1),
    })).toThrow('diagnostic evidence sources must exactly cover the ordered nine-step contract');
  });

  it('combines signed sensitivity terms with a general evidence-backed covariance matrix', () => {
    expect(ACLR_UNCERTAINTY_COMPONENTS.find(({ id }) => id === 'main-common-amplitude')?.sensitivityCoefficient).toBe(-1);
    expect(ACLR_UNCERTAINTY_COMPONENTS.find(({ id }) => id === 'adjacent-common-amplitude')?.sensitivityCoefficient).toBe(1);
    const independent = combineUncertaintyBudget([
      {
        id: 'sensor', label: 'Sensor cal', evaluationType: 'B',
        sourceType: 'calibration-certificate', sourceEvidenceId: 'cert-sensor-001',
        reportedUncertainty: { unit: 'dB', valueDb: 0.6 }, distribution: 'normal', divisor: 2,
        referencePlane: 'dut-output', sensitivityCoefficient: 1, correlations: [],
      },
      {
        id: 'repeat', label: 'Repeatability', evaluationType: 'A',
        sourceType: 'repeatability-study', sourceEvidenceId: 'repeat-study-001',
        reportedUncertainty: { unit: 'dB', valueDb: 0.4 }, distribution: 'normal', divisor: 1,
        sampleCount: 10, degreesOfFreedom: 9,
        referencePlane: 'dut-output', sensitivityCoefficient: 1, correlations: [],
      },
    ]);
    expect(independent.standardUncertainty).toEqual({ unit: 'dB', valueDb: 0.5 });
    expect(independent.expandedUncertainty).toEqual({ unit: 'dB', valueDb: 1 });
    expect(independent.method).toBe('general-covariance');

    const mixed = combineUncertaintyBudget([
      {
        id: 'path-a', label: 'Input path', evaluationType: 'B',
        sourceType: 'calibration-certificate', sourceEvidenceId: 'cert-path-a',
        reportedUncertainty: { unit: 'dB', valueDb: 0.3 }, distribution: 'normal', divisor: 1,
        referencePlane: 'dut-input', sensitivityCoefficient: 1,
        correlations: [{ withComponentId: 'path-b', correlationCoefficient: 0.5, evidenceId: 'rho-path-ab' }],
      },
      {
        id: 'path-b', label: 'Output path', evaluationType: 'B',
        sourceType: 'calibration-certificate', sourceEvidenceId: 'cert-path-b',
        reportedUncertainty: { unit: 'dB', valueDb: 0.4 }, distribution: 'normal', divisor: 1,
        referencePlane: 'dut-output', sensitivityCoefficient: 1, correlations: [],
      },
      {
        id: 'noise', label: 'Repeatability', evaluationType: 'A',
        sourceType: 'repeatability-study', sourceEvidenceId: 'repeat-noise',
        reportedUncertainty: { unit: 'dB', valueDb: 0.5 }, distribution: 'normal', divisor: 1,
        sampleCount: 12, degreesOfFreedom: 11,
        referencePlane: 'dut-output', sensitivityCoefficient: 1, correlations: [],
      },
    ], 2);
    expect(mixed.signedSensitivityContributions).toMatchObject({
      'path-a': { unit: 'dB', signedValueDb: 0.3 },
      'path-b': { unit: 'dB', signedValueDb: 0.4 },
    });
    expect(mixed.correlationCovarianceContributions['path-a|path-b']).toEqual({
      unit: 'dB-squared',
      signedValueDbSquared: 0.12,
    });
    expect(mixed.standardUncertainty.unit).toBe('dB');
    expect(mixed.standardUncertainty.unit === 'dB' && mixed.standardUncertainty.valueDb).toBeCloseTo(Math.sqrt(0.62), 12);
    expect(mixed.expandedUncertainty.unit === 'dB' && mixed.expandedUncertainty.valueDb).toBeCloseTo(2 * Math.sqrt(0.62), 12);

    const cancelled = combineUncertaintyBudget([
      {
        id: 'shared-in', label: 'Shared path input', evaluationType: 'B',
        sourceType: 'calibration-certificate', sourceEvidenceId: 'shared-cert',
        reportedUncertainty: { unit: 'dB', valueDb: 0.2 }, distribution: 'normal', divisor: 1,
        referencePlane: 'dut-input', sensitivityCoefficient: 1,
        correlations: [{ withComponentId: 'shared-out', correlationCoefficient: 1, evidenceId: 'shared-rho' }],
      },
      {
        id: 'shared-out', label: 'Shared path output', evaluationType: 'B',
        sourceType: 'calibration-certificate', sourceEvidenceId: 'shared-cert',
        reportedUncertainty: { unit: 'dB', valueDb: 0.2 }, distribution: 'normal', divisor: 1,
        referencePlane: 'dut-output', sensitivityCoefficient: -1, correlations: [],
      },
    ]);
    expect(cancelled.standardUncertainty).toEqual({ unit: 'dB', valueDb: 0 });
    expect(cancelled.signedSensitivityContributions['shared-out']).toEqual({
      unit: 'dB',
      signedValueDb: -0.2,
    });

    const impossibleCorrelations = [
      { id: 'a', correlations: [{ withComponentId: 'b', correlationCoefficient: 0.9, evidenceId: 'rho-ab' }, { withComponentId: 'c', correlationCoefficient: 0.9, evidenceId: 'rho-ac' }] },
      { id: 'b', correlations: [{ withComponentId: 'c', correlationCoefficient: -0.9, evidenceId: 'rho-bc' }] },
      { id: 'c', correlations: [] },
    ].map(({ id, correlations }) => ({
      id, label: id, evaluationType: 'B' as const, sourceType: 'model' as const,
      sourceEvidenceId: `model-${id}`, reportedUncertainty: { unit: 'dB' as const, valueDb: 1 },
      distribution: 'normal' as const, divisor: 1, referencePlane: 'dut-output',
      sensitivityCoefficient: 1, correlations,
    }));
    expect(() => combineUncertaintyBudget(impossibleCorrelations)).toThrow(/positive semidefinite/i);
  });

  it('normalizes upper, lower, and range margins after guardbanding', () => {
    const aclr = decideWithGuardband({
      metricId: 'aclr-upper',
      validity: 'valid',
      direction: 'upper-bound',
      measured: { unit: 'dBc', valueDbc: -45 },
      expandedUncertainty: { unit: 'dB', valueDb: 1.5 },
      upperLimit: { unit: 'dBc', valueDbc: -30 },
      valueConvention: 'analyzer-negative-dbc',
    });
    expect(aclr).toMatchObject({
      verdict: 'pass',
      guardbandedLower: { unit: 'dBc', valueDbc: -46.5 },
      guardbandedUpper: { unit: 'dBc', valueDbc: -43.5 },
      normalizedMargin: { unit: 'dB', valueDb: 13.5 },
      valueConvention: 'analyzer-negative-dbc',
    });

    const positiveAclr = decideWithGuardband({
      metricId: 'aclr-ratio',
      validity: 'valid',
      direction: 'lower-bound',
      measured: { unit: 'dB', valueDb: 45 },
      expandedUncertainty: { unit: 'dB', valueDb: 1.5 },
      lowerLimit: { unit: 'dB', valueDb: 30 },
      valueConvention: 'positive-ratio-aclr-db',
    });
    expect(positiveAclr.normalizedMargin).toEqual({ unit: 'dB', valueDb: 13.5 });

    const evmRange = decideWithGuardband({
      metricId: 'evm-window',
      validity: 'valid',
      direction: 'range',
      measured: { unit: 'percent', valuePercent: 2.8 },
      expandedUncertainty: { unit: 'percent', valuePercent: 0.5 },
      lowerLimit: { unit: 'percent', valuePercent: 1 },
      upperLimit: { unit: 'percent', valuePercent: 3 },
    });
    expect(evmRange.verdict).toBe('inconclusive');
    expect(evmRange.normalizedMargin?.unit).toBe('percent');
    expect(
      evmRange.normalizedMargin?.unit === 'percent'
        ? evmRange.normalizedMargin.valuePercent
        : Number.NaN,
    ).toBeCloseTo(-0.3, 12);

    expect(decideWithGuardband({
      metricId: 'evm-outside',
      validity: 'valid',
      direction: 'range',
      measured: { unit: 'percent', valuePercent: 4 },
      expandedUncertainty: { unit: 'percent', valuePercent: 0.5 },
      lowerLimit: { unit: 'percent', valuePercent: 1 },
      upperLimit: { unit: 'percent', valuePercent: 3 },
    }).verdict).toBe('fail');

    expect(decideWithGuardband({
      metricId: 'aclr-overlap',
      validity: 'valid',
      direction: 'upper-bound',
      measured: { unit: 'dBc', valueDbc: -30.8 },
      expandedUncertainty: { unit: 'dB', valueDb: 1 },
      upperLimit: { unit: 'dBc', valueDbc: -30 },
      valueConvention: 'analyzer-negative-dbc',
    }).verdict).toBe('inconclusive');

    const exactTouchDecisions = [
      decideWithGuardband({
        metricId: 'upper-exact-touch', validity: 'valid', direction: 'upper-bound',
        measured: { unit: 'dBc', valueDbc: -31 }, expandedUncertainty: { unit: 'dB', valueDb: 1 },
        upperLimit: { unit: 'dBc', valueDbc: -30 }, valueConvention: 'analyzer-negative-dbc',
      }),
      decideWithGuardband({
        metricId: 'lower-exact-touch', validity: 'valid', direction: 'lower-bound',
        measured: { unit: 'dB', valueDb: 31 }, expandedUncertainty: { unit: 'dB', valueDb: 1 },
        lowerLimit: { unit: 'dB', valueDb: 30 }, valueConvention: 'positive-ratio-aclr-db',
      }),
      decideWithGuardband({
        metricId: 'range-exact-touch', validity: 'valid', direction: 'range',
        measured: { unit: 'percent', valuePercent: 2.5 }, expandedUncertainty: { unit: 'percent', valuePercent: 0.5 },
        lowerLimit: { unit: 'percent', valuePercent: 1 }, upperLimit: { unit: 'percent', valuePercent: 3 },
      }),
    ];
    expect(exactTouchDecisions.map(({ verdict }) => verdict)).toEqual([
      'inconclusive', 'inconclusive', 'inconclusive',
    ]);
    expect(exactTouchDecisions.map(({ normalizedMargin }) => normalizedMargin)).toEqual([
      { unit: 'dB', valueDb: 0 },
      { unit: 'dB', valueDb: 0 },
      { unit: 'percent', valuePercent: 0 },
    ]);

    expect(decideWithGuardband({
      metricId: 'stale-aclr',
      validity: 'invalid',
      direction: 'upper-bound',
      measured: { unit: 'dBc', valueDbc: -45 },
      expandedUncertainty: { unit: 'dB', valueDb: 1 },
      upperLimit: { unit: 'dBc', valueDbc: -30 },
    })).toMatchObject({ verdict: 'inconclusive', normalizedMargin: null });
  });

  it('reuses the PA model for deterministic P1dB and PAE and derives two-tone IM3', () => {
    const expected = calculateDvtPaExpectedValues();
    const p1db = rappOneDbCompressionPoint(DEFAULT_EDUCATIONAL_PA);
    const operatingPoint = evaluatePa(p1db.inputPowerDbm, DEFAULT_EDUCATIONAL_PA);

    expect(expected.p1dbInputPowerDbm).toBeCloseTo(p1db.inputPowerDbm, 12);
    expect(expected.p1dbOutputPowerDbm).toBeCloseTo(p1db.outputPowerDbm, 12);
    expect(expected.paeAtP1dbPercent).toBeCloseTo(operatingPoint.paePercent, 12);
    expect(expected.twoTonePerToneOutputPowerDbm).toBe(20);
    expect(expected.twoToneCompositeOutputPowerDbm).toBeCloseTo(23.01029995664, 11);
    expect(expected.twoToneOip3Dbm).toBe(40);
    expect(expected.im3OutputPowerDbm).toBe(-20);
    expect(expected.im3Dbc).toBe(-40);
  });

  it('validates a same-frequency desense risk budget and blocks double isolation', () => {
    const validEvidence = {
      measurementPointId: 'fdd-b3-desense-001',
      txCarrierFrequencyHz: 1_740_000_000,
      txWaveformId: 'LTE_FDD_B3_20M_QPSK',
      txOutputPowerDbm: 25.3,
      txModeId: 'generic-high-gain',
      supplyStateId: '4p2v-cv-1p86a',
      supplyMetricEvidenceId: 'dc',
      supplyVoltageV: 4.2,
      supplyCurrentA: 1.86,
      supplyRegulationMode: 'CV',
      frequencyHz: 1_840_000_000,
      rxFrequencyRangeHz: { startHz: 1_805_000_000, stopHz: 1_880_000_000 },
      noiseMeasurementFrequencyHz: 1_840_000_000,
      isolationMeasurementFrequencyHz: 1_840_000_000,
      noiseSourcePlane: 'pamid-tx-output',
      noiseMeasurementPlane: 'pamid-tx-output',
      rxBranchPlane: 'pamid-rx-branch',
      isolationTxPlane: 'pamid-tx-output',
      isolationRxPlane: 'pamid-rx-branch',
      isolationDirection: 'tx-to-rx',
      isolationDutPathState: 'small-signal-passive-path',
      isolationDutControlStateId: 'passive-isolation-state',
      isolationDutBiasState: 'off',
      isolationAcquiredAtIso: '2026-07-17T07:59:30.000Z',
      isolationCalibrationEvidenceId: 'vna-path-cal',
      isolationExcitation: { kind: 'small-signal-cw', sourceAssetId: 'vna-path', sourceRole: 'stimulus-source', sourceQueryBackEvidenceId: 'vna-path-qb-001', powerDbm: -20 },
      isolationApplicability: 'small-signal-path-isolation-only',
      txToRxIsolationDb: 45,
      noiseMeasurement: { convention: 'density', densityDbmPerHz: -125 },
      txNoiseMetricEvidenceId: 'tx-noise',
      terminationState: 'source-connected',
      dutPathState: 'pa-on',
      noiseIncludesTxToRxIsolation: false,
      noiseExpandedUncertaintyDb: 1.2,
      isolationExpandedUncertaintyDb: 1.5,
      isolationEvidenceId: 'isolation-001',
      analyzerFloorDensityDbmPerHz: -165,
      floorEvidenceId: 'floor-001',
      floorExpandedUncertaintyDb: 1,
      minimumFloorHeadroomDb: 6,
      terminatedBaselineEvidenceId: 'terminated-baseline-001',
      terminatedBaselineDensityDbmPerHz: -165,
      paOffLeakageEvidenceId: 'pa-off-leakage-001',
      paOffLeakageDensityDbmPerHz: -164,
      noiseCorrectionId: 'rx-noise-corr-001',
    } as const;

    expect(evaluateDesenseRiskBudget(validEvidence)).toEqual({
      scope: 'risk-budget-only',
      validity: 'valid',
      reasons: [],
      sourceDensityDbmPerHz: -125,
      worstCaseNoiseLowerBoundDbmPerHz: -126.2,
      floorUpperBoundDbmPerHz: -164,
      validatedFloorHeadroomDb: 37.8,
      estimatedRxBranchDensityDbmPerHz: -170,
      worstCaseRxBranchDensityDbmPerHz: -167.3,
      combinedExpandedUncertaintyDb: 2.7,
    });
    expect(evaluateDesenseRiskBudget({
      ...validEvidence,
      isolationMeasurementFrequencyHz: 1_841_000_000,
    })).toMatchObject({
      validity: 'invalid',
      reasons: ['noise and isolation evidence must use the same frequency'],
    });
    expect(evaluateDesenseRiskBudget({
      ...validEvidence,
      noiseIncludesTxToRxIsolation: true,
    })).toMatchObject({
      validity: 'invalid',
      reasons: ['noise evidence already includes TX-to-RX isolation; refusing to apply it twice'],
    });
    expect(evaluateDesenseRiskBudget({
      ...validEvidence,
      isolationTxPlane: 'analyzer-input',
    })).toMatchObject({
      validity: 'invalid',
      reasons: ['noise and isolation reference planes are incompatible'],
    });

    expect(evaluateDesenseRiskBudget({
      ...validEvidence,
      noiseMeasurement: {
        convention: 'rbw-integrated',
        integratedNoisePowerDbm: -95,
        equivalentNoiseBandwidthHz: 100_000,
      },
    })).toMatchObject({
      validity: 'valid',
      sourceDensityDbmPerHz: -145,
      estimatedRxBranchDensityDbmPerHz: -190,
    });
    const floorBlocked = evaluateDesenseRiskBudget({
      ...validEvidence,
      analyzerFloorDensityDbmPerHz: -128,
      floorExpandedUncertaintyDb: 1,
      minimumFloorHeadroomDb: 3,
    });
    expect(floorBlocked).toMatchObject({
      validity: 'invalid',
      reasons: ['worst-case noise is not resolved above the analyzer-floor upper bound by the required headroom'],
      sourceDensityDbmPerHz: -125,
      worstCaseNoiseLowerBoundDbmPerHz: -126.2,
      floorUpperBoundDbmPerHz: -127,
    });
    expect(floorBlocked.validatedFloorHeadroomDb).toBeCloseTo(0.8, 12);
  });

  it('keeps all three blind cases deterministic and rejects out-of-order evidence', () => {
    const expectedCases = [
      {
        id: 'gain-pae-fail',
        evidenceIds: ['known-path-recheck', 'gain-mode-query-back', 'synchronized-rf-dc'],
      },
      {
        id: 'evm-aclr-fail',
        evidenceIds: ['passive-through-residual', 'attenuation-step-check', 'pout-backoff-recovery'],
      },
      {
        id: 'desense-risk-budget',
        evidenceIds: ['terminated-floor-baseline', 'independent-isolation', 'rx-branch-risk-budget'],
      },
    ] as const;
    expect(DVT_BUILT_IN_CASES.map(({ id }) => id)).toEqual(
      expectedCases.map(({ id }) => id),
    );

    for (const expectedCase of expectedCases) {
      const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === expectedCase.id);
      expect(diagnosticCase?.steps.map(({ order }) => order)).toEqual([1, 2, 3]);
      expect(diagnosticCase?.steps.map(({ expectedEvidenceId }) => expectedEvidenceId)).toEqual(
        expectedCase.evidenceIds,
      );
      const hypothesisIds = diagnosticCase?.hypotheses.map(({ hypothesisId }) => hypothesisId).sort();
      for (const step of diagnosticCase?.steps ?? []) {
        expect(step.expectedEffects.map(({ hypothesisId }) => hypothesisId).sort()).toEqual(hypothesisIds);
      }

      let progress: DvtDiagnosticProgress = {
        caseId: expectedCase.id,
        nextStepIndex: 0,
        acceptedEvidenceIds: [],
        accepted: false,
        complete: false,
      };
      expect(advanceDiagnosticCase(
        expectedCase.id,
        progress,
        CAPSTONE_OBSERVED_CASE_EVIDENCE.find(({ caseId, evidenceId }) => (
          caseId === expectedCase.id && evidenceId === expectedCase.evidenceIds[1]
        ))!,
      )).toEqual(progress);

      for (const evidenceId of expectedCase.evidenceIds) {
        progress = advanceDiagnosticCase(
          expectedCase.id,
          progress,
          CAPSTONE_OBSERVED_CASE_EVIDENCE.find((record) => (
            record.caseId === expectedCase.id && record.evidenceId === evidenceId
          ))!,
        );
      }
      expect(progress).toMatchObject({
        nextStepIndex: 3,
        acceptedEvidenceIds: expectedCase.evidenceIds,
        accepted: true,
        complete: true,
      });
    }

    const riskBudget = DVT_BUILT_IN_CASES
      .find(({ id }) => id === 'desense-risk-budget')
      ?.steps.at(-1)?.expectedEvidence;
    expect(riskBudget).toMatchObject({
      metric: 'desense-risk-budget',
      scope: 'risk-budget-only',
      requiredMeasurementPointId: DVT_CAPSTONE_OPERATING_PROFILE.measurementPointId,
      requiredTxCarrierFrequencyHz: DVT_CAPSTONE_OPERATING_PROFILE.txCarrierFrequencyHz,
      requiredNoiseMeasurementFrequencyHz: 1_840_000_000,
      requiredIsolationMeasurementFrequencyHz: 1_840_000_000,
      requiredIsolationApplicability: 'small-signal-path-isolation-only',
      requiresAnalyzerFloorResolution: true,
    });
    expect(JSON.stringify(riskBudget)).not.toMatch(/sensitivity|BLER|"txOutputPowerDbm"|"txToRxIsolationDb"|"noiseMeasurement"|"floorEvidenceId"/i);

    const gainPaeFinal = DVT_BUILT_IN_CASES
      .find(({ id }) => id === 'gain-pae-fail')
      ?.steps.at(-1)?.expectedEvidence;
    expect(gainPaeFinal).toMatchObject({
      metric: 'synchronized-kpi',
      requiredEvidenceIds: ['pin', 'pout', 'dc'],
      acquisitionMode: 'repeatable-sequence',
      maximumTriggerRepeatabilitySeconds: 1e-6,
      requiredSupplyRegulationMode: 'CV',
      maximumGainDroopDbAcrossAperture: 0.2,
      thermalMechanismClaimRequiresFixtureTemperatureEvidence: true,
    });
    expect(JSON.stringify(gainPaeFinal)).not.toMatch(/observedSupply|fixtureTemperatureEvidence|thermalMechanismClaimAllowed/);

    const attenuationStep = DVT_BUILT_IN_CASES
      .find(({ id }) => id === 'evm-aclr-fail')
      ?.steps[1]?.expectedEvidence;
    expect(attenuationStep).toMatchObject({
      metric: 'analyzer-attenuation-step',
      attenuationStepDeltaDb: 10,
      maximumAbsoluteCorrectedAclrDeltaDb: 0.4,
      maximumRepeatabilityDb: 0.2,
      minimumMixerHeadroomDb: 0,
      minimumNoiseFloorHeadroomDb: 0,
    });
    expect(JSON.stringify(attenuationStep)).not.toMatch(/correctedAclrDeltaDb|mixerHeadroomBeforeDb|noiseFloorHeadroomAfterDb/);

    const initialProgress: DvtDiagnosticProgress = {
      caseId: 'gain-pae-fail', nextStepIndex: 0, acceptedEvidenceIds: [], accepted: false, complete: false,
    };
    const firstObserved = CAPSTONE_OBSERVED_CASE_EVIDENCE.find(({ caseId, evidenceId }) => (
      caseId === 'gain-pae-fail' && evidenceId === 'known-path-recheck'
    ))!;
    const sameIdSignatureMismatch = firstObserved.payload?.metric === 'typed-signature'
      ? { ...firstObserved, payload: { ...firstObserved.payload, observedSignature: 'gain-mode-query-mismatch' as const } }
      : firstObserved;
    expect(advanceDiagnosticCase('gain-pae-fail', initialProgress, sameIdSignatureMismatch)).toEqual(initialProgress);
    expect(() => buildConclusionEvidenceLinkage({
      ...CAPSTONE_SOURCE_RECORDS,
      observedCaseEvidence: CAPSTONE_SOURCE_RECORDS.observedCaseEvidence.map((record) => (
        record.caseId === sameIdSignatureMismatch.caseId && record.evidenceId === sameIdSignatureMismatch.evidenceId
          ? sameIdSignatureMismatch
          : record
      )),
    })).toThrow(/does not match the locked deterministic contract/);

    const synchronizedObserved = CAPSTONE_OBSERVED_CASE_EVIDENCE.find(({ evidenceId }) => evidenceId === 'synchronized-rf-dc')!;
    const toleranceMismatch = synchronizedObserved.payload?.metric === 'synchronized-kpi'
      ? { ...synchronizedObserved, payload: { ...synchronizedObserved.payload, observedPaePercent: synchronizedObserved.payload.observedPaePercent + 1 } }
      : synchronizedObserved;
    const progressedTwice = ['known-path-recheck', 'gain-mode-query-back'].reduce((current, evidenceId) => (
      advanceDiagnosticCase('gain-pae-fail', current, CAPSTONE_OBSERVED_CASE_EVIDENCE.find((record) => record.evidenceId === evidenceId)!)
    ), initialProgress);
    expect(advanceDiagnosticCase('gain-pae-fail', progressedTwice, toleranceMismatch)).toEqual(progressedTwice);
    expect(() => buildConclusionEvidenceLinkage({
      ...CAPSTONE_SOURCE_RECORDS,
      observedCaseEvidence: CAPSTONE_SOURCE_RECORDS.observedCaseEvidence.map((record) => (
        record.evidenceId === toleranceMismatch.evidenceId ? toleranceMismatch : record
      )),
    })).toThrow(/differs from the locked transaction contract/);

    expect(validateDiagnosticPlan('evm-aclr-fail', {
      nextStepId: 'step-analyzer-attenuation',
      expectedEvidenceId: 'attenuation-step-check',
    })).toEqual({ valid: true, reason: 'diagnostic plan is internally consistent' });
    expect(validateDiagnosticPlan('evm-aclr-fail', {
      nextStepId: 'step-analyzer-attenuation',
      expectedEvidenceId: 'pout-backoff-recovery',
    })).toMatchObject({ valid: false });
    expect(validateEvidenceClassification('evm-aclr-fail', {
      evidenceId: 'attenuation-step-check',
      hypothesisId: 'analyzer-artifact',
      effect: 'contradict',
    })).toEqual({ valid: true, reason: 'evidence classification matches the built-in case' });
  });

  it('binds canonical external values and typed correlation records into educational source checksums', () => {
    const canonicalDrift: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === 'capstone-state-repeatability-2026-07-r2'
          ? { ...record, relatedEvidenceIds: ['same-id-canonical-drift'] }
          : record
      )),
    };
    const canonicalLinkage = buildConclusionEvidenceLinkage(CAPSTONE_SOURCE_RECORDS);
    const driftedLinkage = buildConclusionEvidenceLinkage(canonicalDrift);
    expect(driftedLinkage.decisionSources[0]?.sourceDigest).not.toBe(canonicalLinkage.decisionSources[0]?.sourceDigest);

    const correlationEvidenceId = 'capstone-pae-correlation-study';
    const correlatedRecords: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      decisionSources: CAPSTONE_SOURCE_RECORDS.decisionSources.map((source, sourceIndex) => sourceIndex === 0 ? {
        ...source,
        uncertaintyComponents: source.uncertaintyComponents.map((component, componentIndex) => componentIndex === 0 ? {
          ...component,
          correlations: [{
            withComponentId: source.uncertaintyComponents[1]!.id,
            correlationCoefficient: 0.25,
            evidenceId: correlationEvidenceId,
          }],
        } : component),
      } : source),
      externalEvidenceRegistry: [
        ...CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry,
        {
          evidenceId: correlationEvidenceId,
          evidenceKind: 'uncertainty',
          sourceMeasurementPointId: CAPSTONE_SOURCE_RECORDS.measurementPoint.pointId,
          metric: 'correlation',
          value: 0.25,
          unit: 'coefficient',
        },
      ],
    };
    expect(() => buildConclusionEvidenceLinkage(correlatedRecords)).not.toThrow();
    for (const mutation of [{ value: 0.2 }, { evidenceKind: 'station-verification' as const }]) {
      expect(() => buildConclusionEvidenceLinkage({
        ...correlatedRecords,
        externalEvidenceRegistry: correlatedRecords.externalEvidenceRegistry.map((record) => (
          record.evidenceId === correlationEvidenceId ? { ...record, ...mutation } : record
        )),
      })).toThrow(/correlation source .* is not registered as typed correlation provenance/);
    }
  });

  it('validates connector-to-mixer units independently of reference level and blocks unknown typed IDs', () => {
    const basePoint = CAPSTONE_SOURCE_RECORDS.measurementPoint;
    const validateHeadroom = (analyzerHeadroom: DvtMeasurementPoint['analyzerHeadroom']) => {
      const point = { ...basePoint, analyzerHeadroom };
      const externalEvidenceRegistry = CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === basePoint.analyzerHeadroom.evidenceId
          ? { ...record, analyzerHeadroom }
          : record
      ));
      return validateMeasurementPoint(point, {
        stationManifest: CAPSTONE_SOURCE_RECORDS.stationManifest,
        sourceAssetId: CAPSTONE_SOURCE_RECORDS.sourceAssetId,
        requiredCapabilityIds: CAPSTONE_SOURCE_RECORDS.requiredCapabilityIds,
        asOfIso: CAPSTONE_SOURCE_RECORDS.stationAsOfIso,
        externalEvidenceRegistry,
      });
    };

    expect(basePoint.analyzerHeadroom.mixerTotalPowerDbm).toBeCloseTo(
      basePoint.analyzerHeadroom.connectorTotalPowerDbm - basePoint.analyzerHeadroom.inputAttenuationDb,
      12,
    );
    expect(basePoint.analyzerHeadroom.stationVerifiedMixerOperatingLimitDbm).toBeLessThan(0);
    expect(validateHeadroom(basePoint.analyzerHeadroom)).toEqual({ validity: 'valid', reasons: [] });
    expect(validateHeadroom({
      ...basePoint.analyzerHeadroom,
      referenceLevelDbm: basePoint.analyzerHeadroom.referenceLevelDbm + 17,
    })).toEqual({ validity: 'valid', reasons: [] });
    expect(validateHeadroom({
      ...basePoint.analyzerHeadroom,
      mixerTotalPowerDbm: basePoint.analyzerHeadroom.mixerTotalPowerDbm + 0.1,
    })).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining(['mixer total power must equal connector total power minus input attenuation']),
    });
    expect(validateHeadroom({
      ...basePoint.analyzerHeadroom,
      operatingLimitEvidenceId: 'unknown-operating-limit',
    })).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining(['analyzer operating limit requires exact valid typed station provenance']),
    });
    expect(validateHeadroom({
      ...basePoint.analyzerHeadroom,
      residualState: { ...basePoint.analyzerHeadroom.residualState, evidenceId: 'unknown-residual-state' },
    })).toMatchObject({
      validity: 'invalid',
      reasons: expect.arrayContaining(['analyzer residual state requires exact typed point and asset provenance']),
    });
  });

  it('requires typed analyzer provenance on every analyzer-based decision and diagnostic source', () => {
    const linkage = buildConclusionEvidenceLinkage(CAPSTONE_SOURCE_RECORDS);
    const requiredIds = [
      CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.evidenceId,
      CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.operatingLimitEvidenceId,
      CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.residualState.evidenceId,
    ];
    const analyzerMetricIds = new Set(['pout', 'aclr', 'evm', 'spectrum', 'tx-noise']);
    for (const source of [
      ...CAPSTONE_SOURCE_RECORDS.decisionSources,
      ...CAPSTONE_SOURCE_RECORDS.diagnosticEvidenceSources,
    ]) {
      if (source.sourceMetricEvidenceIds.some((id) => analyzerMetricIds.has(id))) {
        expect(source.sourceExternalEvidenceIds).toEqual(expect.arrayContaining(requiredIds));
      }
    }
    expect(linkage.measurementValidation.validity).toBe('valid');
    expect(() => buildConclusionEvidenceLinkage({
      ...CAPSTONE_SOURCE_RECORDS,
      decisionSources: CAPSTONE_SOURCE_RECORDS.decisionSources.map((source) => (
        source.metricKind === 'aclr-native'
          ? {
              ...source,
              sourceExternalEvidenceIds: source.sourceExternalEvidenceIds.filter((id) => (
                id !== CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.operatingLimitEvidenceId
              )),
            }
          : source
      )),
    })).toThrow(/requires headroom, operating-limit, and residual provenance/);
    expect(() => buildConclusionEvidenceLinkage({
      ...CAPSTONE_SOURCE_RECORDS,
      decisionSources: CAPSTONE_SOURCE_RECORDS.decisionSources.map((source) => (
        source.metricKind === 'desense-isolation'
          ? {
              ...source,
              sourceExternalEvidenceIds: source.sourceExternalEvidenceIds.filter((id) => (
                id !== CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.residualState.evidenceId
              )),
            }
          : source
      )),
    })).toThrow(/requires headroom, operating-limit, and residual provenance/);
    expect(() => buildConclusionEvidenceLinkage({
      ...CAPSTONE_SOURCE_RECORDS,
      diagnosticEvidenceSources: CAPSTONE_SOURCE_RECORDS.diagnosticEvidenceSources.map((source) => (
        source.evidenceId === 'terminated-floor-baseline'
          ? {
              ...source,
              sourceExternalEvidenceIds: source.sourceExternalEvidenceIds.filter((id) => (
                id !== CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.evidenceId
              )),
            }
          : source
      )),
    })).toThrow(/requires headroom, operating-limit, and residual provenance/);
  });

  it('rejects an old linkage when the point and headroom registry drift together consistently', () => {
    const originalLinkage = buildConclusionEvidenceLinkage(CAPSTONE_SOURCE_RECORDS);
    const driftedHeadroom = {
      ...CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom,
      referenceLevelDbm: CAPSTONE_SOURCE_RECORDS.measurementPoint.analyzerHeadroom.referenceLevelDbm + 5,
    };
    const driftedRecords: DvtConclusionSourceRecords = {
      ...CAPSTONE_SOURCE_RECORDS,
      measurementPoint: {
        ...CAPSTONE_SOURCE_RECORDS.measurementPoint,
        analyzerHeadroom: driftedHeadroom,
      },
      externalEvidenceRegistry: CAPSTONE_SOURCE_RECORDS.externalEvidenceRegistry.map((record) => (
        record.evidenceId === driftedHeadroom.evidenceId
          ? { ...record, analyzerHeadroom: driftedHeadroom }
          : record
      )),
    };
    const driftedLinkage = buildConclusionEvidenceLinkage(driftedRecords);
    expect(driftedLinkage.decisionSources[0]?.sourceDigest).not.toBe(
      originalLinkage.decisionSources[0]?.sourceDigest,
    );
    expect(validateConclusionSourceRecords(
      makeCapstoneConclusionReport(driftedLinkage),
      driftedRecords,
      originalLinkage,
    )).toMatchObject({
      valid: false,
      reasons: expect.arrayContaining([
        'claimed conclusion linkage does not match recomputed source-record provenance',
      ]),
    });
  });

  it('binds isolation certificate and excitation query-back metadata into the canonical source checksum', () => {
    const originalLinkage = buildConclusionEvidenceLinkage(CAPSTONE_SOURCE_RECORDS);
    const originalIsolationSource = originalLinkage.decisionSources.find(({ metricId }) => (
      metricId.includes('desense-isolation')
    ))!;
    const driftedBundles: DvtConclusionSourceRecords[] = [
      {
        ...CAPSTONE_SOURCE_RECORDS,
        stationManifest: {
          ...CAPSTONE_SOURCE_RECORDS.stationManifest,
          calibrations: CAPSTONE_SOURCE_RECORDS.stationManifest.calibrations.map((calibration) => (
            calibration.calibrationEvidenceId === 'capstone-vna-cal'
              ? {
                  ...calibration,
                  certificateOrEducationalId: `${calibration.certificateOrEducationalId}-metadata-drift`,
                  validThroughIso: '2026-11-30T23:59:59.000Z',
                }
              : calibration
          )),
        },
      },
      {
        ...CAPSTONE_SOURCE_RECORDS,
        stationManifest: {
          ...CAPSTONE_SOURCE_RECORDS.stationManifest,
          assets: CAPSTONE_SOURCE_RECORDS.stationManifest.assets.map((asset) => (
            asset.assetId === 'capstone-vna-e5080b'
              ? {
                  ...asset,
                  queryBack: { ...asset.queryBack, acquiredAtIso: '2026-07-17T07:59:49.000Z' },
                }
              : asset
          )),
        },
      },
    ];

    for (const driftedRecords of driftedBundles) {
      const driftedLinkage = buildConclusionEvidenceLinkage(driftedRecords);
      const driftedIsolationSource = driftedLinkage.decisionSources.find(({ metricId }) => (
        metricId.includes('desense-isolation')
      ))!;
      expect(driftedIsolationSource.sourceDigest).not.toBe(originalIsolationSource.sourceDigest);
      expect(validateConclusionSourceRecords(
        makeCapstoneConclusionReport(driftedLinkage),
        driftedRecords,
        originalLinkage,
      )).toMatchObject({
        valid: false,
        reasons: expect.arrayContaining([
          'claimed conclusion linkage does not match recomputed source-record provenance',
        ]),
      });
    }
  });

  it('requires every senior conclusion section, linked IDs, cleanup, owner, and next action', () => {
    const nineStepDiagnosticSources = DVT_BUILT_IN_CASES.flatMap(({ id: caseId, steps }) => (
      steps.map(({ expectedEvidenceId }) => ({
        caseId,
        evidenceId: expectedEvidenceId,
        sourceMeasurementPointId: 'p-001',
        sourceMetricEvidenceIds: ['aclr'] as const,
        sourceExternalEvidenceIds: [],
        decisionMetricId: 'decision-aclr-001',
      }))
    ));
    const report = {
      reportId: 'edu-report-001',
      stationId: 'bench-a',
      measurementPointId: 'p-001',
      decisionIds: ['decision-aclr-001'],
      acceptedDiagnosticEvidenceIds: nineStepDiagnosticSources.map(({ evidenceId }) => evidenceId),
      sections: {
        scope: 'Educational LTE Band 3 FDD PAMiD nominal DVT.',
        station: 'Station manifest rev-1 is linked.',
        symptom: 'Corrected ACLR interval overlaps the allocation.',
        validity: 'Required evidence is valid and synchronized.',
        decision: 'Guardband decision is inconclusive.',
        hypotheses: 'DUT compression and analyzer artifact remain ranked.',
        evidence: 'Through, attenuation-step and backoff evidence are linked.',
        conclusion: 'PA nonlinearity is strongly indicated within this case.',
        residualRisk: 'Thermal drift and fixture repeatability remain.',
      },
      cleanup: {
        rfOutput: { status: 'off', atIso: '2026-07-17T09:00:00.000Z', evidenceId: 'rf-off-001' },
        acquisition: { status: 'aborted', atIso: '2026-07-17T09:00:00.100Z', evidenceId: 'abort-001' },
        bias: { status: 'safe-down', atIso: '2026-07-17T09:00:00.200Z', evidenceId: 'bias-down-001' },
        dcOutput: { status: 'off', atIso: '2026-07-17T09:00:00.300Z', evidenceId: 'dc-off-001' },
      },
      nextAction: 'Repeat at the pinned thermal state.',
      owner: 'RF DVT engineer',
    } as const;
    expect(validateConclusionReportCompleteness(report)).toEqual({
      complete: true,
      missingFields: [],
    });
    expect(validateConclusionReportCompleteness({
      ...report,
      sections: { ...report.sections, residualRisk: '' },
      owner: '',
      cleanup: {
        ...report.cleanup,
        rfOutput: { ...report.cleanup.rfOutput, status: 'on' },
      },
    })).toEqual({
      complete: false,
      missingFields: ['sections.residualRisk', 'cleanup.rfOutput.status', 'owner'],
    });

    const linkedDecision = decideWithGuardband({
      metricId: 'decision-aclr-001', validity: 'valid', direction: 'upper-bound',
      measured: { unit: 'dBc', valueDbc: -45 }, expandedUncertainty: { unit: 'dB', valueDb: 1 },
      upperLimit: { unit: 'dBc', valueDbc: -30 }, valueConvention: 'analyzer-negative-dbc',
    });
    const linkage = {
      stationId: 'bench-a',
      stationRevisionId: 'rev-1',
      stationReadiness: {
        state: 'ready', requiredCapabilityIds: ['lte-b3'], blockingCapabilityIds: [],
        conditionalCapabilityIds: [], evidence: ['lte-b3: ready'],
        effectiveCapabilities: [{
          id: 'lte-b3', label: 'LTE B3', nominalState: 'ready', effectiveState: 'ready',
          reasons: [], evidence: 'ready',
        }],
      },
      measurementPointId: 'p-001',
      measurementValidation: { validity: 'valid', reasons: [] },
      cleanup: report.cleanup,
      decisionSources: [{
        metricId: 'decision-aclr-001', sourceMeasurementPointId: 'p-001',
        sourceMetricEvidenceIds: ['aclr'], sourceExternalEvidenceIds: [],
        uncertaintySourceEvidenceIds: ['aclr-u-001'],
        valueDigest: 'fnv1a32:12345678', sourceDigest: 'fnv1a32:90abcdef',
      }],
      diagnosticEvidenceSources: nineStepDiagnosticSources,
      decisions: [linkedDecision],
    } as const;
    expect(validateConclusionEvidenceLinkage(report, linkage)).toEqual({ valid: true, reasons: [] });
    expect(validateConclusionEvidenceLinkage(report, {
      ...linkage,
      decisionSources: linkage.decisionSources.map((source) => ({ ...source, valueDigest: '' })),
    })).toEqual({
      valid: false,
      reasons: ['decision source educational checksums are invalid'],
    });
    const inconclusiveDecision = decideWithGuardband({
      metricId: 'decision-aclr-inconclusive', validity: 'valid', direction: 'upper-bound',
      measured: { unit: 'dBc', valueDbc: -30.8 }, expandedUncertainty: { unit: 'dB', valueDb: 1 },
      upperLimit: { unit: 'dBc', valueDbc: -30 }, valueConvention: 'analyzer-negative-dbc',
    });
    expect(validateConclusionEvidenceLinkage(
      { ...report, decisionIds: ['decision-aclr-inconclusive'] },
      {
        ...linkage,
        decisions: [inconclusiveDecision],
        decisionSources: [{
          metricId: 'decision-aclr-inconclusive', sourceMeasurementPointId: 'p-001',
          sourceMetricEvidenceIds: ['aclr'], sourceExternalEvidenceIds: [],
          uncertaintySourceEvidenceIds: ['aclr-u-001'],
          valueDigest: 'fnv1a32:23456789', sourceDigest: 'fnv1a32:abcdef01',
        }],
        diagnosticEvidenceSources: linkage.diagnosticEvidenceSources.map((source) => ({
          ...source, decisionMetricId: 'decision-aclr-inconclusive',
        })),
      },
    )).toEqual({ valid: true, reasons: [] });
    expect(validateConclusionEvidenceLinkage(report, {
      ...linkage,
      stationReadiness: { ...linkage.stationReadiness, state: 'blocked' },
      measurementValidation: { validity: 'invalid', reasons: ['trigger is misaligned'] },
    })).toEqual({
      valid: false,
      reasons: ['linked station readiness must be ready', 'linked measurement point validity must be valid'],
    });
  });
});
