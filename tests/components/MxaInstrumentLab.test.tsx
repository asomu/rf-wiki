import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MxaInstrumentLab, { type MxaScenarioId } from '../../src/components/simulators/MxaInstrumentLab';

describe('MxaInstrumentLab', () => {
  it.each([
    ['mxa-safe-input', '입력 안전 수치'],
    ['mxa-sweep-rbw', 'Sweep 핵심 설정'],
    ['mxa-iq-trigger', 'IQ capture 핵심 수치'],
    ['mxa-scpi-measurements', '현재 SCPI state'],
    ['mxa-pa-analysis', 'PA spectrum 핵심 결과'],
  ] as const)('renders an accessible result table for %s', (scenario, caption) => {
    const { container } = render(<MxaInstrumentLab scenario={scenario} />);
    expect(screen.getByText(caption, { selector: 'caption' })).toBeInTheDocument();
    expect(container.querySelector('.lab-shell')).toHaveAttribute('data-lab-id', `instrument:sa:${scenario}`);
  });

  it('labels damage, connector and mixer boundaries separately', () => {
    render(<MxaInstrumentLab scenario="mxa-safe-input" />);
    expect(screen.getByText('+30 dBm')).toBeInTheDocument();
    expect(screen.getByText('+50 dBm')).toBeInTheDocument();
    expect(screen.getByText(/Reference level은 화면 눈금/)).toBeInTheDocument();
    expect(screen.getByText(/Connector − input attenuation/)).toBeInTheDocument();
  });

  it('keeps sweep span, RBW and VBW as different controls', () => {
    render(<MxaInstrumentLab scenario="mxa-sweep-rbw" />);
    expect(screen.getByRole('slider', { name: 'Frequency span' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Resolution bandwidth' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Video bandwidth' })).toBeInTheDocument();
    expect(screen.getByText(/관찰 범위, 순간 digitizing 폭, 분해 filter 폭/)).toBeInTheDocument();
  });

  it('links IQ record length to duration and FFT-bin spacing', () => {
    render(<MxaInstrumentLab scenario="mxa-iq-trigger" />);
    expect(screen.getAllByText(/125\.0 MSa\/s/).length).toBeGreaterThan(0);
    expect(screen.getByText(/N\/Fs/)).toBeInTheDocument();
    expect(screen.getByText(/Fs\/N/)).toBeInTheDocument();
  });

  it('runs a bounded SCPI acquisition before trace retrieval', () => {
    render(<MxaInstrumentLab scenario="mxa-scpi-measurements" />);
    fireEvent.click(screen.getByRole('radio', { name: '이전/유효하지 않은 상태이므로 fresh acquisition이 필요' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.click(screen.getByRole('button', { name: 'Single acquire' }));
    expect(screen.getByText('FRESH', { selector: '.mxa-console-status strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trace query' }));
    expect(screen.getByText('1', { selector: '.mxa-console-status strong' })).toBeInTheDocument();
  });

  it('keeps PAE and EVM outside a plain swept-spectrum result', () => {
    render(<MxaInstrumentLab scenario="mxa-pa-analysis" />);
    expect(screen.getByText('Gain·PAE')).toBeInTheDocument();
    expect(screen.getByText('SG/sensors/PSU 동시 data')).toBeInTheDocument();
    expect(screen.getByText('EVM')).toBeInTheDocument();
    expect(screen.getByText('LTE/NR or VSA demod app')).toBeInTheDocument();
  });

  it('exports the five manifest scenario identifiers', () => {
    const scenarios: readonly MxaScenarioId[] = ['mxa-safe-input', 'mxa-sweep-rbw', 'mxa-iq-trigger', 'mxa-scpi-measurements', 'mxa-pa-analysis'];
    expect(scenarios).toHaveLength(5);
  });
});
