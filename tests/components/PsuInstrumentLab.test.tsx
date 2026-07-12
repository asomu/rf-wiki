import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PsuInstrumentLab, { type PsuScenarioId } from '../../src/components/simulators/PsuInstrumentLab';

describe('PsuInstrumentLab visualization alternatives', () => {
  const scenarios: readonly [PsuScenarioId, string][] = [
    ['psu-safe-bias', '안전한 bias operating point'],
    ['psu-cv-cc', 'CV CC protection 핵심 수치'],
    ['psu-remote-sense', 'Remote sense wiring 핵심 수치'],
    ['psu-scpi-sequence', 'Multi-rail LIST timeline 핵심 수치'],
    ['psu-pa-dc-power', 'PA DC power와 PAE 핵심 수치'],
  ];

  it.each(scenarios)('provides a data-table alternative and namespaced progress for %s', (scenario, caption) => {
    const { container } = render(<PsuInstrumentLab scenario={scenario} />);
    expect(Array.from(container.querySelectorAll('caption')).some((node) => node.textContent === caption)).toBe(true);
    expect(container.querySelector(`[data-lab-id="instrument:psu:${scenario}"]`)).not.toBeNull();
  });

  it('labels the operating envelope without relying on color alone', () => {
    const { container } = render(<PsuInstrumentLab scenario="psu-cv-cc" />);
    const plot = container.querySelector('svg[aria-labelledby="psu-envelope-title psu-envelope-desc"]');
    expect(plot).not.toBeNull();
    expect(plot).toHaveTextContent('100 W autoranging 경계');
    expect(plot).toHaveTextContent('요청 V/R');
    expect(plot?.querySelector('[stroke-dasharray], [strokeDasharray]')).not.toBeNull();
  });

  it('states that the module digitizer is not an RF waveform sample rate', () => {
    const { container } = render(<PsuInstrumentLab scenario="psu-pa-dc-power" />);
    expect(container).toHaveTextContent('97.656 kSa/s는 RF waveform sample rate가 아닙니다');
    expect(container).toHaveTextContent('10.24 µs');
    expect(container).toHaveTextContent('Sensor·SA');
  });

  it('does not crash or enable output when a LIST point exceeds the 100 W envelope', () => {
    const { container } = render(<PsuInstrumentLab scenario="psu-scpi-sequence" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Armed 상태에서 trigger를 기다림' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.change(screen.getByRole('slider', { name: 'LIST voltage step' }), { target: { value: '50' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Explicit output permission' }), { target: { value: 'on' } });
    expect(container.querySelector('.psu-program__warning')).toHaveTextContent('100 W envelope');
    expect(screen.getByText(/Preview는 2.00 A로 낮추고 OUTP ON을 생략/)).toBeInTheDocument();
    expect(screen.queryByText('OUTP ON,(@1)')).not.toBeInTheDocument();
  });

  it('makes the scrollable SCPI program keyboard accessible', () => {
    render(<PsuInstrumentLab scenario="psu-scpi-sequence" />);
    expect(screen.getByRole('region', { name: 'SCPI program preview' })).toHaveAttribute('tabindex', '0');
  });
});
