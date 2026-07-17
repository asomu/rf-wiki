import { describe, expect, it } from 'vitest';
import { createResidualPhaseTrace, simulateQpskRecovery } from '../../src/lib/cellular';

describe('educational QPSK receiver recovery', () => {
  it('recovers the transmitted dibit exactly through a clean unity channel', () => {
    const result = simulateQpskRecovery({
      transmittedDibit: '00',
      channelMagnitude: 1,
      channelPhaseDegrees: 0,
      residualFrequencyOffsetHz: 0,
      noiseVectorMagnitude: 0,
      observationTimeMilliseconds: 1,
    });

    expect(result.decidedDibit).toBe('00');
    expect(result.equalizedSymbol.re).toBeCloseTo(Math.SQRT1_2, 12);
    expect(result.equalizedSymbol.im).toBeCloseTo(Math.SQRT1_2, 12);
    expect(result.equalizedEvmPercent).toBeCloseTo(0, 12);
    expect(result.bitErrorCount).toBe(0);
  });

  it('removes a known common gain and phase coefficient before decision', () => {
    const result = simulateQpskRecovery({
      transmittedDibit: '11',
      channelMagnitude: 0.42,
      channelPhaseDegrees: 73,
      residualFrequencyOffsetHz: 0,
      noiseVectorMagnitude: 0,
      observationTimeMilliseconds: 1,
    });

    expect(result.rawEvmPercent).toBeGreaterThan(50);
    expect(result.equalizedEvmPercent).toBeCloseTo(0, 12);
    expect(result.decidedDibit).toBe('11');
    expect(result.bitErrorCount).toBe(0);
  });

  it('keeps residual frequency offset as a deterministic phase drift after common-channel correction', () => {
    const result = simulateQpskRecovery({
      transmittedDibit: '00',
      channelMagnitude: 0.8,
      channelPhaseDegrees: -41,
      residualFrequencyOffsetHz: 100,
      noiseVectorMagnitude: 0,
      observationTimeMilliseconds: 1,
    });
    const trace = createResidualPhaseTrace(100, 1, 3);

    expect(result.phaseDriftDegrees).toBeCloseTo(36, 12);
    expect(result.equalizedEvmPercent).toBeGreaterThan(60);
    expect(trace).toEqual([
      { timeMilliseconds: 0, phaseDegrees: 0 },
      { timeMilliseconds: 0.5, phaseDegrees: 18 },
      { timeMilliseconds: 1, phaseDegrees: 36 },
    ]);
  });

  it('leaves deterministic noise as a non-zero equalized error vector', () => {
    const result = simulateQpskRecovery({
      transmittedDibit: '10',
      channelMagnitude: 1,
      channelPhaseDegrees: 0,
      residualFrequencyOffsetHz: 0,
      noiseVectorMagnitude: 0.1,
      observationTimeMilliseconds: 1,
    });

    expect(result.equalizedEvmPercent).toBeCloseTo(10, 12);
    expect(result.decidedDibit).toBe('10');
    expect(result.bitErrorCount).toBe(0);
  });

  it('reports a bit error when residual rotation crosses a QPSK decision boundary', () => {
    const result = simulateQpskRecovery({
      transmittedDibit: '00',
      channelMagnitude: 1,
      channelPhaseDegrees: 0,
      residualFrequencyOffsetHz: 150,
      noiseVectorMagnitude: 0,
      observationTimeMilliseconds: 1,
    });

    expect(result.phaseDriftDegrees).toBeCloseTo(54, 12);
    expect(result.equalizedSymbol.re).toBeLessThan(0);
    expect(result.equalizedSymbol.im).toBeGreaterThan(0);
    expect(result.decidedDibit).toBe('01');
    expect(result.bitErrorCount).toBe(1);
  });
});
