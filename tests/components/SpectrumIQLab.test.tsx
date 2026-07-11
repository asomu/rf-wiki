import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SpectrumIQLab from '../../src/components/simulators/SpectrumIQLab';

describe('SpectrumIQLab', () => {
  it('switches one shared learning surface between SA and IQ views', () => {
    render(<SpectrumIQLab />);

    const tablist = screen.getByRole('tablist', { name: 'SA와 IQ 실험 선택' });
    const spectrumTab = within(tablist).getByRole('tab', { name: 'SA trace' });
    const iqTab = within(tablist).getByRole('tab', { name: 'IQ capture' });

    expect(spectrumTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', {
      name: 'RBW를 줄이면 왜 CW 기준 tone은 유지되는데 noise가 내려갈까?',
    })).toBeVisible();
    expect(screen.getAllByText(/0 dBFS = -30 dBm/).length).toBeGreaterThan(0);

    fireEvent.click(iqTab);
    expect(iqTab).toHaveAttribute('aria-selected', 'true');
    expect(spectrumTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('heading', {
      name: 'IQ를 30° 회전시켜도 magnitude spectrum은 왜 그대로일까?',
    })).toBeVisible();

    fireEvent.click(spectrumTab);
    expect(spectrumTab).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps one complex record, signal controls, and symbol marker across SA and IQ views', () => {
    render(<SpectrumIQLab />);
    const spectrumPanel = screen.getByRole('tabpanel', { name: 'SA trace' });
    const spectrum = within(spectrumPanel);

    fireEvent.click(spectrum.getByRole('radio', {
      name: 'tone 거의 동일 · noise 약 −10 dB',
    }));
    fireEvent.click(spectrum.getByRole('button', { name: '예측 고정' }));

    fireEvent.change(spectrum.getByLabelText('Common IQ phase'), {
      target: { value: '90' },
    });
    fireEvent.change(spectrum.getByLabelText('Symbol marker'), {
      target: { value: '7' },
    });
    expect(screen.getAllByText(/shared record qpsk-89600-32x16/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'IQ capture' }));
    const iqPanel = screen.getByRole('tabpanel', { name: 'IQ capture' });
    const iq = within(iqPanel);

    expect(iq.getByLabelText('Common IQ phase')).toHaveValue('90');
    expect(iq.getByLabelText('Symbol marker')).toHaveValue('7');
    expect(screen.getAllByText(/shared record qpsk-89600-32x16/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/symbol 7/i).length).toBeGreaterThan(0);

    fireEvent.click(iq.getByRole('button', { name: /marker 9 선택/ }));
    expect(iq.getByLabelText('Symbol marker')).toHaveValue('9');
    expect(screen.getAllByText(/symbol 9/i).length).toBeGreaterThan(0);
  });

  it('separates source settings from analyzer processing in the Signal Spine', () => {
    const { container } = render(<SpectrumIQLab />);
    const spectrumLab = container.querySelector<HTMLElement>('[data-lab-id="spectrum"]')!;
    const spectrum = within(spectrumLab);
    const activeStageLabels = () => Array.from(
      spectrumLab.querySelectorAll('.signal-spine li.is-active strong'),
      (element) => element.textContent,
    );

    fireEvent.click(spectrum.getByRole('radio', {
      name: 'tone 거의 동일 · noise 약 −10 dB',
    }));
    fireEvent.click(spectrum.getByRole('button', { name: '예측 고정' }));

    fireEvent.change(spectrum.getByLabelText('Baseband frequency offset'), {
      target: { value: '40' },
    });
    expect(activeStageLabels()).toEqual(['Source', 'Acquisition', 'DSP / Math', 'Display']);

    fireEvent.change(spectrum.getByLabelText('Resolution bandwidth'), {
      target: { value: '20' },
    });
    expect(activeStageLabels()).toEqual(['Acquisition', 'DSP / Math', 'Display']);

    fireEvent.change(spectrum.getByLabelText('Detector'), {
      target: { value: 'positive-peak' },
    });
    expect(activeStageLabels()).toEqual(['DSP / Math', 'Display']);
  });
});
