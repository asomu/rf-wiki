import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LabPrediction } from '../../src/components/lab/LabPrediction';

const prediction = {
  id: 'rbw-decade',
  prompt: 'RBW를 한 decade 줄이면 noise는?',
  options: ['그대로', '약 10 dB 감소', '약 20 dB 감소'],
  correctIndex: 1,
  explanation: '적분 noise power는 bandwidth에 비례합니다.',
} as const;

describe('LabPrediction', () => {
  it('requires a prediction and reports a missed stage without completing', () => {
    const onComplete = vi.fn();
    render(<LabPrediction spec={prediction} onComplete={onComplete} />);

    const check = screen.getByRole('button', { name: '예측 고정' });
    expect(check).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '그대로' }));
    expect(check).toBeEnabled();
    fireEvent.click(check);

    expect(screen.getByRole('status')).toHaveTextContent('놓친 stage가 있습니다.');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls completion only after the correct prediction is fixed', () => {
    const onComplete = vi.fn();
    render(<LabPrediction spec={prediction} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('radio', { name: '약 10 dB 감소' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));

    expect(screen.getByRole('status')).toHaveTextContent('예측이 맞습니다.');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('makes the locked state explicit and allows a clean retry', () => {
    const onReset = vi.fn();
    render(<LabPrediction spec={prediction} onReset={onReset} />);

    fireEvent.click(screen.getByRole('radio', { name: '그대로' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    expect(screen.getByRole('radio', { name: '그대로' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '다시 선택' }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByRole('radio', { name: '그대로' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '예측 고정' })).toBeDisabled();
  });
});
