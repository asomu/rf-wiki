import type {
  DBm,
  Decibels,
  Degrees,
  Hertz,
  Impedance,
  Kilohertz,
  Megahertz,
  Ohms,
  Seconds,
  Watts,
} from './units';

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export type WindowKind = 'rectangular' | 'hann' | 'hamming' | 'blackman';

export interface SpectrumTone {
  /** Complex-baseband offset from the capture center. */
  readonly frequencyHz: Hertz;
  readonly amplitude: number;
  readonly phaseDegrees: Degrees;
}

export interface SpectrumScenario {
  readonly sampleRateHz: Hertz;
  readonly sampleCount: number;
  readonly tones: readonly SpectrumTone[];
  readonly noiseRms: number;
  readonly seed: number;
  readonly window: WindowKind;
}

export interface SpectrumBin {
  readonly index: number;
  readonly frequencyHz: Hertz;
  readonly value: Complex;
  /** Coherent-gain-corrected complex amplitude relative to full scale. */
  readonly amplitude: number;
  readonly magnitudeDbfs: number;
  readonly phaseDegrees: Degrees;
}

export interface SpectrumResult {
  readonly bins: readonly SpectrumBin[];
  readonly resolutionBandwidthHz: Hertz;
  readonly equivalentNoiseBandwidthHz: Hertz;
  readonly coherentGain: number;
  readonly window: WindowKind;
}

export interface IQSample extends Complex {
  readonly timeSeconds: Seconds;
}

export interface IQCapture {
  readonly sampleRateHz: Hertz;
  readonly centerFrequencyHz: Hertz;
  readonly samples: readonly IQSample[];
}

export type QamOrder = 4 | 16 | 64 | 256;

export interface OfdmMappedSubcarrier {
  /** Integer FFT-bin offset from DC. */
  readonly offsetFromDc: number;
  readonly value: Complex;
}

export interface OfdmSymbol {
  readonly fftSize: number;
  readonly cyclicPrefixSamples: number;
  readonly mappedSubcarriers: readonly OfdmMappedSubcarrier[];
  readonly frequencyBins: readonly Complex[];
  readonly usefulSamples: readonly Complex[];
  readonly samplesWithCyclicPrefix: readonly Complex[];
}

export type RadioStandard = 'LTE' | 'NR';
/** Release 17 split: FR2-2 adds 480/960 kHz SCS and wider channel bandwidths. */
export type FrequencyRange = 'FR1' | 'FR2-1' | 'FR2-2';

export interface ResourceGridConfig {
  readonly standard: RadioStandard;
  readonly channelBandwidthMHz: Megahertz;
  readonly subcarrierSpacingKHz: Kilohertz;
  readonly totalResourceBlocks: number;
  readonly subcarriersPerResourceBlock: 12;
  readonly symbolsPerGridTimeUnit: 14;
  /** LTE uses one 1 ms subframe; NR uses one numerology-dependent slot. */
  readonly gridTimeUnit: 'subframe' | 'slot';
  readonly gridTimeUnitDurationSeconds: Seconds;
  readonly frequencyRange: FrequencyRange;
}

export interface ResourceBlockAllocation {
  readonly config: ResourceGridConfig;
  /** Resource block index measured from the lowest configured RB. */
  readonly startResourceBlock: number;
  readonly resourceBlockCount: number;
  readonly firstSubcarrierIndex: number;
  readonly subcarrierCount: number;
  readonly occupiedBandwidthHz: Hertz;
  readonly lowEdgeOffsetHz: Hertz;
  readonly highEdgeOffsetHz: Hertz;
  readonly centerOffsetHz: Hertz;
}

export interface SParameterNetwork {
  readonly s11: Complex;
  readonly s12: Complex;
  readonly s21: Complex;
  readonly s22: Complex;
  readonly referenceImpedanceOhms: Ohms;
}

export interface PowerWaveState {
  readonly incident: Complex;
  readonly reflected: Complex;
  readonly incidentPowerWatts: Watts;
  readonly reflectedPowerWatts: Watts;
  readonly acceptedPowerWatts: Watts;
}

export interface CouplerModel {
  readonly couplingDb: Decibels;
  readonly isolationDb: Decibels;
  readonly directivityDb: Decibels;
  readonly mainLineLossDb: Decibels;
  readonly excessLossDb: Decibels;
  readonly throughCoefficient: Complex;
  readonly coupledCoefficient: Complex;
  readonly isolatedCoefficient: Complex;
}

export interface PullSweepPoint {
  readonly gamma: Complex;
  readonly impedance: Impedance;
  /** Source power available to the tuner/DUT input reference plane. */
  readonly availableInputPowerDbm: DBm;
  /** Net RF power accepted at the DUT input reference plane. */
  readonly acceptedInputPowerDbm: DBm;
  readonly outputPowerDbm: DBm;
  readonly gainDb: Decibels;
  readonly paePercent: number;
  readonly evmPercent: number;
  /** Adjacent-channel leakage ratio; a more-negative value is better. */
  readonly aclrDbc: Decibels;
  readonly stable: boolean;
}

export type PullMetric =
  | 'outputPowerDbm'
  | 'gainDb'
  | 'paePercent'
  | 'evmPercent'
  | 'aclrDbc';

export type PullInputPowerCondition = 'constant-available' | 'constant-accepted';

export interface PullMetricOptima {
  readonly outputPowerDbm: Complex;
  readonly gainDb: Complex;
  readonly paePercent: Complex;
  readonly evmPercent: Complex;
  readonly aclrDbc: Complex;
}

export interface LoadPullSweep {
  readonly kind: 'load' | 'source';
  readonly referenceImpedanceOhms: Ohms;
  /** Backward-compatible alias for the output-power optimum. */
  readonly optimumGamma: Complex;
  readonly metricOptima: PullMetricOptima;
  readonly inputPowerCondition: PullInputPowerCondition;
  readonly points: readonly PullSweepPoint[];
  readonly resolution: number;
}

export interface PaOperatingPoint {
  readonly inputPowerDbm: DBm;
  readonly idealOutputPowerDbm: DBm;
  readonly outputPowerDbm: DBm;
  readonly gainDb: Decibels;
  readonly compressionDb: Decibels;
  readonly phaseShiftDegrees: Degrees;
  readonly dcPowerWatts: Watts;
  readonly paePercent: number;
  readonly evmPercent: number;
  readonly aclrDbc: Decibels;
}
