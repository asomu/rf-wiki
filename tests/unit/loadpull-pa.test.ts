import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDUCATIONAL_PA,
  bestPullPoint,
  conjugateMismatchFactor,
  evaluatePa,
  generateLoadPullSweep,
  generateSourcePullSweep,
  nearestPullPoint,
  rappOneDbCompressionPoint,
} from '../../src/lib/rf';

describe('load-pull and source-pull surfaces', () => {
  const powerOptimum = { re: 0.3, im: 0.2 };
  const paeOptimum = { re: 0.1, im: 0.32 };
  const evmOptimum = { re: -0.12, im: 0.08 };
  const aclrOptimum = { re: 0.05, im: -0.18 };

  it('uses a physical conjugate-mismatch factor with a maximum of one', () => {
    expect(conjugateMismatchFactor(powerOptimum, powerOptimum)).toBeCloseTo(1, 14);
    expect(conjugateMismatchFactor({ re: 0, im: 0 }, powerOptimum)).toBeCloseTo(0.87, 14);
  });

  it('includes distinct exact optima for power, PAE, EVM, and ACLR', () => {
    const sweep = generateLoadPullSweep({
      optimumGamma: powerOptimum,
      paeOptimumGamma: paeOptimum,
      evmOptimumGamma: evmOptimum,
      aclrOptimumGamma: aclrOptimum,
      inputPowerDbm: 10,
      peakOutputPowerDbm: 32,
      peakPaePercent: 55,
      minimumEvmPercent: 1.5,
      bestAclrDbc: -52,
      resolution: 11,
      smithRadius: 0.8,
    });
    const bestPower = bestPullPoint(sweep, 'outputPowerDbm');
    const bestPae = bestPullPoint(sweep, 'paePercent');
    const bestEvm = bestPullPoint(sweep, 'evmPercent');
    const bestAclr = bestPullPoint(sweep, 'aclrDbc');
    expect(sweep.kind).toBe('load');
    expect(bestPower.gamma).toEqual(powerOptimum);
    expect(bestPae.gamma).toEqual(paeOptimum);
    expect(bestEvm.gamma).toEqual(evmOptimum);
    expect(bestAclr.gamma).toEqual(aclrOptimum);
    expect(Number(bestPower.outputPowerDbm)).toBeCloseTo(32, 12);
    expect(Number(bestPower.gainDb)).toBeCloseTo(22, 12);
    expect(bestPae.paePercent).toBeCloseTo(55, 12);
    expect(bestEvm.evmPercent).toBeCloseTo(1.5, 12);
    expect(Number(bestAclr.aclrDbc)).toBeCloseTo(-52, 12);

    const matched = nearestPullPoint(sweep, { re: 0, im: 0 });
    expect(Number(matched.outputPowerDbm)).toBeLessThan(32);
  });

  it('distinguishes constant available from constant accepted source-pull drive', () => {
    const options = {
      optimumGamma: powerOptimum,
      inputMatchGamma: powerOptimum,
      inputPowerDbm: 0,
      peakOutputPowerDbm: 20,
      peakPaePercent: 40,
      resolution: 9,
    } as const;
    const availableFixed = generateSourcePullSweep({
      ...options,
      inputPowerCondition: 'constant-available',
    });
    const acceptedFixed = generateSourcePullSweep({
      ...options,
      inputPowerCondition: 'constant-accepted',
    });
    const gamma50 = { re: 0, im: 0 };
    const availablePoint = nearestPullPoint(availableFixed, gamma50);
    const acceptedPoint = nearestPullPoint(acceptedFixed, gamma50);

    expect(availableFixed.kind).toBe('source');
    expect(Number(availablePoint.availableInputPowerDbm)).toBeCloseTo(0, 12);
    expect(Number(availablePoint.acceptedInputPowerDbm)).toBeLessThan(0);
    expect(Number(acceptedPoint.acceptedInputPowerDbm)).toBeCloseTo(0, 12);
    expect(Number(acceptedPoint.availableInputPowerDbm)).toBeGreaterThan(0);
    expect(Number(availablePoint.outputPowerDbm)).toBeLessThan(
      Number(acceptedPoint.outputPowerDbm),
    );
  });
});

describe('educational PA model', () => {
  it('shows the Rapp knee, AM-AM compression, and AM-PM together', () => {
    // At Pin=5 dBm, the default 26 dB ideal gain reaches the 31 dBm Psat drive.
    const point = evaluatePa(5, DEFAULT_EDUCATIONAL_PA);
    expect(Number(point.idealOutputPowerDbm)).toBe(31);
    expect(Number(point.compressionDb)).toBeCloseTo(1.0034333188799374, 12);
    expect(Number(point.outputPowerDbm)).toBeCloseTo(29.996566681120063, 12);
    expect(Number(point.phaseShiftDegrees)).toBeCloseTo(-6, 12);
    expect(point.evmPercent).toBeGreaterThan(10);
    expect(Number(point.aclrDbc)).toBeCloseTo(-44.08283340560031, 12);
  });

  it('solves the Rapp 1 dB compression point against the same model', () => {
    const p1 = rappOneDbCompressionPoint(DEFAULT_EDUCATIONAL_PA);
    const evaluated = evaluatePa(p1.inputPowerDbm, DEFAULT_EDUCATIONAL_PA);
    expect(Number(evaluated.compressionDb)).toBeCloseTo(1, 12);
    expect(Number(evaluated.outputPowerDbm)).toBeCloseTo(p1.outputPowerDbm, 12);
  });

  it('approaches small-signal gain far below compression', () => {
    const point = evaluatePa(-30, DEFAULT_EDUCATIONAL_PA);
    expect(Number(point.gainDb)).toBeCloseTo(26, 7);
    expect(Number(point.compressionDb)).toBeLessThan(1e-7);
  });

  it('uses incremental drain efficiency without claiming it is the net Psat efficiency', () => {
    const point = evaluatePa(5, DEFAULT_EDUCATIONAL_PA);
    const outputWatts = 10 ** ((Number(point.outputPowerDbm) - 30) / 10);
    const quiescentPowerWatts = DEFAULT_EDUCATIONAL_PA.drainVoltageV *
      DEFAULT_EDUCATIONAL_PA.quiescentCurrentA;

    expect(Number(point.dcPowerWatts)).toBeCloseTo(
      quiescentPowerWatts + outputWatts / DEFAULT_EDUCATIONAL_PA.incrementalDrainEfficiency,
      12,
    );
    expect(outputWatts / Number(point.dcPowerWatts)).toBeLessThan(
      DEFAULT_EDUCATIONAL_PA.incrementalDrainEfficiency,
    );
  });
});
