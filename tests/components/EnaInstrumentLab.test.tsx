import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EnaInstrumentLab, { type EnaScenarioId } from '../../src/components/simulators/EnaInstrumentLab';

describe('EnaInstrumentLab', () => {
  const scenarios: readonly [EnaScenarioId, string][] = [
    ['ena-safe-sweep', 'Safe sweep 핵심 수치'],
    ['ena-calibration', 'Calibration 유효성 상태'],
    ['ena-sparameters', 'Smith marker 핵심 수치'],
    ['ena-scpi-data', '현재 E5080B session state'],
    ['ena-pa-characterization', 'PA characterization power budget'],
  ];

  it.each(scenarios)('uses the VNA progress namespace and a data-table alternative for %s', (scenario, caption) => {
    const { container } = render(<EnaInstrumentLab scenario={scenario} />);
    expect(container.querySelector('.lab-shell')).toHaveAttribute('data-lab-id', `instrument:vna:${scenario}`);
    const captions = Array.from(container.querySelectorAll('caption')).map((node) => node.textContent);
    expect(captions).toContain(caption);
    expect(container.querySelector('svg[role="img"], .ena-session, .ena-power-path')).not.toBeNull();
  });

  it('labels every SVG with an accessible title and description', () => {
    for (const scenario of ['ena-safe-sweep', 'ena-calibration', 'ena-sparameters'] as const) {
      const { container, unmount } = render(<EnaInstrumentLab scenario={scenario} />);
      for (const svg of Array.from(container.querySelectorAll('svg[role="img"]'))) {
        expect(svg.querySelector('title')).not.toBeNull();
        expect(svg.querySelector('desc')).not.toBeNull();
      }
      unmount();
    }
  });

  it('does not describe a receiver damage level as the working limit', () => {
    const { container } = render(<EnaInstrumentLab scenario="ena-pa-characterization" />);
    expect(container).toHaveTextContent('working envelope');
    expect(container).toHaveTextContent('+27 dBm 또는 ±35 VDC damage 수치는 동작 목표가 아닙니다');
    expect(container).toHaveTextContent('0.00 dB compression');
  });
});
