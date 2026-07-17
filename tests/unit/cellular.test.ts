import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import cellularLessons from '../../src/content/cellular-lessons.json';
import { cellularLessonCount, cellularSections } from '../../src/data/cellular';
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
  it('contains exactly 59 unique ready lessons in the approved section counts', () => {
    expect(cellularLessonCount).toBe(59);
    expect(cellularLessons).toHaveLength(cellularLessonCount);
    expect(new Set(cellularLessons.map(({ id }) => id)).size).toBe(cellularLessonCount);
    expect(new Set(cellularLessons.map(({ progressId }) => progressId)).size).toBe(cellularLessonCount);
    for (const section of cellularSections) {
      const lessons = cellularLessons.filter(({ section: candidate }) => candidate === section.id);
      expect(lessons).toHaveLength(section.count);
      expect(lessons.map(({ order }) => order).sort((a, b) => a - b)).toEqual(
        Array.from({ length: section.count }, (_, index) => index + 1),
      );
    }
  });

  it('keeps the six established foundation progress IDs while inserting the two new questions', () => {
    const foundations = cellularLessons
      .filter(({ section }) => section === 'foundations')
      .sort((a, b) => a.order - b.order);

    expect(foundations.map(({ slug }) => slug)).toEqual([
      'modulation-waveform-multiple-access-duplex',
      'bits-to-iq-rf',
      'coding-rate-matching-scrambling',
      'time-frequency-reading',
      'iq-magnitude-phase-psd-papr',
      'receiver-iq-to-bits',
      'ue-reference-planes-power',
      'reading-3gpp-requirements',
    ]);

    for (const slug of [
      'modulation-waveform-multiple-access-duplex',
      'bits-to-iq-rf',
      'time-frequency-reading',
      'iq-magnitude-phase-psd-papr',
      'ue-reference-planes-power',
      'reading-3gpp-requirements',
    ]) {
      expect(foundations.find((lesson) => lesson.slug === slug)?.progressId)
        .toBe(`cellular:foundations:${slug}`);
    }
  });

  it('traces the new coding question to Release 17 coding and PUSCH scrambling clauses', () => {
    const codingLesson = cellularLessons.find(({ slug }) => slug === 'coding-rate-matching-scrambling');
    expect(codingLesson?.referenceIds).toEqual(expect.arrayContaining([
      'lte-36-212-5',
      'lte-36-211-5-3-1',
      'nr-38-212-5',
      'nr-38-212-6',
      'nr-38-212-7',
      'nr-38-211-6-3-1-1',
    ]));
    const references = resolveCellularSpecReferences(codingLesson?.referenceIds ?? []);
    expect(references).toHaveLength(6);
    expect(references).toEqual(expect.arrayContaining([
      expect.objectContaining({ specification: '3GPP TS 36.211', version: '17.4.0', clause: '5.3.1' }),
      expect.objectContaining({ specification: '3GPP TS 38.211', version: '17.7.0', clause: '6.3.1.1' }),
    ]));
  });

  it('keeps segmented rate-matching notation explicit before scrambling', () => {
    const codingLesson = cellularLessons.find(({ slug }) => slug === 'coding-rate-matching-scrambling');
    const lessonText = JSON.stringify(codingLesson);
    const diagram = readFileSync(
      resolve(process.cwd(), 'src/components/astro/CodingTransformDiagram.astro'),
      'utf8',
    );

    expect(codingLesson?.theory.formula).toContain('E_r per code block');
    expect(codingLesson?.theory.formula).toContain('G = Σ_r E_r');
    expect(codingLesson?.theory.formula).toContain('C=2이면 G = E_0 + E_1');
    expect(diagram).toContain('Code-block concatenation');
    expect(diagram).toContain('G = Σ_r E_r bit');
    expect(lessonText).not.toContain('일반적으로 G = E');
    expect(diagram).not.toContain('G = E bit');
  });

  it('uses the clause-native normalized pi-over-two BPSK coordinates and exposes every point in the table', () => {
    const diagram = readFileSync(
      resolve(process.cwd(), 'src/components/astro/ConstellationGuideDiagram.astro'),
      'utf8',
    );
    const expectedCoordinateRows = [
      '{ n: 0, bit: 0, i: piOverTwoScale, q: piOverTwoScale, phaseDegrees: 45',
      '{ n: 1, bit: 0, i: -piOverTwoScale, q: piOverTwoScale, phaseDegrees: 135',
      '{ n: 2, bit: 1, i: -piOverTwoScale, q: -piOverTwoScale, phaseDegrees: -135',
      '{ n: 3, bit: 1, i: piOverTwoScale, q: -piOverTwoScale, phaseDegrees: -45',
    ];

    expect(diagram).toContain('const piOverTwoScale = Math.SQRT1_2');
    for (const row of expectedCoordinateRows) expect(diagram).toContain(row);
    expect(diagram).toContain('piOverTwoPoints.map((point)');
    expect(diagram).toContain('data-pi2-point={`n${point.n}`}');
    expect(diagram).toContain('<th>normalized I</th>');
    expect(diagram).toContain('<th>normalized Q</th>');
    expect(diagram).toContain('<th>phase</th>');
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
