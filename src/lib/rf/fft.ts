import type { Complex, WindowKind } from '../../types';
import { add, complex, expj, multiply, multiplyReal, subtract } from './complex';

export interface WindowMetrics {
  readonly coefficients: readonly number[];
  readonly coherentGain: number;
  readonly equivalentNoiseBandwidthBins: number;
}

export function isPowerOfTwo(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function reverseBits(value: number, bitCount: number): number {
  let result = 0;
  for (let bit = 0; bit < bitCount; bit += 1) {
    result = (result << 1) | ((value >>> bit) & 1);
  }
  return result;
}

/**
 * Radix-2 DIT FFT. The forward transform is unscaled and the inverse is scaled
 * by 1/N, matching the convention used by most spectrum analyzers.
 */
export function fft(input: readonly Complex[], inverse = false): Complex[] {
  const sampleCount = input.length;
  if (!isPowerOfTwo(sampleCount)) {
    throw new RangeError(`FFT length must be a positive power of two; received ${sampleCount}`);
  }

  const bitCount = Math.log2(sampleCount);
  const output = Array.from({ length: sampleCount }, (_, index) => {
    const source = input[reverseBits(index, bitCount)];
    if (source === undefined) throw new RangeError('FFT source index is out of bounds');
    return complex(source.re, source.im);
  });

  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= sampleCount; size *= 2) {
    const half = size / 2;
    const phaseStep = (sign * 2 * Math.PI) / size;

    for (let start = 0; start < sampleCount; start += size) {
      for (let offset = 0; offset < half; offset += 1) {
        const evenIndex = start + offset;
        const oddIndex = evenIndex + half;
        const even = output[evenIndex];
        const odd = output[oddIndex];
        if (even === undefined || odd === undefined) {
          throw new RangeError('FFT butterfly index is out of bounds');
        }

        const rotatedOdd = multiply(odd, expj(phaseStep * offset));
        output[evenIndex] = add(even, rotatedOdd);
        output[oddIndex] = subtract(even, rotatedOdd);
      }
    }
  }

  return inverse
    ? output.map((value) => multiplyReal(value, 1 / sampleCount))
    : output;
}

export function ifft(input: readonly Complex[]): Complex[] {
  return fft(input, true);
}

export function fftShift<T>(values: readonly T[]): T[] {
  const split = Math.ceil(values.length / 2);
  return [...values.slice(split), ...values.slice(0, split)];
}

/** Periodic windows are used so an FFT-length Hann window has CG=0.5 exactly. */
export function createWindow(kind: WindowKind, sampleCount: number): WindowMetrics {
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
    throw new RangeError(`Window length must be a positive integer; received ${sampleCount}`);
  }

  if (sampleCount === 1) {
    return {
      coefficients: [1],
      coherentGain: 1,
      equivalentNoiseBandwidthBins: 1,
    };
  }

  const coefficients = Array.from({ length: sampleCount }, (_, index) => {
    const angle = (2 * Math.PI * index) / sampleCount;
    switch (kind) {
      case 'rectangular':
        return 1;
      case 'hann':
        return 0.5 - 0.5 * Math.cos(angle);
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(angle);
      case 'blackman':
        return 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
    }
  });

  const sum = coefficients.reduce((total, value) => total + value, 0);
  const sumSquares = coefficients.reduce((total, value) => total + value * value, 0);

  return {
    coefficients,
    coherentGain: sum / sampleCount,
    equivalentNoiseBandwidthBins: (sampleCount * sumSquares) / (sum * sum),
  };
}

export function applyWindow(
  samples: readonly Complex[],
  coefficients: readonly number[],
): Complex[] {
  if (samples.length !== coefficients.length) {
    throw new RangeError(
      `Sample and window lengths must match; received ${samples.length} and ${coefficients.length}`,
    );
  }

  return samples.map((sample, index) => {
    const coefficient = coefficients[index];
    if (coefficient === undefined) throw new RangeError('Window index is out of bounds');
    return multiplyReal(sample, coefficient);
  });
}
