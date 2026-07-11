import { describe, expect, it } from 'vitest';
import {
  allocateBwpResourceBlocks,
  createResourceAllocationOfdm,
  getNrResourceGrid,
} from '../../src/lib/rf';

describe('resource allocation drives the actual educational OFDM symbol', () => {
  it('maps every allocated RB subcarrier into one deterministic IFFT record', () => {
    const config = getNrResourceGrid(100, 30, 'FR1');
    const model = createResourceAllocationOfdm(config, 0, 100, {
      fftSize: 4096,
      cyclicPrefixSamples: 256,
      qamOrder: 16,
      seed: 17,
    });

    expect(model.allocation.startResourceBlock).toBe(0);
    expect(model.symbol.mappedSubcarriers).toHaveLength(1_200);
    expect(model.symbol.mappedSubcarriers[0]?.offsetFromDc).toBe(-1_638);
    expect(model.symbol.mappedSubcarriers.at(-1)?.offsetFromDc).toBe(-439);
    expect(Number(model.allocation.occupiedBandwidthHz)).toBe(36_000_000);
    expect(Number(model.sampleRateHz)).toBe(122_880_000);
    expect(Number(model.usefulSymbolDurationSeconds)).toBeCloseTo(1 / 30_000, 15);

    const halfWidth = createResourceAllocationOfdm(config, 0, 50, {
      fftSize: 4096,
      cyclicPrefixSamples: 256,
      qamOrder: 16,
      seed: 17,
    });
    expect(halfWidth.symbol.mappedSubcarriers).toHaveLength(600);
    expect(Number(halfWidth.allocation.occupiedBandwidthHz)).toBe(18_000_000);
  });

  it('turns an RB location shift into the exact time-domain phase ramp', () => {
    const config = getNrResourceGrid(100, 30, 'FR1');
    const low = createResourceAllocationOfdm(config, 0, 100, {
      fftSize: 4096,
      cyclicPrefixSamples: 0,
      qamOrder: 4,
      seed: 23,
    });
    const shifted = createResourceAllocationOfdm(config, 86, 100, {
      fftSize: 4096,
      cyclicPrefixSamples: 0,
      qamOrder: 4,
      seed: 23,
    });
    const binShift = 86 * 12;

    for (const sampleIndex of [0, 1, 17, 127, 511, 2047]) {
      const before = low.symbol.usefulSamples[sampleIndex]!;
      const after = shifted.symbol.usefulSamples[sampleIndex]!;
      const phase = 2 * Math.PI * binShift * sampleIndex / low.symbol.fftSize;
      const expected = {
        re: before.re * Math.cos(phase) - before.im * Math.sin(phase),
        im: before.re * Math.sin(phase) + before.im * Math.cos(phase),
      };
      expect(after.re).toBeCloseTo(expected.re, 11);
      expect(after.im).toBeCloseTo(expected.im, 11);
    }
  });

  it('resolves location inside a bounded BWP before mapping carrier PRBs', () => {
    const config = getNrResourceGrid(100, 30, 'FR1');
    const result = allocateBwpResourceBlocks(config, {
      startResourceBlock: 40,
      resourceBlockCount: 160,
      allocationLocation: 10,
      allocationResourceBlockCount: 100,
    });

    expect(result.bwpStartResourceBlock).toBe(40);
    expect(result.bwpResourceBlockCount).toBe(160);
    expect(result.allocation.startResourceBlock).toBe(50);
    expect(result.maxAllocationLocation).toBe(60);
    expect(() => allocateBwpResourceBlocks(config, {
      startResourceBlock: 40,
      resourceBlockCount: 160,
      allocationLocation: 61,
      allocationResourceBlockCount: 100,
    })).toThrow(/BWP/);
  });

  it('doubles RB100 width and halves useful-symbol time when SCS doubles', () => {
    const thirty = createResourceAllocationOfdm(getNrResourceGrid(100, 30), 0, 100);
    const sixty = createResourceAllocationOfdm(getNrResourceGrid(100, 60), 0, 100);

    expect(Number(thirty.allocation.occupiedBandwidthHz)).toBe(36_000_000);
    expect(Number(sixty.allocation.occupiedBandwidthHz)).toBe(72_000_000);
    expect(Number(sixty.usefulSymbolDurationSeconds)).toBeCloseTo(
      Number(thirty.usefulSymbolDurationSeconds) / 2,
      15,
    );
  });

  it('applies total-carrier and per-subcarrier power normalization to actual IFFT bins', () => {
    const config = getNrResourceGrid(100, 30, 'FR1');
    const fixedTotal100 = createResourceAllocationOfdm(config, 0, 100, {
      powerNormalization: 'fixed-carrier-total',
      seed: 17,
    });
    const fixedTotal50 = createResourceAllocationOfdm(config, 0, 50, {
      powerNormalization: 'fixed-carrier-total',
      seed: 17,
    });
    const perSubcarrier100 = createResourceAllocationOfdm(config, 0, 100, {
      powerNormalization: 'per-subcarrier',
      seed: 17,
    });
    const perSubcarrier50 = createResourceAllocationOfdm(config, 0, 50, {
      powerNormalization: 'per-subcarrier',
      seed: 17,
    });

    const fullCarrierSubcarriers = config.totalResourceBlocks * config.subcarriersPerResourceBlock;
    expect(fixedTotal100.mappedSubcarrierPower).toBeCloseTo(fullCarrierSubcarriers, 9);
    expect(fixedTotal50.mappedSubcarrierPower).toBeCloseTo(fullCarrierSubcarriers, 9);
    expect(perSubcarrier100.mappedSubcarrierPower).toBeCloseTo(1_200, 9);
    expect(perSubcarrier50.mappedSubcarrierPower).toBeCloseTo(600, 9);
    expect(fixedTotal50.subcarrierAmplitudeScale).toBeGreaterThan(
      perSubcarrier50.subcarrierAmplitudeScale,
    );
  });
});
