import { describe, expect, it } from 'vitest';
import { cosineWaveformByCycles, frequencyLinkState } from '../../src/lib/rf';

describe('frequency, period, wavelength, and cable phase', () => {
  it('doubles electrical length and halves period when frequency doubles', () => {
    const one = frequencyLinkState(1, 10, 0.7);
    const two = frequencyLinkState(2, 10, 0.7);
    expect(two.periodNs).toBeCloseTo(one.periodNs / 2, 14);
    expect(two.wavelengthMm).toBeCloseTo(one.wavelengthMm / 2, 14);
    expect(two.electricalLengthDegrees).toBeCloseTo(one.electricalLengthDegrees * 2, 14);
  });

  it('generates exactly the requested number of cycles and samples', () => {
    const waveform = cosineWaveformByCycles(2, 3, 181);
    expect(waveform).toHaveLength(181);
    expect(waveform[0]).toEqual({ x: 0, y: 1 });
    expect(waveform.at(-1)?.x).toBeCloseTo(1.5, 14);
    expect(waveform.at(-1)?.y).toBeCloseTo(1, 14);
  });
});
