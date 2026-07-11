import type { Complex, CouplerModel } from '../../types';
import { dbm, decibels } from '../../types';
import { complex, magnitudeSquared } from './complex';
import { dbmToWatts, powerRatioToDb, wattsToDbm } from './units';

export interface CouplerCoefficients {
  readonly throughCoefficient: Complex;
  readonly coupledCoefficient: Complex;
  readonly isolatedCoefficient: Complex;
}

export interface CouplerPowerFlow {
  readonly inputPowerDbm: ReturnType<typeof dbm>;
  readonly throughPowerDbm: ReturnType<typeof dbm>;
  readonly coupledPowerDbm: ReturnType<typeof dbm>;
  readonly isolatedPowerDbm: ReturnType<typeof dbm>;
  readonly dissipatedPowerWatts: number;
}

/**
 * Builds an educational four-port directional-coupler slice for excitation at
 * port 1: through=S21, coupled=S31, isolated=S41. Coupling and isolation use
 * positive loss magnitudes. Directivity = isolation - coupling.
 */
export function createDirectionalCoupler(
  couplingDb: number,
  directivityDb: number,
  excessLossDb = 0,
): CouplerModel {
  if (
    !Number.isFinite(couplingDb) ||
    !Number.isFinite(directivityDb) ||
    !Number.isFinite(excessLossDb) ||
    couplingDb < 0 ||
    directivityDb < 0 ||
    excessLossDb < 0
  ) {
    throw new RangeError('Coupling, directivity, and excess loss must be non-negative');
  }

  const isolationDb = couplingDb + directivityDb;
  const coupledPowerRatio = 10 ** (-couplingDb / 10);
  const isolatedPowerRatio = 10 ** (-isolationDb / 10);
  // This project uses the common useful-port convention:
  // Lexcess = -10log10((Pthrough + Pcoupled) / Pinput).
  const usefulOutputPowerRatio = 10 ** (-excessLossDb / 10);
  const throughPowerRatio = usefulOutputPowerRatio - coupledPowerRatio;
  if (throughPowerRatio < -1e-12) {
    throw new RangeError(
      'The coupled output exceeds the useful power remaining after excess loss',
    );
  }
  if (usefulOutputPowerRatio + isolatedPowerRatio > 1 + 1e-12) {
    throw new RangeError(
      'Excess loss is too small to conserve power with the requested finite isolation',
    );
  }

  // A quadrature phase on the coupled arm is conventional for an ideal coupler.
  const throughCoefficient = complex(Math.sqrt(Math.max(0, throughPowerRatio)), 0);
  const coupledCoefficient = complex(0, Math.sqrt(coupledPowerRatio));
  const isolatedCoefficient = complex(Math.sqrt(isolatedPowerRatio), 0);
  const mainLineLossDb = -powerRatioToDb(Math.max(throughPowerRatio, 0));

  return {
    couplingDb: decibels(couplingDb),
    isolationDb: decibels(isolationDb),
    directivityDb: decibels(directivityDb),
    mainLineLossDb: decibels(mainLineLossDb),
    excessLossDb: decibels(excessLossDb),
    throughCoefficient,
    coupledCoefficient,
    isolatedCoefficient,
  };
}

export function analyzeDirectionalCoupler(
  coefficients: CouplerCoefficients,
): CouplerModel {
  const throughPower = magnitudeSquared(coefficients.throughCoefficient);
  const coupledPower = magnitudeSquared(coefficients.coupledCoefficient);
  const isolatedPower = magnitudeSquared(coefficients.isolatedCoefficient);
  const totalOutputPower = throughPower + coupledPower + isolatedPower;
  if (totalOutputPower > 1 + 1e-12) {
    throw new RangeError('Passive coupler output powers must not exceed input power');
  }
  const couplingDb = -powerRatioToDb(coupledPower);
  const isolationDb = -powerRatioToDb(isolatedPower);
  const directivityDb = isolationDb - couplingDb;
  const mainLineLossDb = -powerRatioToDb(throughPower);
  const usefulOutputPower = throughPower + coupledPower;
  const excessLossDb = usefulOutputPower === 0
    ? Number.POSITIVE_INFINITY
    : -powerRatioToDb(usefulOutputPower);

  return {
    couplingDb: decibels(couplingDb),
    isolationDb: decibels(isolationDb),
    directivityDb: decibels(directivityDb),
    mainLineLossDb: decibels(mainLineLossDb),
    excessLossDb: decibels(excessLossDb),
    throughCoefficient: coefficients.throughCoefficient,
    coupledCoefficient: coefficients.coupledCoefficient,
    isolatedCoefficient: coefficients.isolatedCoefficient,
  };
}

export function couplerPowerFlow(
  inputPowerDbm: number,
  model: CouplerModel,
): CouplerPowerFlow {
  const inputWatts = dbmToWatts(inputPowerDbm);
  const throughWatts = inputWatts * magnitudeSquared(model.throughCoefficient);
  const coupledWatts = inputWatts * magnitudeSquared(model.coupledCoefficient);
  const isolatedWatts = inputWatts * magnitudeSquared(model.isolatedCoefficient);

  return {
    inputPowerDbm: dbm(inputPowerDbm),
    throughPowerDbm: dbm(wattsToDbm(throughWatts)),
    coupledPowerDbm: dbm(wattsToDbm(coupledWatts)),
    isolatedPowerDbm: dbm(wattsToDbm(isolatedWatts)),
    dissipatedPowerWatts: Math.max(
      0,
      inputWatts - throughWatts - coupledWatts - isolatedWatts,
    ),
  };
}

/** Ideal lossless main-line loss implied by a coupling factor alone. */
export function theoreticalMainLineLossDb(couplingDb: number): number {
  const coupledPowerRatio = 10 ** (-couplingDb / 10);
  if (coupledPowerRatio >= 1) return Number.POSITIVE_INFINITY;
  return -powerRatioToDb(1 - coupledPowerRatio);
}
