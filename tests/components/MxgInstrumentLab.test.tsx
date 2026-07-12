import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MxgInstrumentLab from '../../src/components/simulators/MxgInstrumentLab';

describe('MxgInstrumentLab visualization alternatives', () => {
  it('marks a second harmonic outside the 0–6 GHz span instead of clamping a trace to the edge', () => {
    const { container } = render(<MxgInstrumentLab scenario="mxg-safe-cw" />);
    const spectrum = container.querySelector<SVGElement>('svg[aria-labelledby="cw-spectrum-title cw-spectrum-desc"]');

    expect(spectrum).not.toBeNull();
    expect(spectrum).toHaveTextContent('2f 7.000 GHz · span 밖');
    expect(spectrum?.querySelectorAll('.mxg-trace--reference')).toHaveLength(0);
    expect(container.querySelector('.plot-frame__table table')).toHaveTextContent('span 밖 · trace를 6 GHz에 고정하지 않음');
  });

  it.each([
    ['mxg-safe-cw', 'CW spectrum 핵심 수치'],
    ['mxg-waveform-iq', 'IQ linked view 핵심 수치'],
    ['mxg-arb-playback', 'ARB playback timeline 핵심 수치'],
    ['mxg-pa-test-program', 'PA stimulus power budget 핵심 수치'],
  ] as const)('provides a data-table alternative for %s', (scenario, caption) => {
    const { container } = render(<MxgInstrumentLab scenario={scenario} />);
    const captions = Array.from(container.querySelectorAll('.plot-frame__table caption'));
    expect(captions.some((node) => node.textContent === caption)).toBe(true);
  });

  it('shows the PA physical estimate and guard-reduced limit as separate equations', () => {
    const { container } = render(<MxgInstrumentLab scenario="mxg-pa-test-program" />);
    const equations = container.querySelector('.mxg-power-budget__equations');
    const values = equations?.querySelectorAll(':scope > div > dd');
    const physical = values?.item(0);
    const permitted = values?.item(1);

    expect(physical).toHaveTextContent('-19.3 dBm');
    expect(physical).not.toHaveTextContent('guard');
    expect(permitted).toHaveTextContent('-10.0 − 2.0 guard = -12.0 dBm');
    expect(container.querySelector('.mxg-power-budget__status strong'))
      .toHaveTextContent('-19.3 dBm estimated · -12.0 dBm permitted');
  });
});
