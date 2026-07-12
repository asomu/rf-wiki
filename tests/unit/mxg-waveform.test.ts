import { describe, expect, it } from 'vitest';
import type { IqWaveformAsset } from '../../src/types/instruments';
import { hertz } from '../../src/types/units';
import {
  buildN5182bWaveformTransfer,
  calculateIqWaveformMetrics,
  encodeIeee4882DefiniteBlock,
  encodeN5182bIqWaveform,
  N5182B_IQ_FULL_SCALE,
  N5182B_IQ_NEGATIVE_FULL_SCALE,
  N5182B_WAVEFORM_MINIMUM_POINTS,
  n5182bBuiltInWaveformRecords,
  n5182bBuiltInWaveforms,
  validateN5182bWaveform,
} from '../../src/lib/instruments';

function constantWaveform(
  sampleCount = 512,
  i = 1,
  q = -1,
  normalization: IqWaveformAsset['normalization'] = 'none',
): IqWaveformAsset {
  return {
    id: 'fixture',
    name: 'Fixture',
    sampleRateHz: hertz(8_000_000),
    samples: Array.from({ length: sampleCount }, () => ({ re: i, im: q })),
    normalization,
    playback: 'continuous',
  };
}

describe('N5182B built-in IQ waveform math', () => {
  it('keeps every built-in waveform finite and at or above the supported minimum length', () => {
    expect(n5182bBuiltInWaveforms.length).toBeGreaterThanOrEqual(3);
    for (const waveform of n5182bBuiltInWaveforms) {
      expect(() => validateN5182bWaveform(waveform)).not.toThrow();
      expect(waveform.samples.length).toBeGreaterThanOrEqual(N5182B_WAVEFORM_MINIMUM_POINTS);
      expect(waveform.samples.every(({ re, im }) => Number.isFinite(re) && Number.isFinite(im))).toBe(true);
    }
  });

  it('exposes deterministic single-tone, two-tone, and OFDM-like playback records', () => {
    const byId = Object.fromEntries(n5182bBuiltInWaveforms.map((waveform) => [waveform.id, waveform]));
    expect(Object.keys(byId)).toEqual(expect.arrayContaining([
      'single_tone',
      'two_tone',
      'ofdm_like',
    ]));

    const singleTone = calculateIqWaveformMetrics(byId.single_tone!);
    const twoTone = calculateIqWaveformMetrics(byId.two_tone!);
    const ofdmLike = calculateIqWaveformMetrics(byId.ofdm_like!);
    expect(singleTone.crestFactorDb).toBeCloseTo(0, 12);
    expect(twoTone.crestFactorDb).toBeCloseTo(10 * Math.log10(2), 10);
    expect(ofdmLike.crestFactorDb).toBeGreaterThan(5);
    expect(ofdmLike.crestFactorDb).toBeLessThan(15);

    expect(n5182bBuiltInWaveformRecords.map(({ memoryPath }) => memoryPath)).toEqual(
      expect.arrayContaining([
        'WFM1:SINGLE_TONE',
        'WFM1:TWO_TONE',
        'WFM1:OFDM_LIKE',
      ]),
    );
  });

  it('links sample count and sample rate to duration and calculates envelope metrics', () => {
    const metrics = calculateIqWaveformMetrics(constantWaveform());
    expect(metrics.sampleCount).toBe(512);
    expect(metrics.sampleRateHz).toBe(8e6);
    expect(metrics.durationSeconds).toBeCloseTo(64e-6, 12);
    expect(metrics.peakComponent).toBe(1);
    expect(metrics.peakEnvelope).toBeCloseTo(Math.sqrt(2), 12);
    expect(metrics.rmsEnvelope).toBeCloseTo(Math.sqrt(2), 12);
    expect(metrics.crestFactorDb).toBeCloseTo(0, 12);
  });

  it('enforces the official 60-point minimum without inventing a point quantum', () => {
    expect(() => validateN5182bWaveform(constantWaveform(59))).toThrow(/at least 60/);
    expect(() => validateN5182bWaveform(constantWaveform(60))).not.toThrow();
    expect(() => validateN5182bWaveform(constantWaveform(61))).not.toThrow();

    const nonFinite = constantWaveform(60);
    const badSamples = [...nonFinite.samples];
    badSamples[7] = { re: Number.NaN, im: 0 };
    expect(() => validateN5182bWaveform({ ...nonFinite, samples: badSamples })).toThrow(/finite/);
  });

  it('rejects over-range unnormalized IQ component data', () => {
    expect(() => encodeN5182bIqWaveform(constantWaveform(512, 1.01, 0))).toThrow(/full scale/);
  });
});

describe('N5182B signed-int16 IQ and IEEE 488.2 block encoding', () => {
  it('encodes big-endian signed int16 samples in I,Q order', () => {
    const encoded = encodeN5182bIqWaveform(constantWaveform());
    expect(encoded.payload).toHaveLength(512 * 4);
    expect(encoded.byteOrder).toBe('big-endian');
    expect(encoded.encoding).toBe('signed-int16-interleaved-iq');

    const first = Array.from(encoded.payload.slice(0, 4));
    expect(first).toEqual([0x7f, 0xff, 0x80, 0x00]);
    const view = new DataView(encoded.payload.buffer, encoded.payload.byteOffset, encoded.payload.byteLength);
    expect(view.getInt16(0, false)).toBe(N5182B_IQ_FULL_SCALE);
    expect(view.getInt16(2, false)).toBe(N5182B_IQ_NEGATIVE_FULL_SCALE);
  });

  it('applies a deterministic peak-component scale before quantization', () => {
    const encoded = encodeN5182bIqWaveform(constantWaveform(512, 2, -1, 'peak-component'));
    expect(encoded.scaleApplied).toBe(0.5);
    const view = new DataView(encoded.payload.buffer, encoded.payload.byteOffset, encoded.payload.byteLength);
    expect(view.getInt16(0, false)).toBe(32_767);
    expect(view.getInt16(2, false)).toBe(-16_384);
  });

  it('builds an exact definite-length block and MMEMory:DATA prefix', () => {
    const payload = Uint8Array.from([1, 2, 3, 4, 5]);
    expect(new TextDecoder().decode(encodeIeee4882DefiniteBlock(payload).slice(0, 3))).toBe('#15');

    const encoded = encodeN5182bIqWaveform(constantWaveform());
    const transfer = buildN5182bWaveformTransfer('WFM1:PA_QPSK', encoded);
    const prefix = new TextEncoder().encode(':MMEMory:DATA "WFM1:PA_QPSK",');
    expect(Array.from(transfer.message.slice(0, prefix.length))).toEqual(Array.from(prefix));
    expect(transfer.definiteBlock[0]).toBe('#'.charCodeAt(0));
    expect(new TextDecoder().decode(transfer.definiteBlock.slice(0, 6))).toBe('#42048');
    expect(transfer.message.byteLength).toBe(prefix.byteLength + transfer.definiteBlock.byteLength);
  });

  it('rejects unsafe or ambiguous waveform memory paths', () => {
    const encoded = encodeN5182bIqWaveform(constantWaveform());
    expect(() => buildN5182bWaveformTransfer('../waveform', encoded)).toThrow(/WFM1/);
    expect(() => buildN5182bWaveformTransfer('WFM1:bad"name', encoded)).toThrow(/WFM1/);
  });
});
