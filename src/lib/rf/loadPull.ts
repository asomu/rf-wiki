import type {
  Complex,
  LoadPullSweep,
  PullInputPowerCondition,
  PullMetric,
  PullMetricOptima,
  PullSweepPoint,
} from '../../types';
import { dbm, decibels, ohms } from '../../types';
import { magnitude, magnitudeSquared, multiply, subtract, conjugate } from './complex';
import { reflectionCoefficientToImpedance } from './smith';
import { powerRatioToDb } from './units';

export interface PullSweepOptions {
  readonly referenceImpedanceOhms?: number;
  /** Output-power optimum. */
  readonly optimumGamma: Complex;
  readonly paeOptimumGamma?: Complex;
  readonly evmOptimumGamma?: Complex;
  readonly aclrOptimumGamma?: Complex;
  /** Input match used to distinguish source available and DUT accepted drive. */
  readonly inputMatchGamma?: Complex;
  readonly inputPowerCondition?: PullInputPowerCondition;
  readonly inputPowerDbm: number;
  readonly peakOutputPowerDbm: number;
  readonly peakPaePercent: number;
  readonly minimumEvmPercent?: number;
  readonly bestAclrDbc?: number;
  /** Multiplier on conjugate-mismatch loss for output-power contours. */
  readonly powerSensitivity?: number;
  readonly paeExponent?: number;
  /** EVM percentage points added per dB of distance from its optimum. */
  readonly evmSensitivity?: number;
  /** ACLR dB added per dB of distance from its optimum. */
  readonly aclrSensitivity?: number;
  readonly resolution?: number;
  /** Sweep radius is kept below one so every plotted impedance remains finite. */
  readonly smithRadius?: number;
  readonly isStable?: (gamma: Complex) => boolean;
}

interface NormalizedPullSweepOptions {
  readonly referenceImpedanceOhms: number;
  readonly optimumGamma: Complex;
  readonly paeOptimumGamma: Complex;
  readonly evmOptimumGamma: Complex;
  readonly aclrOptimumGamma: Complex;
  readonly inputMatchGamma: Complex;
  readonly inputPowerCondition: PullInputPowerCondition;
  readonly inputPowerDbm: number;
  readonly peakOutputPowerDbm: number;
  readonly peakPaePercent: number;
  readonly minimumEvmPercent: number;
  readonly bestAclrDbc: number;
  readonly powerSensitivity: number;
  readonly paeExponent: number;
  readonly evmSensitivity: number;
  readonly aclrSensitivity: number;
  readonly resolution: number;
  readonly smithRadius: number;
  readonly isStable?: (gamma: Complex) => boolean;
}

function validateOptions(options: PullSweepOptions): NormalizedPullSweepOptions {
  const normalized = {
    referenceImpedanceOhms: options.referenceImpedanceOhms ?? 50,
    optimumGamma: options.optimumGamma,
    paeOptimumGamma: options.paeOptimumGamma ?? options.optimumGamma,
    evmOptimumGamma: options.evmOptimumGamma ?? options.optimumGamma,
    aclrOptimumGamma: options.aclrOptimumGamma ?? options.optimumGamma,
    inputMatchGamma: options.inputMatchGamma ?? options.optimumGamma,
    inputPowerCondition: options.inputPowerCondition ?? 'constant-accepted',
    inputPowerDbm: options.inputPowerDbm,
    peakOutputPowerDbm: options.peakOutputPowerDbm,
    peakPaePercent: options.peakPaePercent,
    minimumEvmPercent: options.minimumEvmPercent ?? 2,
    bestAclrDbc: options.bestAclrDbc ?? -50,
    powerSensitivity: options.powerSensitivity ?? 1,
    paeExponent: options.paeExponent ?? 0.6,
    evmSensitivity: options.evmSensitivity ?? 0.45,
    aclrSensitivity: options.aclrSensitivity ?? 0.8,
    resolution: options.resolution ?? 31,
    smithRadius: options.smithRadius ?? 0.95,
    ...(options.isStable === undefined ? {} : { isStable: options.isStable }),
  };

  const gammaEntries = [
    ['output-power', normalized.optimumGamma],
    ['PAE', normalized.paeOptimumGamma],
    ['EVM', normalized.evmOptimumGamma],
    ['ACLR', normalized.aclrOptimumGamma],
    ['input-match', normalized.inputMatchGamma],
  ] as const;
  for (const [label, gamma] of gammaEntries) {
    if (magnitude(gamma) >= 1) {
      throw new RangeError(`${label} optimum reflection coefficient must lie inside the Smith chart`);
    }
  }
  if (
    !Number.isSafeInteger(normalized.resolution) ||
    normalized.resolution < 5 ||
    normalized.resolution > 201
  ) {
    throw new RangeError('Pull resolution must be an integer from 5 through 201');
  }
  if (normalized.smithRadius <= 0 || normalized.smithRadius >= 1) {
    throw new RangeError('Smith sweep radius must lie in (0, 1)');
  }
  if (normalized.referenceImpedanceOhms <= 0) {
    throw new RangeError('Reference impedance must be positive');
  }
  if (normalized.peakPaePercent < 0 || normalized.peakPaePercent > 100) {
    throw new RangeError('Peak PAE must lie in [0, 100] percent');
  }
  if (!Number.isFinite(normalized.minimumEvmPercent) || normalized.minimumEvmPercent < 0) {
    throw new RangeError('Minimum EVM must be finite and non-negative');
  }
  if (!Number.isFinite(normalized.bestAclrDbc) || normalized.bestAclrDbc > 0) {
    throw new RangeError('Best ACLR must be a finite non-positive dBc value');
  }
  if (
    normalized.powerSensitivity <= 0 ||
    normalized.paeExponent <= 0 ||
    normalized.evmSensitivity <= 0 ||
    normalized.aclrSensitivity <= 0
  ) {
    throw new RangeError('Pull sensitivities and PAE exponent must be positive');
  }

  return normalized;
}

/**
 * Smooth passive mismatch kernel on the unit disk. It is 1 at the requested
 * optimum and decreases with the bilinear Smith-chart distance. It shapes an
 * educational contour; it is not a substitute for measured large-signal data.
 */
export function conjugateMismatchFactor(gamma: Complex, optimumGamma: Complex): number {
  const numerator = (1 - magnitudeSquared(gamma)) *
    (1 - magnitudeSquared(optimumGamma));
  const denominator = magnitudeSquared(
    subtract({ re: 1, im: 0 }, multiply(conjugate(optimumGamma), gamma)),
  );
  if (denominator === 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

function pullPoint(
  gamma: Complex,
  options: NormalizedPullSweepOptions,
  kind: LoadPullSweep['kind'],
): PullSweepPoint {
  const boundedMatch = (optimumGamma: Complex) => Math.max(
    conjugateMismatchFactor(gamma, optimumGamma),
    1e-15,
  );
  const powerMismatchDb = powerRatioToDb(boundedMatch(options.optimumGamma));
  const paeMatch = boundedMatch(options.paeOptimumGamma);
  const evmDistanceDb = -powerRatioToDb(boundedMatch(options.evmOptimumGamma));
  const aclrDistanceDb = -powerRatioToDb(boundedMatch(options.aclrOptimumGamma));
  const inputMatchDb = powerRatioToDb(boundedMatch(options.inputMatchGamma));

  let availableInputPowerDbm = options.inputPowerDbm;
  let acceptedInputPowerDbm = options.inputPowerDbm;
  if (kind === 'source') {
    if (options.inputPowerCondition === 'constant-available') {
      acceptedInputPowerDbm += inputMatchDb;
    } else {
      availableInputPowerDbm -= inputMatchDb;
    }
  }

  const sourceDriveDeltaDb = kind === 'source' &&
    options.inputPowerCondition === 'constant-available'
    ? acceptedInputPowerDbm - options.inputPowerDbm
    : 0;
  const outputPowerDbm = options.peakOutputPowerDbm +
    options.powerSensitivity * powerMismatchDb +
    0.5 * sourceDriveDeltaDb;
  const gainReferenceDbm = options.inputPowerCondition === 'constant-available'
    ? availableInputPowerDbm
    : acceptedInputPowerDbm;

  return {
    gamma,
    impedance: reflectionCoefficientToImpedance(gamma, options.referenceImpedanceOhms),
    availableInputPowerDbm: dbm(availableInputPowerDbm),
    acceptedInputPowerDbm: dbm(acceptedInputPowerDbm),
    outputPowerDbm: dbm(outputPowerDbm),
    gainDb: decibels(outputPowerDbm - gainReferenceDbm),
    paePercent: options.peakPaePercent * paeMatch ** options.paeExponent,
    evmPercent: options.minimumEvmPercent + options.evmSensitivity * evmDistanceDb,
    aclrDbc: decibels(options.bestAclrDbc + options.aclrSensitivity * aclrDistanceDb),
    stable: options.isStable?.(gamma) ?? true,
  };
}

function generatePullSweep(
  kind: LoadPullSweep['kind'],
  rawOptions: PullSweepOptions,
): LoadPullSweep {
  const options = validateOptions(rawOptions);
  const metricOptima: PullMetricOptima = {
    outputPowerDbm: options.optimumGamma,
    gainDb: options.optimumGamma,
    paePercent: options.paeOptimumGamma,
    evmPercent: options.evmOptimumGamma,
    aclrDbc: options.aclrOptimumGamma,
  };
  const points: PullSweepPoint[] = [];
  const step = (2 * options.smithRadius) / (options.resolution - 1);

  for (let yIndex = 0; yIndex < options.resolution; yIndex += 1) {
    const im = -options.smithRadius + yIndex * step;
    for (let xIndex = 0; xIndex < options.resolution; xIndex += 1) {
      const re = -options.smithRadius + xIndex * step;
      const gamma = { re, im };
      if (magnitude(gamma) <= options.smithRadius + 1e-12) {
        points.push(pullPoint(gamma, options, kind));
      }
    }
  }

  // Every exact metric optimum is included even when it falls between grid points.
  for (const optimum of Object.values(metricOptima)) {
    if (!points.some((point) => magnitude(subtract(point.gamma, optimum)) < 1e-12)) {
      points.push(pullPoint(optimum, options, kind));
    }
  }

  return {
    kind,
    referenceImpedanceOhms: ohms(options.referenceImpedanceOhms),
    optimumGamma: options.optimumGamma,
    metricOptima,
    inputPowerCondition: options.inputPowerCondition,
    points,
    resolution: options.resolution,
  };
}

export function generateLoadPullSweep(options: PullSweepOptions): LoadPullSweep {
  return generatePullSweep('load', options);
}

export function generateSourcePullSweep(options: PullSweepOptions): LoadPullSweep {
  return generatePullSweep('source', options);
}

export function nearestPullPoint(
  sweep: LoadPullSweep,
  gamma: Complex,
): PullSweepPoint {
  const first = sweep.points[0];
  if (first === undefined) throw new RangeError('Pull sweep contains no points');

  return sweep.points.reduce((nearest, point) =>
    magnitudeSquared(subtract(point.gamma, gamma)) <
    magnitudeSquared(subtract(nearest.gamma, gamma))
      ? point
      : nearest,
  first);
}

export function bestPullPoint(
  sweep: LoadPullSweep,
  metric: PullMetric,
): PullSweepPoint {
  const stablePoints = sweep.points.filter((point) => point.stable);
  const first = stablePoints[0];
  if (first === undefined) throw new RangeError('Pull sweep has no stable point');

  const lowerIsBetter = metric === 'evmPercent' || metric === 'aclrDbc';
  return stablePoints.reduce((best, point) => {
    const candidate = Number(point[metric]);
    const current = Number(best[metric]);
    return lowerIsBetter ? (candidate < current ? point : best) : (candidate > current ? point : best);
  }, first);
}

/** Returns data points near a requested contour level for SVG interpolation. */
export function pullContourBand(
  sweep: LoadPullSweep,
  metric: PullMetric,
  target: number,
  tolerance: number,
): PullSweepPoint[] {
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new RangeError('Contour tolerance must be finite and positive');
  }

  return sweep.points.filter(
    (point) => Math.abs(Number(point[metric]) - target) <= tolerance,
  );
}
