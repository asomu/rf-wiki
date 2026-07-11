import { describe, expect, it } from 'vitest';
import {
  generateLoadPullSweep,
  generateSourcePullSweep,
  getNetworkScenario,
  nearestPullPoint,
  terminatedStability,
} from '../../src/lib/rf';

const round = (value: number) => Number(value.toFixed(3));

describe('verified source/load-pull reference surface', () => {
  it('keeps the deterministic contour and S-parameter stability mask stable', () => {
    const network = getNetworkScenario('conditional-pa').network;
    const common = {
      optimumGamma: { re: 0.45, im: -0.25 },
      paeOptimumGamma: { re: 0.28, im: -0.36 },
      evmOptimumGamma: { re: 0.1, im: -0.16 },
      aclrOptimumGamma: { re: 0.18, im: -0.05 },
      inputMatchGamma: { re: 0.45, im: -0.25 },
      inputPowerDbm: 4,
      peakOutputPowerDbm: 29.5,
      peakPaePercent: 48,
      minimumEvmPercent: 1.4,
      bestAclrDbc: -48,
      resolution: 15,
      smithRadius: 0.9,
    } as const;
    const load = generateLoadPullSweep({
      ...common,
      inputPowerCondition: 'constant-accepted',
      isStable: (gamma) => terminatedStability(network, gamma, 'load').stable,
    });
    const source = generateSourcePullSweep({
      ...common,
      inputPowerCondition: 'constant-available',
      isStable: (gamma) => terminatedStability(network, gamma, 'source').stable,
    });

    const summarize = (sweep: typeof load) => {
      const center = nearestPullPoint(sweep, { re: 0, im: 0 });
      const selected = nearestPullPoint(sweep, { re: 0.45, im: -0.25 });
      return {
        kind: sweep.kind,
        pointCount: sweep.points.length,
        stableCount: sweep.points.filter((point) => point.stable).length,
        center: {
          outputPowerDbm: round(Number(center.outputPowerDbm)),
          paePercent: round(center.paePercent),
          evmPercent: round(center.evmPercent),
          aclrDbc: round(Number(center.aclrDbc)),
          acceptedInputPowerDbm: round(Number(center.acceptedInputPowerDbm)),
        },
        selected: {
          gamma: selected.gamma,
          outputPowerDbm: round(Number(selected.outputPowerDbm)),
          paePercent: round(selected.paePercent),
          stable: selected.stable,
        },
      };
    };

    expect({ load: summarize(load), source: summarize(source) }).toMatchInlineSnapshot(`
      {
        "load": {
          "center": {
            "acceptedInputPowerDbm": 4,
            "aclrDbc": -47.877,
            "evmPercent": 1.471,
            "outputPowerDbm": 28.163,
            "paePercent": 41.733,
          },
          "kind": "load",
          "pointCount": 153,
          "selected": {
            "gamma": {
              "im": -0.25,
              "re": 0.45,
            },
            "outputPowerDbm": 29.5,
            "paePercent": 46.079,
            "stable": true,
          },
          "stableCount": 142,
        },
        "source": {
          "center": {
            "acceptedInputPowerDbm": 2.663,
            "aclrDbc": -47.877,
            "evmPercent": 1.471,
            "outputPowerDbm": 27.494,
            "paePercent": 41.733,
          },
          "kind": "source",
          "pointCount": 153,
          "selected": {
            "gamma": {
              "im": -0.25,
              "re": 0.45,
            },
            "outputPowerDbm": 29.5,
            "paePercent": 46.079,
            "stable": true,
          },
          "stableCount": 147,
        },
      }
    `);
  });
});
