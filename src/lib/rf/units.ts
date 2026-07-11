import type { Power } from '../../types';
import { dbm, watts } from '../../types';

const MILLIWATTS_PER_WATT = 1_000;

export function dbToPowerRatio(decibels: number): number {
  return 10 ** (decibels / 10);
}

export function powerRatioToDb(powerRatio: number): number {
  if (powerRatio < 0 || Number.isNaN(powerRatio)) {
    throw new RangeError(`Power ratio must be non-negative; received ${powerRatio}`);
  }

  return powerRatio === 0 ? Number.NEGATIVE_INFINITY : 10 * Math.log10(powerRatio);
}

export function dbToVoltageRatio(decibels: number): number {
  return 10 ** (decibels / 20);
}

export function voltageRatioToDb(voltageRatio: number): number {
  if (voltageRatio < 0 || Number.isNaN(voltageRatio)) {
    throw new RangeError(`Voltage ratio must be non-negative; received ${voltageRatio}`);
  }

  return voltageRatio === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(voltageRatio);
}

export function dbmToWatts(dbmValue: number): number {
  return 10 ** (dbmValue / 10) / MILLIWATTS_PER_WATT;
}

export function wattsToDbm(wattsValue: number): number {
  if (wattsValue < 0 || Number.isNaN(wattsValue)) {
    throw new RangeError(`Power in watts must be non-negative; received ${wattsValue}`);
  }

  return wattsValue === 0
    ? Number.NEGATIVE_INFINITY
    : 10 * Math.log10(wattsValue * MILLIWATTS_PER_WATT);
}

export function powerFromDbm(dbmValue: number): Power {
  return {
    dbm: dbm(dbmValue),
    watts: watts(dbmToWatts(dbmValue)),
  };
}

export function powerFromWatts(wattsValue: number): Power {
  return {
    dbm: dbm(wattsToDbm(wattsValue)),
    watts: watts(wattsValue),
  };
}

export function hzToKhz(frequencyHz: number): number {
  return frequencyHz / 1_000;
}

export function hzToMhz(frequencyHz: number): number {
  return frequencyHz / 1_000_000;
}

export function khzToHz(frequencyKhz: number): number {
  return frequencyKhz * 1_000;
}

export function mhzToHz(frequencyMhz: number): number {
  return frequencyMhz * 1_000_000;
}
