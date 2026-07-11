import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VnaSmithLab from '../../src/components/simulators/VnaSmithLab';

describe('VnaSmithLab', () => {
  it('switches from one-port mismatch to the linked two-port gain and stability model', () => {
    render(<VnaSmithLab />);

    const tablist = screen.getByRole('tablist', { name: 'VNA one-port와 two-port 실험 선택' });
    const onePort = within(tablist).getByRole('tab', { name: '1-port · Γ / VSWR' });
    const twoPort = within(tablist).getByRole('tab', { name: '2-port · gain / stability' });
    expect(onePort).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Resistance R')).toBeInTheDocument();

    fireEvent.click(twoPort);
    expect(twoPort).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('검증된 two-port 시나리오')).toHaveValue('conditional-pa');
    expect(screen.getByText('Source plane · ΓS stability circle')).toBeInTheDocument();
    expect(screen.getByText('Load plane · ΓL stability circle')).toBeInTheDocument();
    expect(screen.getByText('같은 S-parameter에서 파생된 gain과 명칭')).toBeInTheDocument();
  });
});
