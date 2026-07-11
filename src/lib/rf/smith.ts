import type { Complex, Impedance } from '../../types';
import { impedance, ohms } from '../../types';
import {
  COMPLEX_ONE,
  add,
  complex,
  divide,
  magnitude,
  magnitudeSquared,
  multiply,
  multiplyReal,
  subtract,
} from './complex';

export interface ReflectionMetrics {
  readonly gamma: Complex;
  readonly gammaMagnitude: number;
  readonly returnLossDb: number;
  readonly vswr: number;
  /** Positive power loss caused only by mismatch. */
  readonly mismatchLossDb: number;
  readonly acceptedPowerFraction: number;
}

export interface Admittance {
  readonly conductanceSiemens: number;
  readonly susceptanceSiemens: number;
}

function assertReferenceImpedance(referenceImpedanceOhms: number): void {
  if (!Number.isFinite(referenceImpedanceOhms) || referenceImpedanceOhms <= 0) {
    throw new RangeError(
      `Reference impedance must be positive; received ${referenceImpedanceOhms} Ω`,
    );
  }
}

export function impedanceToComplex(value: Impedance): Complex {
  return {
    re: Number(value.resistanceOhms),
    im: Number(value.reactanceOhms),
  };
}

export function impedanceToReflectionCoefficient(
  value: Impedance,
  referenceImpedanceOhms = 50,
): Complex {
  assertReferenceImpedance(referenceImpedanceOhms);
  const z = impedanceToComplex(value);
  const z0 = complex(referenceImpedanceOhms);
  return divide(subtract(z, z0), add(z, z0));
}

export function reflectionCoefficientToImpedance(
  gamma: Complex,
  referenceImpedanceOhms = 50,
): Impedance {
  assertReferenceImpedance(referenceImpedanceOhms);
  if (magnitude(gamma) >= 1 && Math.abs(gamma.im) < Number.EPSILON && gamma.re === 1) {
    throw new RangeError('Γ=1 maps to infinite impedance and cannot be represented as a finite value');
  }

  const normalized = divide(add(COMPLEX_ONE, gamma), subtract(COMPLEX_ONE, gamma));
  const z = multiplyReal(normalized, referenceImpedanceOhms);
  return {
    resistanceOhms: ohms(z.re),
    reactanceOhms: ohms(z.im),
  };
}

export function impedanceToAdmittance(value: Impedance): Admittance {
  const z = impedanceToComplex(value);
  const denominator = magnitudeSquared(z);
  if (denominator === 0) {
    throw new RangeError('Zero impedance maps to infinite admittance');
  }

  return {
    conductanceSiemens: z.re / denominator,
    susceptanceSiemens: -z.im / denominator,
  };
}

export function reflectionMetricsFromGamma(gamma: Complex): ReflectionMetrics {
  const gammaMagnitude = magnitude(gamma);
  const acceptedPowerFraction = 1 - gammaMagnitude * gammaMagnitude;
  const returnLossDb = gammaMagnitude === 0
    ? Number.POSITIVE_INFINITY
    : -20 * Math.log10(gammaMagnitude);
  const vswr = gammaMagnitude >= 1
    ? Number.POSITIVE_INFINITY
    : (1 + gammaMagnitude) / (1 - gammaMagnitude);
  const mismatchLossDb = acceptedPowerFraction <= 0
    ? Number.POSITIVE_INFINITY
    : -10 * Math.log10(acceptedPowerFraction);

  return {
    gamma,
    gammaMagnitude,
    returnLossDb,
    vswr,
    mismatchLossDb,
    acceptedPowerFraction,
  };
}

export function reflectionMetrics(
  value: Impedance,
  referenceImpedanceOhms = 50,
): ReflectionMetrics {
  return reflectionMetricsFromGamma(
    impedanceToReflectionCoefficient(value, referenceImpedanceOhms),
  );
}

/**
 * Adds lossless line between the measurement plane and load. Positive one-way
 * electrical length moves the measurement plane toward the generator and,
 * under the e^(jωt) convention, rotates Γ by -2θ. Moving an existing plane
 * toward the load instead applies the opposite +2θ compensation.
 */
export function shiftReflectionReferencePlane(
  gamma: Complex,
  addedLineElectricalLengthDegrees: number,
): Complex {
  const phaseRadians = (-2 * addedLineElectricalLengthDegrees * Math.PI) / 180;
  return multiply(gamma, {
    re: Math.cos(phaseRadians),
    im: Math.sin(phaseRadians),
  });
}

export function acceptedPowerWatts(
  incidentPowerWatts: number,
  gamma: Complex,
): number {
  if (!Number.isFinite(incidentPowerWatts) || incidentPowerWatts < 0) {
    throw new RangeError(`Incident power must be non-negative; received ${incidentPowerWatts} W`);
  }

  return incidentPowerWatts * Math.max(0, 1 - magnitudeSquared(gamma));
}

/** Points on a normalized constant-resistance circle for a Smith chart. */
export function constantResistanceCircle(
  normalizedResistance: number,
  sampleCount = 181,
  maxNormalizedReactance = 20,
): Complex[] {
  if (normalizedResistance < 0 || !Number.isFinite(normalizedResistance)) {
    throw new RangeError('Normalized resistance must be finite and non-negative');
  }
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('Circle sample count must be at least two');
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const reactance = -maxNormalizedReactance +
      (2 * maxNormalizedReactance * index) / (sampleCount - 1);
    return impedanceToReflectionCoefficient(
      impedance(normalizedResistance, reactance),
      1,
    );
  });
}

/** Points on a normalized constant-reactance arc for a Smith chart. */
export function constantReactanceArc(
  normalizedReactance: number,
  sampleCount = 181,
  maxNormalizedResistance = 20,
): Complex[] {
  if (!Number.isFinite(normalizedReactance)) {
    throw new RangeError('Normalized reactance must be finite');
  }
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('Arc sample count must be at least two');
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const resistance = (maxNormalizedResistance * index) / (sampleCount - 1);
    return impedanceToReflectionCoefficient(
      impedance(resistance, normalizedReactance),
      1,
    );
  });
}
