import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResourceGridLab from '../../src/components/simulators/ResourceGridLab';

describe('ResourceGridLab', () => {
  it('resolves BWP-relative location into carrier PRBs and the same OFDM IFFT bins', () => {
    const { container } = render(<ResourceGridLab />);

    fireEvent.click(screen.getByRole('radio', { name: '36 MHz → 72 MHz' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    fireEvent.change(screen.getByLabelText('BWP start (CRB)'), {
      target: { value: '40' },
    });
    fireEvent.change(screen.getByLabelText('BWP size'), {
      target: { value: '160' },
    });
    fireEvent.change(screen.getByLabelText('Location within BWP'), {
      target: { value: '10' },
    });

    expect(screen.getAllByText('50…149').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1,200 \/ 4,096/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BWP 40…199/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bin shift 120/).length).toBeGreaterThan(0);
    expect(screen.getByText('3276.000')).toBeInTheDocument();

    const constellationMarkers = Array.from(
      container.querySelectorAll<SVGCircleElement>('.complex-plane .complex-point__marker'),
    );
    expect(constellationMarkers.length).toBeGreaterThan(0);
    for (const marker of constellationMarkers) {
      expect(Number(marker.getAttribute('cx'))).toBeGreaterThanOrEqual(30);
      expect(Number(marker.getAttribute('cx'))).toBeLessThanOrEqual(390);
      expect(Number(marker.getAttribute('cy'))).toBeGreaterThanOrEqual(28);
      expect(Number(marker.getAttribute('cy'))).toBeLessThanOrEqual(332);
    }

    fireEvent.change(screen.getByLabelText('Power normalization'), {
      target: { value: 'per-rb' },
    });
    expect(screen.getByText('1200.000')).toBeInTheDocument();
  });
});
