import { describe, expect, it } from 'vitest';
import {
  expectedPvtPrediction,
  PVT_DEFAULT_PARAMETERS,
  PVT_EDUCATIONAL_PROFILE,
  PVT_SCENARIOS,
  simulatePvt,
  validatePvtParameters,
} from '../../src/lib/cellular/pvt';

describe('GSM PvT educational model', () => {
  it('is deterministic for the same parameters and seed', () => {
    const first = simulatePvt(PVT_DEFAULT_PARAMETERS);
    const second = simulatePvt(PVT_DEFAULT_PARAMETERS);

    expect(second).toEqual(first);
    expect(first.trace.length).toBeGreaterThan(600);
    expect(first.evaluation.pass).toBe(true);
    expect(expectedPvtPrediction(first)).toBe('pass');
  });

  it('keeps the educational scope and exact useful burst timing explicit', () => {
    expect(PVT_EDUCATIONAL_PROFILE.educationalOnly).toBe(true);
    expect(PVT_EDUCATIONAL_PROFILE.burstStartUs).toBe(0);
    expect(PVT_EDUCATIONAL_PROFILE.burstEndUs).toBe(542.8);
    expect(PVT_EDUCATIONAL_PROFILE.assumptions.join(' ')).toContain('not official conformance limits');
  });

  it('rejects parameters outside the authored control range', () => {
    expect(() => validatePvtParameters({ ...PVT_DEFAULT_PARAMETERS, overshootDb: 4.1 }))
      .toThrow(RangeError);
    expect(() => validatePvtParameters({ ...PVT_DEFAULT_PARAMETERS, seed: 0 }))
      .toThrow(RangeError);
  });

  it.each(PVT_SCENARIOS)('$id matches its declared trace evidence', (scenario) => {
    const result = simulatePvt(scenario.parameters);
    const expected = scenario.expectedTrace;
    const first = result.evaluation.violations[0] ?? null;
    const worst = result.evaluation.violations.reduce(
      (candidate, violation) => (
        candidate === null || violation.worstMarginDb < candidate.worstMarginDb
          ? violation
          : candidate
      ),
      null as (typeof result.evaluation.violations)[number] | null,
    );

    expect(result.evaluation.pass).toBe(expected.pass);
    expect(first?.region ?? null).toBe(expected.firstRegion);
    expect(first?.boundary ?? null).toBe(expected.firstBoundary);
    expect(worst?.region ?? null).toBe(expected.worstRegion);
    expect(worst?.boundary ?? null).toBe(expected.worstBoundary);
    expect(result.evaluation.violations.length).toBeGreaterThanOrEqual(expected.minimumViolationGroups);
  });
});
