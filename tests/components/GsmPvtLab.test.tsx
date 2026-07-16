import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GsmPvtLab from '../../src/components/cellular/GsmPvtLab';

describe('GSM PvT workbench', () => {
  it('requires a prediction before revealing a selected scenario trace', () => {
    const { container } = render(<GsmPvtLab />);
    const run = screen.getByRole('button', { name: '예측 제출 후 trace 실행' });

    expect(run).toBeDisabled();
    expect(screen.getByRole('img', { name: /PASS한 그래프/ })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Turn-on overshoot' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /CASE 04 · Hot start/ }));
    expect(screen.getByText('TRACE ARMED')).toBeInTheDocument();
    expect(run).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /PLATEAU.*Settling 포함/ }));
    expect(run).toBeEnabled();
    fireEvent.click(run);

    expect(screen.queryByText('TRACE ARMED')).not.toBeInTheDocument();
    expect(container.querySelector('.gsm-pvt__feedback')).toHaveTextContent('예측이 맞았습니다');
    expect(screen.getByRole('img', { name: /EARLY SETTLING 영역/ })).toBeInTheDocument();
    expect(container.querySelector('.gsm-pvt')).toHaveAttribute('data-result', 'fail');
    expect(screen.getByText(/EARLY SETTLING · upper/)).toBeInTheDocument();
  });

  it('exposes line-style labels, a tabular alternative and the conformance disclaimer', () => {
    render(<GsmPvtLab />);

    expect(screen.getByLabelText('그래프 선 종류')).toHaveTextContent('Trace · 실선');
    expect(screen.getByText('그래프의 대표 sample과 margin을 표로 보기')).toBeInTheDocument();
    expect(screen.getByText('교육 모델의 한계')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Switching transient 진단으로 이동' }))
      .toHaveAttribute('href', '/cellular/diagnostics/switching-transient/');
  });
});
