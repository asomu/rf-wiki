import type { Complex, Decibels, Degrees, PaOperatingPoint } from '../../types';
import { dbm, decibels, degrees, watts } from '../../types';
import { fromPolarDegrees, magnitude, multiply } from './complex';
import { dbmToWatts, wattsToDbm } from './units';

export interface PaModel {
  readonly smallSignalGainDb: number;
  /** Rapp asymptotic output power. */
  readonly saturationOutputPowerDbm: number;
  /** Rapp smoothness; larger values make a harder knee. */
  readonly smoothness: number;
  readonly phaseAtSaturationDegrees: number;
  readonly amPmExponent: number;
  readonly drainVoltageV: number;
  readonly quiescentCurrentA: number;
  /** Incremental RF-output/DC slope used in Pdc = Pq + Pout/ηincremental. */
  readonly incrementalDrainEfficiency: number;
  /** Negative dBc value in the small-signal region. */
  readonly baselineAclrDbc: number;
}

export const DEFAULT_EDUCATIONAL_PA: PaModel = Object.freeze({
  smallSignalGainDb: 26,
  saturationOutputPowerDbm: 31,
  smoothness: 3,
  phaseAtSaturationDegrees: -12,
  amPmExponent: 2,
  drainVoltageV: 5,
  quiescentCurrentA: 0.08,
  incrementalDrainEfficiency: 0.55,
  baselineAclrDbc: -50,
});

export interface NormalizedPaSampleResult {
  /** Ideal linear-output complex envelope, normalized to saturation amplitude = 1. */
  readonly inputSampleNormalized: Complex;
  /** Memoryless PA output complex envelope on the same normalized amplitude scale. */
  readonly outputSampleNormalized: Complex;
  readonly inputMagnitudeNormalized: number;
  readonly outputMagnitudeNormalized: number;
  readonly compressionDb: Decibels;
  readonly phaseShiftDegrees: Degrees;
}

function validatePaModel(model: PaModel): void {
  for (const [field, value] of Object.entries(model)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`PA model ${field} must be finite`);
    }
  }
  if (model.smoothness <= 0 || !Number.isFinite(model.smoothness)) {
    throw new RangeError('PA smoothness must be finite and positive');
  }
  if (model.amPmExponent <= 0 || !Number.isFinite(model.amPmExponent)) {
    throw new RangeError('AM-PM exponent must be finite and positive');
  }
  if (model.drainVoltageV <= 0 || model.quiescentCurrentA < 0) {
    throw new RangeError('Drain voltage must be positive and quiescent current non-negative');
  }
  if (
    model.incrementalDrainEfficiency <= 0 ||
    model.incrementalDrainEfficiency > 1
  ) {
    throw new RangeError('Incremental drain efficiency must lie in (0, 1]');
  }
  if (!Number.isFinite(model.baselineAclrDbc) || model.baselineAclrDbc > 0) {
    throw new RangeError('Baseline ACLR must be a finite non-positive dBc value');
  }
}

/**
 * Applies the same memoryless Rapp AM-AM and saturating AM-PM laws used by
 * evaluatePa to one ideal linear-output complex-envelope sample. A normalized
 * magnitude of 1 is the model's saturation-amplitude reference.
 */
export function transformNormalizedPaSample(
  inputSampleNormalized: Complex,
  model: PaModel = DEFAULT_EDUCATIONAL_PA,
): NormalizedPaSampleResult {
  validatePaModel(model);
  if (!Number.isFinite(inputSampleNormalized.re) || !Number.isFinite(inputSampleNormalized.im)) {
    throw new RangeError('Normalized PA sample must contain finite I and Q values');
  }

  const inputMagnitudeNormalized = magnitude(inputSampleNormalized);
  if (inputMagnitudeNormalized === 0) {
    return {
      inputSampleNormalized: { ...inputSampleNormalized },
      outputSampleNormalized: { re: 0, im: 0 },
      inputMagnitudeNormalized: 0,
      outputMagnitudeNormalized: 0,
      compressionDb: decibels(0),
      phaseShiftDegrees: degrees(0),
    };
  }

  const normalizedDrivePower = inputMagnitudeNormalized ** 2;
  const rappPowerDenominator = (
    1 + normalizedDrivePower ** model.smoothness
  ) ** (1 / model.smoothness);
  const amplitudeRatioToIdeal = 1 / Math.sqrt(rappPowerDenominator);
  const phaseWeight = normalizedDrivePower ** model.amPmExponent /
    (1 + normalizedDrivePower ** model.amPmExponent);
  const phaseShiftDegrees = model.phaseAtSaturationDegrees * phaseWeight;
  const outputSampleNormalized = multiply(
    inputSampleNormalized,
    fromPolarDegrees(amplitudeRatioToIdeal, phaseShiftDegrees),
  );

  return {
    inputSampleNormalized: { ...inputSampleNormalized },
    outputSampleNormalized,
    inputMagnitudeNormalized,
    outputMagnitudeNormalized: magnitude(outputSampleNormalized),
    compressionDb: decibels(-20 * Math.log10(amplitudeRatioToIdeal)),
    phaseShiftDegrees: degrees(phaseShiftDegrees),
  };
}

/**
 * Memoryless Rapp AM-AM plus a saturating AM-PM law. EVM and ACLR are
 * educational indicators, not a compliance waveform measurement.
 */
export function evaluatePa(
  inputPowerDbm: number,
  model: PaModel = DEFAULT_EDUCATIONAL_PA,
): PaOperatingPoint {
  validatePaModel(model);
  const inputWatts = dbmToWatts(inputPowerDbm);
  const idealOutputPowerDbm = inputPowerDbm + model.smallSignalGainDb;
  const idealOutputWatts = dbmToWatts(idealOutputPowerDbm);
  const saturationWatts = dbmToWatts(model.saturationOutputPowerDbm);
  const normalizedDrive = idealOutputWatts / saturationWatts;
  const rappDenominator = (
    1 + normalizedDrive ** model.smoothness
  ) ** (1 / model.smoothness);
  const outputWatts = idealOutputWatts / rappDenominator;
  const outputPowerDbm = wattsToDbm(outputWatts);
  const compressionDb = idealOutputPowerDbm - outputPowerDbm;
  const phaseWeight = normalizedDrive ** model.amPmExponent /
    (1 + normalizedDrive ** model.amPmExponent);
  const phaseShiftDegrees = model.phaseAtSaturationDegrees * phaseWeight;

  const quiescentPowerWatts = model.drainVoltageV * model.quiescentCurrentA;
  const dcPowerWatts = quiescentPowerWatts +
    outputWatts / model.incrementalDrainEfficiency;
  const paePercent = Math.max(0, (100 * (outputWatts - inputWatts)) / dcPowerWatts);

  const amplitudeRatioToIdeal = Math.sqrt(outputWatts / idealOutputWatts);
  const phaseRadians = (phaseShiftDegrees * Math.PI) / 180;
  const normalizedComplexGain = {
    re: amplitudeRatioToIdeal * Math.cos(phaseRadians),
    im: amplitudeRatioToIdeal * Math.sin(phaseRadians),
  };
  const evmPercent = 100 * Math.hypot(
    normalizedComplexGain.re - 1,
    normalizedComplexGain.im,
  );

  // A deterministic visual proxy: spectral regrowth worsens with compression and AM-PM.
  const aclrDbc = Math.min(
    -10,
    model.baselineAclrDbc + 5 * compressionDb + 0.15 * Math.abs(phaseShiftDegrees),
  );

  return {
    inputPowerDbm: dbm(inputPowerDbm),
    idealOutputPowerDbm: dbm(idealOutputPowerDbm),
    outputPowerDbm: dbm(outputPowerDbm),
    gainDb: decibels(outputPowerDbm - inputPowerDbm),
    compressionDb: decibels(compressionDb),
    phaseShiftDegrees: degrees(phaseShiftDegrees),
    dcPowerWatts: watts(dcPowerWatts),
    paePercent,
    evmPercent,
    aclrDbc: decibels(aclrDbc),
  };
}

export function rappOneDbCompressionPoint(
  model: PaModel = DEFAULT_EDUCATIONAL_PA,
): {
  readonly inputPowerDbm: number;
  readonly outputPowerDbm: number;
} {
  validatePaModel(model);
  const p = model.smoothness;
  const normalizedLinearOutput = (10 ** (p / 10) - 1) ** (1 / p);
  const linearAtP1Dbm = model.saturationOutputPowerDbm +
    10 * Math.log10(normalizedLinearOutput);
  return {
    inputPowerDbm: linearAtP1Dbm - model.smallSignalGainDb,
    outputPowerDbm: linearAtP1Dbm - 1,
  };
}

export function generatePaTransferCurve(
  inputStartDbm: number,
  inputStopDbm: number,
  stepDb: number,
  model: PaModel = DEFAULT_EDUCATIONAL_PA,
): PaOperatingPoint[] {
  if (!Number.isFinite(stepDb) || stepDb <= 0) {
    throw new RangeError('PA sweep step must be finite and positive');
  }
  if (inputStopDbm < inputStartDbm) {
    throw new RangeError('PA sweep stop must be greater than or equal to start');
  }

  const pointCount = Math.floor((inputStopDbm - inputStartDbm) / stepDb) + 1;
  return Array.from({ length: pointCount }, (_, index) =>
    evaluatePa(inputStartDbm + index * stepDb, model),
  );
}
