import type {
  Complex,
  SpectrumResult,
  WindowKind,
} from '../../types';
import { degrees, hertz } from '../../types';
import { magnitude, phaseDegrees } from './complex';
import { applyWindow, createWindow, fft, fftShift } from './fft';

export interface SpectrumAnalysisOptions {
  readonly sampleRateHz: number;
  readonly window?: WindowKind;
  /** Display floor applied only after the linear calculation. */
  readonly displayFloorDbfs?: number;
}

/**
 * Produces a centered, two-sided complex spectrum. Magnitude is corrected for
 * the selected window's coherent gain. A bin-centered complex tone of peak
 * amplitude 1 therefore reads 0 dBFS.
 */
export function analyzeSpectrum(
  samples: readonly Complex[],
  options: SpectrumAnalysisOptions,
): SpectrumResult {
  const { sampleRateHz } = options;
  const windowKind = options.window ?? 'hann';
  const displayFloorDbfs = options.displayFloorDbfs ?? -180;

  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError(`Sample rate must be positive; received ${sampleRateHz}`);
  }
  if (!Number.isFinite(displayFloorDbfs)) {
    throw new RangeError(`Display floor must be finite; received ${displayFloorDbfs}`);
  }

  const metrics = createWindow(windowKind, samples.length);
  const transformed = fft(applyWindow(samples, metrics.coefficients));
  const shifted = fftShift(transformed);
  const binWidthHz = sampleRateHz / samples.length;
  const normalization = samples.length * metrics.coherentGain;

  const bins = shifted.map((value, shiftedIndex) => {
    const unshiftedIndex = (shiftedIndex + Math.ceil(samples.length / 2)) % samples.length;
    const amplitude = magnitude(value) / normalization;
    const rawDbfs = amplitude === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(amplitude);
    const frequencyHz = (shiftedIndex - Math.floor(samples.length / 2)) * binWidthHz;

    return {
      index: unshiftedIndex,
      frequencyHz: hertz(frequencyHz),
      value,
      amplitude,
      magnitudeDbfs: Math.max(rawDbfs, displayFloorDbfs),
      phaseDegrees: degrees(phaseDegrees(value)),
    };
  });

  return {
    bins,
    resolutionBandwidthHz: hertz(binWidthHz),
    equivalentNoiseBandwidthHz: hertz(
      binWidthHz * metrics.equivalentNoiseBandwidthBins,
    ),
    coherentGain: metrics.coherentGain,
    window: windowKind,
  };
}

export function nearestSpectrumBin(
  spectrum: SpectrumResult,
  frequencyHz: number,
): SpectrumResult['bins'][number] {
  const first = spectrum.bins[0];
  if (first === undefined) throw new RangeError('Spectrum contains no bins');

  return spectrum.bins.reduce((nearest, bin) =>
    Math.abs(Number(bin.frequencyHz) - frequencyHz) <
    Math.abs(Number(nearest.frequencyHz) - frequencyHz)
      ? bin
      : nearest,
  first);
}
