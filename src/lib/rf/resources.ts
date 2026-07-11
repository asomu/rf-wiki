import type {
  FrequencyRange,
  ResourceBlockAllocation,
  ResourceGridConfig,
} from '../../types';
import { hertz, kilohertz, megahertz, seconds } from '../../types';

const LTE_RESOURCE_BLOCKS: Readonly<Record<string, number>> = Object.freeze({
  '1.4': 6,
  '3': 15,
  '5': 25,
  '10': 50,
  '15': 75,
  '20': 100,
});

const NR_FR1_RESOURCE_BLOCKS: Readonly<Record<string, number>> = Object.freeze({
  '5/15': 25,
  '5/30': 11,
  '10/15': 52,
  '10/30': 24,
  '10/60': 11,
  '15/15': 79,
  '15/30': 38,
  '15/60': 18,
  '20/15': 106,
  '20/30': 51,
  '20/60': 24,
  '25/15': 133,
  '25/30': 65,
  '25/60': 31,
  '30/15': 160,
  '30/30': 78,
  '30/60': 38,
  '40/15': 216,
  '40/30': 106,
  '40/60': 51,
  '50/15': 270,
  '50/30': 133,
  '50/60': 65,
  '60/30': 162,
  '60/60': 79,
  '70/30': 189,
  '70/60': 93,
  '80/30': 217,
  '80/60': 107,
  '90/30': 245,
  '90/60': 121,
  '100/30': 273,
  '100/60': 135,
});

const NR_FR2_1_RESOURCE_BLOCKS: Readonly<Record<string, number>> = Object.freeze({
  '50/60': 66,
  '50/120': 32,
  '100/60': 132,
  '100/120': 66,
  '200/60': 264,
  '200/120': 132,
  '400/120': 264,
});

// 3GPP TS 38.104 V17.7.0, table 5.3.2-3 (FR2-2).
const NR_FR2_2_RESOURCE_BLOCKS: Readonly<Record<string, number>> = Object.freeze({
  '100/120': 66,
  '400/120': 264,
  '400/480': 66,
  '800/480': 124,
  '1600/480': 248,
  '400/960': 33,
  '800/960': 62,
  '1600/960': 124,
  '2000/960': 148,
});

function integerKey(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

/** LTE E-UTRA transmission bandwidth configuration from 3GPP TS 36.104. */
export function getLteResourceGrid(channelBandwidthMHz: number): ResourceGridConfig {
  const totalResourceBlocks = LTE_RESOURCE_BLOCKS[integerKey(channelBandwidthMHz)];
  if (totalResourceBlocks === undefined) {
    throw new RangeError(
      `Unsupported LTE bandwidth ${channelBandwidthMHz} MHz; valid values are 1.4, 3, 5, 10, 15, 20 MHz`,
    );
  }

  return {
    standard: 'LTE',
    channelBandwidthMHz: megahertz(channelBandwidthMHz),
    subcarrierSpacingKHz: kilohertz(15),
    totalResourceBlocks,
    subcarriersPerResourceBlock: 12,
    symbolsPerGridTimeUnit: 14,
    gridTimeUnit: 'subframe',
    gridTimeUnitDurationSeconds: seconds(0.001),
    frequencyRange: 'FR1',
  };
}

/** NR maximum transmission bandwidth configuration from 3GPP TS 38.104 Rel-17. */
export function getNrResourceGrid(
  channelBandwidthMHz: number,
  subcarrierSpacingKHz: number,
  frequencyRange: FrequencyRange = 'FR1',
): ResourceGridConfig {
  const table = frequencyRange === 'FR1'
    ? NR_FR1_RESOURCE_BLOCKS
    : frequencyRange === 'FR2-1'
      ? NR_FR2_1_RESOURCE_BLOCKS
      : NR_FR2_2_RESOURCE_BLOCKS;
  const key = `${integerKey(channelBandwidthMHz)}/${integerKey(subcarrierSpacingKHz)}`;
  const totalResourceBlocks = table[key];

  if (totalResourceBlocks === undefined) {
    throw new RangeError(
      `Unsupported NR ${frequencyRange} bandwidth/SCS pair: ${channelBandwidthMHz} MHz / ${subcarrierSpacingKHz} kHz`,
    );
  }

  const numerologySlotSeconds = 0.001 * (15 / subcarrierSpacingKHz);
  return {
    standard: 'NR',
    channelBandwidthMHz: megahertz(channelBandwidthMHz),
    subcarrierSpacingKHz: kilohertz(subcarrierSpacingKHz),
    totalResourceBlocks,
    subcarriersPerResourceBlock: 12,
    symbolsPerGridTimeUnit: 14,
    gridTimeUnit: 'slot',
    gridTimeUnitDurationSeconds: seconds(numerologySlotSeconds),
    frequencyRange,
  };
}

export function occupiedResourceGridBandwidthHz(config: ResourceGridConfig): number {
  return config.totalResourceBlocks *
    config.subcarriersPerResourceBlock *
    Number(config.subcarrierSpacingKHz) *
    1_000;
}

/**
 * Allocates contiguous RBs. `startResourceBlock=0` is the lowest-frequency RB,
 * not DC and not the carrier center.
 */
export function allocateResourceBlocks(
  config: ResourceGridConfig,
  startResourceBlock: number,
  resourceBlockCount: number,
): ResourceBlockAllocation {
  if (!Number.isSafeInteger(startResourceBlock) || startResourceBlock < 0) {
    throw new RangeError(`RB start must be a non-negative integer; received ${startResourceBlock}`);
  }
  if (!Number.isSafeInteger(resourceBlockCount) || resourceBlockCount <= 0) {
    throw new RangeError(`RB count must be a positive integer; received ${resourceBlockCount}`);
  }
  if (startResourceBlock + resourceBlockCount > config.totalResourceBlocks) {
    throw new RangeError(
      `RB allocation [${startResourceBlock}, ${startResourceBlock + resourceBlockCount}) exceeds 0…${config.totalResourceBlocks - 1}`,
    );
  }

  const spacingHz = Number(config.subcarrierSpacingKHz) * 1_000;
  const totalSubcarriers = config.totalResourceBlocks * config.subcarriersPerResourceBlock;
  const firstSubcarrierIndex = startResourceBlock * config.subcarriersPerResourceBlock;
  const subcarrierCount = resourceBlockCount * config.subcarriersPerResourceBlock;
  const gridLowEdgeHz = -(totalSubcarriers * spacingHz) / 2;
  const lowEdgeOffsetHz = gridLowEdgeHz + firstSubcarrierIndex * spacingHz;
  const highEdgeOffsetHz = lowEdgeOffsetHz + subcarrierCount * spacingHz;

  return {
    config,
    startResourceBlock,
    resourceBlockCount,
    firstSubcarrierIndex,
    subcarrierCount,
    occupiedBandwidthHz: hertz(subcarrierCount * spacingHz),
    lowEdgeOffsetHz: hertz(lowEdgeOffsetHz),
    highEdgeOffsetHz: hertz(highEdgeOffsetHz),
    centerOffsetHz: hertz((lowEdgeOffsetHz + highEdgeOffsetHz) / 2),
  };
}

export interface BwpResourceBlockRequest {
  /** BWP start in carrier resource-block coordinates. */
  readonly startResourceBlock: number;
  readonly resourceBlockCount: number;
  /** Allocation start in PRBs relative to the BWP. */
  readonly allocationLocation: number;
  readonly allocationResourceBlockCount: number;
}

export interface BwpResourceBlockAllocation {
  readonly bwpStartResourceBlock: number;
  readonly bwpResourceBlockCount: number;
  readonly allocationLocation: number;
  readonly maxAllocationLocation: number;
  readonly allocation: ResourceBlockAllocation;
}

/** Resolves a BWP-relative PRB allocation into the carrier RB coordinate. */
export function allocateBwpResourceBlocks(
  config: ResourceGridConfig,
  request: BwpResourceBlockRequest,
): BwpResourceBlockAllocation {
  const {
    startResourceBlock,
    resourceBlockCount,
    allocationLocation,
    allocationResourceBlockCount,
  } = request;
  for (const [label, value] of [
    ['BWP start', startResourceBlock],
    ['BWP size', resourceBlockCount],
    ['BWP allocation location', allocationLocation],
    ['BWP allocation size', allocationResourceBlockCount],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${label} must be a non-negative integer; received ${value}`);
    }
  }
  if (resourceBlockCount <= 0 || allocationResourceBlockCount <= 0) {
    throw new RangeError('BWP and allocation RB counts must be positive');
  }
  if (startResourceBlock + resourceBlockCount > config.totalResourceBlocks) {
    throw new RangeError('BWP extends beyond the configured carrier grid');
  }
  if (allocationResourceBlockCount > resourceBlockCount) {
    throw new RangeError('Allocation RB count exceeds the BWP size');
  }
  const maxAllocationLocation = resourceBlockCount - allocationResourceBlockCount;
  if (allocationLocation > maxAllocationLocation) {
    throw new RangeError(
      `BWP allocation location ${allocationLocation} exceeds 0…${maxAllocationLocation}`,
    );
  }

  return {
    bwpStartResourceBlock: startResourceBlock,
    bwpResourceBlockCount: resourceBlockCount,
    allocationLocation,
    maxAllocationLocation,
    allocation: allocateResourceBlocks(
      config,
      startResourceBlock + allocationLocation,
      allocationResourceBlockCount,
    ),
  };
}

export function resourceBlockCenterOffsetHz(
  config: ResourceGridConfig,
  resourceBlockIndex: number,
): number {
  const allocation = allocateResourceBlocks(config, resourceBlockIndex, 1);
  return Number(allocation.centerOffsetHz);
}

export function subcarrierCenterOffsetHz(
  config: ResourceGridConfig,
  subcarrierIndex: number,
): number {
  const totalSubcarriers = config.totalResourceBlocks * config.subcarriersPerResourceBlock;
  if (!Number.isSafeInteger(subcarrierIndex) || subcarrierIndex < 0 || subcarrierIndex >= totalSubcarriers) {
    throw new RangeError(
      `Subcarrier index must be in 0…${totalSubcarriers - 1}; received ${subcarrierIndex}`,
    );
  }

  const spacingHz = Number(config.subcarrierSpacingKHz) * 1_000;
  return (subcarrierIndex + 0.5 - totalSubcarriers / 2) * spacingHz;
}

export function channelGuardBandwidthHz(config: ResourceGridConfig): number {
  return (
    Number(config.channelBandwidthMHz) * 1_000_000 -
    occupiedResourceGridBandwidthHz(config)
  ) / 2;
}
