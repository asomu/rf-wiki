import type {
  InstrumentProfile,
  IqWaveformAsset,
  MxgSession,
  MxgState,
  MxgWaveformRecord,
  PaPowerBudgetInput,
  PaSafetyDecision,
  PaSafetyEnvelope,
  PendingOperation,
} from '@/types/instruments';
import type { Hertz } from '@/types/units';
import { dbm, decibels, hertz } from '@/types/units';
import {
  n5182bProgrammingReference,
  n5182bScpiReference,
  n5182bWaveformReference,
} from './catalog';
import {
  calculateIqWaveformMetrics,
  encodeN5182bIqWaveform,
  n5182bBuiltInWaveforms,
  normalizeN5182bWaveformMemoryPath,
} from './waveform';

export const N5182B_ERROR_QUEUE_CAPACITY = 30;
/** Thirty queued errors plus one final query that must return code +0. */
export const N5182B_ERROR_DRAIN_MAX_QUERIES = N5182B_ERROR_QUEUE_CAPACITY + 1;
export const N5182B_FREQUENCY_MIN_HZ = 9_000;
/** Family maximum; a configured session derives its limit from option 501, 503, or 506. */
export const N5182B_FREQUENCY_MAX_HZ = 6_000_000_000;
/** Family-wide educational envelope. The instrument's leveled maximum depends on frequency and options. */
export const N5182B_POWER_MIN_DBM = -144;
export const N5182B_POWER_MAX_DBM = 27;

export const n5182bProfile: InstrumentProfile = Object.freeze({
  id: 'keysight-n5182b',
  kind: 'signal-generator',
  vendor: 'Keysight Technologies',
  family: 'MXG X-Series',
  model: 'N5182B',
  firmwareScope: 'SCPI language; examples target B.01.96-era X-Series documentation',
  supportedOptions: ['501', '503', '506', '656', '657'],
  references: Object.freeze([
    n5182bScpiReference,
    n5182bProgrammingReference,
    n5182bWaveformReference,
  ]),
});

export const defaultPaSafetyEnvelope: PaSafetyEnvelope = Object.freeze({
  dutMaxInputDbm: dbm(-10),
  sourceToDutGainDb: decibels(0),
  pathUncertaintyDb: decibels(1),
  guardMarginDb: decibels(3),
  maximumDutyCyclePercent: 100,
  requireRfOffForStimulusChange: true,
});

const frequencyOptionLimitsHz = Object.freeze({
  '501': 1_000_000_000,
  '503': 3_000_000_000,
  '506': 6_000_000_000,
} satisfies Readonly<Record<string, number>>);

export function getN5182bFrequencyMaxHz(
  installedOptions: readonly string[],
): Hertz | null {
  const limits = installedOptions
    .map((option) => frequencyOptionLimitsHz[option as keyof typeof frequencyOptionLimitsHz])
    .filter((limit): limit is number => limit !== undefined);
  return limits.length > 0 ? hertz(Math.max(...limits)) : null;
}

export function getN5182bArbSampleRateMaxHz(
  installedOptions: readonly string[],
): Hertz | null {
  if (!installedOptions.includes('656')) return null;
  return hertz(installedOptions.includes('657') ? 200_000_000 : 100_000_000);
}

function assertN5182bOptionDependencies(installedOptions: readonly string[]): void {
  if (installedOptions.includes('657') && !installedOptions.includes('656')) {
    throw new RangeError('N5182B option 657 requires baseband generator option 656.');
  }
}

export function toWaveformRecord(
  waveform: IqWaveformAsset,
  memoryPath = `WFM1:${waveform.id.toUpperCase().replace(/[^A-Z0-9_.-]/g, '_')}`,
): MxgWaveformRecord {
  const metrics = calculateIqWaveformMetrics(waveform);
  const normalizedMemoryPath = normalizeN5182bWaveformMemoryPath(memoryPath);
  return {
    id: waveform.id,
    memoryPath: normalizedMemoryPath,
    sampleCount: metrics.sampleCount,
    sampleRateHz: metrics.sampleRateHz,
    durationSeconds: metrics.durationSeconds,
    peakEnvelope: metrics.peakEnvelope,
    rmsEnvelope: metrics.rmsEnvelope,
    crestFactorDb: metrics.crestFactorDb,
    byteLength: encodeN5182bIqWaveform(waveform).payload.byteLength,
  };
}

export const n5182bBuiltInWaveformRecords: readonly MxgWaveformRecord[] = Object.freeze(
  n5182bBuiltInWaveforms.map((waveform) => Object.freeze(toWaveformRecord(waveform))),
);

export function createN5182bResetState(
  waveformMemory: readonly MxgWaveformRecord[] = n5182bBuiltInWaveformRecords,
  installedOptions: readonly string[] = ['506', '656'],
): MxgState {
  return {
    frequencyHz: hertz(1_000_000_000),
    powerDbm: dbm(-135),
    rfOutputEnabled: false,
    modulationEnabled: true,
    arbEnabled: false,
    selectedWaveformPath: null,
    arbSampleClockRateHz: getN5182bArbSampleRateMaxHz(installedOptions) ?? hertz(0),
    arbRuntimeScalingPercent: 70,
    arbTriggerSource: 'EXT',
    plannedDutyCyclePercent: 100,
    waveformMemory,
  };
}

export function evaluatePaSafety(
  state: MxgState,
  envelope: PaSafetyEnvelope,
): PaSafetyDecision {
  if (envelope.maximumDutyCyclePercent < 0 || envelope.maximumDutyCyclePercent > 100) {
    throw new RangeError('PA safety maximum duty cycle must be between 0 and 100 percent.');
  }
  if (state.plannedDutyCyclePercent < 0 || state.plannedDutyCyclePercent > 100) {
    throw new RangeError('Planned duty cycle must be between 0 and 100 percent.');
  }

  const selectedWaveform = state.arbEnabled
    && state.modulationEnabled
    && state.selectedWaveformPath !== null
    ? state.waveformMemory.find(
      (record) => record.memoryPath.toUpperCase() === state.selectedWaveformPath?.toUpperCase(),
    )
    : undefined;
  const waveformCrestFactor = Math.max(0, selectedWaveform?.crestFactorDb ?? 0);
  const budget = evaluatePaPowerBudget({
    sourceAveragePowerDbm: state.powerDbm,
    waveformCrestFactorDb: decibels(waveformCrestFactor),
    envelope,
  });
  const reasons = [...budget.reasons];
  if (state.arbEnabled && state.selectedWaveformPath === null) {
    reasons.push('ARB playback is enabled without a selected waveform.');
  }
  if (state.plannedDutyCyclePercent > envelope.maximumDutyCyclePercent) {
    reasons.push(
      `Planned duty cycle ${state.plannedDutyCyclePercent.toFixed(1)}% exceeds the safety limit ${envelope.maximumDutyCyclePercent.toFixed(1)}%.`,
    );
  }

  return {
    ...budget,
    allowed: reasons.length === 0,
    reasons,
  };
}

/**
 * Computes the PA input power budget without mixing a policy guard into the
 * physical DUT-plane estimate. The guard only reduces the permitted limit.
 */
export function evaluatePaPowerBudget({
  sourceAveragePowerDbm,
  waveformCrestFactorDb,
  envelope,
}: PaPowerBudgetInput): PaSafetyDecision {
  if (envelope.pathUncertaintyDb < 0) {
    throw new RangeError('PA safety path uncertainty must be zero or greater.');
  }
  if (envelope.guardMarginDb < 0) {
    throw new RangeError('PA safety guard margin must be zero or greater.');
  }
  if (waveformCrestFactorDb < 0) {
    throw new RangeError('Waveform crest factor must be zero or greater.');
  }

  const estimatedDutAverage = sourceAveragePowerDbm + envelope.sourceToDutGainDb;
  const estimatedDutInput = estimatedDutAverage
    + envelope.pathUncertaintyDb
    + waveformCrestFactorDb;
  const permittedDutInput = envelope.dutMaxInputDbm - envelope.guardMarginDb;
  const headroom = permittedDutInput - estimatedDutInput;
  const reasons = headroom < 0
    ? [
      `Estimated DUT input ${estimatedDutInput.toFixed(2)} dBm exceeds the guarded limit ${permittedDutInput.toFixed(2)} dBm.`,
    ]
    : [];

  return {
    allowed: reasons.length === 0,
    estimatedDutInputDbm: dbm(estimatedDutInput),
    estimatedDutAverageDbm: dbm(estimatedDutAverage),
    waveformCrestFactorDb: decibels(waveformCrestFactorDb),
    permittedDutInputDbm: dbm(permittedDutInput),
    headroomDb: decibels(headroom),
    reasons,
  };
}

export interface CreateN5182bSessionOptions {
  readonly installedOptions?: readonly string[];
  readonly safetyEnvelope?: PaSafetyEnvelope | null;
  readonly waveformMemory?: readonly MxgWaveformRecord[];
}

export function createN5182bSession(options: CreateN5182bSessionOptions = {}): MxgSession {
  const waveformMemory = options.waveformMemory ?? n5182bBuiltInWaveformRecords;
  const installedOptions = options.installedOptions ?? ['506', '656'];
  assertN5182bOptionDependencies(installedOptions);
  return {
    profile: n5182bProfile,
    installedOptions: Object.freeze([...installedOptions]),
    instrumentState: createN5182bResetState(waveformMemory, installedOptions),
    outputQueue: [],
    errorQueue: [],
    pendingOperations: [],
    transcript: [],
    safetyEnvelope: options.safetyEnvelope === undefined
      ? defaultPaSafetyEnvelope
      : options.safetyEnvelope,
  };
}

export function installN5182bWaveform(
  session: MxgSession,
  waveform: IqWaveformAsset,
  memoryPath?: string,
): MxgSession {
  const record = toWaveformRecord(waveform, memoryPath);
  const remaining = session.instrumentState.waveformMemory.filter(
    (candidate) => candidate.memoryPath.toUpperCase() !== record.memoryPath.toUpperCase(),
  );
  const operation: PendingOperation = {
    id: session.transcript.length + session.pendingOperations.length + 1,
    kind: 'waveform-upload',
    description: `Upload ${record.memoryPath} (${record.byteLength} bytes) to volatile waveform memory.`,
  };
  return {
    ...session,
    instrumentState: {
      ...session.instrumentState,
      waveformMemory: [...remaining, record],
    },
    pendingOperations: [...session.pendingOperations, operation],
  };
}
