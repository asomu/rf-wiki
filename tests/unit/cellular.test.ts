import { describe, expect, it } from 'vitest';
import cellularLessons from '../../src/content/cellular-lessons.json';
import { cellularSections } from '../../src/data/cellular';
import { resolveCellularSpecReferences } from '../../src/data/cellular-specs';
import {
  DIAGNOSTIC_SIGNATURES,
  GSM_NORMAL_BURST,
  GSM_TIMESLOT_SECONDS,
  GSM_TDMA_FRAME_SECONDS,
  PAMID_TOPOLOGIES,
  gsmBurstDurationSeconds,
  gsmMultislotDutyCycle,
  gsmTimeslotStartSeconds,
} from '../../src/lib/cellular';

describe('GSM time structure', () => {
  it('fills one exact 156.25-symbol timeslot with the normal burst fields', () => {
    const fieldTotal = GSM_NORMAL_BURST.fields.reduce((sum, field) => sum + field.symbolPeriods, 0);
    expect(fieldTotal).toBe(156.25);
    expect(GSM_NORMAL_BURST.occupiedSymbolPeriods + GSM_NORMAL_BURST.guardSymbolPeriods).toBe(156.25);
    expect(gsmBurstDurationSeconds(GSM_NORMAL_BURST)).toBeCloseTo(GSM_TIMESLOT_SECONDS, 15);
  });

  it('uses the nominal 8-slot TDMA frame timing', () => {
    expect(GSM_TIMESLOT_SECONDS * 1e6).toBeCloseTo(576.9230769, 6);
    expect(GSM_TDMA_FRAME_SECONDS * 1e3).toBeCloseTo(4.6153846, 6);
    expect(gsmTimeslotStartSeconds(7)).toBeCloseTo(7 * GSM_TIMESLOT_SECONDS, 15);
  });

  it('computes nominal multislot occupancy and rejects impossible settings', () => {
    expect(gsmMultislotDutyCycle(1)).toBe(0.125);
    expect(gsmMultislotDutyCycle(4)).toBe(0.5);
    expect(() => gsmMultislotDutyCycle(0)).toThrow(RangeError);
    expect(() => gsmTimeslotStartSeconds(8)).toThrow(RangeError);
  });
});

describe('PAMiD and diagnostic contracts', () => {
  it('defines three distinct DUT topologies whose paths reference real blocks', () => {
    expect(PAMID_TOPOLOGIES.map(({ id }) => id)).toEqual(['gsm-pa-asm', 'fdd-pamid', 'tdd-txm']);
    for (const topology of PAMID_TOPOLOGIES) {
      const ids = new Set(topology.blocks.map(({ id }) => id));
      expect(topology.txPath.every((id) => ids.has(id))).toBe(true);
      expect(topology.rxPath.every((id) => ids.has(id))).toBe(true);
      expect(topology.txPath.at(-1)).toBe('ant');
    }
  });

  it('provides a complete static evidence matrix for ten diagnostic symptoms', () => {
    expect(DIAGNOSTIC_SIGNATURES).toHaveLength(10);
    for (const signature of DIAGNOSTIC_SIGNATURES) {
      expect(signature.observedViews.length).toBeGreaterThan(1);
      expect(signature.likelyStages.length).toBeGreaterThan(1);
      expect(signature.controlChecks.length).toBeGreaterThan(1);
      expect(signature.discriminatingMeasurements.length).toBeGreaterThan(0);
      expect(signature.falsePositives.length).toBeGreaterThan(0);
    }
  });
});

describe('cellular content registry', () => {
  it('contains exactly 57 unique ready lessons in the approved section counts', () => {
    expect(cellularLessons).toHaveLength(57);
    expect(new Set(cellularLessons.map(({ id }) => id)).size).toBe(57);
    expect(new Set(cellularLessons.map(({ progressId }) => progressId)).size).toBe(57);
    for (const section of cellularSections) {
      const lessons = cellularLessons.filter(({ section: candidate }) => candidate === section.id);
      expect(lessons).toHaveLength(section.count);
      expect(lessons.map(({ order }) => order).sort((a, b) => a - b)).toEqual(
        Array.from({ length: section.count }, (_, index) => index + 1),
      );
    }
  });

  it('resolves every clause-trace source and keeps the progress namespace independent', () => {
    for (const lesson of cellularLessons) {
      expect(lesson.progressId).toBe(`cellular:${lesson.section}:${lesson.slug}`);
      expect(resolveCellularSpecReferences(lesson.referenceIds)).toHaveLength(lesson.referenceIds.length);
      expect(lesson.intuition.points.length).toBeGreaterThanOrEqual(2);
      expect(lesson.bench.points.length).toBeGreaterThanOrEqual(2);
      expect(lesson.theory.points.length).toBeGreaterThanOrEqual(2);
    }
  });
});
