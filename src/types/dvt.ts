export type DvtCapabilityState = 'ready' | 'conditional' | 'blocked';

export type DvtValidity = 'valid' | 'inconclusive' | 'invalid';

export type DvtLimitDirection = 'upper-bound' | 'lower-bound' | 'range';

export interface DvtStationCapability {
  readonly id: string;
  readonly label: string;
  readonly state: DvtCapabilityState;
  readonly evidence: string;
  readonly condition?: string;
  readonly requiredAssetIds: readonly string[];
  readonly requiredAssetConfigurations: readonly {
    readonly assetId: string;
    readonly requiredModel: string;
    readonly requiredOptionIds: readonly string[];
    readonly requiredModules: readonly {
      readonly moduleAssetId: string;
      readonly model: string;
      readonly requiredOptionIds: readonly string[];
    }[];
  }[];
  readonly requiredAccessoryIds: readonly string[];
  readonly requiredApplicationIds: readonly string[];
  readonly requiredCalibrationIds: readonly string[];
}

export interface DvtStationAsset {
  readonly assetId: string;
  readonly role: 'signal-source' | 'analyzer' | 'power-sensor' | 'power-supply' | 'network-analyzer';
  readonly manufacturer: string;
  readonly model: string;
  readonly serialOrRedactedId: string;
  readonly firmwareVersion: string;
  readonly installedOptionIds: readonly string[];
  readonly installedModules?: readonly {
    readonly moduleAssetId: string;
    readonly model: string;
    readonly serialOrRedactedId: string;
    readonly firmwareVersion: string;
    readonly installedOptionIds: readonly string[];
    readonly queryBackModel: string;
    readonly queryBackSerialOrRedactedId: string;
    readonly queryBackFirmwareVersion: string;
    readonly queryBackOptionIds: readonly string[];
    readonly queryBackEvidenceId: string;
    readonly queryBackStatus: 'verified' | 'unverified';
    readonly unverifiedConditions: readonly string[];
  }[];
  readonly queryBack: {
    readonly evidenceId: string;
    readonly acquiredAtIso: string;
    readonly model: string;
    readonly serialOrRedactedId: string;
    readonly firmwareVersion: string;
    readonly optionIds: readonly string[];
    readonly status: 'verified' | 'unverified';
  };
  readonly unverifiedConditions: readonly string[];
}

export interface DvtApplicationEvidence {
  readonly applicationEvidenceId: string;
  readonly assetId: string;
  readonly applicationName: string;
  readonly version: string;
  readonly licenseState: 'verified' | 'unverified' | 'not-required';
  readonly queryBackEvidenceId: string;
  readonly acquiredAtIso: string;
  readonly unverifiedConditions: readonly string[];
}

export interface DvtAccessoryEvidence {
  readonly accessoryEvidenceId: string;
  readonly assetId: string;
  readonly label: string;
  readonly model: string;
  readonly serialOrRedactedId: string;
  readonly maximumFrequencyHz?: number;
  readonly maximumInputPowerDbm?: number;
  readonly impedanceOhms?: number;
  readonly role: 'forward-coupler' | 'output-attenuator' | 'dc-block' | 'termination' | 'rf-cable' | 'calibration-kit' | 'torque-tool';
  readonly measurementPlane: 'dut-input-path' | 'dut-output-path' | 'source-output' | 'analyzer-input' | 'vna-reference-plane' | 'connector-interface';
  readonly ratingEvidenceId: string;
  readonly ratingState: 'verified' | 'unverified';
  readonly unverifiedConditions: readonly string[];
}

export interface DvtCalibrationEvidence {
  readonly calibrationEvidenceId: string;
  readonly assetId: string;
  readonly certificateOrEducationalId: string;
  readonly validFromIso: string;
  readonly validThroughIso: string;
  readonly scope: string;
  readonly state: 'valid' | 'expired' | 'unverified';
  readonly verificationId: string;
  readonly unverifiedConditions: readonly string[];
}

export interface DvtStationManifest {
  readonly stationId: string;
  readonly revisionId: string;
  readonly assets: readonly DvtStationAsset[];
  readonly applications: readonly DvtApplicationEvidence[];
  readonly accessories: readonly DvtAccessoryEvidence[];
  readonly calibrations: readonly DvtCalibrationEvidence[];
  readonly verificationIds: readonly string[];
  readonly unverifiedConditions: readonly string[];
  readonly capabilities: readonly DvtStationCapability[];
}

export interface DvtStationReadiness {
  readonly state: DvtCapabilityState;
  readonly requiredCapabilityIds: readonly string[];
  readonly blockingCapabilityIds: readonly string[];
  readonly conditionalCapabilityIds: readonly string[];
  readonly evidence: readonly string[];
  readonly effectiveCapabilities: readonly {
    readonly id: string;
    readonly label: string;
    readonly nominalState: DvtCapabilityState | null;
    readonly effectiveState: DvtCapabilityState;
    readonly reasons: readonly string[];
    readonly evidence: string;
  }[];
}

export type DvtMetricEvidenceId =
  | 'pin'
  | 'pout'
  | 'dc'
  | 'spectrum'
  | 'aclr'
  | 'evm'
  | 'tx-noise';

export interface DvtWaveformAllocation {
  readonly waveformId: string;
  readonly waveformSha256: string;
  readonly rat: 'LTE' | 'NR' | 'GSM' | 'CW' | 'two-tone';
  readonly bandId: string;
  readonly duplexMode: 'FDD' | 'TDD' | 'not-applicable';
  readonly direction: 'UL' | 'DL' | 'not-applicable';
  readonly centerFrequencyHz: number;
  readonly channelBandwidthHz: number;
  readonly allocationId: string;
  readonly resourceBlockStart?: number;
  readonly resourceBlockCount?: number;
  readonly modulation: string;
  readonly sourceSetpointDbm: number;
}

export interface DvtGenericDutState {
  readonly stateId: string;
  readonly intendedMode: string;
  readonly queriedMode: string;
  readonly queryBackAtIso: string;
  readonly biasState: 'on' | 'off' | 'unknown';
  readonly fixtureTemperatureC?: number;
}

/**
 * Analyzer level plan at the RF connector and behind the configured input
 * attenuator. Reference level remains a display/setup field and is never used
 * as the mixer operating boundary.
 */
export interface DvtAnalyzerHeadroomEvidence {
  readonly strongestConnectorSignalDbm: number;
  readonly strongestConnectorSignalSourceId: string;
  readonly strongestConnectorSignalRole: 'dominant-off-screen-tx-carrier' | 'measured-channel-power';
  readonly connectorTotalPowerDbm: number;
  readonly inputAttenuationDb: number;
  readonly mixerTotalPowerDbm: number;
  /** A station-qualified working boundary, not a vendor accuracy specification. */
  readonly stationVerifiedMixerOperatingLimitDbm: number;
  /** Typed registry record that proves the station-qualified mixer boundary. */
  readonly operatingLimitEvidenceId: string;
  readonly mixerHeadroomDb: number;
  readonly residualState: {
    readonly kind: 'if-adc-status' | 'attenuation-step';
    readonly status: 'verified-in-range' | 'overload' | 'unverified';
    readonly evidenceId: string;
    readonly observedAtIso: string;
  };
  readonly referenceLevelDbm: number;
  readonly evidenceId: string;
}

export type DvtNoiseMeasurement =
  | {
      readonly convention: 'density';
      readonly densityDbmPerHz: number;
    }
  | {
      readonly convention: 'rbw-integrated';
      readonly integratedNoisePowerDbm: number;
      readonly equivalentNoiseBandwidthHz: number;
    };

export interface DvtMetricEvidenceBase {
  readonly evidenceId: DvtMetricEvidenceId;
  readonly instrumentAssetId: string;
  readonly instrumentQueryBackEvidenceId: string;
  readonly measurementCalibrationEvidenceId: string;
  readonly acquisitionId: string;
  readonly acquisitionGroupId: string;
  readonly acquisitionSequenceIndex: number;
  readonly triggerReferenceId: string;
  readonly triggerRepeatabilitySeconds: number;
  readonly settlingSeconds: number;
  readonly referencePlane: string;
  readonly correctionId: string;
  readonly correctionProviderAssetId: string;
  readonly correctionCalibrationEvidenceId: string;
  readonly correctionVerificationId: string;
  /** Aperture ends at acquiredAtIso. */
  readonly apertureSeconds: number;
  readonly acquiredAtIso: string;
  readonly status: 'valid' | 'conditional' | 'corrupt';
  readonly overload: boolean | null;
  readonly errors: readonly string[];
}

export type DvtMetricEvidence =
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'pin';
      readonly metric: 'pin';
      readonly measurementMethod: 'forward-coupled-power-sensor';
      readonly rawPowerDbm: number;
      readonly correctedPowerDbm: number;
      readonly coupler: {
        readonly accessoryEvidenceId: string;
        readonly direction: 'forward';
        readonly inputPort: string;
        readonly throughPort: string;
        readonly coupledPort: string;
        readonly couplingFactorDb: number;
        /** Add to the coupled-port reading to refer Pin to the DUT-input plane. */
        readonly signedCorrectionDb: number;
        readonly expandedUncertaintyDb: number;
        readonly verificationId: string;
      };
    })
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'pout';
      readonly metric: 'pout';
      readonly measurementMethod: 'analyzer-channel-power';
      readonly rawPowerDbm: number;
      readonly correctedPowerDbm: number;
      readonly channelPowerBandwidthHz: number;
      readonly outputPath: {
        readonly accessoryEvidenceIds: readonly string[];
        /** Add to the analyzer-input reading to refer Pout to the DUT-output plane. */
        readonly signedCorrectionDb: number;
        readonly expandedUncertaintyDb: number;
        readonly verificationId: string;
      };
    })
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'dc';
      readonly metric: 'dc';
      readonly rawVoltageV: number;
      readonly rawCurrentA: number;
      readonly correctedVoltageV: number;
      readonly correctedCurrentA: number;
    })
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'spectrum';
      readonly metric: 'spectrum';
      readonly rawChannelPowerDbm: number;
      readonly correctedChannelPowerDbm: number;
    })
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'aclr';
      readonly metric: 'aclr';
      readonly rawAclrDbc: number;
      readonly correctedAclrDbc: number;
      readonly rawPositiveAclrDb: number;
      readonly correctedPositiveAclrDb: number;
      readonly integrationConditions: {
        readonly mainChannelBandwidthHz: number;
        readonly adjacentChannelBandwidthHz: number;
        readonly channelSpacingHz: number;
        readonly detector: 'rms';
        readonly filterId: string;
      };
    })
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'evm';
      readonly metric: 'evm';
      readonly rawEvmPercent: number;
      readonly correctedEvmPercent: number;
      readonly applicationEvidenceId: string;
      readonly licenseState: 'verified' | 'unverified';
      readonly referenceWaveformId: string;
      readonly equalizationMode: string;
      readonly normalizationReference: string;
      readonly residualEvmPercent: number;
      readonly residualEvidenceId: string;
    })
  | (DvtMetricEvidenceBase & {
      readonly evidenceId: 'tx-noise';
      readonly metric: 'tx-noise';
      readonly rawNoise: DvtNoiseMeasurement;
      readonly correctedNoise: DvtNoiseMeasurement;
      readonly resolutionBandwidthHz: number;
      readonly equivalentNoiseBandwidthHz: number;
      readonly analyzerFloorDensityDbmPerHz: number;
      readonly floorEvidenceId: string;
      readonly analyzerFrontEndSetup: {
        readonly setupEvidenceId: string;
        readonly inputAttenuationDb: number;
        readonly preamplifierEnabled: boolean;
        readonly referenceLevelDbm: number;
        readonly detector: 'rms';
        readonly measurementMode: 'swept-spectrum' | 'zero-span';
      };
    });

export interface DvtCleanupEvidence {
  readonly rfOutput: {
    readonly status: 'off' | 'on' | 'unknown';
    readonly atIso: string;
    readonly evidenceId: string;
  };
  readonly acquisition: {
    readonly status: 'aborted' | 'idle' | 'running' | 'unknown';
    readonly atIso: string;
    readonly evidenceId: string;
  };
  readonly bias: {
    readonly status: 'safe-down' | 'on' | 'unknown';
    readonly atIso: string;
    readonly evidenceId: string;
  };
  readonly dcOutput: {
    readonly status: 'off' | 'on' | 'not-applicable' | 'unknown';
    readonly atIso: string;
    readonly evidenceId: string;
  };
}

export interface DvtMeasurementPoint {
  readonly pointId: string;
  readonly waveform: DvtWaveformAllocation;
  readonly dutState: DvtGenericDutState;
  /** Named supply state whose numeric provenance is the point's required DC record. */
  readonly supplyStateId: string;
  readonly requiredEvidenceIds: readonly DvtMetricEvidenceId[];
  readonly metricEvidence: readonly DvtMetricEvidence[];
  readonly acquisitionPolicy:
    | {
        readonly mode: 'simultaneous';
        readonly minimumRequiredApertureOverlapSeconds: number;
      }
    | {
        readonly mode: 'repeatable-sequence';
        readonly requiredAcquisitionGroupId: string;
        readonly maximumTriggerRepeatabilitySeconds: number;
        readonly minimumSettlingSeconds: number;
        readonly settlingEvidenceId: string;
        readonly stateRepeatabilityEvidenceId: string;
      };
  readonly configuredAtIso: string;
  readonly acquiredAtIso: string;
  readonly triggerId: string;
  readonly triggerDelaySeconds: number;
  readonly dwellSeconds: number;
  readonly sourceState: 'leveled' | 'unlevel' | 'unknown';
  readonly analyzerState: 'in-range' | 'overload' | 'unknown';
  readonly acquisitionState: 'fresh' | 'stale' | 'unknown';
  readonly calibrationState: 'valid' | 'expired' | 'unknown';
  readonly triggerAlignment: 'aligned' | 'misaligned' | 'not-required' | 'unknown';
  readonly psuRegulationMode: 'CV' | 'CC' | 'TRIPPED' | 'OFF' | 'unknown';
  readonly instrumentErrors: readonly string[];
  readonly analyzerHeadroom: DvtAnalyzerHeadroomEvidence;
  readonly cleanup: DvtCleanupEvidence;
}

export interface DvtMeasurementValidationContext {
  readonly stationManifest: DvtStationManifest;
  readonly sourceAssetId: string;
  readonly requiredCapabilityIds: readonly string[];
  readonly asOfIso?: string;
  readonly externalEvidenceRegistry?: readonly DvtExternalEvidenceRegistryRecord[];
}

export interface DvtMeasurementValidation {
  readonly validity: DvtValidity;
  readonly reasons: readonly string[];
}

export type DvtQuantity =
  | { readonly unit: 'dB'; readonly valueDb: number }
  | { readonly unit: 'dBc'; readonly valueDbc: number }
  | { readonly unit: 'dBm'; readonly valueDbm: number }
  | { readonly unit: 'percent'; readonly valuePercent: number };

export type DvtDeltaQuantity =
  | { readonly unit: 'dB'; readonly valueDb: number }
  | { readonly unit: 'percent'; readonly valuePercent: number };

export type DvtNonnegativeUncertainty =
  | { readonly unit: 'dB'; readonly valueDb: number }
  | { readonly unit: 'percent'; readonly valuePercent: number };

export type DvtSignedSensitivityContribution =
  | { readonly unit: 'dB'; readonly signedValueDb: number }
  | { readonly unit: 'percent'; readonly signedValuePercent: number };

export type DvtSignedCovarianceContribution =
  | { readonly unit: 'dB-squared'; readonly signedValueDbSquared: number }
  | { readonly unit: 'percent-squared'; readonly signedValuePercentSquared: number };

export interface DvtCorrelationEvidence {
  readonly withComponentId: string;
  readonly correlationCoefficient: number;
  readonly evidenceId: string;
}

export interface DvtUncertaintyComponent {
  readonly id: string;
  readonly label: string;
  readonly evaluationType: 'A' | 'B';
  readonly sourceType: 'repeatability-study' | 'calibration-certificate' | 'manufacturer-specification' | 'resolution' | 'model';
  readonly sourceEvidenceId: string;
  readonly reportedUncertainty: DvtNonnegativeUncertainty;
  readonly distribution: 'normal' | 'rectangular' | 'triangular' | 'u-shaped';
  /** Divides the reported uncertainty to obtain a standard uncertainty. */
  readonly divisor: number;
  readonly sampleCount?: number;
  readonly degreesOfFreedom?: number;
  readonly referencePlane: string;
  readonly sensitivityCoefficient: number;
  readonly correlations: readonly DvtCorrelationEvidence[];
}

export interface DvtUncertaintyBudget {
  readonly standardUncertainty: DvtNonnegativeUncertainty;
  readonly coverageFactor: number;
  readonly expandedUncertainty: DvtNonnegativeUncertainty;
  readonly method: 'general-covariance';
  readonly signedSensitivityContributions: Readonly<Record<string, DvtSignedSensitivityContribution>>;
  readonly correlationCovarianceContributions: Readonly<Record<string, DvtSignedCovarianceContribution>>;
}

export interface DvtDecisionRequest {
  readonly metricId: string;
  readonly validity: DvtValidity;
  readonly direction: DvtLimitDirection;
  readonly measured: DvtQuantity;
  readonly expandedUncertainty: DvtDeltaQuantity;
  readonly lowerLimit?: DvtQuantity;
  readonly upperLimit?: DvtQuantity;
  readonly valueConvention?: 'generic' | 'analyzer-negative-dbc' | 'positive-ratio-aclr-db';
}

export interface DvtDecision {
  readonly metricId: string;
  readonly validity: DvtValidity;
  readonly direction: DvtLimitDirection;
  readonly verdict: 'pass' | 'fail' | 'inconclusive';
  readonly measured: DvtQuantity;
  readonly expandedUncertainty: DvtDeltaQuantity;
  /**
   * Positive means the uncertainty interval is wholly inside the limit and
   * zero touches it. Negative means overlap or wholly outside; verdict
   * disambiguates those two states.
   */
  readonly normalizedMargin: DvtDeltaQuantity | null;
  readonly guardbandedLower: DvtQuantity;
  readonly guardbandedUpper: DvtQuantity;
  readonly valueConvention: 'generic' | 'analyzer-negative-dbc' | 'positive-ratio-aclr-db';
  readonly explanation: string;
}

export interface DvtPaExpectedValues {
  readonly p1dbInputPowerDbm: number;
  readonly p1dbOutputPowerDbm: number;
  readonly paeAtP1dbPercent: number;
  readonly twoTonePerToneOutputPowerDbm: number;
  readonly twoToneCompositeOutputPowerDbm: number;
  readonly twoToneOip3Dbm: number;
  readonly im3OutputPowerDbm: number;
  readonly im3Dbc: number;
}

export interface DvtDesenseRiskEvidence {
  readonly measurementPointId: string;
  readonly txCarrierFrequencyHz: number;
  readonly txWaveformId: string;
  readonly txOutputPowerDbm: number;
  readonly txModeId: string;
  readonly supplyStateId: string;
  /** Structurally binds the named supply state to the synchronized DC record. */
  readonly supplyMetricEvidenceId: 'dc';
  readonly supplyVoltageV: number;
  readonly supplyCurrentA: number;
  readonly supplyRegulationMode: 'CV';
  readonly frequencyHz: number;
  readonly rxFrequencyRangeHz: {
    readonly startHz: number;
    readonly stopHz: number;
  };
  readonly noiseMeasurementFrequencyHz: number;
  readonly isolationMeasurementFrequencyHz: number;
  readonly noiseSourcePlane: string;
  readonly noiseMeasurementPlane: string;
  readonly rxBranchPlane: string;
  readonly isolationTxPlane: string;
  readonly isolationRxPlane: string;
  readonly isolationDirection: 'tx-to-rx';
  readonly txToRxIsolationDb: number;
  readonly noiseMeasurement: DvtNoiseMeasurement;
  /** Supporting TX-noise metric record from the same synchronized point. */
  readonly txNoiseMetricEvidenceId: 'tx-noise';
  readonly terminationState: 'source-connected' | 'source-terminated-baseline';
  readonly dutPathState: 'pa-on' | 'pa-off' | 'bypass';
  readonly noiseIncludesTxToRxIsolation: boolean;
  readonly noiseExpandedUncertaintyDb: number;
  readonly isolationExpandedUncertaintyDb: number;
  readonly isolationEvidenceId: string;
  readonly isolationDutPathState: 'small-signal-passive-path';
  readonly isolationDutControlStateId: string;
  readonly isolationDutBiasState: 'off';
  readonly isolationAcquiredAtIso: string;
  readonly isolationCalibrationEvidenceId: string;
  readonly isolationExcitation: DvtIndependentIsolationEvidence['excitation'];
  readonly isolationApplicability: DvtIndependentIsolationEvidence['applicability'];
  readonly analyzerFloorDensityDbmPerHz: number;
  readonly floorEvidenceId: string;
  readonly floorExpandedUncertaintyDb: number;
  readonly minimumFloorHeadroomDb: number;
  readonly terminatedBaselineEvidenceId: string;
  readonly terminatedBaselineDensityDbmPerHz: number;
  readonly paOffLeakageEvidenceId: string;
  readonly paOffLeakageDensityDbmPerHz: number;
  readonly noiseCorrectionId: string;
}

export interface DvtDesenseRiskEvaluation {
  readonly scope: 'risk-budget-only';
  readonly validity: 'valid' | 'invalid';
  readonly reasons: readonly string[];
  readonly sourceDensityDbmPerHz: number | null;
  readonly worstCaseNoiseLowerBoundDbmPerHz: number | null;
  readonly floorUpperBoundDbmPerHz: number | null;
  readonly validatedFloorHeadroomDb: number | null;
  readonly estimatedRxBranchDensityDbmPerHz: number | null;
  readonly worstCaseRxBranchDensityDbmPerHz: number | null;
  readonly combinedExpandedUncertaintyDb: number | null;
}

export type DvtEvidenceSignature =
  | 'path-correction-stable'
  | 'gain-mode-query-mismatch'
  | 'source-residual-qualified'
  | 'analyzer-attenuation-invariant'
  | 'evm-aclr-recover-with-backoff'
  | 'terminated-floor-separated'
  | 'isolation-independently-verified';

export type DvtExpectedEvidence =
  | { readonly metric: 'p1db-input'; readonly valueDbm: number; readonly toleranceDb: number }
  | { readonly metric: 'pae'; readonly valuePercent: number; readonly tolerancePercent: number }
  | { readonly metric: 'im3'; readonly valueDbc: number; readonly toleranceDb: number }
  | {
      readonly metric: 'typed-signature';
      readonly signature: DvtEvidenceSignature;
      readonly expectedObservation: string;
    }
  | {
      readonly metric: 'synchronized-kpi';
      readonly requiredEvidenceIds: readonly ['pin', 'pout', 'dc'];
      readonly acquisitionMode: 'repeatable-sequence';
      readonly acquisitionGroupId: string;
      readonly triggerReferenceId: string;
      readonly maximumTriggerRepeatabilitySeconds: number;
      readonly settlingEvidenceId: string;
      readonly stateRepeatabilityEvidenceId: string;
      readonly expectedPaePercent: number;
      readonly tolerancePercent: number;
      readonly requiredSupplyRegulationMode: 'CV';
      readonly maximumGainDroopDbAcrossAperture: number;
      readonly thermalMechanismClaimRequiresFixtureTemperatureEvidence: true;
    }
  | {
      readonly metric: 'analyzer-attenuation-step';
      readonly attenuationStepDeltaDb: number;
      readonly maximumAbsoluteCorrectedAclrDeltaDb: number;
      readonly maximumRepeatabilityDb: number;
      readonly minimumMixerHeadroomDb: number;
      readonly minimumNoiseFloorHeadroomDb: number;
    }
  | {
      readonly metric: 'desense-risk-budget';
      readonly scope: 'risk-budget-only';
      readonly educationalIsolationTargetDb: number;
      readonly requiredMeasurementPointId: string;
      readonly requiredTxCarrierFrequencyHz: number;
      readonly requiredNoiseMeasurementFrequencyHz: number;
      readonly requiredIsolationMeasurementFrequencyHz: number;
      readonly requiredIsolationApplicability: 'small-signal-path-isolation-only';
      readonly requiresAnalyzerFloorResolution: true;
    };

export type DvtHypothesisEffect = 'support' | 'contradict' | 'neutral';

export interface DvtCaseHypothesis {
  readonly hypothesisId: string;
  readonly label: string;
}

export interface DvtCaseEvidenceEffect {
  readonly hypothesisId: string;
  readonly effect: DvtHypothesisEffect;
  readonly rationale: string;
}

export interface DvtCaseStep {
  readonly caseId: string;
  readonly stepId: string;
  readonly order: number;
  readonly stage: 'source' | 'path' | 'dut' | 'acquisition' | 'math';
  readonly prompt: string;
  readonly expectedEvidenceId: string;
  readonly expectedEvidence: DvtExpectedEvidence;
  readonly expectedEffects: readonly DvtCaseEvidenceEffect[];
}

export interface DvtDiagnosticCase {
  readonly id: string;
  readonly title: string;
  readonly hypotheses: readonly DvtCaseHypothesis[];
  readonly steps: readonly DvtCaseStep[];
}

export interface DvtDiagnosticPlan {
  readonly nextStepId: string;
  readonly expectedEvidenceId: string;
}

export interface DvtEvidenceClassification {
  readonly evidenceId: string;
  readonly hypothesisId: string;
  readonly effect: DvtHypothesisEffect;
}

export interface DvtConsistencyValidation {
  readonly valid: boolean;
  readonly reason: string;
}

export interface DvtDiagnosticProgress {
  readonly caseId: string;
  readonly nextStepIndex: number;
  readonly acceptedEvidenceIds: readonly string[];
  readonly accepted: boolean;
  readonly complete: boolean;
}

export type DvtObservedEvidencePayload =
  | { readonly metric: 'typed-signature'; readonly observedSignature: DvtEvidenceSignature; readonly observation: string }
  | {
      readonly metric: 'synchronized-kpi';
      readonly requiredEvidenceIds: readonly ['pin', 'pout', 'dc'];
      readonly acquisitionMode: 'repeatable-sequence';
      readonly acquisitionGroupId: string;
      readonly triggerReferenceId: string;
      readonly maximumTriggerRepeatabilitySeconds: number;
      readonly settlingEvidenceId: string;
      readonly stateRepeatabilityEvidenceId: string;
      readonly observedPaePercent: number;
      readonly observedSupplyRegulationMode: 'CV' | 'CC';
      readonly gainDroopDbAcrossAperture: number;
      readonly fixtureTemperatureEvidence: 'present' | 'absent';
      readonly thermalMechanismClaimAllowed: boolean;
    }
  | {
      readonly metric: 'analyzer-attenuation-step';
      readonly attenuationStepDeltaDb: number;
      readonly correctedAclrDeltaDb: number;
      readonly repeatabilityDb: number;
      readonly expandedUncertaintyDb: number;
      readonly mixerHeadroomBeforeDb: number;
      readonly mixerHeadroomAfterDb: number;
      readonly noiseFloorHeadroomBeforeDb: number;
      readonly noiseFloorHeadroomAfterDb: number;
    }
  | ({ readonly metric: 'desense-risk-budget'; readonly scope: 'risk-budget-only'; readonly educationalIsolationTargetDb: number } & DvtDesenseRiskEvidence);

/** Observation revealed only after the learner locks an expected signature. */
export interface DvtObservedCaseEvidence {
  readonly caseId: string;
  readonly evidenceId: string;
  readonly observedAtIso: string;
  readonly availability: 'available' | 'unavailable';
  readonly unavailableReason?: string;
  readonly payload?: DvtObservedEvidencePayload;
}

export interface DvtObservedEvidenceComparison {
  readonly state: 'match' | 'mismatch' | 'unavailable';
  readonly reason: string;
}

export interface DvtConclusionSections {
  readonly scope: string;
  readonly station: string;
  readonly symptom: string;
  readonly validity: string;
  readonly decision: string;
  readonly hypotheses: string;
  readonly evidence: string;
  readonly conclusion: string;
  readonly residualRisk: string;
}

export interface DvtConclusionReport {
  readonly reportId: string;
  readonly stationId: string;
  readonly measurementPointId: string;
  readonly decisionIds: readonly string[];
  readonly acceptedDiagnosticEvidenceIds: readonly string[];
  readonly sections: DvtConclusionSections;
  readonly cleanup: DvtCleanupEvidence;
  readonly nextAction: string;
  readonly owner: string;
}

export interface DvtConclusionCompleteness {
  readonly complete: boolean;
  readonly missingFields: readonly string[];
}

export interface DvtConclusionEvidenceLinkage {
  readonly stationId: string;
  readonly stationRevisionId: string;
  readonly stationReadiness: DvtStationReadiness;
  readonly measurementPointId: string;
  readonly measurementValidation: DvtMeasurementValidation;
  readonly cleanup: DvtCleanupEvidence;
  readonly decisionSources: readonly {
    readonly metricId: string;
    readonly sourceMeasurementPointId: string;
    readonly sourceMetricEvidenceIds: readonly DvtMetricEvidenceId[];
    readonly sourceExternalEvidenceIds: readonly string[];
    readonly uncertaintySourceEvidenceIds: readonly string[];
    /** Deterministic educational checksum; not a cryptographic or tamper-proof digest. */
    readonly valueDigest: string;
    /** Deterministic educational checksum; not a cryptographic or tamper-proof digest. */
    readonly sourceDigest: string;
  }[];
  readonly diagnosticEvidenceSources: readonly DvtDiagnosticEvidenceSource[];
  readonly decisions: readonly DvtDecision[];
  readonly desenseEvaluation?: DvtDesenseRiskEvaluation;
}

export interface DvtConclusionLinkageValidation {
  readonly valid: boolean;
  readonly reasons: readonly string[];
}

export interface DvtDecisionSourceRecord {
  readonly metricId: string;
  readonly metricKind: 'pae' | 'aclr-native' | 'evm' | 'pout' | 'desense-isolation';
  readonly sourceMetricEvidenceIds: readonly DvtMetricEvidenceId[];
  /** Primary non-metric measurement records, such as independently measured isolation. */
  readonly sourceExternalEvidenceIds: readonly string[];
  readonly uncertaintyComponents: readonly DvtUncertaintyComponent[];
  readonly coverageFactor: number;
  readonly decisionRule: {
    readonly direction: DvtLimitDirection;
    readonly lowerLimit?: DvtQuantity;
    readonly upperLimit?: DvtQuantity;
    readonly valueConvention?: DvtDecisionRequest['valueConvention'];
  };
}

/** One accepted blind-diagnostic observation and its immutable source bundle. */
export interface DvtDiagnosticEvidenceSource {
  readonly caseId: string;
  readonly evidenceId: string;
  readonly sourceMeasurementPointId: string;
  readonly sourceMetricEvidenceIds: readonly DvtMetricEvidenceId[];
  readonly sourceExternalEvidenceIds: readonly string[];
  readonly decisionMetricId?: string;
  /** Deterministic educational checksum; not a cryptographic or tamper-proof digest. */
  readonly observedValueDigest?: string;
  /** Deterministic educational checksum; not a cryptographic or tamper-proof digest. */
  readonly sourceDigest?: string;
}

export interface DvtIndependentIsolationEvidence {
  readonly evidenceId: string;
  readonly measurementPointId: string;
  readonly valueDb: number;
  readonly frequencyHz: number;
  readonly txPlane: string;
  readonly rxPlane: string;
  readonly direction: 'tx-to-rx';
  readonly dutPathState: 'small-signal-passive-path';
  readonly dutControlStateId: string;
  readonly dutBiasState: 'off';
  readonly acquiredAtIso: string;
  readonly calibrationEvidenceId: string;
  readonly expandedUncertaintyDb: number;
  readonly excitation: {
    readonly kind: 'small-signal-cw';
    readonly sourceAssetId: string;
    readonly sourceRole: 'stimulus-source';
    readonly sourceQueryBackEvidenceId: string;
    readonly powerDbm: number;
  };
  readonly applicability: 'small-signal-path-isolation-only';
}

/** Immutable registry for non-metric source records referenced by conclusions. */
export interface DvtExternalEvidenceRegistryRecord {
  readonly evidenceId: string;
  readonly evidenceKind:
    | 'station-verification'
    | 'asset-query-back'
    | 'application-query-back'
    | 'accessory-rating'
    | 'calibration'
    | 'cleanup'
    | 'analyzer-headroom'
    | 'analyzer-operating-limit'
    | 'analyzer-residual-status'
    | 'diagnostic-observation'
    | 'desense-isolation'
    | 'baseline'
    | 'correction'
    | 'uncertainty';
  readonly sourceAssetId?: string;
  readonly sourceMeasurementPointId?: string;
  readonly value?: number;
  readonly unit?: 'dB' | 'dBm' | 'dBm/Hz' | 'percent' | 'state' | 'coefficient';
  readonly metric?:
    | 'evm-residual'
    | 'aclr-residual'
    | 'analyzer-floor'
    | 'analyzer-operating-boundary'
    | 'analyzer-residual-status'
    | 'cleanup-state'
    | 'uncertainty-source'
    | 'correlation'
    | 'noise-path-correction';
  readonly observedAtIso?: string;
  readonly cleanupStatus?: DvtCleanupEvidence[keyof DvtCleanupEvidence]['status'];
  readonly analyzerHeadroom?: DvtAnalyzerHeadroomEvidence;
  readonly verificationStatus?: 'verified' | 'unverified';
  readonly validFromIso?: string;
  readonly validThroughIso?: string;
  readonly qualificationEvidenceId?: string;
  readonly applicability?:
    | 'mixer-operating-boundary'
    | 'if-adc-input-range'
    | 'attenuation-step-stability';
  readonly analyzerResidualKind?: DvtAnalyzerHeadroomEvidence['residualState']['kind'];
  readonly analyzerResidualStatus?: DvtAnalyzerHeadroomEvidence['residualState']['status'];
  readonly instrumentQueryBackEvidenceId?: string;
  readonly applicationEvidenceId?: string;
  readonly waveformId?: string;
  readonly relatedEvidenceIds?: readonly string[];
}

export interface DvtConclusionSourceRecords {
  readonly stationManifest: DvtStationManifest;
  readonly requiredCapabilityIds: readonly string[];
  readonly stationAsOfIso: string;
  readonly measurementPoint: DvtMeasurementPoint;
  readonly sourceAssetId: string;
  readonly decisionSources: readonly DvtDecisionSourceRecord[];
  readonly diagnosticEvidenceSources: readonly DvtDiagnosticEvidenceSource[];
  readonly observedCaseEvidence: readonly DvtObservedCaseEvidence[];
  readonly externalEvidenceRegistry: readonly DvtExternalEvidenceRegistryRecord[];
  readonly independentIsolationEvidence: readonly DvtIndependentIsolationEvidence[];
  readonly desenseEvidence?: DvtDesenseRiskEvidence;
}
