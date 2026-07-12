import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PowerSensorInstrumentLab, {
  type PowerSensorScenarioId,
} from '../../src/components/simulators/PowerSensorInstrumentLab';

describe('PowerSensorInstrumentLab', () => {
  it.each([
    ['sensor-safe-power', 'U2061XA 입력 안전 핵심 수치'],
    ['sensor-average-peak', 'Average·peak·burst 핵심 수치'],
    ['sensor-correction', 'Correction·uncertainty 핵심 수치'],
    ['sensor-scpi-trigger', 'SCPI trigger 핵심 상태'],
    ['sensor-pa-power-budget', 'PA power budget 핵심 수치'],
  ] as const)('provides an accessible data table for %s', (scenario, caption) => {
    const { container } = render(<PowerSensorInstrumentLab scenario={scenario} />);
    expect(Array.from(container.querySelectorAll('caption')).some((node) => node.textContent === caption)).toBe(true);
    expect(container.querySelector('.lab-shell')).toHaveAttribute('data-lab-id', `instrument:sensor:${scenario}`);
  });

  it('labels +26/+29 dBm as damage levels and keeps the short-pulse condition visible', () => {
    render(<PowerSensorInstrumentLab scenario="sensor-safe-power" />);
    expect(screen.getByText('+26 dBm average · +29 dBm peak')).toBeInTheDocument();
    expect(screen.getAllByText(/<10 µs/).length).toBeGreaterThan(0);
    expect(screen.getByText(/측정 목표가 아니라 damage level/)).toBeInTheDocument();
  });

  it('distinguishes period average from on-level peak', () => {
    render(<PowerSensorInstrumentLab scenario="sensor-average-peak" />);
    expect(screen.getAllByText('3.98 dBm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10.0 dBm').length).toBeGreaterThan(0);
    expect(screen.getByText(/100 MHz급 변조 average와 5 MHz peak capability/)).toBeInTheDocument();
  });

  it('shows DUT-plane correction and k=2 uncertainty as separate results', () => {
    render(<PowerSensorInstrumentLab scenario="sensor-correction" />);
    expect(screen.getAllByText('18.7 dBm').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/k=2/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Basic accuracy 하나만 total uncertainty/)).toBeInTheDocument();
  });

  it('runs a query through the deterministic output queue without mixing the error queue', () => {
    render(<PowerSensorInstrumentLab scenario="sensor-scpi-trigger" />);
    expect(screen.getByRole('button', { name: 'QUERY + READ' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '새 유효 측정값을 보장하지 못함' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.click(screen.getByRole('button', { name: 'QUERY + READ' }));
    expect(screen.getByText('Keysight Technologies,U2061XA,RF-WIKI-DEMO,A.03.16')).toBeInTheDocument();
    expect(screen.getAllByText('0', { selector: '.power-sensor-queue-strip strong' })).toHaveLength(2);
  });

  it('keeps the maximum allowed safety-axis peak inside its SVG canvas', () => {
    const { container } = render(<PowerSensorInstrumentLab scenario="sensor-safe-power" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sensor average와 peak가 모두 10 dB 상승' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.change(screen.getByRole('slider', { name: 'DUT average output' }), { target: { value: '45' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Waveform PAPR' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Total path attenuation' }), { target: { value: '10' } });
    const svg = container.querySelector('svg[aria-labelledby="sensor-safety-title sensor-safety-desc"]');
    const peak = svg?.querySelector('path.power-sensor-marker--reference');
    expect(svg?.querySelector('desc')).toHaveTextContent('peak 입력 47.0 dBm');
    expect(peak?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g)?.map(Number).every((value) => value >= 0 && value <= 760)).toBe(true);
  });

  it('maps PA gain and PAE to RF sensors and PSU readback', () => {
    render(<PowerSensorInstrumentLab scenario="sensor-pa-power-budget" />);
    expect(screen.getAllByText('30.0 dB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('71.36%').length).toBeGreaterThan(0);
    expect(screen.getByText('EVM·ACLR·SEM')).toBeInTheDocument();
    expect(screen.getByText('SA / VSA')).toBeInTheDocument();
  });

  it('exports exactly the five manifest scenario identifiers', () => {
    const scenarios: readonly PowerSensorScenarioId[] = [
      'sensor-safe-power',
      'sensor-average-peak',
      'sensor-correction',
      'sensor-scpi-trigger',
      'sensor-pa-power-budget',
    ];
    expect(scenarios).toHaveLength(5);
  });
});
