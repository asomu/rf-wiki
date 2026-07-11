import type {
  OfdmSymbol,
  QamOrder,
  ResourceBlockAllocation,
  ResourceGridConfig,
} from '../../types';
import { hertz, seconds } from '../../types';
import { multiply } from './complex';
import { modulateOfdmSymbol, qamConstellationPoint } from './ofdm';
import { createMulberry32 } from './random';
import { allocateResourceBlocks } from './resources';

export interface ResourceAllocationOfdmOptions {
  readonly fftSize?: number;
  readonly cyclicPrefixSamples?: number;
  readonly qamOrder?: QamOrder;
  readonly seed?: number;
  /** Exact frequency-domain power convention for the mapped allocation. */
  readonly powerNormalization?: 'per-subcarrier' | 'fixed-carrier-total';
}

export interface ResourceAllocationOfdmModel {
  readonly allocation: ResourceBlockAllocation;
  readonly symbol: OfdmSymbol;
  readonly sampleRateHz: ReturnType<typeof hertz>;
  readonly usefulSymbolDurationSeconds: ReturnType<typeof seconds>;
  readonly cyclicPrefixDurationSeconds: ReturnType<typeof seconds>;
  readonly firstActiveBinOffset: number;
  readonly lastActiveBinOffset: number;
  /** Bin shift from carrier-grid PRB 0; one RB shift is exactly 12 bins. */
  readonly allocationBinShift: number;
  readonly qamOrder: QamOrder;
  readonly seed: number;
  readonly powerNormalization: 'per-subcarrier' | 'fixed-carrier-total';
  readonly subcarrierAmplitudeScale: number;
  readonly mappedSubcarrierPower: number;
}

/**
 * Maps every subcarrier of one contiguous RB allocation into an educational
 * baseband IFFT. The default 4096-point transform holds the complete Rel-17
 * FR1 100 MHz / 273-RB grid (3276 subcarriers) without collapsing RBs.
 * Reference-signal puncturing, filtering, and windowing are intentionally
 * excluded. Power is explicitly normalized either per mapped subcarrier or
 * to the configured carrier's full-grid total before the 1/N IFFT.
 */
export function createResourceAllocationOfdm(
  config: ResourceGridConfig,
  startResourceBlock: number,
  resourceBlockCount: number,
  options: ResourceAllocationOfdmOptions = {},
): ResourceAllocationOfdmModel {
  const fftSize = options.fftSize ?? 4096;
  const cyclicPrefixSamples = options.cyclicPrefixSamples ?? 256;
  const qamOrder = options.qamOrder ?? 16;
  const seed = options.seed ?? 1701;
  const powerNormalization = options.powerNormalization ?? 'per-subcarrier';
  if (!['per-subcarrier', 'fixed-carrier-total'].includes(powerNormalization)) {
    throw new RangeError(`Unsupported OFDM power normalization: ${powerNormalization}`);
  }
  const allocation = allocateResourceBlocks(config, startResourceBlock, resourceBlockCount);
  const totalCarrierSubcarriers = config.totalResourceBlocks * config.subcarriersPerResourceBlock;
  if (totalCarrierSubcarriers > fftSize) {
    throw new RangeError(
      `FFT size ${fftSize} cannot hold ${totalCarrierSubcarriers} configured carrier subcarriers`,
    );
  }

  const gridFirstBinOffset = -Math.floor(totalCarrierSubcarriers / 2);
  const firstActiveBinOffset = gridFirstBinOffset + allocation.firstSubcarrierIndex;
  const lastActiveBinOffset = firstActiveBinOffset + allocation.subcarrierCount - 1;
  const uniform = createMulberry32(seed);
  const rawMappedSubcarriers = Array.from(
    { length: allocation.subcarrierCount },
    (_, localSubcarrierIndex) => ({
      offsetFromDc: firstActiveBinOffset + localSubcarrierIndex,
      value: qamConstellationPoint(Math.floor(uniform() * qamOrder), qamOrder),
    }),
  );
  const rawMappedPower = rawMappedSubcarriers.reduce(
    (sum, mapped) => sum + mapped.value.re ** 2 + mapped.value.im ** 2,
    0,
  );
  const targetMappedPower = powerNormalization === 'fixed-carrier-total'
    ? totalCarrierSubcarriers
    : allocation.subcarrierCount;
  const subcarrierAmplitudeScale = Math.sqrt(targetMappedPower / rawMappedPower);
  const mappedSubcarriers = rawMappedSubcarriers.map((mapped) => ({
    ...mapped,
    value: multiply(mapped.value, { re: subcarrierAmplitudeScale, im: 0 }),
  }));
  const mappedSubcarrierPower = mappedSubcarriers.reduce(
    (sum, mapped) => sum + mapped.value.re ** 2 + mapped.value.im ** 2,
    0,
  );
  const symbol = modulateOfdmSymbol(fftSize, cyclicPrefixSamples, mappedSubcarriers);
  const subcarrierSpacingHz = Number(config.subcarrierSpacingKHz) * 1_000;
  const sampleRateHz = fftSize * subcarrierSpacingHz;

  return {
    allocation,
    symbol,
    sampleRateHz: hertz(sampleRateHz),
    usefulSymbolDurationSeconds: seconds(fftSize / sampleRateHz),
    cyclicPrefixDurationSeconds: seconds(cyclicPrefixSamples / sampleRateHz),
    firstActiveBinOffset,
    lastActiveBinOffset,
    allocationBinShift: allocation.firstSubcarrierIndex,
    qamOrder,
    seed,
    powerNormalization,
    subcarrierAmplitudeScale,
    mappedSubcarrierPower,
  };
}
