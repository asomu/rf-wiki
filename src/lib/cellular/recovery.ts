import type { Complex } from '../../types';
import {
  add,
  divide,
  fromPolarDegrees,
  magnitude,
  multiply,
  subtract,
} from '../rf/complex';

export type QpskDibit = '00' | '01' | '11' | '10';

export interface QpskRecoverySettings {
  readonly transmittedDibit: QpskDibit;
  /** Linear voltage ratio of the common channel coefficient. */
  readonly channelMagnitude: number;
  readonly channelPhaseDegrees: number;
  readonly residualFrequencyOffsetHz: number;
  /** Dimensionless complex noise-vector magnitude relative to a unit-power symbol. */
  readonly noiseVectorMagnitude: number;
  readonly observationTimeMilliseconds: number;
}

export interface QpskRecoveryResult {
  readonly transmittedDibit: QpskDibit;
  readonly decidedDibit: QpskDibit;
  readonly transmittedSymbol: Complex;
  readonly channelCoefficient: Complex;
  readonly measuredSymbol: Complex;
  readonly equalizedSymbol: Complex;
  readonly phaseDriftDegrees: number;
  readonly rawEvmPercent: number;
  readonly equalizedEvmPercent: number;
  readonly bitErrorCount: number;
}

const QPSK_NORMALIZATION = Math.SQRT1_2;

const QPSK_POINTS: Readonly<Record<QpskDibit, Complex>> = Object.freeze({
  '00': Object.freeze({ re: QPSK_NORMALIZATION, im: QPSK_NORMALIZATION }),
  '01': Object.freeze({ re: -QPSK_NORMALIZATION, im: QPSK_NORMALIZATION }),
  '11': Object.freeze({ re: -QPSK_NORMALIZATION, im: -QPSK_NORMALIZATION }),
  '10': Object.freeze({ re: QPSK_NORMALIZATION, im: -QPSK_NORMALIZATION }),
});

export const QPSK_DIBITS = Object.freeze(Object.keys(QPSK_POINTS) as QpskDibit[]);

export function educationalQpskPoint(dibit: QpskDibit): Complex {
  return QPSK_POINTS[dibit];
}

export function hardDecisionQpsk(value: Complex): QpskDibit {
  if (!Number.isFinite(value.re) || !Number.isFinite(value.im)) {
    throw new RangeError('QPSK decision input must contain finite I and Q values');
  }
  if (value.re >= 0 && value.im >= 0) return '00';
  if (value.re < 0 && value.im >= 0) return '01';
  if (value.re < 0 && value.im < 0) return '11';
  return '10';
}

function evmPercent(measured: Complex, reference: Complex): number {
  return (100 * magnitude(subtract(measured, reference))) / magnitude(reference);
}

function validateSettings(settings: QpskRecoverySettings): void {
  if (!QPSK_DIBITS.includes(settings.transmittedDibit)) {
    throw new RangeError(`Unsupported QPSK dibit ${String(settings.transmittedDibit)}`);
  }
  if (!Number.isFinite(settings.channelMagnitude) || settings.channelMagnitude <= 0) {
    throw new RangeError('Channel magnitude must be finite and positive');
  }
  if (!Number.isFinite(settings.channelPhaseDegrees)) {
    throw new RangeError('Channel phase must be finite');
  }
  if (!Number.isFinite(settings.residualFrequencyOffsetHz)) {
    throw new RangeError('Residual frequency offset must be finite');
  }
  if (!Number.isFinite(settings.noiseVectorMagnitude) || settings.noiseVectorMagnitude < 0) {
    throw new RangeError('Noise-vector magnitude must be finite and non-negative');
  }
  if (!Number.isFinite(settings.observationTimeMilliseconds) || settings.observationTimeMilliseconds < 0) {
    throw new RangeError('Observation time must be finite and non-negative');
  }
}

/**
 * Deterministic educational QPSK receiver model.
 *
 * A known common linear channel coefficient is removed exactly, as if an
 * idealized DM-RS estimate were available at t=0. Residual frequency offset
 * and a fixed-direction noise vector remain. This is intentionally not a
 * 3GPP reference receiver, decoder, or compliance waveform.
 */
export function simulateQpskRecovery(settings: QpskRecoverySettings): QpskRecoveryResult {
  validateSettings(settings);
  const transmittedSymbol = educationalQpskPoint(settings.transmittedDibit);
  const channelCoefficient = fromPolarDegrees(
    settings.channelMagnitude,
    settings.channelPhaseDegrees,
  );
  const phaseDriftDegrees = 360
    * settings.residualFrequencyOffsetHz
    * settings.observationTimeMilliseconds
    / 1_000;
  const residualRotation = fromPolarDegrees(1, phaseDriftDegrees);
  const noiselessMeasured = multiply(
    multiply(transmittedSymbol, channelCoefficient),
    residualRotation,
  );
  const deterministicNoise = fromPolarDegrees(settings.noiseVectorMagnitude, -32);
  const measuredSymbol = add(noiselessMeasured, deterministicNoise);
  const equalizedSymbol = divide(measuredSymbol, channelCoefficient);
  const decidedDibit = hardDecisionQpsk(equalizedSymbol);
  const bitErrorCount = [...settings.transmittedDibit].reduce(
    (errors, bit, index) => errors + (bit === decidedDibit[index] ? 0 : 1),
    0,
  );

  return {
    transmittedDibit: settings.transmittedDibit,
    decidedDibit,
    transmittedSymbol,
    channelCoefficient,
    measuredSymbol,
    equalizedSymbol,
    phaseDriftDegrees,
    rawEvmPercent: evmPercent(measuredSymbol, transmittedSymbol),
    equalizedEvmPercent: evmPercent(equalizedSymbol, transmittedSymbol),
    bitErrorCount,
  };
}

export interface ResidualPhasePoint {
  readonly timeMilliseconds: number;
  readonly phaseDegrees: number;
}

export function createResidualPhaseTrace(
  residualFrequencyOffsetHz: number,
  durationMilliseconds: number,
  pointCount = 41,
): readonly ResidualPhasePoint[] {
  if (!Number.isFinite(residualFrequencyOffsetHz)) {
    throw new RangeError('Residual frequency offset must be finite');
  }
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
    throw new RangeError('Trace duration must be finite and positive');
  }
  if (!Number.isSafeInteger(pointCount) || pointCount < 2) {
    throw new RangeError('Phase trace requires at least two points');
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const timeMilliseconds = durationMilliseconds * index / (pointCount - 1);
    return {
      timeMilliseconds,
      phaseDegrees: 360 * residualFrequencyOffsetHz * timeMilliseconds / 1_000,
    };
  });
}
