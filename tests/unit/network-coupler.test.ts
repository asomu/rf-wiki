import { describe, expect, it } from 'vitest';
import {
  analyzeDirectionalCoupler,
  complex,
  couplerPowerFlow,
  createDirectionalCoupler,
  createSParameterNetwork,
  deliveredLoadPowerWatts,
  gainSummary,
  getNetworkScenario,
  inputReflectionCoefficient,
  loadStabilityCircle,
  magnitude,
  networkMetrics,
  outputReflectionCoefficient,
  powerWaveState,
  powerWavesFromVoltageCurrent,
  sourceStabilityCircle,
  stabilityMetrics,
  terminatedStability,
  theoreticalMainLineLossDb,
  transducerGainDb,
  voltageCurrentFromPowerWaves,
} from '../../src/lib/rf';

describe('S-parameters and normalized power waves', () => {
  const network = createSParameterNetwork(
    complex(0.2),
    complex(0.05),
    complex(2),
    complex(0.3),
  );

  it('keeps active S21 gain distinct from the passive loss label', () => {
    const metrics = networkMetrics(network);
    expect(metrics.forwardGainDb).toBeCloseTo(6.020599913279624, 12);
    expect(metrics.passiveInsertionLossDb).toBeCloseTo(-6.020599913279624, 12);
    expect(metrics.reverseIsolationDb).toBeCloseTo(26.020599913279625, 12);
    expect(metrics.inputReturnLossDb).toBeCloseTo(13.979400086720375, 12);
  });

  it('returns |S21|² for matched-source matched-load transducer gain', () => {
    expect(transducerGainDb(network, complex(0), complex(0))).toBeCloseTo(
      6.020599913279624,
      12,
    );
    expect(deliveredLoadPowerWatts(1, network, complex(0), complex(0))).toBeCloseTo(4, 12);
  });

  it('calculates K, μ, and μ′ for an unconditionally stable network', () => {
    const stability = stabilityMetrics(network);
    expect(stability.determinant.re).toBeCloseTo(-0.04, 14);
    expect(stability.rollettK).toBeCloseTo(4.358, 12);
    expect(stability.mu).toBeCloseTo(2.3529411764705883, 12);
    expect(stability.muPrime).toBeCloseTo(2.916666666666667, 12);
    expect(stability.unconditionallyStable).toBe(true);
  });

  it('calculates GT, GP, and GA from the same mismatched two-port state', () => {
    const summary = gainSummary(network, complex(0.18, 0.08), complex(-0.12, 0.2));
    expect(Number.isFinite(Number(summary.transducerGainDb))).toBe(true);
    expect(Number.isFinite(Number(summary.operatingGainDb))).toBe(true);
    expect(Number.isFinite(Number(summary.availableGainDb))).toBe(true);
    expect(Number(summary.transducerGainDb)).not.toBeCloseTo(Number(summary.operatingGainDb), 6);
    expect(Number(summary.transducerGainDb)).not.toBeCloseTo(Number(summary.availableGainDb), 6);
  });

  it('places stability-circle boundary points at |Γeffective|=1', () => {
    const conditional = getNetworkScenario('conditional-pa').network;
    const sourceCircle = sourceStabilityCircle(conditional);
    const loadCircle = loadStabilityCircle(conditional);
    expect(sourceCircle).not.toBeNull();
    expect(loadCircle).not.toBeNull();
    if (!sourceCircle || !loadCircle) return;

    const sourceBoundary = complex(sourceCircle.center.re + sourceCircle.radius, sourceCircle.center.im);
    const loadBoundary = complex(loadCircle.center.re + loadCircle.radius, loadCircle.center.im);
    expect(magnitude(outputReflectionCoefficient(conditional, sourceBoundary))).toBeCloseTo(1, 10);
    expect(magnitude(inputReflectionCoefficient(conditional, loadBoundary))).toBeCloseTo(1, 10);
  });

  it('classifies source and load terminations from effective reflection, not an arbitrary mask', () => {
    const conditional = getNetworkScenario('conditional-pa').network;
    const passiveTerminations = Array.from({ length: 17 }, (_, row) => row - 8).flatMap((row) =>
      Array.from({ length: 17 }, (_, column) => column - 8)
        .map((column) => complex(column / 9, row / 9))
        .filter((gamma) => magnitude(gamma) < 0.99));
    const sourceSamples = passiveTerminations.map((gamma) => terminatedStability(conditional, gamma, 'source'));
    const loadSamples = passiveTerminations.map((gamma) => terminatedStability(conditional, gamma, 'load'));

    for (const state of [...sourceSamples, ...loadSamples]) {
      expect(state.stable).toBe(magnitude(state.effectiveReflectionCoefficient) < 1);
    }
    expect([...sourceSamples, ...loadSamples].some((state) => state.stable)).toBe(true);
    expect([...sourceSamples, ...loadSamples].some((state) => !state.stable)).toBe(true);
  });

  it('uses |a|²-|b|² as accepted power', () => {
    const state = powerWaveState(complex(1), complex(0.5));
    expect(Number(state.incidentPowerWatts)).toBeCloseTo(1, 14);
    expect(Number(state.reflectedPowerWatts)).toBeCloseTo(0.25, 14);
    expect(Number(state.acceptedPowerWatts)).toBeCloseTo(0.75, 14);

    const matched = powerWavesFromVoltageCurrent(
      complex(Math.sqrt(50)),
      complex(1 / Math.sqrt(50)),
      50,
    );
    expect(matched.incident.re).toBeCloseTo(1, 14);
    expect(matched.reflected.re).toBeCloseTo(0, 14);
    const reconstructed = voltageCurrentFromPowerWaves(
      matched.incident,
      matched.reflected,
      50,
    );
    expect(reconstructed.voltageRms.re).toBeCloseTo(Math.sqrt(50), 14);
    expect(reconstructed.currentRms.re).toBeCloseTo(1 / Math.sqrt(50), 14);
  });
});

describe('directional coupler definitions', () => {
  it('keeps coupling, isolation, and directivity conventions explicit', () => {
    const model = createDirectionalCoupler(10, 20, 0.1);
    const expectedThroughRatio = 10 ** (-0.1 / 10) - 10 ** (-10 / 10);
    expect(Number(model.couplingDb)).toBe(10);
    expect(Number(model.isolationDb)).toBe(30);
    expect(Number(model.directivityDb)).toBe(20);
    expect(Number(model.mainLineLossDb)).toBeCloseTo(-10 * Math.log10(expectedThroughRatio), 12);
    expect(theoreticalMainLineLossDb(10)).toBeCloseTo(0.4575749056067512, 12);

    const analyzed = analyzeDirectionalCoupler(model);
    expect(Number(analyzed.couplingDb)).toBeCloseTo(10, 12);
    expect(Number(analyzed.isolationDb)).toBeCloseTo(30, 12);
    expect(Number(analyzed.directivityDb)).toBeCloseTo(20, 12);
    expect(Number(analyzed.excessLossDb)).toBeCloseTo(0.1, 12);
  });

  it('shows output powers relative to the input port', () => {
    const flow = couplerPowerFlow(30, createDirectionalCoupler(10, 20, 0.1));
    const expectedThroughRatio = 10 ** (-0.1 / 10) - 10 ** (-10 / 10);
    expect(Number(flow.coupledPowerDbm)).toBeCloseTo(20, 12);
    expect(Number(flow.isolatedPowerDbm)).toBeCloseTo(0, 12);
    expect(Number(flow.throughPowerDbm)).toBeCloseTo(30 + 10 * Math.log10(expectedThroughRatio), 12);
    expect(flow.dissipatedPowerWatts).toBeCloseTo(
      1 - expectedThroughRatio - 10 ** (-10 / 10) - 10 ** (-30 / 10),
      14,
    );
  });

  it('rejects a zero-excess finite-directivity combination that creates power', () => {
    expect(() => createDirectionalCoupler(10, 20, 0)).toThrow(/conserve power/);
  });
});
