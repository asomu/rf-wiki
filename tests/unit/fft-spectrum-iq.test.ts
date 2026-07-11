import { describe, expect, it } from 'vitest';
import {
  analyzeSpectrum,
  captureToPolar,
  complex,
  createIqCapture,
  createWindow,
  estimateToneOffsetHz,
  fft,
  ifft,
  nearestSpectrumBin,
} from '../../src/lib/rf';

describe('FFT and windows', () => {
  it('maps an impulse to a flat unscaled spectrum', () => {
    const result = fft([
      complex(1),
      complex(0),
      complex(0),
      complex(0),
      complex(0),
      complex(0),
      complex(0),
      complex(0),
    ]);
    for (const bin of result) {
      expect(bin.re).toBeCloseTo(1, 12);
      expect(bin.im).toBeCloseTo(0, 12);
    }
  });

  it('round-trips through the scaled inverse transform', () => {
    const input = [
      complex(1, 0.5),
      complex(-2, 1),
      complex(0.25, -0.75),
      complex(3, 2),
    ];
    const reconstructed = ifft(fft(input));
    reconstructed.forEach((value, index) => {
      expect(value.re).toBeCloseTo(input[index]?.re ?? 0, 12);
      expect(value.im).toBeCloseTo(input[index]?.im ?? 0, 12);
    });
  });

  it('reports exact periodic Hann coherent gain and ENBW', () => {
    const metrics = createWindow('hann', 64);
    expect(metrics.coherentGain).toBeCloseTo(0.5, 14);
    expect(metrics.equivalentNoiseBandwidthBins).toBeCloseTo(1.5, 14);
  });

  it('defines every one-sample window as unity instead of dividing by zero', () => {
    expect(createWindow('hann', 1)).toEqual({
      coefficients: [1],
      coherentGain: 1,
      equivalentNoiseBandwidthBins: 1,
    });
  });
});

describe('IQ capture and spectrum', () => {
  it('keeps magnitude, phase, and FFT bin linked for a coherent IQ tone', () => {
    const capture = createIqCapture({
      sampleRateHz: 6_400,
      sampleCount: 64,
      tones: [{ offsetFrequencyHz: 1_000, amplitude: 1, phaseDegrees: 30 }],
    });
    const polar = captureToPolar(capture);
    expect(polar[0]?.magnitude).toBeCloseTo(1, 12);
    expect(polar[0]?.phaseDegrees).toBeCloseTo(30, 12);

    const spectrum = analyzeSpectrum(capture.samples, {
      sampleRateHz: Number(capture.sampleRateHz),
      window: 'hann',
    });
    const marker = nearestSpectrumBin(spectrum, 1_000);
    expect(Number(marker.frequencyHz)).toBe(1_000);
    expect(marker.amplitude).toBeCloseTo(1, 12);
    expect(marker.magnitudeDbfs).toBeCloseTo(0, 12);
    expect(Number(marker.phaseDegrees)).toBeCloseTo(30, 12);
    expect(Number(spectrum.resolutionBandwidthHz)).toBe(100);
    expect(Number(spectrum.equivalentNoiseBandwidthHz)).toBeCloseTo(150, 12);
  });

  it('estimates baseband offset from inter-sample phase', () => {
    const capture = createIqCapture({
      sampleRateHz: 10_000,
      sampleCount: 128,
      tones: [{ offsetFrequencyHz: -1_250, amplitude: 0.7, phaseDegrees: 71 }],
    });
    expect(estimateToneOffsetHz(capture)).toBeCloseTo(-1_250, 10);
  });

  it('uses a deterministic seed for repeatable complex Gaussian noise', () => {
    const options = {
      sampleRateHz: 1_000,
      sampleCount: 8,
      tones: [] as const,
      noiseRms: 0.1,
      seed: 42,
    };
    const a = createIqCapture(options);
    const b = createIqCapture(options);
    const c = createIqCapture({ ...options, seed: 43 });
    expect(a.samples).toEqual(b.samples);
    expect(a.samples).not.toEqual(c.samples);
    expect(a.samples[0]?.re).toBeCloseTo(-0.06761087963119788, 12);
    expect(a.samples[0]?.im).toBeCloseTo(0.022773805731369563, 12);
  });
});
