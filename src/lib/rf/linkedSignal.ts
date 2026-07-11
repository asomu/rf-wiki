import type { Complex, IQCapture, WindowKind } from '../../types';
import { hertz, seconds } from '../../types';
import { add, expj, multiply } from './complex';
import { analyzeSpectrum } from './spectrum';
import { qamConstellationPoint } from './ofdm';
import { createGaussianNoise, createMulberry32 } from './random';

export interface DeterministicQpskRecordOptions {
  readonly sampleRateHz: number;
  readonly symbolCount: number;
  readonly samplesPerSymbol: number;
  readonly commonPhaseDegrees?: number;
  readonly frequencyOffsetHz?: number;
  readonly noiseRms?: number;
  readonly seed?: number;
  readonly centerFrequencyHz?: number;
}

export interface DeterministicQpskSymbol {
  readonly index: number;
  readonly label: number;
  readonly sampleIndex: number;
  /** Decision sample taken from the same IQ record used by every linked view. */
  readonly value: Complex;
}

export interface DeterministicQpskRecord {
  readonly scenarioId: string;
  readonly capture: IQCapture;
  readonly symbols: readonly DeterministicQpskSymbol[];
  readonly samplesPerSymbol: number;
  readonly symbolRateHz: number;
  readonly commonPhaseDegrees: number;
  readonly frequencyOffsetHz: number;
}

export interface RbwSpectrumOptions {
  readonly rbwHz: number;
  readonly window?: WindowKind;
  readonly displayFloorDbfs?: number;
}

export interface RbwSpectrumBin {
  readonly index: number;
  readonly frequencyHz: number;
  readonly powerDbfs: number;
}

export interface RbwSpectrumResult {
  readonly bins: readonly RbwSpectrumBin[];
  readonly rbwHz: number;
  readonly fftBinWidthHz: number;
  readonly window: WindowKind;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer; received ${value}`);
  }
}

/**
 * Creates one repeatable rectangular-pulse QPSK record. The same returned
 * complex samples are intentionally suitable for IQ time, decision-point,
 * constellation, FFT, and RBW-filtered spectrum views.
 */
export function createDeterministicQpskRecord(
  options: DeterministicQpskRecordOptions,
): DeterministicQpskRecord {
  const {
    sampleRateHz,
    symbolCount,
    samplesPerSymbol,
    commonPhaseDegrees = 0,
    frequencyOffsetHz = 0,
    noiseRms = 0.008,
    seed = 89600,
    centerFrequencyHz = 0,
  } = options;

  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError(`Sample rate must be positive; received ${sampleRateHz}`);
  }
  assertPositiveInteger(symbolCount, 'Symbol count');
  assertPositiveInteger(samplesPerSymbol, 'Samples per symbol');
  if (!Number.isFinite(commonPhaseDegrees) || !Number.isFinite(frequencyOffsetHz)) {
    throw new RangeError('Common phase and frequency offset must be finite');
  }
  if (Math.abs(frequencyOffsetHz) >= sampleRateHz / 2) {
    throw new RangeError('Frequency offset must lie inside the Nyquist interval');
  }
  if (!Number.isFinite(noiseRms) || noiseRms < 0) {
    throw new RangeError('Noise RMS must be finite and non-negative');
  }

  const uniform = createMulberry32(seed);
  const labels = Array.from({ length: symbolCount }, () => Math.floor(uniform() * 4));
  const gaussian = createGaussianNoise(seed ^ 0x51_47_4e_4c);
  const noiseSigma = noiseRms / Math.SQRT2;
  const sampleCount = symbolCount * samplesPerSymbol;
  const commonPhaseRadians = (commonPhaseDegrees * Math.PI) / 180;

  const samples = Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const symbolIndex = Math.floor(sampleIndex / samplesPerSymbol);
    const label = labels[symbolIndex];
    if (label === undefined) throw new RangeError('QPSK symbol index is out of bounds');
    const timeSeconds = sampleIndex / sampleRateHz;
    const phaseRadians = commonPhaseRadians + 2 * Math.PI * frequencyOffsetHz * timeSeconds;
    let basebandValue = qamConstellationPoint(label, 4);
    if (noiseRms > 0) {
      basebandValue = add(basebandValue, {
        re: gaussian() * noiseSigma,
        im: gaussian() * noiseSigma,
      });
    }
    // Common phase and frequency offset are operations on the captured complex
    // record, so the deterministic noise realization rotates with the signal.
    const value = multiply(basebandValue, expj(phaseRadians));
    return { ...value, timeSeconds: seconds(timeSeconds) };
  });

  const capture: IQCapture = {
    sampleRateHz: hertz(sampleRateHz),
    centerFrequencyHz: hertz(centerFrequencyHz),
    samples,
  };
  const markerOffset = Math.floor(samplesPerSymbol / 2);
  const symbols = labels.map((label, index) => {
    const sampleIndex = index * samplesPerSymbol + markerOffset;
    const sample = samples[sampleIndex];
    if (sample === undefined) throw new RangeError('QPSK decision sample is out of bounds');
    return {
      index,
      label,
      sampleIndex,
      value: { re: sample.re, im: sample.im },
    };
  });

  return {
    scenarioId: `qpsk-${seed}-${symbolCount}x${samplesPerSymbol}`,
    capture,
    symbols,
    samplesPerSymbol,
    symbolRateHz: sampleRateHz / samplesPerSymbol,
    commonPhaseDegrees,
    frequencyOffsetHz,
  };
}

/**
 * Applies a Gaussian power-response RBW filter to the FFT of one IQ record.
 * A coherent bin-centered tone keeps its calibrated peak while wider RBW
 * integrates more neighboring noise power.
 */
export function analyzeRbwSpectrum(
  capture: IQCapture,
  options: RbwSpectrumOptions,
): RbwSpectrumResult {
  const { rbwHz, window = 'hann', displayFloorDbfs = -180 } = options;
  if (!Number.isFinite(rbwHz) || rbwHz <= 0) {
    throw new RangeError(`RBW must be positive; received ${rbwHz} Hz`);
  }
  const sampleRateHz = Number(capture.sampleRateHz);
  if (rbwHz > sampleRateHz) {
    throw new RangeError('RBW must not exceed the capture sample rate');
  }

  const raw = analyzeSpectrum(capture.samples, {
    sampleRateHz,
    window,
    displayFloorDbfs: Math.min(displayFloorDbfs, -240),
  });
  const coherentReference = analyzeSpectrum(
    Array.from({ length: capture.samples.length }, () => ({ re: 1, im: 0 })),
    {
      sampleRateHz,
      window,
      displayFloorDbfs: -300,
    },
  );
  const fftBinWidthHz = Number(raw.resolutionBandwidthHz);
  const halfKernelBins = Math.max(1, Math.ceil((2 * rbwHz) / fftBinWidthHz));
  const floorPower = 10 ** (displayFloorDbfs / 10);
  const referenceCenterIndex = coherentReference.bins.findIndex(
    ({ frequencyHz }) => Number(frequencyHz) === 0,
  );
  if (referenceCenterIndex < 0) throw new RangeError('Coherent RBW reference bin is missing');
  let coherentCalibrationPower = 0;
  for (let offset = -halfKernelBins; offset <= halfKernelBins; offset += 1) {
    const sourceIndex = (
      referenceCenterIndex + offset + coherentReference.bins.length
    ) % coherentReference.bins.length;
    const source = coherentReference.bins[sourceIndex];
    if (source === undefined) continue;
    const deltaHz = offset * fftBinWidthHz;
    const powerResponse = Math.exp(-4 * Math.log(2) * (deltaHz / rbwHz) ** 2);
    coherentCalibrationPower += source.amplitude * source.amplitude * powerResponse;
  }
  if (!(coherentCalibrationPower > 0)) {
    throw new RangeError('Coherent RBW calibration power must be positive');
  }
  const bins = raw.bins.map((bin, binIndex) => {
    let integratedPower = 0;
    for (let offset = -halfKernelBins; offset <= halfKernelBins; offset += 1) {
      const sourceIndex = (binIndex + offset + raw.bins.length) % raw.bins.length;
      const source = raw.bins[sourceIndex];
      if (source === undefined) continue;
      const deltaHz = offset * fftBinWidthHz;
      const powerResponse = Math.exp(-4 * Math.log(2) * (deltaHz / rbwHz) ** 2);
      integratedPower += source.amplitude * source.amplitude * powerResponse;
    }
    return {
      index: bin.index,
      frequencyHz: Number(bin.frequencyHz),
      powerDbfs: 10 * Math.log10(Math.max(
        integratedPower / coherentCalibrationPower,
        floorPower,
      )),
    };
  });

  return { bins, rbwHz, fftBinWidthHz, window };
}
