import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadPullLab from '../../src/components/simulators/LoadPullLab';

describe('LoadPullLab', () => {
  it('shows separate metric optima and source-pull input-power conditions', () => {
    render(<LoadPullLab />);

    expect(screen.queryByLabelText('Source-pull power held')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contour metric'), {
      target: { value: 'evmPercent' },
    });
    expect(screen.getByText('EVM optimum')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tuner being swept'), {
      target: { value: 'source' },
    });
    const condition = screen.getByLabelText('Source-pull power held');
    expect(condition).toHaveValue('constant-available');
    expect(screen.getAllByText(/Pavs .* 고정 → DUT accepted/).length).toBeGreaterThan(0);

    fireEvent.change(condition, { target: { value: 'constant-accepted' } });
    expect(screen.getAllByText(/필요한 Pavs/).length).toBeGreaterThan(0);
  });
});
