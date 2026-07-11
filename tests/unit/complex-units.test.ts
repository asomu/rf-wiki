import { describe, expect, it } from 'vitest';
import {
  add,
  complex,
  conjugate,
  dbToPowerRatio,
  dbToVoltageRatio,
  dbmToWatts,
  divide,
  fromPolarDegrees,
  magnitude,
  multiply,
  phaseDegrees,
  powerFromWatts,
  powerRatioToDb,
  unwrapDegrees,
  voltageRatioToDb,
  wattsToDbm,
  wrapDegrees,
} from '../../src/lib/rf';

describe('complex arithmetic', () => {
  it('preserves the rectangular and polar views of one value', () => {
    const value = fromPolarDegrees(2, 30);
    expect(value.re).toBeCloseTo(Math.sqrt(3), 12);
    expect(value.im).toBeCloseTo(1, 12);
    expect(magnitude(value)).toBeCloseTo(2, 12);
    expect(phaseDegrees(value)).toBeCloseTo(30, 12);
  });

  it('implements multiply, divide, conjugate, and add deterministically', () => {
    const a = complex(3, 4);
    const b = complex(1, -2);
    expect(multiply(a, b)).toEqual({ re: 11, im: -2 });
    expect(divide(a, b).re).toBeCloseTo(-1, 12);
    expect(divide(a, b).im).toBeCloseTo(2, 12);
    expect(add(a, conjugate(a))).toEqual({ re: 6, im: 0 });
  });

  it('wraps and unwraps phase across the -180° seam', () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(unwrapDegrees([170, 179, -179, -170])).toEqual([170, 179, 181, 190]);
  });
});

describe('RF unit conversions', () => {
  it('uses power ratios for 10 log and voltage ratios for 20 log', () => {
    expect(dbToPowerRatio(3.010299956639812)).toBeCloseTo(2, 12);
    expect(powerRatioToDb(2)).toBeCloseTo(3.010299956639812, 12);
    expect(dbToVoltageRatio(6.020599913279624)).toBeCloseTo(2, 12);
    expect(voltageRatioToDb(2)).toBeCloseTo(6.020599913279624, 12);
  });

  it('converts dBm to watts with the 1 mW reference', () => {
    expect(dbmToWatts(0)).toBeCloseTo(0.001, 15);
    expect(dbmToWatts(30)).toBeCloseTo(1, 12);
    expect(wattsToDbm(0.05)).toBeCloseTo(16.989700043360187, 12);
    expect(Number(powerFromWatts(0).dbm)).toBe(Number.NEGATIVE_INFINITY);
  });
});
