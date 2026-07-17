import type {
  DvtCapabilityState,
  DvtConclusionCompleteness,
  DvtConclusionEvidenceLinkage,
  DvtConclusionLinkageValidation,
  DvtConclusionReport,
  DvtConclusionSourceRecords,
  DvtCleanupEvidence,
  DvtConsistencyValidation,
  DvtDecision,
  DvtDecisionRequest,
  DvtDiagnosticEvidenceSource,
  DvtDeltaQuantity,
  DvtDesenseRiskEvaluation,
  DvtDesenseRiskEvidence,
  DvtDiagnosticCase,
  DvtDiagnosticPlan,
  DvtDiagnosticProgress,
  DvtEvidenceClassification,
  DvtMetricEvidence,
  DvtMetricEvidenceId,
  DvtMeasurementPoint,
  DvtMeasurementValidation,
  DvtMeasurementValidationContext,
  DvtNonnegativeUncertainty,
  DvtPaExpectedValues,
  DvtQuantity,
  DvtSignedCovarianceContribution,
  DvtSignedSensitivityContribution,
  DvtStationManifest,
  DvtStationReadiness,
  DvtUncertaintyBudget,
  DvtUncertaintyComponent,
} from '../../types/dvt';
import { DEFAULT_EDUCATIONAL_PA, evaluatePa, rappOneDbCompressionPoint } from './pa';
import { dbmToWatts, powerRatioToDb } from './units';

export function evaluateStationReadiness(
  manifest: DvtStationManifest,
  requiredCapabilityIds: readonly string[] = manifest.capabilities.map(({ id }) => id),
  asOfIso?: string,
): DvtStationReadiness {
  const capabilityById = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));
  const assetById = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  const accessoryById = new Map(manifest.accessories.map((accessory) => [accessory.accessoryEvidenceId, accessory]));
  const applicationById = new Map(manifest.applications.map((application) => [application.applicationEvidenceId, application]));
  const calibrationById = new Map(manifest.calibrations.map((calibration) => [calibration.calibrationEvidenceId, calibration]));
  const blockingCapabilityIds = new Set<string>();
  const conditionalCapabilityIds = new Set<string>();
  const evidence: string[] = [];
  const effectiveById = new Map<string, {
    id: string;
    label: string;
    nominalState: DvtStationReadiness['effectiveCapabilities'][number]['nominalState'];
    effectiveState: DvtCapabilityState;
    reasons: string[];
    evidence: string;
  }>();
  const asOfMs = asOfIso === undefined ? undefined : Date.parse(asOfIso);
  if (asOfIso !== undefined && !Number.isFinite(asOfMs)) {
    throw new RangeError('station readiness asOfIso must be a valid ISO timestamp');
  }

  function block(capabilityId: string, reason: string): void {
    blockingCapabilityIds.add(capabilityId);
    conditionalCapabilityIds.delete(capabilityId);
    evidence.push(`${capabilityId}: ${reason}`);
    const effective = effectiveById.get(capabilityId);
    if (effective) {
      effective.effectiveState = 'blocked';
      if (!effective.reasons.includes(reason)) effective.reasons.push(reason);
    }
  }

  function condition(capabilityId: string, reason: string): void {
    if (!blockingCapabilityIds.has(capabilityId)) conditionalCapabilityIds.add(capabilityId);
    evidence.push(`${capabilityId}: ${reason}`);
    const effective = effectiveById.get(capabilityId);
    if (effective && effective.effectiveState !== 'blocked') {
      effective.effectiveState = 'conditional';
      if (!effective.reasons.includes(reason)) effective.reasons.push(reason);
    }
  }

  for (const id of requiredCapabilityIds) {
    const capability = capabilityById.get(id);
    if (!capability) {
      effectiveById.set(id, {
        id, label: id, nominalState: null, effectiveState: 'blocked',
        reasons: [], evidence: 'Capability evidence is missing.',
      });
      block(id, 'capability evidence is missing');
      continue;
    }
    effectiveById.set(id, {
      id,
      label: capability.label,
      nominalState: capability.state,
      effectiveState: capability.state,
      reasons: [],
      evidence: capability.evidence,
    });
    evidence.push(`${id}: ${capability.evidence}`);
    if (capability.state === 'blocked') block(id, capability.condition ?? 'capability is explicitly blocked');
    if (capability.state === 'conditional') condition(id, capability.condition ?? 'capability is explicitly conditional');

    for (const assetId of capability.requiredAssetIds) {
      const asset = assetById.get(assetId);
      if (!asset) {
        block(id, `required asset ${assetId} is missing`);
      } else {
        if ([
          asset.model,
          asset.serialOrRedactedId,
          asset.firmwareVersion,
          asset.queryBack.evidenceId,
        ].some((value) => value.trim().length === 0)) {
          block(id, `required asset ${assetId} declared identity or query-back evidence is missing`);
        }
        if (
          asset.model !== asset.queryBack.model ||
          asset.serialOrRedactedId !== asset.queryBack.serialOrRedactedId ||
          asset.firmwareVersion !== asset.queryBack.firmwareVersion
        ) {
          block(id, `required asset ${assetId} declared identity does not match query-back`);
        }
        const queryBackAtMs = Date.parse(asset.queryBack.acquiredAtIso);
        if (!Number.isFinite(queryBackAtMs)) {
          block(id, `required asset ${assetId} query-back timestamp is invalid`);
        } else if (asOfMs !== undefined && queryBackAtMs > asOfMs) {
          block(id, `required asset ${assetId} query-back timestamp is later than readiness time`);
        }
        if (asset.queryBack.status === 'unverified') {
          condition(id, `required asset ${assetId} exists but query-back is unverified`);
        }
        if (!sameStringSet(asset.installedOptionIds, asset.queryBack.optionIds)) {
          block(id, `required asset ${assetId} installed options do not match option query-back`);
        }
      }
    }
    for (const configuration of capability.requiredAssetConfigurations) {
      if (!capability.requiredAssetIds.includes(configuration.assetId)) {
        block(id, `configured asset ${configuration.assetId} is not declared as a required asset`);
      }
      const asset = assetById.get(configuration.assetId);
      if (!asset) {
        block(id, `configured asset ${configuration.assetId} is missing`);
        continue;
      }
      if (configuration.requiredModel.trim().length === 0 || asset.model !== configuration.requiredModel) {
        block(id, `configured asset ${configuration.assetId} model does not match ${configuration.requiredModel}`);
      }
      for (const optionId of configuration.requiredOptionIds) {
        if (!asset.installedOptionIds.includes(optionId) || !asset.queryBack.optionIds.includes(optionId)) {
          block(id, `required option ${optionId} is missing from asset ${configuration.assetId}`);
        }
      }
      for (const moduleContract of configuration.requiredModules) {
        const module = asset.installedModules?.find(({ moduleAssetId }) => (
          moduleAssetId === moduleContract.moduleAssetId
        ));
        if (!module) {
          block(id, `required module ${moduleContract.moduleAssetId} is missing from asset ${configuration.assetId}`);
          continue;
        }
        if (module.model !== moduleContract.model) {
          block(id, `required module ${moduleContract.moduleAssetId} model does not match ${moduleContract.model}`);
        }
        if ([module.serialOrRedactedId, module.firmwareVersion, module.queryBackEvidenceId].some((value) => (
          value.trim().length === 0
        ))) block(id, `required module ${moduleContract.moduleAssetId} identity or query-back evidence is missing`);
        if (
          module.model !== module.queryBackModel ||
          module.serialOrRedactedId !== module.queryBackSerialOrRedactedId ||
          module.firmwareVersion !== module.queryBackFirmwareVersion
        ) block(id, `required module ${moduleContract.moduleAssetId} identity does not match query-back`);
        if (module.queryBackStatus === 'unverified') {
          condition(id, `required module ${moduleContract.moduleAssetId} query-back is unverified`);
        }
        if (!sameStringSet(module.installedOptionIds, module.queryBackOptionIds)) {
          block(id, `required module ${moduleContract.moduleAssetId} installed options do not match option query-back`);
        }
        for (const optionId of moduleContract.requiredOptionIds) {
          if (!module.installedOptionIds.includes(optionId) || !module.queryBackOptionIds.includes(optionId)) {
            block(id, `required module option ${optionId} is missing from ${moduleContract.moduleAssetId}`);
          }
        }
      }
    }
    for (const accessoryId of capability.requiredAccessoryIds) {
      const accessory = accessoryById.get(accessoryId);
      if (!accessory) block(id, `required accessory ${accessoryId} is missing`);
      else if (accessory.ratingState === 'unverified') {
        condition(id, `required accessory ${accessoryId} exists but rating is unverified`);
      }
    }
    for (const applicationId of capability.requiredApplicationIds) {
      const application = applicationById.get(applicationId);
      if (!application) block(id, `required application ${applicationId} is missing`);
      else {
        const applicationAsset = assetById.get(application.assetId);
        const applicationAtMs = Date.parse(application.acquiredAtIso);
        if (!applicationAsset) {
          block(id, `required application ${applicationId} references a missing asset`);
        } else if (application.queryBackEvidenceId !== applicationAsset.queryBack.evidenceId) {
          block(id, `required application ${applicationId} query-back does not match its asset`);
        }
        if (application.version.trim().length === 0) {
          block(id, `required application ${applicationId} version is missing`);
        }
        if (!Number.isFinite(applicationAtMs)) {
          block(id, `required application ${applicationId} timestamp is invalid`);
        } else if (asOfMs !== undefined && applicationAtMs > asOfMs) {
          block(id, `required application ${applicationId} timestamp is later than readiness time`);
        }
        if (application.licenseState !== 'verified') {
          block(id, `required application ${applicationId} license is not verified`);
        }
      }
    }
    for (const calibrationId of capability.requiredCalibrationIds) {
      const calibration = calibrationById.get(calibrationId);
      if (!calibration) {
        block(id, `required calibration ${calibrationId} is missing`);
        continue;
      }
      const validFromMs = Date.parse(calibration.validFromIso);
      const validThroughMs = Date.parse(calibration.validThroughIso);
      const outsidePeriod = asOfMs !== undefined && (
        !Number.isFinite(validFromMs) || !Number.isFinite(validThroughMs) ||
        asOfMs < validFromMs || asOfMs > validThroughMs
      );
      if (calibration.state === 'expired' || outsidePeriod) {
        block(id, `required calibration ${calibrationId} is outside its validity period`);
      } else if (calibration.state === 'unverified') {
        condition(id, `required calibration ${calibrationId} exists but is unverified`);
      }
    }
  }

  const state = blockingCapabilityIds.size > 0
    ? 'blocked'
    : conditionalCapabilityIds.size > 0
      ? 'conditional'
      : 'ready';

  return {
    state,
    requiredCapabilityIds: [...requiredCapabilityIds],
    blockingCapabilityIds: [...blockingCapabilityIds],
    conditionalCapabilityIds: [...conditionalCapabilityIds],
    evidence,
    effectiveCapabilities: requiredCapabilityIds.map((id) => effectiveById.get(id)!),
  };
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && new Set(left).size === left.length &&
    new Set(right).size === right.length && left.every((value) => right.includes(value));
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateMeasurementPoint(
  point: DvtMeasurementPoint,
  context: DvtMeasurementValidationContext,
): DvtMeasurementValidation {
  const invalidReasons: string[] = [];
  const inconclusiveReasons: string[] = [];
  const numericValues = [
    point.waveform.centerFrequencyHz,
    point.waveform.channelBandwidthHz,
    point.waveform.sourceSetpointDbm,
    point.triggerDelaySeconds,
    point.dwellSeconds,
    ...(point.acquisitionPolicy.mode === 'simultaneous'
      ? [point.acquisitionPolicy.minimumRequiredApertureOverlapSeconds]
      : [
          point.acquisitionPolicy.maximumTriggerRepeatabilitySeconds,
          point.acquisitionPolicy.minimumSettlingSeconds,
        ]),
    ...(point.dutState.fixtureTemperatureC === undefined
      ? []
      : [point.dutState.fixtureTemperatureC]),
  ];

  if (!numericValues.every(Number.isFinite)) invalidReasons.push('measurement contains a non-finite value');
  if (point.waveform.centerFrequencyHz <= 0) invalidReasons.push('frequency must be positive');
  if (point.waveform.channelBandwidthHz <= 0) invalidReasons.push('channel bandwidth must be positive');
  if (point.waveform.resourceBlockStart !== undefined && (
    !Number.isSafeInteger(point.waveform.resourceBlockStart) || point.waveform.resourceBlockStart < 0
  )) invalidReasons.push('resource-block start must be a non-negative integer');
  if (point.waveform.resourceBlockCount !== undefined && (
    !Number.isSafeInteger(point.waveform.resourceBlockCount) || point.waveform.resourceBlockCount <= 0
  )) invalidReasons.push('resource-block count must be a positive integer');
  if (point.triggerDelaySeconds < 0) invalidReasons.push('trigger delay must be non-negative');
  if (point.dwellSeconds < 0) invalidReasons.push('dwell must be non-negative');
  if (
    point.acquisitionPolicy.mode === 'simultaneous' &&
    point.acquisitionPolicy.minimumRequiredApertureOverlapSeconds < 0
  ) {
    invalidReasons.push('minimum required aperture overlap must be non-negative');
  }
  if (point.acquisitionPolicy.mode === 'repeatable-sequence') {
    if (point.acquisitionPolicy.requiredAcquisitionGroupId.trim().length === 0) {
      invalidReasons.push('required acquisition group identity is missing');
    }
    if (point.acquisitionPolicy.maximumTriggerRepeatabilitySeconds < 0) {
      invalidReasons.push('maximum trigger repeatability must be non-negative');
    }
    if (point.acquisitionPolicy.minimumSettlingSeconds < 0) {
      invalidReasons.push('minimum sequence settling time must be non-negative');
    }
    if (point.acquisitionPolicy.settlingEvidenceId.trim().length === 0) {
      invalidReasons.push('settling evidence identity is missing');
    } else if (!context.stationManifest.verificationIds.includes(point.acquisitionPolicy.settlingEvidenceId)) {
      invalidReasons.push('settling evidence is not registered in the station manifest');
    }
    if (point.acquisitionPolicy.stateRepeatabilityEvidenceId.trim().length === 0) {
      invalidReasons.push('state-repeatability evidence identity is missing');
    } else if (!context.stationManifest.verificationIds.includes(
      point.acquisitionPolicy.stateRepeatabilityEvidenceId,
    )) {
      invalidReasons.push('state-repeatability evidence is not registered in the station manifest');
    }
  }

  if (point.waveform.waveformId.trim().length === 0) invalidReasons.push('waveform identity is missing');
  if (!/^[a-f\d]{64}$/i.test(point.waveform.waveformSha256)) {
    invalidReasons.push('waveform checksum must be a 64-character SHA-256 value');
  }
  if (point.waveform.allocationId.trim().length === 0) invalidReasons.push('waveform allocation is missing');
  if (point.triggerId.trim().length === 0) invalidReasons.push('trigger identity is missing');
  if (point.dutState.stateId.trim().length === 0) invalidReasons.push('DUT state identity is missing');
  if (point.supplyStateId.trim().length === 0) invalidReasons.push('supply state identity is missing');
  if (point.dutState.intendedMode !== point.dutState.queriedMode) {
    invalidReasons.push('DUT mode query-back does not match intended mode');
  }
  if (point.dutState.biasState === 'off') invalidReasons.push('DUT bias was off during acquisition');
  if (point.dutState.biasState === 'unknown') inconclusiveReasons.push('DUT bias state is unknown');

  const configuredAtMs = Date.parse(point.configuredAtIso);
  const acquiredAtMs = Date.parse(point.acquiredAtIso);
  const queryBackAtMs = Date.parse(point.dutState.queryBackAtIso);
  if (!Number.isFinite(configuredAtMs) || !Number.isFinite(acquiredAtMs)) {
    invalidReasons.push('configuration and acquisition timestamps must be valid ISO timestamps');
  } else if (acquiredAtMs < configuredAtMs) {
    invalidReasons.push('acquisition timestamp precedes configuration');
  }
  if (!Number.isFinite(queryBackAtMs)) invalidReasons.push('DUT query-back timestamp is invalid');
  else if (Number.isFinite(configuredAtMs) && Number.isFinite(acquiredAtMs) && (
    queryBackAtMs < configuredAtMs || queryBackAtMs > acquiredAtMs
  )) invalidReasons.push('DUT query-back timestamp falls outside the configured point window');

  if (point.sourceState === 'unlevel') invalidReasons.push('source is unlevel');
  if (point.sourceState === 'unknown') inconclusiveReasons.push('source leveling is unknown');
  if (point.analyzerState === 'overload') invalidReasons.push('analyzer overload is active');
  if (point.analyzerState === 'unknown') inconclusiveReasons.push('analyzer range state is unknown');
  if (point.acquisitionState === 'stale') invalidReasons.push('acquisition data is stale');
  if (point.acquisitionState === 'unknown') inconclusiveReasons.push('acquisition freshness is unknown');
  if (point.calibrationState === 'expired') invalidReasons.push('calibration is expired');
  if (point.calibrationState === 'unknown') inconclusiveReasons.push('calibration validity is unknown');
  if (point.triggerAlignment === 'misaligned') invalidReasons.push('trigger is misaligned');
  if (point.triggerAlignment === 'unknown') inconclusiveReasons.push('trigger alignment is unknown');

  if (point.psuRegulationMode === 'CC') invalidReasons.push('power supply entered current regulation');
  if (point.psuRegulationMode === 'TRIPPED') invalidReasons.push('power supply protection tripped');
  if (point.psuRegulationMode === 'OFF') invalidReasons.push('power supply was off during acquisition');
  if (point.psuRegulationMode === 'unknown') {
    inconclusiveReasons.push('power supply regulation mode is unknown');
  }
  if (point.instrumentErrors.length > 0) {
    invalidReasons.push('instrument error queue is not empty');
  }
  validateMeasurementContext(point, context, invalidReasons, inconclusiveReasons);
  validateCleanupEvidence(point, invalidReasons, inconclusiveReasons);
  validateMetricEvidence(point, context, invalidReasons, inconclusiveReasons);

  if (invalidReasons.length > 0) return { validity: 'invalid', reasons: invalidReasons };
  if (inconclusiveReasons.length > 0) {
    return { validity: 'inconclusive', reasons: inconclusiveReasons };
  }
  return { validity: 'valid', reasons: [] };
}

function validateMeasurementContext(
  point: DvtMeasurementPoint,
  context: DvtMeasurementValidationContext,
  invalidReasons: string[],
  inconclusiveReasons: string[],
): void {
  const readiness = evaluateStationReadiness(
    context.stationManifest,
    context.requiredCapabilityIds,
    context.asOfIso ?? point.acquiredAtIso,
  );
  if (readiness.state === 'blocked') invalidReasons.push('station capability readiness is blocked');
  if (readiness.state === 'conditional') {
    inconclusiveReasons.push('station capability readiness is conditional');
  }
  const source = context.stationManifest.assets.find(({ assetId }) => assetId === context.sourceAssetId);
  if (!source) {
    invalidReasons.push(`source asset ${context.sourceAssetId} is missing from the station manifest`);
    return;
  }
  if (source.role !== 'signal-source') invalidReasons.push('configured source asset does not have the signal-source role');
  if (source.queryBack.status !== 'verified') inconclusiveReasons.push('source asset query-back is unverified');
  if (source.queryBack.evidenceId.trim().length === 0) invalidReasons.push('source asset query-back evidence is missing');
}

function calibrationIsValidAt(
  calibration: DvtStationManifest['calibrations'][number],
  acquiredAtIso: string,
): boolean {
  const acquiredAtMs = Date.parse(acquiredAtIso);
  const validFromMs = Date.parse(calibration.validFromIso);
  const validThroughMs = Date.parse(calibration.validThroughIso);
  return calibration.state === 'valid' &&
    Number.isFinite(acquiredAtMs) &&
    Number.isFinite(validFromMs) &&
    Number.isFinite(validThroughMs) &&
    acquiredAtMs >= validFromMs && acquiredAtMs <= validThroughMs;
}

function validateCleanupEvidence(
  point: DvtMeasurementPoint,
  invalidReasons: string[],
  inconclusiveReasons: string[],
): void {
  const cleanupRecords = [
    point.cleanup.rfOutput,
    point.cleanup.acquisition,
    point.cleanup.bias,
    point.cleanup.dcOutput,
  ];
  if (cleanupRecords.some(({ atIso }) => !Number.isFinite(Date.parse(atIso)))) {
    invalidReasons.push('cleanup contains an invalid timestamp');
  }
  const pointAcquiredAtMs = Date.parse(point.acquiredAtIso);
  if (Number.isFinite(pointAcquiredAtMs) && cleanupRecords.some(({ atIso }) => (
    Date.parse(atIso) < pointAcquiredAtMs
  ))) invalidReasons.push('cleanup timestamp precedes point acquisition completion');
  if (cleanupRecords.some(({ evidenceId }) => evidenceId.trim().length === 0)) {
    invalidReasons.push('cleanup evidence identity is missing');
  }
  if (point.cleanup.rfOutput.status === 'on') invalidReasons.push('RF output cleanup was not confirmed off');
  if (point.cleanup.acquisition.status === 'running') invalidReasons.push('acquisition cleanup was not aborted or idle');
  if (point.cleanup.bias.status === 'on') invalidReasons.push('DUT bias cleanup was not safely reduced');
  if (point.cleanup.dcOutput.status === 'on') invalidReasons.push('DC output cleanup was not confirmed off');
  if (point.cleanup.rfOutput.status === 'unknown') inconclusiveReasons.push('RF output cleanup state is unknown');
  if (point.cleanup.acquisition.status === 'unknown') inconclusiveReasons.push('acquisition cleanup state is unknown');
  if (point.cleanup.bias.status === 'unknown') inconclusiveReasons.push('DUT bias cleanup state is unknown');
  if (point.cleanup.dcOutput.status === 'unknown') inconclusiveReasons.push('DC output cleanup state is unknown');
}

function validateMetricEvidence(
  point: DvtMeasurementPoint,
  context: DvtMeasurementValidationContext,
  invalidReasons: string[],
  inconclusiveReasons: string[],
): void {
  const evidenceById = new Map<string, DvtMetricEvidence>();
  const uniqueRequiredEvidenceIds = [...new Set(point.requiredEvidenceIds)];
  if (uniqueRequiredEvidenceIds.length !== point.requiredEvidenceIds.length) {
    invalidReasons.push('required evidence IDs must be unique');
  }
  for (const evidence of point.metricEvidence) {
    if (evidenceById.has(evidence.evidenceId)) {
      invalidReasons.push(`duplicate metric evidence ${evidence.evidenceId}`);
      continue;
    }
    evidenceById.set(evidence.evidenceId, evidence);
    validateEvidenceStructure(evidence, context, invalidReasons);
  }

  const requiredEvidence: DvtMetricEvidence[] = [];
  for (const evidenceId of uniqueRequiredEvidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence) {
      inconclusiveReasons.push(`required evidence ${evidenceId} is missing`);
      continue;
    }
    requiredEvidence.push(evidence);
    if (evidence.status === 'corrupt') invalidReasons.push(`required evidence ${evidenceId} is corrupt`);
    if (evidence.status === 'conditional') inconclusiveReasons.push(`required evidence ${evidenceId} is conditional`);
    if (evidence.overload === true) invalidReasons.push(`required evidence ${evidenceId} reports overload`);
    if (evidence.overload === null) inconclusiveReasons.push(`required evidence ${evidenceId} overload state is unknown`);
    if (evidence.errors.length > 0) invalidReasons.push(`required evidence ${evidenceId} has instrument errors`);
  }

  if (requiredEvidence.length !== uniqueRequiredEvidenceIds.length) return;
  const configuredAtMs = Date.parse(point.configuredAtIso);
  const pointAcquiredAtMs = Date.parse(point.acquiredAtIso);
  if (requiredEvidence.some(({ acquiredAtIso }) => {
    const evidenceAtMs = Date.parse(acquiredAtIso);
    return Number.isFinite(configuredAtMs) && Number.isFinite(pointAcquiredAtMs) && (
      evidenceAtMs < configuredAtMs || evidenceAtMs > pointAcquiredAtMs
    );
  })) invalidReasons.push('required evidence timestamp falls outside the configured point window');
  if (point.acquisitionPolicy.mode === 'simultaneous') {
    if (new Set(requiredEvidence.map(({ acquisitionId }) => acquisitionId)).size !== 1) {
      invalidReasons.push('simultaneous evidence does not share a common acquisition ID');
    }
    const intervals = requiredEvidence.map((evidence) => {
      const endMs = Date.parse(evidence.acquiredAtIso);
      return { startMs: endMs - evidence.apertureSeconds * 1_000, endMs };
    });
    if (intervals.every(({ startMs, endMs }) => Number.isFinite(startMs) && Number.isFinite(endMs))) {
      const commonStartMs = Math.max(...intervals.map(({ startMs }) => startMs));
      const commonEndMs = Math.min(...intervals.map(({ endMs }) => endMs));
      const overlapSeconds = Math.max(0, commonEndMs - commonStartMs) / 1_000;
      if (overlapSeconds < point.acquisitionPolicy.minimumRequiredApertureOverlapSeconds) {
        invalidReasons.push(
          `required evidence apertures do not overlap for ${point.acquisitionPolicy.minimumRequiredApertureOverlapSeconds} seconds`,
        );
      }
    }
    return;
  }

  const sequencePolicy = point.acquisitionPolicy;
  if (requiredEvidence.some(({ acquisitionGroupId }) => (
    acquisitionGroupId !== sequencePolicy.requiredAcquisitionGroupId
  ))) invalidReasons.push('required evidence does not share the declared acquisition group');
  if (new Set(requiredEvidence.map(({ triggerReferenceId }) => triggerReferenceId)).size !== 1) {
    invalidReasons.push('required evidence does not share a trigger reference');
  }
  if (requiredEvidence.some(({ triggerReferenceId }) => triggerReferenceId !== point.triggerId)) {
    invalidReasons.push('required evidence trigger reference does not match the point trigger ID');
  }
  if (new Set(requiredEvidence.map(({ acquisitionSequenceIndex }) => acquisitionSequenceIndex)).size !== requiredEvidence.length) {
    invalidReasons.push('required evidence sequence indices must be unique');
  }
  const evidenceInSequenceOrder = [...requiredEvidence].sort((left, right) => (
    left.acquisitionSequenceIndex - right.acquisitionSequenceIndex
  ));
  if (evidenceInSequenceOrder.some(({ acquisitionSequenceIndex }, index) => (
    acquisitionSequenceIndex !== index + 1
  ))) invalidReasons.push('required evidence sequence indices must be contiguous from 1 through N');
  if (evidenceInSequenceOrder.some((evidence, index) => {
    if (index === 0) return false;
    return Date.parse(evidence.acquiredAtIso) <= Date.parse(evidenceInSequenceOrder[index - 1]!.acquiredAtIso);
  })) invalidReasons.push('required evidence timestamps are not strictly increasing in sequence-index order');
  if (requiredEvidence.some(({ triggerRepeatabilitySeconds }) => (
    triggerRepeatabilitySeconds > sequencePolicy.maximumTriggerRepeatabilitySeconds
  ))) {
    invalidReasons.push(
      `trigger repeatability exceeds ${sequencePolicy.maximumTriggerRepeatabilitySeconds} seconds`,
    );
  }
  if (requiredEvidence.some(({ settlingSeconds }) => (
    settlingSeconds < sequencePolicy.minimumSettlingSeconds
  ))) invalidReasons.push('required evidence does not meet the sequence settling-time contract');
}

function validateEvidenceStructure(
  evidence: DvtMetricEvidence,
  context: DvtMeasurementValidationContext,
  invalidReasons: string[],
): void {
  const asset = context.stationManifest.assets.find(({ assetId }) => assetId === evidence.instrumentAssetId);
  const expectedRoleByMetric: Readonly<Record<DvtMetricEvidence['metric'], DvtStationManifest['assets'][number]['role']>> = {
    pin: 'power-sensor',
    pout: 'analyzer',
    dc: 'power-supply',
    spectrum: 'analyzer',
    aclr: 'analyzer',
    evm: 'analyzer',
    'tx-noise': 'analyzer',
  };
  if (evidence.instrumentAssetId.trim().length === 0) invalidReasons.push(`${evidence.evidenceId} instrument asset is missing`);
  if (evidence.instrumentQueryBackEvidenceId.trim().length === 0) {
    invalidReasons.push(`${evidence.evidenceId} instrument query-back evidence is missing`);
  }
  if (evidence.acquisitionId.trim().length === 0) invalidReasons.push(`${evidence.evidenceId} acquisition identity is missing`);
  if (evidence.acquisitionGroupId.trim().length === 0) invalidReasons.push(`${evidence.evidenceId} acquisition group is missing`);
  if (!Number.isSafeInteger(evidence.acquisitionSequenceIndex) || evidence.acquisitionSequenceIndex < 0) {
    invalidReasons.push(`${evidence.evidenceId} acquisition sequence index must be a non-negative integer`);
  }
  if (evidence.triggerReferenceId.trim().length === 0) invalidReasons.push(`${evidence.evidenceId} trigger reference is missing`);
  if (!Number.isFinite(evidence.triggerRepeatabilitySeconds) || evidence.triggerRepeatabilitySeconds < 0) {
    invalidReasons.push(`${evidence.evidenceId} trigger repeatability must be finite and non-negative`);
  }
  if (!Number.isFinite(evidence.settlingSeconds) || evidence.settlingSeconds < 0) {
    invalidReasons.push(`${evidence.evidenceId} settling time must be finite and non-negative`);
  }
  if (evidence.referencePlane.trim().length === 0) invalidReasons.push(`${evidence.evidenceId} reference plane is missing`);
  if (evidence.correctionId.trim().length === 0) invalidReasons.push(`${evidence.evidenceId} correction identity is missing`);
  if (!asset) {
    invalidReasons.push(`${evidence.evidenceId} instrument is not registered in the station manifest`);
  } else {
    if (asset.role !== expectedRoleByMetric[evidence.metric]) {
      invalidReasons.push(`${evidence.evidenceId} instrument role ${asset.role} is incompatible with ${evidence.metric}`);
    }
    if (asset.queryBack.status !== 'verified') invalidReasons.push(`${evidence.evidenceId} instrument query-back is unverified`);
    if (asset.queryBack.evidenceId !== evidence.instrumentQueryBackEvidenceId) {
      invalidReasons.push(`${evidence.evidenceId} instrument query-back evidence does not match the station manifest`);
    }
  }
  const measurementCalibration = context.stationManifest.calibrations.find(({ calibrationEvidenceId }) => (
    calibrationEvidenceId === evidence.measurementCalibrationEvidenceId
  ));
  if (!measurementCalibration) {
    invalidReasons.push(`${evidence.evidenceId} measurement calibration is not registered in the station manifest`);
  } else {
    if (measurementCalibration.assetId !== evidence.instrumentAssetId) {
      invalidReasons.push(`${evidence.evidenceId} measurement calibration does not apply to its instrument`);
    }
    if (!calibrationIsValidAt(measurementCalibration, evidence.acquiredAtIso)) {
      invalidReasons.push(`${evidence.evidenceId} measurement calibration is not valid at acquisition time`);
    }
  }
  const correctionProvider = context.stationManifest.assets.find(({ assetId }) => (
    assetId === evidence.correctionProviderAssetId
  ));
  if (!correctionProvider) {
    invalidReasons.push(`${evidence.evidenceId} correction provider is not registered in the station manifest`);
  } else {
    if (correctionProvider.queryBack.status !== 'verified') {
      invalidReasons.push(`${evidence.evidenceId} correction provider query-back is unverified`);
    }
    const expectedProviderRole = evidence.metric === 'dc' ? 'power-supply' : 'network-analyzer';
    if (correctionProvider.role !== expectedProviderRole) {
      invalidReasons.push(`${evidence.evidenceId} correction provider role is incompatible with ${evidence.metric}`);
    }
  }
  const correctionCalibration = context.stationManifest.calibrations.find(({ calibrationEvidenceId }) => (
    calibrationEvidenceId === evidence.correctionCalibrationEvidenceId
  ));
  if (!correctionCalibration) {
    invalidReasons.push(`${evidence.evidenceId} correction-provider calibration is not registered`);
  } else {
    if (correctionCalibration.assetId !== evidence.correctionProviderAssetId) {
      invalidReasons.push(`${evidence.evidenceId} correction-provider calibration does not apply to the provider`);
    }
    if (!calibrationIsValidAt(correctionCalibration, evidence.acquiredAtIso)) {
      invalidReasons.push(`${evidence.evidenceId} correction-provider calibration is not valid at acquisition time`);
    }
  }
  const knownVerificationIds = new Set([
    ...context.stationManifest.verificationIds,
    ...context.stationManifest.calibrations.map(({ verificationId }) => verificationId),
  ]);
  if (!knownVerificationIds.has(evidence.correctionVerificationId)) {
    invalidReasons.push(`${evidence.evidenceId} correction verification is not registered in the station manifest`);
  }
  if (!Number.isFinite(evidence.apertureSeconds) || evidence.apertureSeconds <= 0) {
    invalidReasons.push(`${evidence.evidenceId} aperture must be finite and positive`);
  }
  if (!Number.isFinite(Date.parse(evidence.acquiredAtIso))) {
    invalidReasons.push(`${evidence.evidenceId} acquisition timestamp is invalid`);
  }

  const values: number[] = [];
  switch (evidence.metric) {
    case 'pin': {
      values.push(evidence.rawPowerDbm, evidence.correctedPowerDbm);
      const couplerAccessory = context.stationManifest.accessories.find(({ accessoryEvidenceId }) => (
        accessoryEvidenceId === evidence.coupler.accessoryEvidenceId
      ));
      if (!couplerAccessory) invalidReasons.push('Pin forward coupler is not registered in the station manifest');
      else if (couplerAccessory.ratingState !== 'verified') invalidReasons.push('Pin forward coupler rating is unverified');
      if (evidence.coupler.direction !== 'forward') invalidReasons.push('Pin coupler direction must be forward');
      if (new Set([
        evidence.coupler.inputPort,
        evidence.coupler.throughPort,
        evidence.coupler.coupledPort,
      ]).size !== 3) invalidReasons.push('Pin coupler port identities must be distinct');
      values.push(
        evidence.coupler.couplingFactorDb,
        evidence.coupler.signedCorrectionDb,
        evidence.coupler.expandedUncertaintyDb,
      );
      if (evidence.coupler.couplingFactorDb < 0 || evidence.coupler.expandedUncertaintyDb < 0) {
        invalidReasons.push('Pin coupler factor and uncertainty must be non-negative');
      }
      if (Math.abs(
        evidence.rawPowerDbm + evidence.coupler.signedCorrectionDb - evidence.correctedPowerDbm
      ) > 1e-9) invalidReasons.push('Pin signed coupler correction is inconsistent with corrected power');
      if (evidence.coupler.verificationId !== evidence.correctionVerificationId) {
        invalidReasons.push('Pin coupler verification does not match correction verification');
      }
      break;
    }
    case 'pout':
      values.push(
        evidence.rawPowerDbm,
        evidence.correctedPowerDbm,
        evidence.channelPowerBandwidthHz,
        evidence.outputPath.signedCorrectionDb,
        evidence.outputPath.expandedUncertaintyDb,
      );
      if (evidence.channelPowerBandwidthHz <= 0) invalidReasons.push('Pout channel-power bandwidth must be positive');
      if (evidence.outputPath.accessoryEvidenceIds.length === 0) {
        invalidReasons.push('Pout output-path accessory evidence is missing');
      }
      for (const accessoryId of evidence.outputPath.accessoryEvidenceIds) {
        const accessory = context.stationManifest.accessories.find(({ accessoryEvidenceId }) => (
          accessoryEvidenceId === accessoryId
        ));
        if (!accessory) invalidReasons.push(`Pout output-path accessory ${accessoryId} is not registered`);
        else if (accessory.ratingState !== 'verified') {
          invalidReasons.push(`Pout output-path accessory ${accessoryId} rating is unverified`);
        }
      }
      if (evidence.outputPath.expandedUncertaintyDb < 0) {
        invalidReasons.push('Pout output-path uncertainty must be non-negative');
      }
      if (Math.abs(
        evidence.rawPowerDbm + evidence.outputPath.signedCorrectionDb - evidence.correctedPowerDbm
      ) > 1e-9) invalidReasons.push('Pout signed path correction is inconsistent with corrected power');
      if (evidence.outputPath.verificationId !== evidence.correctionVerificationId) {
        invalidReasons.push('Pout path verification does not match correction verification');
      }
      break;
    case 'dc':
      values.push(
        evidence.rawVoltageV,
        evidence.rawCurrentA,
        evidence.correctedVoltageV,
        evidence.correctedCurrentA,
      );
      if ([
        evidence.rawVoltageV,
        evidence.rawCurrentA,
        evidence.correctedVoltageV,
        evidence.correctedCurrentA,
      ].some((value) => value < 0)) invalidReasons.push('dc evidence must be non-negative');
      break;
    case 'spectrum':
      values.push(evidence.rawChannelPowerDbm, evidence.correctedChannelPowerDbm);
      break;
    case 'aclr':
      values.push(
        evidence.rawAclrDbc,
        evidence.correctedAclrDbc,
        evidence.rawPositiveAclrDb,
        evidence.correctedPositiveAclrDb,
        evidence.integrationConditions.mainChannelBandwidthHz,
        evidence.integrationConditions.adjacentChannelBandwidthHz,
        evidence.integrationConditions.channelSpacingHz,
      );
      if (
        Math.abs(evidence.rawPositiveAclrDb + evidence.rawAclrDbc) > 1e-9 ||
        Math.abs(evidence.correctedPositiveAclrDb + evidence.correctedAclrDbc) > 1e-9
      ) invalidReasons.push('ACLR native dBc and positive-ratio values are inconsistent');
      if (
        evidence.rawAclrDbc > 0 || evidence.correctedAclrDbc > 0 ||
        evidence.rawPositiveAclrDb < 0 || evidence.correctedPositiveAclrDb < 0
      ) invalidReasons.push('ACLR sign conventions are invalid');
      if (
        evidence.integrationConditions.mainChannelBandwidthHz <= 0 ||
        evidence.integrationConditions.adjacentChannelBandwidthHz <= 0 ||
        evidence.integrationConditions.channelSpacingHz <= 0 ||
        evidence.integrationConditions.filterId.trim().length === 0
      ) invalidReasons.push('ACLR integration conditions are invalid');
      break;
    case 'evm':
      values.push(evidence.rawEvmPercent, evidence.correctedEvmPercent, evidence.residualEvmPercent);
      if (
        evidence.rawEvmPercent < 0 ||
        evidence.correctedEvmPercent < 0 ||
        evidence.residualEvmPercent < 0
      ) invalidReasons.push('EVM percentages must be non-negative');
      if (evidence.licenseState === 'unverified' && evidence.status !== 'conditional') {
        invalidReasons.push('EVM with an unverified license must be conditional');
      }
      if ([
        evidence.applicationEvidenceId,
        evidence.referenceWaveformId,
        evidence.equalizationMode,
        evidence.normalizationReference,
        evidence.residualEvidenceId,
      ].some((value) => value.trim().length === 0)) invalidReasons.push('EVM analysis conditions are incomplete');
      break;
    case 'tx-noise':
      values.push(
        noiseMeasurementValue(evidence.rawNoise),
        noiseMeasurementValue(evidence.correctedNoise),
        evidence.resolutionBandwidthHz,
        evidence.equivalentNoiseBandwidthHz,
        evidence.analyzerFloorDensityDbmPerHz,
      );
      if (evidence.rawNoise.convention !== evidence.correctedNoise.convention) {
        invalidReasons.push('TX-noise raw and corrected conventions must match');
      }
      validateNoiseMeasurement(evidence.rawNoise, 'raw TX-noise', invalidReasons);
      validateNoiseMeasurement(evidence.correctedNoise, 'corrected TX-noise', invalidReasons);
      if (evidence.resolutionBandwidthHz <= 0 || evidence.equivalentNoiseBandwidthHz <= 0) {
        invalidReasons.push('TX-noise RBW and ENBW must be positive');
      }
      if (evidence.floorEvidenceId.trim().length === 0) {
        invalidReasons.push('TX-noise analyzer-floor evidence is missing');
      }
      const analyzerSetup = evidence.analyzerFrontEndSetup;
      if (analyzerSetup === undefined || analyzerSetup === null) {
        invalidReasons.push('TX-noise analyzer front-end setup is missing');
      } else {
        values.push(analyzerSetup.inputAttenuationDb, analyzerSetup.referenceLevelDbm);
        if (analyzerSetup.setupEvidenceId.trim().length === 0) {
          invalidReasons.push('TX-noise analyzer front-end setup evidence is missing');
        } else if (!knownVerificationIds.has(analyzerSetup.setupEvidenceId)) {
          invalidReasons.push('TX-noise analyzer front-end setup evidence is not registered');
        }
        if (analyzerSetup.inputAttenuationDb < 0) {
          invalidReasons.push('TX-noise analyzer input attenuation must be non-negative');
        }
        if (typeof analyzerSetup.preamplifierEnabled !== 'boolean') {
          invalidReasons.push('TX-noise analyzer preamplifier state must be explicit');
        }
        if (analyzerSetup.detector !== 'rms') {
          invalidReasons.push('TX-noise analyzer detector must be RMS');
        }
        if (!['swept-spectrum', 'zero-span'].includes(analyzerSetup.measurementMode)) {
          invalidReasons.push('TX-noise analyzer measurement mode is invalid');
        }
      }
      break;
  }
  if (!values.every(Number.isFinite)) invalidReasons.push(`${evidence.evidenceId} contains a non-finite metric value`);
}

function validateNoiseMeasurement(
  measurement: DvtDesenseRiskEvidence['noiseMeasurement'],
  label: string,
  invalidReasons: string[],
): void {
  if (measurement.convention === 'density') {
    if (!Number.isFinite(measurement.densityDbmPerHz)) {
      invalidReasons.push(`${label} density must be finite`);
    }
    return;
  }
  if (
    !Number.isFinite(measurement.integratedNoisePowerDbm) ||
    !Number.isFinite(measurement.equivalentNoiseBandwidthHz) ||
    measurement.equivalentNoiseBandwidthHz <= 0
  ) invalidReasons.push(`${label} RBW-integrated value is invalid`);
}

function noiseMeasurementValue(measurement: DvtDesenseRiskEvidence['noiseMeasurement']): number {
  return measurement.convention === 'density'
    ? measurement.densityDbmPerHz
    : measurement.integratedNoisePowerDbm;
}

/** General covariance propagation using evidence-backed pairwise rho values. */
export function combineUncertaintyBudget(
  components: readonly DvtUncertaintyComponent[],
  coverageFactor = 2,
): DvtUncertaintyBudget {
  if (!Number.isFinite(coverageFactor) || coverageFactor <= 0) {
    throw new RangeError('coverageFactor must be finite and positive');
  }
  if (components.length === 0) throw new RangeError('uncertainty budget requires at least one component');

  const ids = new Set<string>();
  const budgetUnit = components[0]?.reportedUncertainty.unit;
  const signedContributions = new Map<string, number>();
  components.forEach((component) => {
    if (ids.has(component.id)) throw new RangeError(`duplicate uncertainty component id: ${component.id}`);
    ids.add(component.id);
    if (component.reportedUncertainty.unit !== budgetUnit) {
      throw new RangeError('uncertainty components must use one common delta unit');
    }
    const reportedUncertainty = deltaValue(component.reportedUncertainty);
    if (!Number.isFinite(reportedUncertainty) || reportedUncertainty < 0) {
      throw new RangeError(`${component.id} reported uncertainty must be finite and non-negative`);
    }
    if (!Number.isFinite(component.divisor) || component.divisor <= 0) {
      throw new RangeError(`${component.id} divisor must be finite and positive`);
    }
    const sensitivity = component.sensitivityCoefficient;
    if (!Number.isFinite(sensitivity)) {
      throw new RangeError(`${component.id} sensitivityCoefficient must be finite`);
    }
    if (component.sourceEvidenceId.trim().length === 0) {
      throw new RangeError(`${component.id} source evidence is required`);
    }
    if (component.referencePlane.trim().length === 0) {
      throw new RangeError(`${component.id} reference plane is required`);
    }
    if (component.sampleCount !== undefined && (
      !Number.isSafeInteger(component.sampleCount) || component.sampleCount < 2
    )) throw new RangeError(`${component.id} sampleCount must be an integer of at least two`);
    if (component.degreesOfFreedom !== undefined && (
      !Number.isFinite(component.degreesOfFreedom) || component.degreesOfFreedom <= 0
    )) throw new RangeError(`${component.id} degreesOfFreedom must be finite and positive`);
    signedContributions.set(component.id, sensitivity * reportedUncertainty / component.divisor);
  });

  if (budgetUnit === undefined) throw new RangeError('uncertainty budget unit is missing');
  const correlationByPair = new Map<string, number>();
  for (const component of components) {
    for (const correlation of component.correlations) {
      if (!ids.has(correlation.withComponentId)) {
        throw new RangeError(`${component.id} correlation target is unknown: ${correlation.withComponentId}`);
      }
      if (correlation.withComponentId === component.id) {
        throw new RangeError(`${component.id} cannot declare self-correlation`);
      }
      if (
        !Number.isFinite(correlation.correlationCoefficient) ||
        Math.abs(correlation.correlationCoefficient) > 1
      ) throw new RangeError(`${component.id} correlation coefficient must lie in [-1, 1]`);
      if (correlation.evidenceId.trim().length === 0) {
        throw new RangeError(`${component.id} correlation evidence is required`);
      }
      const pair = [component.id, correlation.withComponentId].sort().join('|');
      const prior = correlationByPair.get(pair);
      if (prior !== undefined && Math.abs(prior - correlation.correlationCoefficient) > 1e-12) {
        throw new RangeError(`conflicting correlation declarations for ${pair}`);
      }
      correlationByPair.set(pair, correlation.correlationCoefficient);
    }
  }

  const componentIds = components.map(({ id }) => id);
  const correlationMatrix = componentIds.map((leftId, leftIndex) => (
    componentIds.map((rightId, rightIndex) => {
      if (leftIndex === rightIndex) return 1;
      return correlationByPair.get([leftId, rightId].sort().join('|')) ?? 0;
    })
  ));
  assertPositiveSemidefiniteCorrelationMatrix(correlationMatrix);

  const covarianceByPair = new Map<string, number>();
  for (const [pair, rho] of correlationByPair) {
    const [leftId, rightId] = pair.split('|');
    const left = signedContributions.get(leftId ?? '');
    const right = signedContributions.get(rightId ?? '');
    if (left === undefined || right === undefined) throw new RangeError(`missing covariance term ${pair}`);
    covarianceByPair.set(pair, 2 * rho * left * right);
  }

  const diagonalVariance = [...signedContributions.values()].reduce(
    (sum, contribution) => sum + contribution ** 2,
    0,
  );
  const totalVariance = diagonalVariance + [...covarianceByPair.values()].reduce(
    (sum, covariance) => sum + covariance,
    0,
  );
  if (totalVariance < -1e-12) {
    throw new RangeError('correlation matrix produces a negative combined variance');
  }
  const standardUncertainty = Math.sqrt(Math.max(0, totalVariance));

  return {
    standardUncertainty: makeNonnegativeUncertainty(budgetUnit, standardUncertainty),
    coverageFactor,
    expandedUncertainty: makeNonnegativeUncertainty(budgetUnit, coverageFactor * standardUncertainty),
    method: 'general-covariance',
    signedSensitivityContributions: Object.freeze(Object.fromEntries(
      [...signedContributions].map(([id, contribution]) => [
        id,
        makeSignedContribution(budgetUnit, contribution),
      ]),
    )),
    correlationCovarianceContributions: Object.freeze(Object.fromEntries(
      [...covarianceByPair].map(([pair, covariance]) => [
        pair,
        makeCovarianceContribution(budgetUnit, covariance),
      ]),
    )),
  };
}

function assertPositiveSemidefiniteCorrelationMatrix(matrix: readonly (readonly number[])[]): void {
  const size = matrix.length;
  const lower = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const tolerance = 1e-12;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let residual = matrix[row]?.[column] ?? Number.NaN;
      for (let index = 0; index < column; index += 1) {
        residual -= (lower[row]?.[index] ?? 0) * (lower[column]?.[index] ?? 0);
      }
      if (row === column) {
        if (!Number.isFinite(residual) || residual < -tolerance) {
          throw new RangeError('correlation matrix must be positive semidefinite');
        }
        if (lower[row]) lower[row]![column] = Math.sqrt(Math.max(0, residual));
      } else {
        const pivot = lower[column]?.[column] ?? 0;
        if (pivot > tolerance) {
          if (lower[row]) lower[row]![column] = residual / pivot;
        } else if (Math.abs(residual) > tolerance) {
          throw new RangeError('correlation matrix must be positive semidefinite');
        }
      }
    }
  }
}

function makeNonnegativeUncertainty(
  unit: DvtNonnegativeUncertainty['unit'],
  value: number,
): DvtNonnegativeUncertainty {
  return unit === 'dB' ? { unit, valueDb: value } : { unit, valuePercent: value };
}

function makeSignedContribution(
  unit: DvtNonnegativeUncertainty['unit'],
  value: number,
): DvtSignedSensitivityContribution {
  return unit === 'dB'
    ? { unit, signedValueDb: value }
    : { unit, signedValuePercent: value };
}

function makeCovarianceContribution(
  unit: DvtNonnegativeUncertainty['unit'],
  value: number,
): DvtSignedCovarianceContribution {
  return unit === 'dB'
    ? { unit: 'dB-squared', signedValueDbSquared: value }
    : { unit: 'percent-squared', signedValuePercentSquared: value };
}

function deltaValue(quantity: DvtDeltaQuantity): number {
  return quantity.unit === 'dB' ? quantity.valueDb : quantity.valuePercent;
}

function makeDeltaQuantity(unit: DvtDeltaQuantity['unit'], value: number): DvtDeltaQuantity {
  return unit === 'dB'
    ? { unit: 'dB', valueDb: value }
    : { unit: 'percent', valuePercent: value };
}

function quantityValue(quantity: DvtQuantity): number {
  switch (quantity.unit) {
    case 'dB': return quantity.valueDb;
    case 'dBc': return quantity.valueDbc;
    case 'dBm': return quantity.valueDbm;
    case 'percent': return quantity.valuePercent;
  }
}

function makeQuantity(unit: DvtQuantity['unit'], value: number): DvtQuantity {
  switch (unit) {
    case 'dB': return { unit, valueDb: value };
    case 'dBc': return { unit, valueDbc: value };
    case 'dBm': return { unit, valueDbm: value };
    case 'percent': return { unit, valuePercent: value };
  }
}

/**
 * Applies a symmetric expanded-uncertainty guardband to one result. For
 * upper limits the worst case is measured + U; for lower limits it is
 * measured - U; a range uses the smaller of both normalized margins.
 */
export function decideWithGuardband(request: DvtDecisionRequest): DvtDecision {
  const measuredValue = quantityValue(request.measured);
  const uncertaintyValue = deltaValue(request.expandedUncertainty);
  const convention = request.valueConvention ?? 'generic';
  if (!Number.isFinite(measuredValue)) throw new RangeError('measured value must be finite');
  if (!Number.isFinite(uncertaintyValue) || uncertaintyValue < 0) {
    throw new RangeError('expanded uncertainty must be finite and non-negative');
  }
  const expectedDeltaUnit = request.measured.unit === 'percent' ? 'percent' : 'dB';
  if (request.expandedUncertainty.unit !== expectedDeltaUnit) {
    throw new RangeError(`expanded uncertainty for ${request.measured.unit} must use ${expectedDeltaUnit}`);
  }
  if (convention === 'analyzer-negative-dbc' && (
    request.measured.unit !== 'dBc' || request.direction !== 'upper-bound'
  )) {
    throw new RangeError('analyzer-negative-dbc requires a dBc upper-bound decision');
  }
  if (convention === 'positive-ratio-aclr-db' && (
    request.measured.unit !== 'dB' || request.direction !== 'lower-bound'
  )) {
    throw new RangeError('positive-ratio-aclr-db requires a dB lower-bound decision');
  }

  const lowerValue = request.lowerLimit === undefined
    ? undefined
    : compatibleLimitValue(request.measured, request.lowerLimit, 'lower');
  const upperValue = request.upperLimit === undefined
    ? undefined
    : compatibleLimitValue(request.measured, request.upperLimit, 'upper');
  const guardbandedLowerValue = measuredValue - uncertaintyValue;
  const guardbandedUpperValue = measuredValue + uncertaintyValue;
  let marginValue: number;
  let intervalVerdict: DvtDecision['verdict'];

  if (request.direction === 'upper-bound') {
    if (upperValue === undefined || lowerValue !== undefined) {
      throw new RangeError('upper-bound decisions require only an upper limit');
    }
    marginValue = upperValue - guardbandedUpperValue;
    intervalVerdict = guardbandedUpperValue <= upperValue
      ? 'pass'
      : guardbandedLowerValue > upperValue
        ? 'fail'
        : 'inconclusive';
  } else if (request.direction === 'lower-bound') {
    if (lowerValue === undefined || upperValue !== undefined) {
      throw new RangeError('lower-bound decisions require only a lower limit');
    }
    marginValue = guardbandedLowerValue - lowerValue;
    intervalVerdict = guardbandedLowerValue >= lowerValue
      ? 'pass'
      : guardbandedUpperValue < lowerValue
        ? 'fail'
        : 'inconclusive';
  } else {
    if (lowerValue === undefined || upperValue === undefined) {
      throw new RangeError('range decisions require lower and upper limits');
    }
    if (lowerValue > upperValue) throw new RangeError('range lower limit must not exceed upper limit');
    marginValue = Math.min(
      guardbandedLowerValue - lowerValue,
      upperValue - guardbandedUpperValue,
    );
    intervalVerdict = guardbandedLowerValue >= lowerValue && guardbandedUpperValue <= upperValue
      ? 'pass'
      : guardbandedUpperValue < lowerValue || guardbandedLowerValue > upperValue
        ? 'fail'
        : 'inconclusive';
  }

  const validityAllowsDecision = request.validity === 'valid';
  const verdict = validityAllowsDecision
    ? intervalVerdict
    : 'inconclusive';
  const normalizedMargin = validityAllowsDecision
    ? makeDeltaQuantity(expectedDeltaUnit, marginValue)
    : null;

  return {
    metricId: request.metricId,
    validity: request.validity,
    direction: request.direction,
    verdict,
    measured: request.measured,
    expandedUncertainty: request.expandedUncertainty,
    normalizedMargin,
    guardbandedLower: makeQuantity(request.measured.unit, guardbandedLowerValue),
    guardbandedUpper: makeQuantity(request.measured.unit, guardbandedUpperValue),
    valueConvention: convention,
    explanation: validityAllowsDecision
      ? `${request.direction} guardband margin is ${marginValue} ${expectedDeltaUnit}`
      : `No pass/fail decision: measurement validity is ${request.validity}`,
  };
}

function compatibleLimitValue(
  measured: DvtQuantity,
  limit: DvtQuantity,
  label: 'lower' | 'upper',
): number {
  if (limit.unit !== measured.unit) {
    throw new RangeError(`${label} limit unit must match measured unit ${measured.unit}`);
  }
  const value = quantityValue(limit);
  if (!Number.isFinite(value)) throw new RangeError(`${label} limit must be finite`);
  return value;
}

/** Deterministic PA KPI fixture derived from the shared educational PA model. */
export function calculateDvtPaExpectedValues(): DvtPaExpectedValues {
  const p1db = rappOneDbCompressionPoint(DEFAULT_EDUCATIONAL_PA);
  const p1dbOperatingPoint = evaluatePa(p1db.inputPowerDbm, DEFAULT_EDUCATIONAL_PA);
  const twoTonePerToneOutputPowerDbm = 20;
  const twoToneCompositeOutputPowerDbm = twoTonePerToneOutputPowerDbm + powerRatioToDb(2);
  const twoToneOip3Dbm = 40;
  const im3OutputPowerDbm = (
    3 * twoTonePerToneOutputPowerDbm - 2 * twoToneOip3Dbm
  );
  const im3Dbc = powerRatioToDb(
    dbmToWatts(im3OutputPowerDbm) / dbmToWatts(twoTonePerToneOutputPowerDbm),
  );

  return {
    p1dbInputPowerDbm: p1db.inputPowerDbm,
    p1dbOutputPowerDbm: p1db.outputPowerDbm,
    paeAtP1dbPercent: p1dbOperatingPoint.paePercent,
    twoTonePerToneOutputPowerDbm,
    twoToneCompositeOutputPowerDbm,
    twoToneOip3Dbm,
    im3OutputPowerDbm,
    im3Dbc,
  };
}

/**
 * Reduces qualified TX-noise and TX→RX isolation evidence to a conservative
 * RX-branch risk budget. It never produces receiver performance claims.
 */
export function evaluateDesenseRiskBudget(
  evidence: DvtDesenseRiskEvidence,
): DvtDesenseRiskEvaluation {
  const reasons: string[] = [];
  const numericValues = [
    evidence.txCarrierFrequencyHz,
    evidence.txOutputPowerDbm,
    evidence.frequencyHz,
    evidence.rxFrequencyRangeHz.startHz,
    evidence.rxFrequencyRangeHz.stopHz,
    evidence.noiseMeasurementFrequencyHz,
    evidence.isolationMeasurementFrequencyHz,
    evidence.txToRxIsolationDb,
    evidence.noiseExpandedUncertaintyDb,
    evidence.isolationExpandedUncertaintyDb,
    evidence.analyzerFloorDensityDbmPerHz,
    evidence.floorExpandedUncertaintyDb,
    evidence.minimumFloorHeadroomDb,
    noiseMeasurementValue(evidence.noiseMeasurement),
  ];
  if (!numericValues.every(Number.isFinite)) reasons.push('desense risk evidence contains a non-finite value');
  if ([
    evidence.measurementPointId,
    evidence.txWaveformId,
    evidence.txModeId,
    evidence.supplyStateId,
  ].some((value) => value.trim().length === 0)) {
    reasons.push('TX operating-point linkage is incomplete');
  }
  if (evidence.txCarrierFrequencyHz <= 0) reasons.push('TX carrier frequency must be positive');
  if (
    evidence.rxFrequencyRangeHz.startHz <= 0 ||
    evidence.rxFrequencyRangeHz.stopHz < evidence.rxFrequencyRangeHz.startHz ||
    evidence.frequencyHz < evidence.rxFrequencyRangeHz.startHz ||
    evidence.frequencyHz > evidence.rxFrequencyRangeHz.stopHz
  ) reasons.push('risk frequency must lie inside the declared RX frequency range');
  if (
    evidence.frequencyHz !== evidence.noiseMeasurementFrequencyHz ||
    evidence.frequencyHz !== evidence.isolationMeasurementFrequencyHz
  ) reasons.push('noise and isolation evidence must use the same frequency');
  if (evidence.frequencyHz <= 0) reasons.push('desense risk frequency must be positive');
  if (
    evidence.noiseSourcePlane !== evidence.noiseMeasurementPlane ||
    evidence.noiseSourcePlane !== evidence.isolationTxPlane ||
    evidence.rxBranchPlane !== evidence.isolationRxPlane
  ) reasons.push('noise and isolation reference planes are incompatible');
  if (evidence.isolationDirection !== 'tx-to-rx') reasons.push('isolation direction must be tx-to-rx');
  if (!Number.isFinite(evidence.txToRxIsolationDb) || evidence.txToRxIsolationDb < 0) {
    reasons.push('TX-to-RX isolation must be finite and non-negative');
  }
  if (evidence.noiseIncludesTxToRxIsolation) {
    reasons.push('noise evidence already includes TX-to-RX isolation; refusing to apply it twice');
  }
  if (evidence.noiseMeasurement.convention === 'rbw-integrated' && (
    !Number.isFinite(evidence.noiseMeasurement.equivalentNoiseBandwidthHz) ||
    evidence.noiseMeasurement.equivalentNoiseBandwidthHz <= 0
  )) reasons.push('equivalent noise bandwidth must be finite and positive');
  if (
    evidence.noiseExpandedUncertaintyDb < 0 ||
    evidence.isolationExpandedUncertaintyDb < 0 ||
    evidence.floorExpandedUncertaintyDb < 0 ||
    evidence.minimumFloorHeadroomDb < 0
  ) reasons.push('noise, isolation, floor uncertainty, and minimum headroom must be non-negative');
  if (evidence.noiseCorrectionId.trim().length === 0) reasons.push('noise correction identity is missing');
  if (evidence.isolationEvidenceId.trim().length === 0) reasons.push('isolation evidence identity is missing');
  if (evidence.floorEvidenceId.trim().length === 0) reasons.push('analyzer-floor evidence identity is missing');
  if (evidence.terminatedBaselineEvidenceId.trim().length === 0) {
    reasons.push('source-terminated baseline evidence identity is missing');
  }
  if (evidence.paOffLeakageEvidenceId.trim().length === 0) {
    reasons.push('PA-off leakage evidence identity is missing');
  }
  if (evidence.terminationState !== 'source-connected' || evidence.dutPathState !== 'pa-on') {
    reasons.push('risk calculation requires source-connected PA-on path evidence');
  }

  if (reasons.length > 0) {
    return {
      scope: 'risk-budget-only',
      validity: 'invalid',
      reasons,
      sourceDensityDbmPerHz: null,
      worstCaseNoiseLowerBoundDbmPerHz: null,
      floorUpperBoundDbmPerHz: null,
      validatedFloorHeadroomDb: null,
      estimatedRxBranchDensityDbmPerHz: null,
      worstCaseRxBranchDensityDbmPerHz: null,
      combinedExpandedUncertaintyDb: null,
    };
  }

  const sourceDensityDbmPerHz = evidence.noiseMeasurement.convention === 'density'
    ? evidence.noiseMeasurement.densityDbmPerHz
    : evidence.noiseMeasurement.integratedNoisePowerDbm - powerRatioToDb(
      evidence.noiseMeasurement.equivalentNoiseBandwidthHz,
    );
  const worstCaseNoiseLowerBoundDbmPerHz = sourceDensityDbmPerHz - evidence.noiseExpandedUncertaintyDb;
  const floorUpperBoundDbmPerHz = (
    evidence.analyzerFloorDensityDbmPerHz + evidence.floorExpandedUncertaintyDb
  );
  const validatedFloorHeadroomDb = worstCaseNoiseLowerBoundDbmPerHz - floorUpperBoundDbmPerHz;
  if (validatedFloorHeadroomDb < evidence.minimumFloorHeadroomDb) {
    return {
      scope: 'risk-budget-only',
      validity: 'invalid',
      reasons: ['worst-case noise is not resolved above the analyzer-floor upper bound by the required headroom'],
      sourceDensityDbmPerHz,
      worstCaseNoiseLowerBoundDbmPerHz,
      floorUpperBoundDbmPerHz,
      validatedFloorHeadroomDb,
      estimatedRxBranchDensityDbmPerHz: null,
      worstCaseRxBranchDensityDbmPerHz: null,
      combinedExpandedUncertaintyDb: null,
    };
  }
  const estimatedRxBranchDensityDbmPerHz = sourceDensityDbmPerHz - evidence.txToRxIsolationDb;
  // Conservative sum: higher noise and lower isolation both increase RX-branch risk.
  const combinedExpandedUncertaintyDb = (
    evidence.noiseExpandedUncertaintyDb + evidence.isolationExpandedUncertaintyDb
  );

  return {
    scope: 'risk-budget-only',
    validity: 'valid',
    reasons: [],
    sourceDensityDbmPerHz,
    worstCaseNoiseLowerBoundDbmPerHz,
    floorUpperBoundDbmPerHz,
    validatedFloorHeadroomDb,
    estimatedRxBranchDensityDbmPerHz,
    worstCaseRxBranchDensityDbmPerHz: (
      estimatedRxBranchDensityDbmPerHz + combinedExpandedUncertaintyDb
    ),
    combinedExpandedUncertaintyDb,
  };
}

/**
 * Rejects a numerically plausible desense record when it drifts from the
 * synchronized operating point or from registered external isolation evidence.
 */
export function validateDesenseEvidenceAgainstMeasurementPoint(
  evidence: DvtDesenseRiskEvidence,
  point: DvtMeasurementPoint,
  manifest: DvtStationManifest,
): DvtConclusionLinkageValidation {
  const reasons: string[] = [];
  const pout = point.metricEvidence.find((record) => record.evidenceId === 'pout');
  const dc = point.metricEvidence.find((record) => record.evidenceId === 'dc');
  const txNoise = point.metricEvidence.find((record) => record.evidenceId === 'tx-noise');
  const equalWithin = (left: number, right: number, tolerance: number) => (
    Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance
  );

  if (evidence.measurementPointId !== point.pointId) {
    reasons.push('desense measurement point ID does not match the synchronized point');
  }
  if (evidence.txWaveformId !== point.waveform.waveformId) {
    reasons.push('desense waveform ID does not match the synchronized point');
  }
  if (!equalWithin(evidence.txCarrierFrequencyHz, point.waveform.centerFrequencyHz, 0.5)) {
    reasons.push('desense TX carrier does not match the synchronized point');
  }
  if (evidence.txModeId !== point.dutState.stateId) {
    reasons.push('desense TX mode does not match the synchronized point');
  }
  if (evidence.supplyStateId !== point.supplyStateId) {
    reasons.push('desense supply state ID does not match the synchronized point');
  }
  if (pout?.metric !== 'pout') {
    reasons.push('synchronized point is missing Pout evidence for desense linkage');
  } else if (!equalWithin(evidence.txOutputPowerDbm, pout.correctedPowerDbm, 1e-9)) {
    reasons.push('desense TX output power does not match corrected point Pout');
  }
  if (dc?.metric !== 'dc' || evidence.supplyMetricEvidenceId !== dc?.evidenceId) {
    reasons.push('desense supply state is not linked to the point DC evidence');
  } else {
    if (!equalWithin(evidence.supplyVoltageV, dc.correctedVoltageV, 1e-9)) {
      reasons.push('desense supply voltage does not match corrected point DC evidence');
    }
    if (!equalWithin(evidence.supplyCurrentA, dc.correctedCurrentA, 1e-9)) {
      reasons.push('desense supply current does not match corrected point DC evidence');
    }
    if (evidence.supplyRegulationMode !== point.psuRegulationMode) {
      reasons.push('desense supply regulation mode does not match the synchronized point');
    }
  }
  if (txNoise?.metric !== 'tx-noise' || evidence.txNoiseMetricEvidenceId !== txNoise?.evidenceId) {
    reasons.push('desense noise is not linked to the point TX-noise metric evidence');
  } else {
    if (!sameNoiseMeasurementWithin(evidence.noiseMeasurement, txNoise.correctedNoise, 1e-9)) {
      reasons.push('desense corrected noise does not match point TX-noise evidence');
    }
    if (evidence.noiseCorrectionId !== txNoise.correctionId) {
      reasons.push('desense noise correction ID does not match point TX-noise evidence');
    }
    if (evidence.floorEvidenceId !== txNoise.floorEvidenceId) {
      reasons.push('desense analyzer-floor evidence ID does not match point TX-noise evidence');
    }
    if (!equalWithin(
      evidence.analyzerFloorDensityDbmPerHz,
      txNoise.analyzerFloorDensityDbmPerHz,
      1e-9,
    )) reasons.push('desense analyzer floor does not match point TX-noise evidence');
  }
  if (!manifest.verificationIds.includes(evidence.isolationEvidenceId)) {
    reasons.push('desense isolation evidence is not registered in the station manifest');
  }
  return { valid: reasons.length === 0, reasons };
}

function sameNoiseMeasurementWithin(
  left: DvtDesenseRiskEvidence['noiseMeasurement'],
  right: DvtDesenseRiskEvidence['noiseMeasurement'],
  toleranceDb: number,
): boolean {
  if (left.convention !== right.convention) return false;
  if (left.convention === 'density' && right.convention === 'density') {
    return Math.abs(left.densityDbmPerHz - right.densityDbmPerHz) <= toleranceDb;
  }
  if (left.convention === 'rbw-integrated' && right.convention === 'rbw-integrated') {
    return Math.abs(left.integratedNoisePowerDbm - right.integratedNoisePowerDbm) <= toleranceDb &&
      Math.abs(left.equivalentNoiseBandwidthHz - right.equivalentNoiseBandwidthHz) <= 1e-9;
  }
  return false;
}

/** One shared operating profile for the capstone point, desense budget, and blind cases. */
export const DVT_CAPSTONE_OPERATING_PROFILE = Object.freeze({
  measurementPointId: 'fdd-blind-valid-point-2026-07-r2',
  txCarrierFrequencyHz: 1_740_000_000,
  txWaveformId: 'LTE_FDD_B3_20M_QPSK_CAPSTONE',
  txOutputPowerDbm: 27.295337234821154,
  txModeId: 'capstone-pamid-high-gain',
  supplyStateId: '4p2v-cv-0p266a',
  supplyVoltageV: 4.2,
  supplyCurrentA: 0.266,
  supplyRegulationMode: 'CV' as const,
  expectedPaePercent: 48,
  acquisitionGroupId: 'capstone-lte-b3-sequence-2026-07-r2',
  triggerReferenceId: 'capstone-rf-burst-marker-1',
  maximumTriggerRepeatabilitySeconds: 1e-6,
  settlingEvidenceId: 'capstone-settling-verification-2026-07-r2',
  stateRepeatabilityEvidenceId: 'capstone-state-repeatability-2026-07-r2',
  desenseIsolationDb: 45,
  txNoiseDensityDbmPerHz: -125,
  floorEvidenceId: 'capstone-source-terminated-floor',
  terminatedBaselineEvidenceId: 'capstone-source-terminated-baseline',
  paOffLeakageEvidenceId: 'capstone-pa-off-leakage',
  noiseCorrectionId: 'capstone-rx-noise-path-correction',
});

export const DVT_BUILT_IN_CASES: readonly DvtDiagnosticCase[] = Object.freeze([
  Object.freeze({
    id: 'gain-pae-fail',
    title: 'Gain and PAE fail',
    hypotheses: Object.freeze([
      { hypothesisId: 'dut-mode-state', label: 'DUT gain-mode state mismatch' },
      { hypothesisId: 'path-correction', label: 'RF path correction error' },
      { hypothesisId: 'acquisition-alignment', label: 'RF/DC acquisition misalignment' },
      { hypothesisId: 'supply-thermal', label: 'Supply CC or thermal droop' },
    ]),
    steps: Object.freeze([
      Object.freeze({
        caseId: 'gain-pae-fail',
        stepId: 'recheck-known-path',
        order: 1,
        stage: 'path',
        prompt: 'Recheck measured Pin and Pout corrections on the known path.',
        expectedEvidenceId: 'known-path-recheck',
        expectedEvidence: {
          metric: 'typed-signature' as const,
          signature: 'path-correction-stable' as const,
          expectedObservation: 'Known-path readings remain within the pinned correction uncertainty.',
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'dut-mode-state', effect: 'neutral' as const, rationale: 'A stable path does not prove DUT mode.' },
          { hypothesisId: 'path-correction', effect: 'contradict' as const, rationale: 'The known path remains inside correction uncertainty.' },
          { hypothesisId: 'acquisition-alignment', effect: 'neutral' as const, rationale: 'Path stability does not test RF/DC aperture alignment.' },
          { hypothesisId: 'supply-thermal', effect: 'neutral' as const, rationale: 'The known RF path does not measure supply regulation or thermal drift.' },
        ]),
      }),
      Object.freeze({
        caseId: 'gain-pae-fail',
        stepId: 'query-gain-mode',
        order: 2,
        stage: 'dut',
        prompt: 'Compare gain-mode command intent, query-back and low-power gain.',
        expectedEvidenceId: 'gain-mode-query-back',
        expectedEvidence: {
          metric: 'typed-signature' as const,
          signature: 'gain-mode-query-mismatch' as const,
          expectedObservation: 'A pre-correction query-back mismatch is retained; the final synchronized point records the corrected matching state.',
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'dut-mode-state', effect: 'support' as const, rationale: 'Generic mode query-back directly disagrees with intent.' },
          { hypothesisId: 'path-correction', effect: 'neutral' as const, rationale: 'Mode query-back does not measure path correction.' },
          { hypothesisId: 'acquisition-alignment', effect: 'neutral' as const, rationale: 'Mode query-back alone does not prove acquisition-group, trigger, or state repeatability.' },
          { hypothesisId: 'supply-thermal', effect: 'neutral' as const, rationale: 'Mode query-back does not measure supply regulation or thermal drift.' },
        ]),
      }),
      Object.freeze({
        caseId: 'gain-pae-fail',
        stepId: 'synchronize-rf-dc',
        order: 3,
        stage: 'acquisition',
        prompt: 'Bind Pin, Pout, VDD and IDD to one repeatable operating-point sequence.',
        expectedEvidenceId: 'synchronized-rf-dc',
        expectedEvidence: {
          metric: 'synchronized-kpi' as const,
          requiredEvidenceIds: ['pin', 'pout', 'dc'] as const,
          acquisitionMode: 'repeatable-sequence' as const,
          acquisitionGroupId: DVT_CAPSTONE_OPERATING_PROFILE.acquisitionGroupId,
          triggerReferenceId: DVT_CAPSTONE_OPERATING_PROFILE.triggerReferenceId,
          maximumTriggerRepeatabilitySeconds: DVT_CAPSTONE_OPERATING_PROFILE.maximumTriggerRepeatabilitySeconds,
          settlingEvidenceId: DVT_CAPSTONE_OPERATING_PROFILE.settlingEvidenceId,
          stateRepeatabilityEvidenceId: DVT_CAPSTONE_OPERATING_PROFILE.stateRepeatabilityEvidenceId,
          expectedPaePercent: DVT_CAPSTONE_OPERATING_PROFILE.expectedPaePercent,
          tolerancePercent: 0.2,
          observedSupplyRegulationMode: 'CV' as const,
          gainDroopDbAcrossAperture: 0.1,
          fixtureTemperatureEvidence: 'absent' as const,
          thermalMechanismClaimAllowed: false,
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'dut-mode-state', effect: 'support' as const, rationale: 'Low PAE remains after synchronized RF/DC evidence is valid.' },
          { hypothesisId: 'path-correction', effect: 'neutral' as const, rationale: 'Synchronization alone does not independently recalibrate the RF path.' },
          { hypothesisId: 'acquisition-alignment', effect: 'contradict' as const, rationale: 'Pin, Pout and DC records share the acquisition group, point trigger, contiguous sequence and state-repeatability contract.' },
          { hypothesisId: 'supply-thermal', effect: 'neutral' as const, rationale: 'CV and low gain droop lower supply-limit concern, but absent fixture-temperature evidence prevents a thermal mechanism conclusion.' },
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: 'evm-aclr-fail',
    title: 'EVM and ACLR fail',
    hypotheses: Object.freeze([
      { hypothesisId: 'dut-nonlinearity', label: 'DUT compression/nonlinearity' },
      { hypothesisId: 'source-residual', label: 'Source waveform residual' },
      { hypothesisId: 'analyzer-artifact', label: 'Analyzer ACLR input-range artifact' },
      { hypothesisId: 'evm-demod-artifact', label: 'EVM demodulation artifact' },
    ]),
    steps: Object.freeze([
      Object.freeze({
        caseId: 'evm-aclr-fail',
        stepId: 'qualify-passive-through',
        order: 1,
        stage: 'source',
        prompt: 'Measure the same waveform through the qualified passive path.',
        expectedEvidenceId: 'passive-through-residual',
        expectedEvidence: {
          metric: 'typed-signature' as const,
          signature: 'source-residual-qualified' as const,
          expectedObservation: 'Through EVM and ACLR residuals remain below the project allocation.',
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'dut-nonlinearity', effect: 'neutral' as const, rationale: 'Passive through removes the DUT from this observation.' },
          { hypothesisId: 'source-residual', effect: 'contradict' as const, rationale: 'The source and passive path residual are qualified.' },
          { hypothesisId: 'analyzer-artifact', effect: 'neutral' as const, rationale: 'A low-level through does not reproduce DUT output level.' },
          { hypothesisId: 'evm-demod-artifact', effect: 'neutral' as const, rationale: 'A low-level through does not qualify DUT-level demodulation headroom.' },
        ]),
      }),
      Object.freeze({
        caseId: 'evm-aclr-fail',
        stepId: 'step-analyzer-attenuation',
        order: 2,
        stage: 'acquisition',
        prompt: 'Increase analyzer input attenuation and preserve DUT-plane correction.',
        expectedEvidenceId: 'attenuation-step-check',
        expectedEvidence: {
          metric: 'analyzer-attenuation-step' as const,
          attenuationStepDeltaDb: 10,
          correctedAclrDeltaDb: 0.15,
          repeatabilityDb: 0.1,
          expandedUncertaintyDb: 0.4,
          mixerHeadroomBeforeDb: 3,
          mixerHeadroomAfterDb: 13,
          noiseFloorHeadroomBeforeDb: 16,
          noiseFloorHeadroomAfterDb: 6,
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'dut-nonlinearity', effect: 'neutral' as const, rationale: 'Analyzer attenuation does not change the DUT operating point.' },
          { hypothesisId: 'source-residual', effect: 'neutral' as const, rationale: 'Analyzer attenuation does not change source residual.' },
          { hypothesisId: 'analyzer-artifact', effect: 'contradict' as const, rationale: 'Corrected ACLR delta is within repeatability and uncertainty with valid mixer/noise headroom.' },
          { hypothesisId: 'evm-demod-artifact', effect: 'neutral' as const, rationale: 'This evidence contains no EVM delta, residual, or demodulation-validity result.' },
        ]),
      }),
      Object.freeze({
        caseId: 'evm-aclr-fail',
        stepId: 'backoff-output-power',
        order: 3,
        stage: 'dut',
        prompt: 'Back off output power without changing waveform or analysis definition.',
        expectedEvidenceId: 'pout-backoff-recovery',
        expectedEvidence: {
          metric: 'typed-signature' as const,
          signature: 'evm-aclr-recover-with-backoff' as const,
          expectedObservation: 'EVM and ACLR recover together with reduced AM-AM and AM-PM distortion.',
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'dut-nonlinearity', effect: 'support' as const, rationale: 'Power backoff reduces DUT envelope compression and regrowth.' },
          { hypothesisId: 'source-residual', effect: 'contradict' as const, rationale: 'The source waveform is unchanged while DUT-plane quality recovers.' },
          { hypothesisId: 'analyzer-artifact', effect: 'neutral' as const, rationale: 'Attenuation-step evidence separately addresses analyzer contribution.' },
          { hypothesisId: 'evm-demod-artifact', effect: 'neutral' as const, rationale: 'Backoff recovery does not independently qualify the analyzer demodulation chain.' },
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: 'desense-risk-budget',
    title: 'Tx noise to Rx-branch desense risk budget',
    hypotheses: Object.freeze([
      { hypothesisId: 'pa-tx-noise', label: 'PA-on TX noise contribution' },
      { hypothesisId: 'bench-leakage', label: 'Bench leakage contribution' },
      { hypothesisId: 'analyzer-floor', label: 'Analyzer floor contribution' },
      { hypothesisId: 'isolation-shortfall', label: 'Duplexer or fixture isolation shortfall' },
    ]),
    steps: Object.freeze([
      Object.freeze({
        caseId: 'desense-risk-budget',
        stepId: 'separate-floor-and-leakage',
        order: 1,
        stage: 'acquisition',
        prompt: 'Compare source-terminated, PA-off and PA-on RX-band baselines.',
        expectedEvidenceId: 'terminated-floor-baseline',
        expectedEvidence: {
          metric: 'typed-signature' as const,
          signature: 'terminated-floor-separated' as const,
          expectedObservation: 'Analyzer floor and bench leakage are separated from the PA-on noise trace.',
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'pa-tx-noise', effect: 'neutral' as const, rationale: 'The baseline establishes floor before PA-on attribution.' },
          { hypothesisId: 'bench-leakage', effect: 'neutral' as const, rationale: 'PA-off comparison retains bench leakage as a measured contribution.' },
          { hypothesisId: 'analyzer-floor', effect: 'contradict' as const, rationale: 'The PA-on trace is resolved above the terminated floor.' },
          { hypothesisId: 'isolation-shortfall', effect: 'neutral' as const, rationale: 'Floor separation does not measure TX-to-RX isolation.' },
        ]),
      }),
      Object.freeze({
        caseId: 'desense-risk-budget',
        stepId: 'verify-isolation-independently',
        order: 2,
        stage: 'path',
        prompt: 'Use independently verified duplexer and fixture isolation evidence.',
        expectedEvidenceId: 'independent-isolation',
        expectedEvidence: {
          metric: 'typed-signature' as const,
          signature: 'isolation-independently-verified' as const,
          expectedObservation: 'Isolation evidence is valid at the same frequency and reference planes.',
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'pa-tx-noise', effect: 'neutral' as const, rationale: 'Isolation transports noise but does not identify its source.' },
          { hypothesisId: 'bench-leakage', effect: 'neutral' as const, rationale: 'Independent isolation does not remove radiated bench leakage.' },
          { hypothesisId: 'analyzer-floor', effect: 'neutral' as const, rationale: 'Isolation verification is independent of analyzer floor.' },
          { hypothesisId: 'isolation-shortfall', effect: 'neutral' as const, rationale: 'This step qualifies the isolation evidence; the following budget compares it with the educational target.' },
        ]),
      }),
      Object.freeze({
        caseId: 'desense-risk-budget',
        stepId: 'close-risk-budget',
        order: 3,
        stage: 'math',
        prompt: 'Combine Tx noise density and isolation as an RX-branch risk budget only.',
        expectedEvidenceId: 'rx-branch-risk-budget',
        expectedEvidence: {
          metric: 'desense-risk-budget' as const,
          scope: 'risk-budget-only' as const,
          educationalIsolationTargetDb: 50,
          measurementPointId: DVT_CAPSTONE_OPERATING_PROFILE.measurementPointId,
          txCarrierFrequencyHz: DVT_CAPSTONE_OPERATING_PROFILE.txCarrierFrequencyHz,
          txWaveformId: DVT_CAPSTONE_OPERATING_PROFILE.txWaveformId,
          txOutputPowerDbm: DVT_CAPSTONE_OPERATING_PROFILE.txOutputPowerDbm,
          txModeId: DVT_CAPSTONE_OPERATING_PROFILE.txModeId,
          supplyStateId: DVT_CAPSTONE_OPERATING_PROFILE.supplyStateId,
          supplyMetricEvidenceId: 'dc' as const,
          supplyVoltageV: DVT_CAPSTONE_OPERATING_PROFILE.supplyVoltageV,
          supplyCurrentA: DVT_CAPSTONE_OPERATING_PROFILE.supplyCurrentA,
          supplyRegulationMode: DVT_CAPSTONE_OPERATING_PROFILE.supplyRegulationMode,
          frequencyHz: 1_840_000_000,
          rxFrequencyRangeHz: { startHz: 1_805_000_000, stopHz: 1_880_000_000 },
          noiseMeasurementFrequencyHz: 1_840_000_000,
          isolationMeasurementFrequencyHz: 1_840_000_000,
          noiseSourcePlane: 'pamid-tx-output',
          noiseMeasurementPlane: 'pamid-tx-output',
          rxBranchPlane: 'pamid-rx-branch',
          isolationTxPlane: 'pamid-tx-output',
          isolationRxPlane: 'pamid-rx-branch',
          isolationDirection: 'tx-to-rx' as const,
          txToRxIsolationDb: DVT_CAPSTONE_OPERATING_PROFILE.desenseIsolationDb,
          noiseMeasurement: {
            convention: 'density' as const,
            densityDbmPerHz: DVT_CAPSTONE_OPERATING_PROFILE.txNoiseDensityDbmPerHz,
          },
          txNoiseMetricEvidenceId: 'tx-noise' as const,
          terminationState: 'source-connected' as const,
          dutPathState: 'pa-on' as const,
          noiseIncludesTxToRxIsolation: false,
          noiseExpandedUncertaintyDb: 1.2,
          isolationExpandedUncertaintyDb: 1.5,
          isolationEvidenceId: 'capstone-independent-isolation',
          analyzerFloorDensityDbmPerHz: -165,
          floorEvidenceId: DVT_CAPSTONE_OPERATING_PROFILE.floorEvidenceId,
          floorExpandedUncertaintyDb: 1,
          minimumFloorHeadroomDb: 6,
          terminatedBaselineEvidenceId: DVT_CAPSTONE_OPERATING_PROFILE.terminatedBaselineEvidenceId,
          paOffLeakageEvidenceId: DVT_CAPSTONE_OPERATING_PROFILE.paOffLeakageEvidenceId,
          noiseCorrectionId: DVT_CAPSTONE_OPERATING_PROFILE.noiseCorrectionId,
        },
        expectedEffects: Object.freeze([
          { hypothesisId: 'pa-tx-noise', effect: 'support' as const, rationale: 'Qualified PA-on noise and TX-to-RX isolation produce a bounded RX-branch risk.' },
          { hypothesisId: 'bench-leakage', effect: 'neutral' as const, rationale: 'The conductive budget does not quantify all radiated bench leakage.' },
          { hypothesisId: 'analyzer-floor', effect: 'contradict' as const, rationale: 'Noise is resolved above the qualified analyzer floor.' },
          { hypothesisId: 'isolation-shortfall', effect: 'support' as const, rationale: 'Measured 45 dB isolation is below the explicit 50 dB educational risk target.' },
        ]),
      }),
    ]),
  }),
]);

export function validateDiagnosticPlan(
  caseId: string,
  plan: DvtDiagnosticPlan,
): DvtConsistencyValidation {
  const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === caseId);
  if (!diagnosticCase) return { valid: false, reason: `unknown built-in DVT case: ${caseId}` };
  const step = diagnosticCase.steps.find(({ stepId }) => stepId === plan.nextStepId);
  if (!step) return { valid: false, reason: 'selected next measurement is not part of this case' };
  if (step.expectedEvidenceId !== plan.expectedEvidenceId) {
    return { valid: false, reason: 'expected signature does not belong to the selected measurement' };
  }
  return { valid: true, reason: 'diagnostic plan is internally consistent' };
}

export function validateEvidenceClassification(
  caseId: string,
  classification: DvtEvidenceClassification,
): DvtConsistencyValidation {
  const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === caseId);
  if (!diagnosticCase) return { valid: false, reason: `unknown built-in DVT case: ${caseId}` };
  if (!diagnosticCase.hypotheses.some(({ hypothesisId }) => (
    hypothesisId === classification.hypothesisId
  ))) return { valid: false, reason: 'hypothesis is not part of this case' };
  const step = diagnosticCase.steps.find(({ expectedEvidenceId }) => (
    expectedEvidenceId === classification.evidenceId
  ));
  if (!step) return { valid: false, reason: 'evidence is not part of this case' };
  const expectedEffect = step.expectedEffects.find(({ hypothesisId }) => (
    hypothesisId === classification.hypothesisId
  ));
  if (!expectedEffect) return { valid: false, reason: 'evidence has no effect contract for this hypothesis' };
  if (expectedEffect.effect !== classification.effect) {
    return {
      valid: false,
      reason: `classification conflicts with built-in evidence semantics: ${expectedEffect.rationale}`,
    };
  }
  return { valid: true, reason: 'evidence classification matches the built-in case' };
}

export function validateConclusionReportCompleteness(
  report: DvtConclusionReport,
): DvtConclusionCompleteness {
  const missingFields: string[] = [];
  const requireText = (value: string, field: string) => {
    if (value.trim().length === 0) missingFields.push(field);
  };
  requireText(report.reportId, 'reportId');
  requireText(report.stationId, 'stationId');
  requireText(report.measurementPointId, 'measurementPointId');
  if (report.decisionIds.length === 0) missingFields.push('decisionIds');
  if (report.acceptedDiagnosticEvidenceIds.length === 0) {
    missingFields.push('acceptedDiagnosticEvidenceIds');
  } else if (new Set(report.acceptedDiagnosticEvidenceIds).size !== report.acceptedDiagnosticEvidenceIds.length) {
    missingFields.push('acceptedDiagnosticEvidenceIds.unique');
  }
  const sections = [
    ['scope', report.sections.scope],
    ['station', report.sections.station],
    ['symptom', report.sections.symptom],
    ['validity', report.sections.validity],
    ['decision', report.sections.decision],
    ['hypotheses', report.sections.hypotheses],
    ['evidence', report.sections.evidence],
    ['conclusion', report.sections.conclusion],
    ['residualRisk', report.sections.residualRisk],
  ] as const;
  for (const [field, value] of sections) requireText(value, `sections.${field}`);
  if (report.cleanup.rfOutput.status !== 'off') missingFields.push('cleanup.rfOutput.status');
  if (!['aborted', 'idle'].includes(report.cleanup.acquisition.status)) {
    missingFields.push('cleanup.acquisition.status');
  }
  if (report.cleanup.bias.status !== 'safe-down') missingFields.push('cleanup.bias.status');
  if (!['off', 'not-applicable'].includes(report.cleanup.dcOutput.status)) {
    missingFields.push('cleanup.dcOutput.status');
  }
  const cleanupEntries = [
    ['rfOutput', report.cleanup.rfOutput],
    ['acquisition', report.cleanup.acquisition],
    ['bias', report.cleanup.bias],
    ['dcOutput', report.cleanup.dcOutput],
  ] as const;
  for (const [field, entry] of cleanupEntries) {
    requireText(entry.evidenceId, `cleanup.${field}.evidenceId`);
    if (!Number.isFinite(Date.parse(entry.atIso))) missingFields.push(`cleanup.${field}.atIso`);
  }
  requireText(report.nextAction, 'nextAction');
  requireText(report.owner, 'owner');
  return { complete: missingFields.length === 0, missingFields };
}

/**
 * Prevents a prose-complete conclusion from claiming evidence that is not
 * represented by the linked station, point, and guardband decision objects.
 */
export function validateConclusionEvidenceLinkage(
  report: DvtConclusionReport,
  linkage: DvtConclusionEvidenceLinkage,
): DvtConclusionLinkageValidation {
  const reasons: string[] = [];
  if (report.stationId !== linkage.stationId) reasons.push('report station ID does not match linked station');
  if (linkage.stationRevisionId.trim().length === 0) reasons.push('linked station revision ID is missing');
  if (linkage.stationReadiness.state !== 'ready') reasons.push('linked station readiness must be ready');
  if (report.measurementPointId !== linkage.measurementPointId) {
    reasons.push('report measurement point ID does not match linked point');
  }
  if (linkage.measurementValidation.validity !== 'valid') {
    reasons.push('linked measurement point validity must be valid');
  }
  const reportDecisionIds = new Set(report.decisionIds);
  const linkedDecisionIds = new Set(linkage.decisions.map(({ metricId }) => metricId));
  if (reportDecisionIds.size !== report.decisionIds.length) reasons.push('report decision IDs must be unique');
  if (linkedDecisionIds.size !== linkage.decisions.length) reasons.push('linked decision metric IDs must be unique');
  if (
    reportDecisionIds.size !== linkedDecisionIds.size ||
    [...reportDecisionIds].some((id) => !linkedDecisionIds.has(id))
  ) reasons.push('report decision IDs do not exactly match linked decisions');
  if (linkage.decisions.some(({ validity }) => validity !== 'valid')) {
    reasons.push('linked decisions must originate from valid measurements');
  }
  if (!sameCleanupEvidence(report.cleanup, linkage.cleanup)) {
    reasons.push('report cleanup does not exactly match linked point cleanup');
  }
  const decisionSourceIds = new Set(linkage.decisionSources.map(({ metricId }) => metricId));
  if (
    decisionSourceIds.size !== linkage.decisionSources.length ||
    decisionSourceIds.size !== linkedDecisionIds.size ||
    [...decisionSourceIds].some((id) => !linkedDecisionIds.has(id))
  ) reasons.push('decision source records do not exactly match linked decisions');
  if (linkage.decisionSources.some(({ sourceMeasurementPointId }) => (
    sourceMeasurementPointId !== linkage.measurementPointId
  ))) reasons.push('decision source point ID does not match linked measurement point');
  if (linkage.decisionSources.some(({ sourceMetricEvidenceIds, uncertaintySourceEvidenceIds }) => (
    sourceMetricEvidenceIds.length === 0 || uncertaintySourceEvidenceIds.length === 0
  ))) reasons.push('decision source evidence IDs are incomplete');
  const linkedDiagnosticEvidenceIds = linkage.diagnosticEvidenceSources.map(({ evidenceId }) => evidenceId);
  const expectedDiagnosticSources = expectedDiagnosticEvidenceContract();
  if (
    linkage.diagnosticEvidenceSources.length !== expectedDiagnosticSources.length ||
    linkage.diagnosticEvidenceSources.some((source, index) => {
      const expected = expectedDiagnosticSources[index];
      return expected === undefined || source.caseId !== expected.caseId || source.evidenceId !== expected.evidenceId;
    })
  ) reasons.push('linked diagnostic evidence does not exactly cover the ordered nine-step contract');
  if (!sameStringArray(report.acceptedDiagnosticEvidenceIds, linkedDiagnosticEvidenceIds)) {
    reasons.push('report diagnostic evidence IDs do not exactly match linked diagnostic sources');
  }
  if (new Set(linkedDiagnosticEvidenceIds).size !== linkedDiagnosticEvidenceIds.length) {
    reasons.push('linked diagnostic evidence IDs must be unique');
  }
  if (linkage.diagnosticEvidenceSources.some(({ sourceMeasurementPointId }) => (
    sourceMeasurementPointId !== linkage.measurementPointId
  ))) reasons.push('diagnostic evidence source point ID does not match linked measurement point');
  const linkedMetricIds = new Set(linkage.decisions.map(({ metricId }) => metricId));
  if (linkage.diagnosticEvidenceSources.some(({ decisionMetricId }) => (
    decisionMetricId !== undefined && !linkedMetricIds.has(decisionMetricId)
  ))) reasons.push('diagnostic evidence references an unlinked decision metric');
  return { valid: reasons.length === 0, reasons };
}

/** Recomputes every derived provenance field from immutable educational source records. */
export function buildConclusionEvidenceLinkage(
  records: DvtConclusionSourceRecords,
): DvtConclusionEvidenceLinkage {
  const stationReadiness = evaluateStationReadiness(
    records.stationManifest,
    records.requiredCapabilityIds,
    records.stationAsOfIso,
  );
  const measurementValidation = validateMeasurementPoint(records.measurementPoint, {
    stationManifest: records.stationManifest,
    sourceAssetId: records.sourceAssetId,
    requiredCapabilityIds: records.requiredCapabilityIds,
    asOfIso: records.stationAsOfIso,
  });
  const evidenceById = new Map(records.measurementPoint.metricEvidence.map((evidence) => [
    evidence.evidenceId,
    evidence,
  ]));
  const desenseEvaluation = records.desenseEvidence === undefined
    ? undefined
    : evaluateDesenseRiskBudget(records.desenseEvidence);
  if (records.desenseEvidence !== undefined) {
    const desensePointValidation = validateDesenseEvidenceAgainstMeasurementPoint(
      records.desenseEvidence,
      records.measurementPoint,
      records.stationManifest,
    );
    if (!desensePointValidation.valid) {
      throw new RangeError(desensePointValidation.reasons.join('; '));
    }
  }

  const externalRegistryById = new Map(records.externalEvidenceRegistry.map((record) => [
    record.evidenceId,
    record,
  ]));
  if (externalRegistryById.size !== records.externalEvidenceRegistry.length ||
    records.externalEvidenceRegistry.some(({ evidenceId }) => evidenceId.trim().length === 0)) {
    throw new RangeError('external evidence registry IDs must be nonempty and unique');
  }
  for (const record of records.externalEvidenceRegistry) {
    if (record.sourceAssetId !== undefined && !records.stationManifest.assets.some(({ assetId }) => (
      assetId === record.sourceAssetId
    ))) throw new RangeError(`external evidence ${record.evidenceId} references an unknown asset`);
    if (
      record.sourceMeasurementPointId !== undefined &&
      record.sourceMeasurementPointId !== records.measurementPoint.pointId
    ) throw new RangeError(`external evidence ${record.evidenceId} references another measurement point`);
  }

  const decisionSources = records.decisionSources.map((source) => {
    if (source.metricKind === 'desense-isolation' && desenseEvaluation?.validity !== 'valid') {
      throw new RangeError('desense-isolation decision requires valid desense risk evidence');
    }
    const requiredEvidenceIds = requiredDecisionEvidenceIds(source.metricKind);
    if (!sameStringSet(requiredEvidenceIds, source.sourceMetricEvidenceIds)) {
      throw new RangeError(`${source.metricId} source evidence IDs do not match ${source.metricKind}`);
    }
    for (const evidenceId of source.sourceMetricEvidenceIds) {
      if (!evidenceById.has(evidenceId)) {
        throw new RangeError(`${source.metricId} source evidence ${evidenceId} is missing from the point`);
      }
      if (!records.measurementPoint.requiredEvidenceIds.includes(evidenceId)) {
        throw new RangeError(`${source.metricId} source evidence ${evidenceId} is not required by the point contract`);
      }
    }
    if (new Set(source.sourceExternalEvidenceIds).size !== source.sourceExternalEvidenceIds.length) {
      throw new RangeError(`${source.metricId} external source evidence IDs must be unique`);
    }
    for (const evidenceId of source.sourceExternalEvidenceIds) {
      if (!externalRegistryById.has(evidenceId)) {
        throw new RangeError(`${source.metricId} external source evidence ${evidenceId} is not registered`);
      }
    }
    if (source.metricKind === 'desense-isolation') {
      if (
        records.desenseEvidence === undefined ||
        !sameStringArray(source.sourceExternalEvidenceIds, [records.desenseEvidence.isolationEvidenceId])
      ) throw new RangeError('desense-isolation external source must exactly match isolation evidence');
    }
    const budget = combineUncertaintyBudget(source.uncertaintyComponents, source.coverageFactor);
    const measured = measuredQuantityFromSources(source.metricKind, evidenceById, records.desenseEvidence);
    const decisionRequest: DvtDecisionRequest = {
      metricId: source.metricId,
      validity: measurementValidation.validity,
      direction: source.decisionRule.direction,
      measured,
      expandedUncertainty: budget.expandedUncertainty,
      ...(source.decisionRule.lowerLimit === undefined ? {} : { lowerLimit: source.decisionRule.lowerLimit }),
      ...(source.decisionRule.upperLimit === undefined ? {} : { upperLimit: source.decisionRule.upperLimit }),
      ...(source.decisionRule.valueConvention === undefined
        ? {}
        : { valueConvention: source.decisionRule.valueConvention }),
    };
    return {
      decision: decideWithGuardband(decisionRequest),
      source: {
        metricId: source.metricId,
        sourceMeasurementPointId: records.measurementPoint.pointId,
        sourceMetricEvidenceIds: [...source.sourceMetricEvidenceIds],
        sourceExternalEvidenceIds: [...source.sourceExternalEvidenceIds],
        uncertaintySourceEvidenceIds: source.uncertaintyComponents.map(({ sourceEvidenceId }) => sourceEvidenceId),
      },
    };
  });

  const decisionIds = new Set(decisionSources.map(({ decision }) => decision.metricId));
  const diagnosticEvidenceSources = records.diagnosticEvidenceSources.map((source): DvtDiagnosticEvidenceSource => {
    const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === source.caseId);
    if (!diagnosticCase) throw new RangeError(`diagnostic source references unknown case ${source.caseId}`);
    if (!diagnosticCase.steps.some(({ expectedEvidenceId }) => expectedEvidenceId === source.evidenceId)) {
      throw new RangeError(`${source.evidenceId} is not an expected observation in ${source.caseId}`);
    }
    if (source.sourceMeasurementPointId !== records.measurementPoint.pointId) {
      throw new RangeError(`${source.evidenceId} diagnostic source point does not match the source point`);
    }
    if (
      new Set(source.sourceMetricEvidenceIds).size !== source.sourceMetricEvidenceIds.length ||
      new Set(source.sourceExternalEvidenceIds).size !== source.sourceExternalEvidenceIds.length
    ) throw new RangeError(`${source.evidenceId} diagnostic source IDs must be unique`);
    if (source.sourceMetricEvidenceIds.length + source.sourceExternalEvidenceIds.length === 0) {
      throw new RangeError(`${source.evidenceId} diagnostic source bundle is empty`);
    }
    for (const evidenceId of source.sourceMetricEvidenceIds) {
      if (!evidenceById.has(evidenceId) || !records.measurementPoint.requiredEvidenceIds.includes(evidenceId)) {
        throw new RangeError(`${source.evidenceId} metric source ${evidenceId} is not bound to the point contract`);
      }
    }
    for (const evidenceId of source.sourceExternalEvidenceIds) {
      if (!externalRegistryById.has(evidenceId)) {
        throw new RangeError(`${source.evidenceId} external source ${evidenceId} is not registered`);
      }
    }
    if (source.decisionMetricId !== undefined && !decisionIds.has(source.decisionMetricId)) {
      throw new RangeError(`${source.evidenceId} references unknown decision ${source.decisionMetricId}`);
    }
    return {
      caseId: source.caseId,
      evidenceId: source.evidenceId,
      sourceMeasurementPointId: source.sourceMeasurementPointId,
      sourceMetricEvidenceIds: [...source.sourceMetricEvidenceIds],
      sourceExternalEvidenceIds: [...source.sourceExternalEvidenceIds],
      ...(source.decisionMetricId === undefined ? {} : { decisionMetricId: source.decisionMetricId }),
    };
  });
  if (new Set(diagnosticEvidenceSources.map(({ evidenceId }) => evidenceId)).size !== diagnosticEvidenceSources.length) {
    throw new RangeError('diagnostic evidence IDs must be unique across the conclusion source bundle');
  }
  const expectedDiagnosticSources = expectedDiagnosticEvidenceContract();
  if (
    diagnosticEvidenceSources.length !== expectedDiagnosticSources.length ||
    diagnosticEvidenceSources.some((source, index) => {
      const expected = expectedDiagnosticSources[index];
      return expected === undefined || source.caseId !== expected.caseId || source.evidenceId !== expected.evidenceId;
    })
  ) throw new RangeError('diagnostic evidence sources must exactly cover the ordered nine-step contract');

  return {
    stationId: records.stationManifest.stationId,
    stationRevisionId: records.stationManifest.revisionId,
    stationReadiness,
    measurementPointId: records.measurementPoint.pointId,
    measurementValidation,
    cleanup: cloneCleanupEvidence(records.measurementPoint.cleanup),
    decisionSources: decisionSources.map(({ source }) => source),
    diagnosticEvidenceSources,
    decisions: decisionSources.map(({ decision }) => decision),
    ...(desenseEvaluation === undefined ? {} : { desenseEvaluation }),
  };
}

/**
 * Rebuilds provenance from source records, then optionally rejects any claimed
 * linkage whose derived station, point, cleanup, source IDs, or decisions were edited.
 */
export function validateConclusionSourceRecords(
  report: DvtConclusionReport,
  records: DvtConclusionSourceRecords,
  claimedLinkage?: DvtConclusionEvidenceLinkage,
): DvtConclusionLinkageValidation {
  try {
    const recomputed = buildConclusionEvidenceLinkage(records);
    const reasons = [...validateConclusionEvidenceLinkage(report, recomputed).reasons];
    if (claimedLinkage !== undefined && !structurallyEqual(claimedLinkage, recomputed)) {
      reasons.push('claimed conclusion linkage does not match recomputed source-record provenance');
    }
    return { valid: reasons.length === 0, reasons };
  } catch (error) {
    return {
      valid: false,
      reasons: [error instanceof Error ? error.message : 'source-record provenance could not be recomputed'],
    };
  }
}

function requiredDecisionEvidenceIds(
  metricKind: DvtConclusionSourceRecords['decisionSources'][number]['metricKind'],
): readonly DvtMetricEvidenceId[] {
  switch (metricKind) {
    case 'pae': return ['pin', 'pout', 'dc'];
    case 'aclr-native': return ['aclr'];
    case 'evm': return ['evm'];
    case 'pout': return ['pout'];
    case 'desense-isolation': return ['tx-noise'];
  }
}

function expectedDiagnosticEvidenceContract(): readonly Pick<
  DvtDiagnosticEvidenceSource,
  'caseId' | 'evidenceId'
>[] {
  return DVT_BUILT_IN_CASES.flatMap(({ id: caseId, steps }) => (
    steps.map(({ expectedEvidenceId }) => ({ caseId, evidenceId: expectedEvidenceId }))
  ));
}

function measuredQuantityFromSources(
  metricKind: DvtConclusionSourceRecords['decisionSources'][number]['metricKind'],
  evidenceById: ReadonlyMap<string, DvtMetricEvidence>,
  desenseEvidence?: DvtDesenseRiskEvidence,
): DvtQuantity {
  const requireEvidence = <T extends DvtMetricEvidence['metric']>(id: DvtMetricEvidenceId, metric: T) => {
    const evidence = evidenceById.get(id);
    if (!evidence || evidence.metric !== metric) throw new RangeError(`${id} ${metric} evidence is unavailable`);
    return evidence as Extract<DvtMetricEvidence, { metric: T }>;
  };
  switch (metricKind) {
    case 'pae': {
      const pin = requireEvidence('pin', 'pin');
      const pout = requireEvidence('pout', 'pout');
      const dc = requireEvidence('dc', 'dc');
      const dcPowerW = dc.correctedVoltageV * dc.correctedCurrentA;
      if (dcPowerW <= 0) throw new RangeError('PAE source DC power must be positive');
      return {
        unit: 'percent',
        valuePercent: 100 * (
          dbmToWatts(pout.correctedPowerDbm) - dbmToWatts(pin.correctedPowerDbm)
        ) / dcPowerW,
      };
    }
    case 'aclr-native':
      return { unit: 'dBc', valueDbc: requireEvidence('aclr', 'aclr').correctedAclrDbc };
    case 'evm':
      return { unit: 'percent', valuePercent: requireEvidence('evm', 'evm').correctedEvmPercent };
    case 'pout':
      return { unit: 'dBm', valueDbm: requireEvidence('pout', 'pout').correctedPowerDbm };
    case 'desense-isolation':
      if (desenseEvidence === undefined) throw new RangeError('desense-isolation decision requires desense evidence');
      return { unit: 'dB', valueDb: desenseEvidence.txToRxIsolationDb };
  }
}

function sameCleanupEvidence(left: DvtCleanupEvidence, right: DvtCleanupEvidence): boolean {
  return structurallyEqual(left, right);
}

function cloneCleanupEvidence(cleanup: DvtCleanupEvidence): DvtCleanupEvidence {
  return {
    rfOutput: { ...cleanup.rfOutput },
    acquisition: { ...cleanup.acquisition },
    bias: { ...cleanup.bias },
    dcOutput: { ...cleanup.dcOutput },
  };
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export function advanceDiagnosticCase(
  caseId: string,
  progress: DvtDiagnosticProgress,
  evidenceId: string,
): DvtDiagnosticProgress {
  const diagnosticCase = DVT_BUILT_IN_CASES.find(({ id }) => id === caseId);
  if (!diagnosticCase) throw new RangeError(`unknown built-in DVT case: ${caseId}`);
  validateDiagnosticProgress(diagnosticCase, progress);
  if (progress.complete) return progress;

  const expectedEvidenceId = diagnosticCase.steps[progress.nextStepIndex]?.expectedEvidenceId;
  if (evidenceId !== expectedEvidenceId) return progress;
  const nextStepIndex = progress.nextStepIndex + 1;
  return {
    caseId,
    nextStepIndex,
    acceptedEvidenceIds: [...progress.acceptedEvidenceIds, evidenceId],
    accepted: true,
    complete: nextStepIndex === diagnosticCase.steps.length,
  };
}

function validateDiagnosticProgress(
  diagnosticCase: DvtDiagnosticCase,
  progress: DvtDiagnosticProgress,
): void {
  if (progress.caseId !== diagnosticCase.id) {
    throw new RangeError('diagnostic progress belongs to a different built-in case');
  }
  if (!Number.isSafeInteger(progress.nextStepIndex) || progress.nextStepIndex < 0 || (
    progress.nextStepIndex > diagnosticCase.steps.length
  )) {
    throw new RangeError('diagnostic nextStepIndex is outside the built-in case');
  }
  const expectedAcceptedIds = diagnosticCase.steps
    .slice(0, progress.nextStepIndex)
    .map(({ expectedEvidenceId }) => expectedEvidenceId);
  if (
    progress.acceptedEvidenceIds.length !== expectedAcceptedIds.length ||
    progress.acceptedEvidenceIds.some((id, index) => id !== expectedAcceptedIds[index])
  ) {
    throw new RangeError('diagnostic evidence does not match the ordered built-in case');
  }
  if (progress.complete !== (progress.nextStepIndex === diagnosticCase.steps.length)) {
    throw new RangeError('diagnostic completion state does not match the built-in case');
  }
}
