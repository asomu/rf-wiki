import { describe, expect, it } from 'vitest';
import {
  demodulateOfdmSymbol,
  modulateOfdmSymbol,
  nearestQamLabel,
  ofdmAveragePower,
  qamConstellationPoint,
  readOfdmSubcarrier,
} from '../../src/lib/rf';

describe('QAM and OFDM', () => {
  it('normalizes every supported square QAM constellation to unit average power', () => {
    for (const order of [4, 16, 64, 256] as const) {
      const average = Array.from({ length: order }, (_, label) => {
        const point = qamConstellationPoint(label, order);
        expect(nearestQamLabel(point, order)).toBe(label);
        return point.re * point.re + point.im * point.im;
      }).reduce((sum, value) => sum + value, 0) / order;
      expect(average).toBeCloseTo(1, 14);
    }
  });

  it('round-trips orthogonal subcarriers after cyclic-prefix removal', () => {
    const negative = qamConstellationPoint(3, 4);
    const positive = qamConstellationPoint(11, 16);
    const symbol = modulateOfdmSymbol(64, 8, [
      { offsetFromDc: -7, value: negative },
      { offsetFromDc: 5, value: positive },
    ]);
    expect(symbol.samplesWithCyclicPrefix).toHaveLength(72);
    expect(symbol.samplesWithCyclicPrefix.slice(0, 8)).toEqual(
      symbol.usefulSamples.slice(-8),
    );

    const bins = demodulateOfdmSymbol(symbol.samplesWithCyclicPrefix, 64, 8);
    const recoveredNegative = readOfdmSubcarrier(bins, -7);
    const recoveredPositive = readOfdmSubcarrier(bins, 5);
    expect(recoveredNegative.re).toBeCloseTo(negative.re, 12);
    expect(recoveredNegative.im).toBeCloseTo(negative.im, 12);
    expect(recoveredPositive.re).toBeCloseTo(positive.re, 12);
    expect(recoveredPositive.im).toBeCloseTo(positive.im, 12);
  });

  it('obeys Parseval with the documented unscaled-FFT / 1/N-IFFT convention', () => {
    const symbol = modulateOfdmSymbol(16, 4, [
      { offsetFromDc: -1, value: { re: 1, im: 0 } },
      { offsetFromDc: 1, value: { re: 1, im: 0 } },
    ]);
    expect(ofdmAveragePower(symbol)).toBeCloseTo(2 / (16 * 16), 14);
  });
});
