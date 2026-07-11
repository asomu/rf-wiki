import type { Complex, IQCapture, IQSample, SpectrumScenario } from '../../types';
import { degrees, hertz, seconds } from '../../types';
import {
  add,
  expj,
  fromPolarDegrees,
  magnitude,
  multiply,
  phaseDegrees,
} from './complex';
import { createGaussianNoise } from './random';

export interface IQToneDefinition {
  /** Baseband offset from the capture center frequency. */
  readonly offsetFrequencyHz: number;
  /** Peak complex-envelope magnitude. */
  readonly amplitude: number;
  readonly phaseDegrees?: number;
}

export interface CreateIQCaptureOptions {
  readonly sampleRateHz: number;
  readonly sampleCount: number;
  readonly centerFrequencyHz?: number;
  readonly tones: readonly IQToneDefinition[];
  /** Total complex RMS noise; I and Q each receive noiseRms/sqrt(2). */
  readonly noiseRms?: number;
  readonly seed?: number;
}

export interface IQPolarSample {
  readonly timeSeconds: number;
  readonly magnitude: number;
  readonly phaseDegrees: number;
}

export function createIqCapture(options: CreateIQCaptureOptions): IQCapture {
  const {
    sampleRateHz,
    sampleCount,
    tones,
    centerFrequencyHz = 0,
    noiseRms = 0,
    seed = 1,
  } = options;

  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError(`Sample rate must be positive; received ${sampleRateHz}`);
  }
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
    throw new RangeError(`Sample count must be a positive integer; received ${sampleCount}`);
  }
  if (!Number.isFinite(noiseRms) || noiseRms < 0) {
    throw new RangeError(`Noise RMS must be non-negative; received ${noiseRms}`);
  }
  for (const tone of tones) {
    if (Math.abs(tone.offsetFrequencyHz) >= sampleRateHz / 2) {
      throw new RangeError(
        `Tone offset ${tone.offsetFrequencyHz} Hz must lie inside the Nyquist interval`,
      );
    }
    if (!Number.isFinite(tone.amplitude) || tone.amplitude < 0) {
      throw new RangeError(`Tone amplitude must be non-negative; received ${tone.amplitude}`);
    }
  }

  const gaussian = createGaussianNoise(seed);
  const quadratureNoiseSigma = noiseRms / Math.SQRT2;
  const samples: IQSample[] = Array.from({ length: sampleCount }, (_, index) => {
    const time = index / sampleRateHz;
    let value: Complex = { re: 0, im: 0 };

    for (const tone of tones) {
      const initialPhase = tone.phaseDegrees ?? 0;
      const phase = 2 * Math.PI * tone.offsetFrequencyHz * time;
      value = add(
        value,
        multiply(fromPolarDegrees(tone.amplitude, initialPhase), expj(phase)),
      );
    }

    if (noiseRms > 0) {
      value = add(value, {
        re: gaussian() * quadratureNoiseSigma,
        im: gaussian() * quadratureNoiseSigma,
      });
    }

    return {
      ...value,
      timeSeconds: seconds(time),
    };
  });

  return {
    sampleRateHz: hertz(sampleRateHz),
    centerFrequencyHz: hertz(centerFrequencyHz),
    samples,
  };
}

export function createIqCaptureFromSpectrumScenario(
  scenario: SpectrumScenario,
  centerFrequencyHz = 0,
): IQCapture {
  return createIqCapture({
    sampleRateHz: Number(scenario.sampleRateHz),
    sampleCount: scenario.sampleCount,
    centerFrequencyHz,
    tones: scenario.tones.map((tone) => ({
      offsetFrequencyHz: Number(tone.frequencyHz),
      amplitude: tone.amplitude,
      phaseDegrees: Number(tone.phaseDegrees),
    })),
    noiseRms: scenario.noiseRms,
    seed: scenario.seed,
  });
}

export function iqToPolar(
  samples: readonly Complex[],
  sampleRateHz: number,
): IQPolarSample[] {
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError(`Sample rate must be positive; received ${sampleRateHz}`);
  }

  return samples.map((sample, index) => ({
    timeSeconds: index / sampleRateHz,
    magnitude: magnitude(sample),
    phaseDegrees: phaseDegrees(sample),
  }));
}

export function captureToPolar(capture: IQCapture): IQPolarSample[] {
  return capture.samples.map((sample) => ({
    timeSeconds: Number(sample.timeSeconds),
    magnitude: magnitude(sample),
    phaseDegrees: phaseDegrees(sample),
  }));
}

export function frequencyShift(
  samples: readonly Complex[],
  sampleRateHz: number,
  shiftFrequencyHz: number,
): Complex[] {
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError(`Sample rate must be positive; received ${sampleRateHz}`);
  }

  return samples.map((sample, index) =>
    multiply(sample, expj((2 * Math.PI * shiftFrequencyHz * index) / sampleRateHz)),
  );
}

/** Reconstructs the real RF waveform Re{x(t)e^(j2πfct)} from complex IQ. */
export function iqToRealWaveform(
  samples: readonly Complex[],
  sampleRateHz: number,
  carrierFrequencyHz: number,
): number[] {
  return samples.map((sample, index) => {
    const carrierPhase = (2 * Math.PI * carrierFrequencyHz * index) / sampleRateHz;
    return sample.re * Math.cos(carrierPhase) - sample.im * Math.sin(carrierPhase);
  });
}

export function estimateToneOffsetHz(capture: IQCapture): number {
  if (capture.samples.length < 2) {
    throw new RangeError('At least two IQ samples are required to estimate frequency');
  }

  let accumulated: Complex = { re: 0, im: 0 };
  for (let index = 1; index < capture.samples.length; index += 1) {
    const current = capture.samples[index];
    const previous = capture.samples[index - 1];
    if (current === undefined || previous === undefined) continue;
    accumulated = add(accumulated, multiply(current, { re: previous.re, im: -previous.im }));
  }

  return (phaseDegrees(accumulated) / 360) * Number(capture.sampleRateHz);
}

export function iqMagnitudePhase(value: Complex): {
  readonly magnitude: number;
  readonly phaseDegrees: ReturnType<typeof degrees>;
} {
  return {
    magnitude: magnitude(value),
    phaseDegrees: degrees(phaseDegrees(value)),
  };
}
