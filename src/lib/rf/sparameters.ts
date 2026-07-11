import type { Complex, PowerWaveState, SParameterNetwork } from '../../types';
import { decibels, ohms, watts } from '../../types';
import {
  COMPLEX_ONE,
  add,
  conjugate,
  divide,
  magnitude,
  magnitudeSquared,
  multiply,
  multiplyReal,
  subtract,
} from './complex';
import { powerRatioToDb, voltageRatioToDb } from './units';

export interface TwoPortScatteredWaves {
  readonly reflectedPort1: Complex;
  readonly reflectedPort2: Complex;
}

export interface NetworkMetrics {
  readonly inputReturnLossDb: number;
  readonly outputReturnLossDb: number;
  readonly forwardGainDb: number;
  readonly passiveInsertionLossDb: number;
  readonly reverseIsolationDb: number;
}

export interface StabilityMetrics {
  readonly determinant: Complex;
  readonly rollettK: number;
  readonly mu: number;
  readonly muPrime: number;
  readonly unconditionallyStable: boolean;
}

export interface StabilityCircle {
  readonly center: Complex;
  readonly radius: number;
  readonly plane: 'source' | 'load';
}

export interface TerminatedStability {
  /** Reflection looking into the opposite port after applying the termination. */
  readonly effectiveReflectionCoefficient: Complex;
  readonly stable: boolean;
  readonly plane: 'source' | 'load';
}

export function createSParameterNetwork(
  s11: Complex,
  s12: Complex,
  s21: Complex,
  s22: Complex,
  referenceImpedanceOhms = 50,
): SParameterNetwork {
  if (!Number.isFinite(referenceImpedanceOhms) || referenceImpedanceOhms <= 0) {
    throw new RangeError('Reference impedance must be finite and positive');
  }

  return {
    s11,
    s12,
    s21,
    s22,
    referenceImpedanceOhms: ohms(referenceImpedanceOhms),
  };
}

export function scatterTwoPort(
  network: SParameterNetwork,
  incidentPort1: Complex,
  incidentPort2: Complex,
): TwoPortScatteredWaves {
  return {
    reflectedPort1: add(
      multiply(network.s11, incidentPort1),
      multiply(network.s12, incidentPort2),
    ),
    reflectedPort2: add(
      multiply(network.s21, incidentPort1),
      multiply(network.s22, incidentPort2),
    ),
  };
}

/** Power-wave state using RMS V/I and a real positive reference impedance. */
export function powerWaveState(incident: Complex, reflected: Complex): PowerWaveState {
  const incidentPower = magnitudeSquared(incident);
  const reflectedPower = magnitudeSquared(reflected);
  return {
    incident,
    reflected,
    incidentPowerWatts: watts(incidentPower),
    reflectedPowerWatts: watts(reflectedPower),
    acceptedPowerWatts: watts(incidentPower - reflectedPower),
  };
}

export function powerWavesFromVoltageCurrent(
  voltageRms: Complex,
  currentRms: Complex,
  referenceImpedanceOhms = 50,
): PowerWaveState {
  if (!Number.isFinite(referenceImpedanceOhms) || referenceImpedanceOhms <= 0) {
    throw new RangeError('Reference impedance must be finite and positive');
  }

  const denominator = 2 * Math.sqrt(referenceImpedanceOhms);
  const z0Current = multiplyReal(currentRms, referenceImpedanceOhms);
  const incident = multiplyReal(add(voltageRms, z0Current), 1 / denominator);
  const reflected = multiplyReal(subtract(voltageRms, z0Current), 1 / denominator);
  return powerWaveState(incident, reflected);
}

export function voltageCurrentFromPowerWaves(
  incident: Complex,
  reflected: Complex,
  referenceImpedanceOhms = 50,
): { readonly voltageRms: Complex; readonly currentRms: Complex } {
  if (!Number.isFinite(referenceImpedanceOhms) || referenceImpedanceOhms <= 0) {
    throw new RangeError('Reference impedance must be finite and positive');
  }

  const squareRootZ0 = Math.sqrt(referenceImpedanceOhms);
  return {
    voltageRms: multiplyReal(add(incident, reflected), squareRootZ0),
    currentRms: multiplyReal(
      subtract(incident, reflected),
      1 / squareRootZ0,
    ),
  };
}

export function sParameterDeterminant(network: SParameterNetwork): Complex {
  return subtract(
    multiply(network.s11, network.s22),
    multiply(network.s12, network.s21),
  );
}

export function networkMetrics(network: SParameterNetwork): NetworkMetrics {
  const s21Magnitude = magnitude(network.s21);
  return {
    inputReturnLossDb: -voltageRatioToDb(magnitude(network.s11)),
    outputReturnLossDb: -voltageRatioToDb(magnitude(network.s22)),
    forwardGainDb: voltageRatioToDb(s21Magnitude),
    // This label is meaningful for a passive network; active devices should use forwardGainDb.
    passiveInsertionLossDb: -voltageRatioToDb(s21Magnitude),
    reverseIsolationDb: -voltageRatioToDb(magnitude(network.s12)),
  };
}

export function inputReflectionCoefficient(
  network: SParameterNetwork,
  loadGamma: Complex,
): Complex {
  const feedback = divide(
    multiply(multiply(network.s12, network.s21), loadGamma),
    subtract(COMPLEX_ONE, multiply(network.s22, loadGamma)),
  );
  return add(network.s11, feedback);
}

export function outputReflectionCoefficient(
  network: SParameterNetwork,
  sourceGamma: Complex,
): Complex {
  const feedback = divide(
    multiply(multiply(network.s12, network.s21), sourceGamma),
    subtract(COMPLEX_ONE, multiply(network.s11, sourceGamma)),
  );
  return add(network.s22, feedback);
}

/**
 * Classify one passive source/load termination without guessing which side of
 * a stability circle is stable. A load ΓL is safe when |Γin(ΓL)|<1; a source
 * ΓS is safe when |Γout(ΓS)|<1.
 */
export function terminatedStability(
  network: SParameterNetwork,
  terminationGamma: Complex,
  plane: 'source' | 'load',
): TerminatedStability {
  const effectiveReflectionCoefficient = plane === 'load'
    ? inputReflectionCoefficient(network, terminationGamma)
    : outputReflectionCoefficient(network, terminationGamma);

  return {
    effectiveReflectionCoefficient,
    stable: magnitude(effectiveReflectionCoefficient) < 1,
    plane,
  };
}

export function transducerGainLinear(
  network: SParameterNetwork,
  sourceGamma: Complex,
  loadGamma: Complex,
): number {
  const sourceAcceptance = 1 - magnitudeSquared(sourceGamma);
  const loadAcceptance = 1 - magnitudeSquared(loadGamma);
  if (sourceAcceptance < 0 || loadAcceptance < 0) return Number.NaN;

  const determinantTerm = subtract(
    multiply(
      subtract(COMPLEX_ONE, multiply(network.s11, sourceGamma)),
      subtract(COMPLEX_ONE, multiply(network.s22, loadGamma)),
    ),
    multiply(multiply(multiply(network.s12, network.s21), sourceGamma), loadGamma),
  );

  return (
    magnitudeSquared(network.s21) * sourceAcceptance * loadAcceptance
  ) / magnitudeSquared(determinantTerm);
}

export function transducerGainDb(
  network: SParameterNetwork,
  sourceGamma: Complex,
  loadGamma: Complex,
): number {
  return powerRatioToDb(transducerGainLinear(network, sourceGamma, loadGamma));
}

/**
 * Delivered load power from available source power by the transducer-gain
 * definition. This keeps available, incident, accepted, and delivered power
 * from being used as interchangeable labels.
 */
export function deliveredLoadPowerWatts(
  availableSourcePowerWatts: number,
  network: SParameterNetwork,
  sourceGamma: Complex,
  loadGamma: Complex,
): number {
  if (!Number.isFinite(availableSourcePowerWatts) || availableSourcePowerWatts < 0) {
    throw new RangeError('Available source power must be finite and non-negative');
  }

  return availableSourcePowerWatts *
    transducerGainLinear(network, sourceGamma, loadGamma);
}

export function operatingGainLinear(
  network: SParameterNetwork,
  loadGamma: Complex,
): number {
  const delta = sParameterDeterminant(network);
  const numerator = magnitudeSquared(network.s21) * (1 - magnitudeSquared(loadGamma));
  const denominator =
    magnitudeSquared(subtract(COMPLEX_ONE, multiply(network.s22, loadGamma))) -
    magnitudeSquared(subtract(network.s11, multiply(delta, loadGamma)));
  return numerator / denominator;
}

export function availableGainLinear(
  network: SParameterNetwork,
  sourceGamma: Complex,
): number {
  const delta = sParameterDeterminant(network);
  const numerator = magnitudeSquared(network.s21) * (1 - magnitudeSquared(sourceGamma));
  const denominator =
    magnitudeSquared(subtract(COMPLEX_ONE, multiply(network.s11, sourceGamma))) -
    magnitudeSquared(subtract(network.s22, multiply(delta, sourceGamma)));
  return numerator / denominator;
}

export function stabilityMetrics(network: SParameterNetwork): StabilityMetrics {
  const determinant = sParameterDeterminant(network);
  const s12s21Magnitude = magnitude(multiply(network.s12, network.s21));
  const rollettDenominator = 2 * s12s21Magnitude;
  const rollettK = rollettDenominator === 0
    ? Number.POSITIVE_INFINITY
    : (
      1 - magnitudeSquared(network.s11) - magnitudeSquared(network.s22) +
      magnitudeSquared(determinant)
    ) / rollettDenominator;

  const muDenominator = magnitude(
    subtract(network.s22, multiply(determinant, conjugate(network.s11))),
  ) + s12s21Magnitude;
  const muPrimeDenominator = magnitude(
    subtract(network.s11, multiply(determinant, conjugate(network.s22))),
  ) + s12s21Magnitude;
  const mu = (1 - magnitudeSquared(network.s11)) / muDenominator;
  const muPrime = (1 - magnitudeSquared(network.s22)) / muPrimeDenominator;

  return {
    determinant,
    rollettK,
    mu,
    muPrime,
    unconditionallyStable:
      rollettK > 1 && magnitude(determinant) < 1 && mu > 1 && muPrime > 1,
  };
}

export function sourceStabilityCircle(network: SParameterNetwork): StabilityCircle | null {
  const delta = sParameterDeterminant(network);
  const denominator = magnitudeSquared(network.s11) - magnitudeSquared(delta);
  if (Math.abs(denominator) < Number.EPSILON) return null;

  const center = divide(
    conjugate(subtract(network.s11, multiply(delta, conjugate(network.s22)))),
    { re: denominator, im: 0 },
  );
  return {
    center,
    radius: magnitude(multiply(network.s12, network.s21)) / Math.abs(denominator),
    plane: 'source',
  };
}

export function loadStabilityCircle(network: SParameterNetwork): StabilityCircle | null {
  const delta = sParameterDeterminant(network);
  const denominator = magnitudeSquared(network.s22) - magnitudeSquared(delta);
  if (Math.abs(denominator) < Number.EPSILON) return null;

  const center = divide(
    conjugate(subtract(network.s22, multiply(delta, conjugate(network.s11)))),
    { re: denominator, im: 0 },
  );
  return {
    center,
    radius: magnitude(multiply(network.s12, network.s21)) / Math.abs(denominator),
    plane: 'load',
  };
}

export function gainSummary(
  network: SParameterNetwork,
  sourceGamma: Complex,
  loadGamma: Complex,
): {
  readonly transducerGainDb: ReturnType<typeof decibels>;
  readonly operatingGainDb: ReturnType<typeof decibels>;
  readonly availableGainDb: ReturnType<typeof decibels>;
} {
  return {
    transducerGainDb: decibels(transducerGainDb(network, sourceGamma, loadGamma)),
    operatingGainDb: decibels(powerRatioToDb(operatingGainLinear(network, loadGamma))),
    availableGainDb: decibels(powerRatioToDb(availableGainLinear(network, sourceGamma))),
  };
}
