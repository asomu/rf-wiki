import { describe, expect, it } from 'vitest';
import {
  acceptedPowerWatts,
  allocateResourceBlocks,
  channelGuardBandwidthHz,
  getLteResourceGrid,
  getNrResourceGrid,
  impedanceToReflectionCoefficient,
  occupiedResourceGridBandwidthHz,
  reflectionCoefficientToImpedance,
  reflectionMetrics,
  shiftReflectionReferencePlane,
} from '../../src/lib/rf';
import { impedance } from '../../src/types';

describe('LTE and NR resource grids', () => {
  it('uses the LTE 20 MHz / 100 RB transmission configuration', () => {
    const config = getLteResourceGrid(20);
    expect(config.totalResourceBlocks).toBe(100);
    expect(Number(config.subcarrierSpacingKHz)).toBe(15);
    expect(occupiedResourceGridBandwidthHz(config)).toBe(18_000_000);
    expect(channelGuardBandwidthHz(config)).toBe(1_000_000);
  });

  it('uses the Release 17 NR FR1 100 MHz / 30 kHz = 273 RB row', () => {
    const config = getNrResourceGrid(100, 30, 'FR1');
    expect(config.totalResourceBlocks).toBe(273);
    expect(occupiedResourceGridBandwidthHz(config)).toBe(98_280_000);
    expect(channelGuardBandwidthHz(config)).toBe(860_000);
    expect(Number(config.gridTimeUnitDurationSeconds)).toBeCloseTo(0.0005, 15);
  });

  it.each([
    ['FR2-1', 50, 60, 66],
    ['FR2-1', 400, 120, 264],
    ['FR2-2', 100, 120, 66],
    ['FR2-2', 400, 480, 66],
    ['FR2-2', 800, 480, 124],
    ['FR2-2', 1600, 480, 248],
    ['FR2-2', 400, 960, 33],
    ['FR2-2', 800, 960, 62],
    ['FR2-2', 1600, 960, 124],
    ['FR2-2', 2000, 960, 148],
  ] as const)('uses Release 17 %s %d MHz / %d kHz = %d RB', (range, bandwidth, scs, expectedRb) => {
    const config = getNrResourceGrid(bandwidth, scs, range);
    expect(config.totalResourceBlocks).toBe(expectedRb);
    expect(config.frequencyRange).toBe(range);
    expect(Number(config.gridTimeUnitDurationSeconds)).toBeCloseTo(0.001 * 15 / scs, 15);
  });

  it('rejects FR2-2 bandwidth/SCS pairs marked N/A in the Release 17 table', () => {
    expect(() => getNrResourceGrid(100, 480, 'FR2-2')).toThrow(/Unsupported NR FR2-2/);
    expect(() => getNrResourceGrid(2000, 480, 'FR2-2')).toThrow(/Unsupported NR FR2-2/);
  });

  it('shows how RB100 at location 0 moves to the low side of a 100 MHz grid', () => {
    const config = getNrResourceGrid(100, 30);
    const low = allocateResourceBlocks(config, 0, 100);
    const shifted = allocateResourceBlocks(config, 100, 100);
    expect(Number(low.occupiedBandwidthHz)).toBe(36_000_000);
    expect(Number(low.lowEdgeOffsetHz)).toBe(-49_140_000);
    expect(Number(low.highEdgeOffsetHz)).toBe(-13_140_000);
    expect(Number(low.centerOffsetHz)).toBe(-31_140_000);
    expect(Number(shifted.centerOffsetHz)).toBe(4_860_000);
  });

  it('rejects a range that extends beyond the configured RB grid', () => {
    const config = getNrResourceGrid(100, 30);
    expect(() => allocateResourceBlocks(config, 200, 100)).toThrow(/exceeds/);
    expect(() => getLteResourceGrid(100)).toThrow(/Unsupported LTE/);
  });
});

describe('Smith chart and mismatch metrics', () => {
  it('maps 100 Ω to Γ=1/3 on a 50 Ω chart', () => {
    const gamma = impedanceToReflectionCoefficient(impedance(100), 50);
    expect(gamma.re).toBeCloseTo(1 / 3, 14);
    expect(gamma.im).toBeCloseTo(0, 14);
    const metrics = reflectionMetrics(impedance(100), 50);
    expect(metrics.returnLossDb).toBeCloseTo(9.542425094393248, 12);
    expect(metrics.vswr).toBeCloseTo(2, 12);
    expect(metrics.mismatchLossDb).toBeCloseTo(0.5115252244738129, 12);
    expect(metrics.acceptedPowerFraction).toBeCloseTo(8 / 9, 14);
    expect(acceptedPowerWatts(1, gamma)).toBeCloseTo(8 / 9, 14);
  });

  it('round-trips a complex impedance through Γ', () => {
    const original = impedance(25, -25);
    const reconstructed = reflectionCoefficientToImpedance(
      impedanceToReflectionCoefficient(original, 50),
      50,
    );
    expect(Number(reconstructed.resistanceOhms)).toBeCloseTo(25, 12);
    expect(Number(reconstructed.reactanceOhms)).toBeCloseTo(-25, 12);
  });

  it('rotates Γ clockwise by twice the one-way phase of an added line', () => {
    const shifted = shiftReflectionReferencePlane({ re: 0.5, im: 0 }, 45);
    expect(shifted.re).toBeCloseTo(0, 14);
    expect(shifted.im).toBeCloseTo(-0.5, 14);
  });
});
