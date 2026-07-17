import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReceiverRecoveryLab from '../../src/components/simulators/ReceiverRecoveryLab';

describe('Receiver recovery lab', () => {
  it('locks controls behind prediction and updates the decision and ledger after residual drift crosses a boundary', () => {
    const { container } = render(<ReceiverRecoveryLab />);
    const frequencyOffset = screen.getByRole('slider', { name: 'Residual frequency offset' });

    expect(frequencyOffset).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /고정 gain·phase는 보정되고 residual rotation·noise는 남는다/ }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    expect(frequencyOffset).toBeEnabled();

    fireEvent.change(frequencyOffset, { target: { value: '150' } });

    expect(screen.getByText('Decided dibit').nextElementSibling).toHaveTextContent('01');
    expect(screen.getByText('Bit errors').nextElementSibling).toHaveTextContent('1 bit');
    expect(container.querySelector('.cause-ledger')).toHaveTextContent('54.0° phase drift');
  });

  it('provides plot tables, unit-labeled settings and the receiver-model boundary', () => {
    const { container } = render(<ReceiverRecoveryLab />);

    expect(screen.getAllByText('그래프 값을 표로 보기')).toHaveLength(2);
    const decisionFrame = container.querySelector('.plot-frame');
    expect(decisionFrame).not.toBeNull();
    expect(within(decisionFrame as HTMLElement).getByText(/\|H\| 0.75 V\/V · phase -35°/)).toBeInTheDocument();
    expect(within(decisionFrame as HTMLElement).getByText(/40 Hz · known common H equalization/)).toBeInTheDocument();
    expect(within(decisionFrame as HTMLElement).getByText(/\|n\| 0.04 normalized · direction -32°/)).toBeInTheDocument();
    for (const tick of ['-1.0', '-0.5', '0.5', '1.0']) {
      expect(within(decisionFrame as HTMLElement).getAllByText(tick)).toHaveLength(2);
    }
    expect(screen.getByText(/reference sequence를 생성하지 않으며/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Channel 보정 전후 QPSK decision plane/ })).toBeInTheDocument();
  });

  it('audits every receiver control in the decision-plane settings table', () => {
    const { container } = render(<ReceiverRecoveryLab />);
    fireEvent.click(screen.getByRole('radio', { name: /고정 gain·phase는 보정되고 residual rotation·noise는 남는다/ }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));

    fireEvent.change(screen.getByRole('slider', { name: 'Channel magnitude |H|' }), { target: { value: '1.10' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Channel phase' }), { target: { value: '45' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Residual frequency offset' }), { target: { value: '-120' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Deterministic noise-vector magnitude' }), { target: { value: '0.12' } });

    const decisionFrame = container.querySelector('.plot-frame');
    expect(decisionFrame).not.toBeNull();
    expect(decisionFrame).toHaveTextContent('|H| 1.10 V/V · phase 45°');
    expect(decisionFrame).toHaveTextContent('-120 Hz · known common H equalization');
    expect(decisionFrame).toHaveTextContent('|n| 0.12 normalized · direction -32°');
  });
});
