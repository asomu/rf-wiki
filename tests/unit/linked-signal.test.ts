import { describe, expect, it } from 'vitest';
import {
  analyzeRbwSpectrum,
  createDeterministicQpskRecord,
  createIqCapture,
} from '../../src/lib/rf';

describe('one deterministic record shared by SA and IQ views', () => {
  it('rotates the complete noisy QPSK record without changing magnitude or symbol identity', () => {
    const base = createDeterministicQpskRecord({
      sampleRateHz: 1_024_000,
      symbolCount: 16,
      samplesPerSymbol: 16,
      commonPhaseDegrees: 0,
      frequencyOffsetHz: 0,
      noiseRms: 0.012,
      seed: 89600,
    });
    const rotated = createDeterministicQpskRecord({
      sampleRateHz: 1_024_000,
      symbolCount: 16,
      samplesPerSymbol: 16,
      commonPhaseDegrees: 90,
      frequencyOffsetHz: 0,
      noiseRms: 0.012,
      seed: 89600,
    });

    expect(base.capture.samples).toHaveLength(256);
    expect(rotated.symbols.map(({ label }) => label)).toEqual(
      base.symbols.map(({ label }) => label),
    );

    for (let index = 0; index < base.capture.samples.length; index += 1) {
      const before = base.capture.samples[index]!;
      const after = rotated.capture.samples[index]!;
      expect(after.re).toBeCloseTo(-before.im, 12);
      expect(after.im).toBeCloseTo(before.re, 12);
      expect(Math.hypot(after.re, after.im)).toBeCloseTo(
        Math.hypot(before.re, before.im),
        12,
      );
    }

    const baseSpectrum = analyzeRbwSpectrum(base.capture, { rbwHz: 16_000 });
    const rotatedSpectrum = analyzeRbwSpectrum(rotated.capture, { rbwHz: 16_000 });
    rotatedSpectrum.bins.forEach((bin, index) => {
      expect(bin.powerDbfs).toBeCloseTo(baseSpectrum.bins[index]!.powerDbfs, 10);
    });
  });

  it('integrates more of the same deterministic noise record when RBW is wider', () => {
    const capture = createIqCapture({
      sampleRateHz: 1_024_000,
      sampleCount: 512,
      tones: [],
      noiseRms: 0.02,
      seed: 17,
    });
    const narrow = analyzeRbwSpectrum(capture, { rbwHz: 8_000 });
    const wide = analyzeRbwSpectrum(capture, { rbwHz: 64_000 });
    const averageLinearPower = (values: readonly { powerDbfs: number }[]) => (
      values.reduce((sum, value) => sum + 10 ** (value.powerDbfs / 10), 0) /
      values.length
    );

    expect(narrow.bins.map(({ frequencyHz }) => frequencyHz)).toEqual(
      wide.bins.map(({ frequencyHz }) => frequencyHz),
    );
    expect(averageLinearPower(wide.bins)).toBeGreaterThan(
      averageLinearPower(narrow.bins) * 4,
    );
  });

  it('keeps a bin-centered coherent tone at its calibrated peak for every RBW', () => {
    const capture = createIqCapture({
      sampleRateHz: 1_024_000,
      sampleCount: 512,
      tones: [{ offsetFrequencyHz: 64_000, amplitude: 1 }],
      noiseRms: 0,
    });
    const narrow = analyzeRbwSpectrum(capture, { rbwHz: 8_000 });
    const wide = analyzeRbwSpectrum(capture, { rbwHz: 64_000 });
    const peak = (result: typeof narrow) => Math.max(
      ...result.bins.map(({ powerDbfs }) => powerDbfs),
    );

    expect(peak(narrow)).toBeCloseTo(0, 10);
    expect(peak(wide)).toBeCloseTo(0, 10);
    expect(peak(wide)).toBeCloseTo(peak(narrow), 10);
  });
});
