import type {
  EncodedIqWaveform,
  IqWaveformAsset,
  IqWaveformMetrics,
  WaveformTransfer,
} from '@/types/instruments';
import type { Complex } from '@/types/rf';
import { hertz, seconds } from '@/types/units';

export const N5182B_WAVEFORM_MINIMUM_POINTS = 60;
export const N5182B_IQ_FULL_SCALE = 32_767;
export const N5182B_IQ_NEGATIVE_FULL_SCALE = -32_768;

function assertFiniteComplex(sample: Complex, index: number): void {
  if (!Number.isFinite(sample.re) || !Number.isFinite(sample.im)) {
    throw new RangeError(`IQ sample ${index} must contain finite I and Q values.`);
  }
}

export function validateN5182bWaveform(waveform: IqWaveformAsset): void {
  if (!(waveform.sampleRateHz > 0)) {
    throw new RangeError('Waveform sampleRateHz must be greater than zero.');
  }
  if (waveform.samples.length < N5182B_WAVEFORM_MINIMUM_POINTS) {
    throw new RangeError(`N5182B waveform must contain at least ${N5182B_WAVEFORM_MINIMUM_POINTS} points.`);
  }
  waveform.samples.forEach(assertFiniteComplex);
}

export function calculateIqWaveformMetrics(waveform: IqWaveformAsset): IqWaveformMetrics {
  validateN5182bWaveform(waveform);

  let peakComponent = 0;
  let peakEnvelope = 0;
  let sumEnvelopePower = 0;

  for (const sample of waveform.samples) {
    const envelopePower = sample.re * sample.re + sample.im * sample.im;
    peakComponent = Math.max(peakComponent, Math.abs(sample.re), Math.abs(sample.im));
    peakEnvelope = Math.max(peakEnvelope, Math.sqrt(envelopePower));
    sumEnvelopePower += envelopePower;
  }

  const rmsEnvelope = Math.sqrt(sumEnvelopePower / waveform.samples.length);
  const crestFactorDb = rmsEnvelope > 0
    ? 20 * Math.log10(peakEnvelope / rmsEnvelope)
    : null;

  return {
    sampleCount: waveform.samples.length,
    sampleRateHz: waveform.sampleRateHz,
    durationSeconds: seconds(waveform.samples.length / waveform.sampleRateHz),
    peakComponent,
    peakEnvelope,
    rmsEnvelope,
    crestFactorDb,
  };
}

function normalizedScale(waveform: IqWaveformAsset, metrics: IqWaveformMetrics): number {
  if (waveform.normalization === 'peak-component') {
    return metrics.peakComponent > 1 ? 1 / metrics.peakComponent : 1;
  }
  if (metrics.peakComponent > 1) {
    throw new RangeError('IQ component exceeds normalized full scale; use peak-component normalization.');
  }
  return 1;
}

function int16DacValue(value: number): number {
  const clipped = Math.max(-1, Math.min(1, value));
  return clipped < 0
    ? Math.round(clipped * -N5182B_IQ_NEGATIVE_FULL_SCALE)
    : Math.round(clipped * N5182B_IQ_FULL_SCALE);
}

export function encodeN5182bIqWaveform(waveform: IqWaveformAsset): EncodedIqWaveform {
  const metrics = calculateIqWaveformMetrics(waveform);
  const scaleApplied = normalizedScale(waveform, metrics);
  const payload = new Uint8Array(waveform.samples.length * 4);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

  waveform.samples.forEach((sample, index) => {
    const offset = index * 4;
    view.setInt16(offset, int16DacValue(sample.re * scaleApplied), false);
    view.setInt16(offset + 2, int16DacValue(sample.im * scaleApplied), false);
  });

  return {
    payload,
    metrics,
    scaleApplied,
    byteOrder: 'big-endian',
    encoding: 'signed-int16-interleaved-iq',
  };
}

export function encodeIeee4882DefiniteBlock(payload: Uint8Array): Uint8Array {
  const byteCount = String(payload.byteLength);
  if (byteCount.length > 9) {
    throw new RangeError('IEEE 488.2 definite-length block supports at most nine byte-count digits.');
  }
  const header = new TextEncoder().encode(`#${byteCount.length}${byteCount}`);
  const block = new Uint8Array(header.byteLength + payload.byteLength);
  block.set(header, 0);
  block.set(payload, header.byteLength);
  return block;
}

export function normalizeN5182bWaveformMemoryPath(memoryPath: string): string {
  const normalized = memoryPath.trim();
  if (!/^WFM1:[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new RangeError('Waveform memory path must use WFM1: followed by a simple file name.');
  }
  return normalized;
}

function concatenateBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function buildN5182bWaveformTransfer(
  memoryPath: string,
  encoded: EncodedIqWaveform,
): WaveformTransfer {
  const normalizedPath = normalizeN5182bWaveformMemoryPath(memoryPath);
  const definiteBlock = encodeIeee4882DefiniteBlock(encoded.payload);
  const prefix = new TextEncoder().encode(`:MMEMory:DATA "${normalizedPath}",`);
  return {
    memoryPath: normalizedPath,
    payload: encoded.payload,
    definiteBlock,
    message: concatenateBytes(prefix, definiteBlock),
  };
}

function createComplexToneSamples(
  sampleCount: number,
  normalizedCycles: number,
  amplitude: number,
): readonly Complex[] {
  return Array.from({ length: sampleCount }, (_, index) => {
    const phase = 2 * Math.PI * normalizedCycles * index / sampleCount;
    return { re: amplitude * Math.cos(phase), im: amplitude * Math.sin(phase) };
  });
}

function createTwoToneSamples(
  sampleCount: number,
  firstCycles: number,
  secondCycles: number,
  amplitudePerTone: number,
): readonly Complex[] {
  return Array.from({ length: sampleCount }, (_, index) => {
    const firstPhase = 2 * Math.PI * firstCycles * index / sampleCount;
    const secondPhase = 2 * Math.PI * secondCycles * index / sampleCount;
    return {
      re: amplitudePerTone * (Math.cos(firstPhase) + Math.cos(secondPhase)),
      im: amplitudePerTone * (Math.sin(firstPhase) + Math.sin(secondPhase)),
    };
  });
}

function createOfdmLikeSamples(sampleCount: number, amplitude: number): readonly Complex[] {
  const subcarrierOffsets = [
    ...Array.from({ length: 26 }, (_, index) => index - 26),
    ...Array.from({ length: 26 }, (_, index) => index + 1),
  ];
  const qpsk = [
    { re: 1, im: 1 },
    { re: -1, im: 1 },
    { re: -1, im: -1 },
    { re: 1, im: -1 },
  ] as const;
  const subcarrierScale = amplitude / Math.sqrt(2 * subcarrierOffsets.length);

  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    let re = 0;
    let im = 0;
    subcarrierOffsets.forEach((offset, subcarrierIndex) => {
      const symbol = qpsk[((subcarrierIndex * 29) ^ (subcarrierIndex >> 1) ^ 0b10) & 0b11]!;
      const phase = 2 * Math.PI * offset * sampleIndex / sampleCount;
      const cos = Math.cos(phase);
      const sin = Math.sin(phase);
      re += subcarrierScale * (symbol.re * cos - symbol.im * sin);
      im += subcarrierScale * (symbol.re * sin + symbol.im * cos);
    });
    return { re, im };
  });
}

function createQpskSamples(sampleCount: number, amplitude: number): readonly Complex[] {
  const symbols = [
    { re: 1, im: 1 },
    { re: -1, im: 1 },
    { re: -1, im: -1 },
    { re: 1, im: -1 },
  ] as const;
  const component = amplitude / Math.sqrt(2);
  return Array.from({ length: sampleCount }, (_, index) => {
    // A deterministic 9-bit LFSR-like index keeps the fixture repeatable without Math.random.
    const symbol = symbols[((index * 73) ^ (index >> 2) ^ (index >> 5)) & 0b11]!;
    return { re: symbol.re * component, im: symbol.im * component };
  });
}

export const n5182bBuiltInWaveforms: readonly IqWaveformAsset[] = Object.freeze([
  Object.freeze({
    id: 'single_tone',
    name: 'Single tone · +240 kHz',
    sampleRateHz: hertz(15_360_000),
    samples: Object.freeze(createComplexToneSamples(1024, 16, 0.5)),
    normalization: 'none',
    playback: 'continuous',
  }),
  Object.freeze({
    id: 'two_tone',
    name: 'Two tone · +240 / +600 kHz',
    sampleRateHz: hertz(15_360_000),
    samples: Object.freeze(createTwoToneSamples(1024, 16, 40, 0.35)),
    normalization: 'none',
    playback: 'continuous',
  }),
  Object.freeze({
    id: 'ofdm_like',
    name: 'OFDM-like · 52 deterministic QPSK subcarriers',
    sampleRateHz: hertz(15_360_000),
    samples: Object.freeze(createOfdmLikeSamples(1024, 0.7)),
    normalization: 'peak-component',
    playback: 'continuous',
  }),
  Object.freeze({
    id: 'qpsk-demo',
    name: 'QPSK symbol sequence',
    sampleRateHz: hertz(16_000_000),
    samples: Object.freeze(createQpskSamples(512, 0.8)),
    normalization: 'none',
    playback: 'continuous',
  }),
]);
