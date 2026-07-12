import { describe, expect, it } from 'vitest';
import {
  instruments,
  instrumentChapterHref,
  instrumentProgressId,
  instrumentRoadmap,
} from '../../src/data/instruments';

describe('Keysight instrument study manifest', () => {
  it('publishes five independent five-chapter tracks', () => {
    expect(instruments.map(({ id }) => id)).toEqual([
      'keysight-n5182b',
      'keysight-n9020b',
      'keysight-e5080b',
      'keysight-u2061xa',
      'keysight-n6705c',
    ]);
    expect(instruments.every(({ chapters }) => chapters.length === 5)).toBe(true);
  });

  it('keeps routes, lab IDs, chapter IDs, and progress IDs globally unique', () => {
    const routes = instruments.map(({ route }) => route);
    const chapterIds = instruments.flatMap(({ chapters }) => chapters.map(({ id }) => id));
    const labIds = instruments.flatMap(({ chapters }) => chapters.map(({ labId }) => labId));
    const progressIds = instruments.flatMap((instrument) => (
      instrument.chapters.map((chapter) => instrumentProgressId(instrument, chapter))
    ));

    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(chapterIds).size).toBe(chapterIds.length);
    expect(new Set(labIds).size).toBe(labIds.length);
    expect(new Set(progressIds).size).toBe(progressIds.length);
    expect(progressIds.every((id) => id.startsWith('instrument:'))).toBe(true);
  });

  it('derives canonical hrefs and ordered progress namespaces from one source', () => {
    for (const instrument of instruments) {
      expect(instrument.chapters.map(({ order }) => order)).toEqual([1, 2, 3, 4, 5]);
      for (const chapter of instrument.chapters) {
        expect(instrumentChapterHref(instrument, chapter)).toBe(
          `/instruments/${instrument.route}/${chapter.id}/`,
        );
        expect(instrumentProgressId(instrument, chapter)).toBe(
          `instrument:${instrument.progressNamespace}:${chapter.labId}`,
        );
      }
    }
  });

  it('pins the reviewed Keysight model and firmware baselines', () => {
    expect(instruments.map(({ model, firmwareScope }) => [model, firmwareScope])).toEqual([
      ['N5182B', 'B.01.96'],
      ['N9020B', 'A.43.49'],
      ['E5080B', 'A.20.25.03'],
      ['U2061XA', 'A.03.16'],
      ['N6705C + N6752A', 'E_02_09_3271'],
    ]);
  });

  it('aligns active manifest identities with the shared five-profile union', () => {
    expect(instruments.map(({ id, kind, family, model, supportedOptions }) => ({
      id,
      kind,
      family,
      model,
      supportedOptions,
    }))).toEqual([
      {
        id: 'keysight-n5182b',
        kind: 'signal-generator',
        family: 'MXG X-Series',
        model: 'N5182B',
        supportedOptions: ['506', '656'],
      },
      {
        id: 'keysight-n9020b',
        kind: 'signal-analyzer',
        family: 'MXA X-Series',
        model: 'N9020B',
        supportedOptions: ['526', 'B1X', 'MPB', 'P26'],
      },
      {
        id: 'keysight-e5080b',
        kind: 'network-analyzer',
        family: 'ENA Series',
        model: 'E5080B',
        supportedOptions: ['2K0'],
      },
      {
        id: 'keysight-u2061xa',
        kind: 'power-sensor',
        family: 'U/L2050/60 X-Series',
        model: 'U2061XA',
        supportedOptions: [],
      },
      {
        id: 'keysight-n6705c',
        kind: 'power-supply',
        family: 'N6700 Modular Power System',
        model: 'N6705C + N6752A',
        supportedOptions: ['N6752A', '761'],
      },
    ]);
  });

  it('derives ready roadmap entries from the active manifest with no stale planned SA', () => {
    const ready = instrumentRoadmap.filter((item) => item.status === 'ready');
    const planned = instrumentRoadmap.filter((item) => item.status === 'planned');
    expect(ready.map(({ instrumentId }) => instrumentId)).toEqual(
      instruments.map(({ id }) => id),
    );
    expect(ready.map(({ href }) => href)).toEqual(
      instruments.map(({ route }) => `/instruments/${route}/`),
    );
    expect(planned).toEqual([]);
  });
});
