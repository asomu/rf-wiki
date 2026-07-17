import { describe, expect, it } from 'vitest';
import { DEFAULT_EDUCATIONAL_PA, evaluatePa, transformNormalizedPaSample } from '../../src/lib/rf';

describe('normalized complex-envelope PA transform', () => {
  it('compresses and phase-rotates a 16QAM outer symbol more than an inner symbol', () => {
    const scale = Math.sqrt(10);
    const inner = transformNormalizedPaSample({ re: 1 / scale, im: 1 / scale });
    const outer = transformNormalizedPaSample({ re: 3 / scale, im: 3 / scale });

    expect(outer.outputMagnitudeNormalized).toBeLessThan(outer.inputMagnitudeNormalized);
    expect(Number(outer.compressionDb)).toBeGreaterThan(Number(inner.compressionDb));
    expect(Math.abs(Number(outer.phaseShiftDegrees))).toBeGreaterThan(
      Math.abs(Number(inner.phaseShiftDegrees)),
    );
    expect(outer.outputMagnitudeNormalized).toBeCloseTo(0.9739685711922463, 12);
    expect(Number(outer.compressionDb)).toBeCloseTo(2.781826192269828, 12);
    expect(Number(outer.phaseShiftDegrees)).toBeCloseTo(-9.169811320754718, 12);
    expect(outer.outputSampleNormalized.re).toBeCloseTo(0.789650372990091, 12);
    expect(outer.outputSampleNormalized.im).toBeCloseTo(0.570146530382213, 12);
  });

  it('keeps a zero complex envelope finite and exactly at the origin', () => {
    const result = transformNormalizedPaSample({ re: 0, im: 0 });

    expect(result.outputSampleNormalized).toEqual({ re: 0, im: 0 });
    expect(result.outputMagnitudeNormalized).toBe(0);
    expect(Number(result.compressionDb)).toBe(0);
    expect(Number(result.phaseShiftDegrees)).toBe(0);
  });

  it.each([
    'smallSignalGainDb',
    'saturationOutputPowerDbm',
    'smoothness',
    'phaseAtSaturationDegrees',
    'amPmExponent',
    'drainVoltageV',
    'quiescentCurrentA',
    'incrementalDrainEfficiency',
    'baselineAclrDbc',
  ] as const)('rejects every non-finite value for public PA field %s', (field) => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const model = { ...DEFAULT_EDUCATIONAL_PA, [field]: invalid };
      expect(() => transformNormalizedPaSample({ re: 1, im: 0 }, model)).toThrow(RangeError);
      expect(() => evaluatePa(0, model)).toThrow(RangeError);
    }
  });

  it('returns only finite numeric fields for valid public PA transforms', () => {
    const transformed = transformNormalizedPaSample({ re: 0.5, im: -0.75 });
    const operatingPoint = evaluatePa(4);

    expect([
      transformed.inputSampleNormalized.re,
      transformed.inputSampleNormalized.im,
      transformed.outputSampleNormalized.re,
      transformed.outputSampleNormalized.im,
      transformed.inputMagnitudeNormalized,
      transformed.outputMagnitudeNormalized,
      Number(transformed.compressionDb),
      Number(transformed.phaseShiftDegrees),
      ...Object.values(operatingPoint).map(Number),
    ].every(Number.isFinite)).toBe(true);
  });
});
