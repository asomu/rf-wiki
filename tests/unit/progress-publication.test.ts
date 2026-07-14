import { describe, expect, it } from 'vitest';
import { curriculum } from '../../src/data/curriculum';
import { isPublishedLesson } from '../../src/lib/content-publication';
import {
  PROGRESS_STORAGE_KEY,
  clearLabCompletion,
  parseLearningProgress,
  persistLabCompletion,
  readLearningProgress,
  summarizeModuleProgress,
} from '../../src/lib/progress';

describe('learning progress', () => {
  it('ignores malformed storage and records only valid completion entries', () => {
    expect(parseLearningProgress('{broken')).toEqual({});
    expect(parseLearningProgress(JSON.stringify({
      frequency: { completed: true, completedAt: '2026-07-11T00:00:00.000Z' },
      spectrum: { completed: false },
      iq: 'done',
    }))).toEqual({
      frequency: { completed: true, completedAt: '2026-07-11T00:00:00.000Z' },
    });
  });

  it('persists and clears one lab without discarding other valid labs', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      frequency: { completed: true, completedAt: 'earlier' },
    }));

    expect(persistLabCompletion(localStorage, 'spectrum', 'now')).toBe(true);
    expect(readLearningProgress(localStorage)).toEqual({
      frequency: { completed: true, completedAt: 'earlier' },
      spectrum: { completed: true, completedAt: 'now' },
    });

    expect(clearLabCompletion(localStorage, 'spectrum')).toBe(true);
    expect(readLearningProgress(localStorage)).toEqual({
      frequency: { completed: true, completedAt: 'earlier' },
    });
  });

  it('counts Spectrum·IQ only after both labs and selects the first incomplete module', () => {
    const spectrumOnly = parseLearningProgress(JSON.stringify({
      frequency: { completed: true },
      spectrum: { completed: true },
    }));
    expect(summarizeModuleProgress(curriculum, spectrumOnly)).toMatchObject({
      completedModuleIds: ['foundations'],
      completedCount: 1,
      nextModuleId: 'spectrum-iq',
    });

    const spectrumAndIq = parseLearningProgress(JSON.stringify({
      frequency: { completed: true },
      spectrum: { completed: true },
      iq: { completed: true },
    }));
    expect(summarizeModuleProgress(curriculum, spectrumAndIq)).toMatchObject({
      completedModuleIds: ['foundations', 'spectrum-iq'],
      completedCount: 2,
      nextModuleId: 'ofdm-lte-nr',
    });
  });

  it('counts VNA only after both one-port and two-port labs are complete', () => {
    const smithOnly = parseLearningProgress(JSON.stringify({
      frequency: { completed: true },
      spectrum: { completed: true },
      iq: { completed: true },
      'resource-grid': { completed: true },
      smith: { completed: true },
    }));
    expect(summarizeModuleProgress(curriculum, smithOnly)).toMatchObject({
      completedModuleIds: ['foundations', 'spectrum-iq', 'ofdm-lte-nr'],
      nextModuleId: 'vna-smith',
    });

    const bothVnaLabs = parseLearningProgress(JSON.stringify({
      ...smithOnly,
      network: { completed: true },
    }));
    expect(summarizeModuleProgress(curriculum, bothVnaLabs)).toMatchObject({
      completedModuleIds: ['foundations', 'spectrum-iq', 'ofdm-lte-nr', 'vna-smith'],
      nextModuleId: 'power-coupling',
    });
  });

  it('keeps namespaced instrument completions independent from the six RF modules', () => {
    const progress = parseLearningProgress(JSON.stringify({
      frequency: { completed: true },
      'instrument:sg:mxg-safe-cw': { completed: true },
      'instrument:vna:ena-safe-sweep': { completed: true },
      'instrument:sensor:sensor-safe-power': { completed: true },
      'instrument:psu:psu-safe-bias': { completed: true },
    }));

    expect(summarizeModuleProgress(curriculum, progress)).toMatchObject({
      completedModuleIds: ['foundations'],
      completedCount: 1,
      nextModuleId: 'spectrum-iq',
    });
    expect(summarizeModuleProgress([
      { id: 'mxg-safe-cw', completionLabIds: ['instrument:sg:mxg-safe-cw'] },
      { id: 'mxg-waveform-iq', completionLabIds: ['instrument:sg:mxg-waveform-iq'] },
    ], progress)).toMatchObject({
      completedModuleIds: ['mxg-safe-cw'],
      completedCount: 1,
      nextModuleId: 'mxg-waveform-iq',
    });
    expect(summarizeModuleProgress([
      { id: 'ena-safe-sweep', completionLabIds: ['instrument:vna:ena-safe-sweep'] },
      { id: 'sensor-safe-power', completionLabIds: ['instrument:sensor:sensor-safe-power'] },
      { id: 'psu-safe-bias', completionLabIds: ['instrument:psu:psu-safe-bias'] },
    ], progress)).toMatchObject({
      completedModuleIds: ['ena-safe-sweep', 'sensor-safe-power', 'psu-safe-bias'],
      completedCount: 3,
    });
  });

  it('keeps cellular page completions independent from RF and instrument progress', () => {
    const progress = parseLearningProgress(JSON.stringify({
      frequency: { completed: true },
      'instrument:sg:mxg-safe-cw': { completed: true },
      'cellular:gsm:tdma-frame-timeslots': { completed: true },
      'cellular:nr:100mhz-rb100-location0': { completed: true },
    }));

    expect(summarizeModuleProgress(curriculum, progress)).toMatchObject({
      completedModuleIds: ['foundations'],
      completedCount: 1,
    });
    expect(summarizeModuleProgress([
      { id: 'gsm-slot', completionLabIds: ['cellular:gsm:tdma-frame-timeslots'] },
      { id: 'nr-rb', completionLabIds: ['cellular:nr:100mhz-rb100-location0'] },
      { id: 'pamid-path', completionLabIds: ['cellular:pamid:three-dut-topologies'] },
    ], progress)).toMatchObject({
      completedModuleIds: ['gsm-slot', 'nr-rb'],
      completedCount: 2,
      nextModuleId: 'pamid-path',
    });
  });
});

describe('lesson publication', () => {
  it('publishes only ready lessons', () => {
    expect(isPublishedLesson({ status: 'ready' })).toBe(true);
    expect(isPublishedLesson({ status: 'draft' })).toBe(false);
  });
});
