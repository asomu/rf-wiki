import type {
  Complex,
  OfdmMappedSubcarrier,
  OfdmSymbol,
  QamOrder,
} from '../../types';
import { complex, magnitudeSquared, subtract } from './complex';
import { fft, ifft, isPowerOfTwo } from './fft';

function validateQamOrder(order: number): asserts order is QamOrder {
  if (order !== 4 && order !== 16 && order !== 64 && order !== 256) {
    throw new RangeError(`QAM order must be 4, 16, 64, or 256; received ${order}`);
  }
}

/**
 * Maps an integer label to a square Gray-coded QAM point. The constellation is
 * normalized to unit average symbol power across all labels.
 */
export function qamConstellationPoint(label: number, order: QamOrder): Complex {
  validateQamOrder(order);
  if (!Number.isSafeInteger(label) || label < 0 || label >= order) {
    throw new RangeError(`QAM label must be in 0…${order - 1}; received ${label}`);
  }

  const side = Math.sqrt(order);
  const iBinary = label % side;
  const qBinary = Math.floor(label / side);
  const iGray = iBinary ^ (iBinary >>> 1);
  const qGray = qBinary ^ (qBinary >>> 1);
  const normalization = Math.sqrt((2 * (order - 1)) / 3);

  return {
    re: (2 * iGray - (side - 1)) / normalization,
    im: (2 * qGray - (side - 1)) / normalization,
  };
}

export function nearestQamLabel(value: Complex, order: QamOrder): number {
  validateQamOrder(order);
  let bestLabel = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let label = 0; label < order; label += 1) {
    const distance = magnitudeSquared(subtract(value, qamConstellationPoint(label, order)));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLabel = label;
    }
  }
  return bestLabel;
}

function offsetToBin(offsetFromDc: number, fftSize: number): number {
  if (!Number.isSafeInteger(offsetFromDc)) {
    throw new RangeError(`OFDM subcarrier offset must be an integer; received ${offsetFromDc}`);
  }
  if (offsetFromDc < -fftSize / 2 || offsetFromDc >= fftSize / 2) {
    throw new RangeError(
      `OFDM subcarrier offset ${offsetFromDc} lies outside [-${fftSize / 2}, ${fftSize / 2 - 1}]`,
    );
  }
  return (offsetFromDc + fftSize) % fftSize;
}

/** IFFT-modulates one OFDM symbol and copies its tail into a cyclic prefix. */
export function modulateOfdmSymbol(
  fftSize: number,
  cyclicPrefixSamples: number,
  mappedSubcarriers: readonly OfdmMappedSubcarrier[],
): OfdmSymbol {
  if (!isPowerOfTwo(fftSize)) {
    throw new RangeError(`OFDM FFT size must be a positive power of two; received ${fftSize}`);
  }
  if (
    !Number.isSafeInteger(cyclicPrefixSamples) ||
    cyclicPrefixSamples < 0 ||
    cyclicPrefixSamples > fftSize
  ) {
    throw new RangeError(`Cyclic prefix must be an integer in 0…${fftSize}`);
  }

  const frequencyBins = Array.from({ length: fftSize }, () => complex(0));
  const occupiedBins = new Set<number>();
  for (const mapped of mappedSubcarriers) {
    const bin = offsetToBin(mapped.offsetFromDc, fftSize);
    if (occupiedBins.has(bin)) {
      throw new RangeError(`OFDM subcarrier ${mapped.offsetFromDc} is mapped more than once`);
    }
    occupiedBins.add(bin);
    frequencyBins[bin] = mapped.value;
  }

  const usefulSamples = ifft(frequencyBins);
  const cyclicPrefix = cyclicPrefixSamples === 0
    ? []
    : usefulSamples.slice(fftSize - cyclicPrefixSamples);

  return {
    fftSize,
    cyclicPrefixSamples,
    mappedSubcarriers: [...mappedSubcarriers],
    frequencyBins,
    usefulSamples,
    samplesWithCyclicPrefix: [...cyclicPrefix, ...usefulSamples],
  };
}

export function demodulateOfdmSymbol(
  samplesWithCyclicPrefix: readonly Complex[],
  fftSize: number,
  cyclicPrefixSamples: number,
): Complex[] {
  if (!isPowerOfTwo(fftSize)) {
    throw new RangeError(`OFDM FFT size must be a positive power of two; received ${fftSize}`);
  }
  if (samplesWithCyclicPrefix.length !== fftSize + cyclicPrefixSamples) {
    throw new RangeError(
      `Expected ${fftSize + cyclicPrefixSamples} OFDM samples; received ${samplesWithCyclicPrefix.length}`,
    );
  }

  return fft(samplesWithCyclicPrefix.slice(cyclicPrefixSamples));
}

export function readOfdmSubcarrier(
  demodulatedBins: readonly Complex[],
  offsetFromDc: number,
): Complex {
  const bin = offsetToBin(offsetFromDc, demodulatedBins.length);
  const value = demodulatedBins[bin];
  if (value === undefined) throw new RangeError('OFDM bin is out of bounds');
  return value;
}

export function ofdmAveragePower(symbol: OfdmSymbol): number {
  // With this project's 1/N IFFT, Parseval gives Σ|x[n]|²=(1/N)Σ|X[k]|².
  // Dividing by N samples therefore gives average power Σ|X[k]|²/N².
  return symbol.usefulSamples.reduce(
    (total, sample) => total + magnitudeSquared(sample),
    0,
  ) / symbol.fftSize;
}
