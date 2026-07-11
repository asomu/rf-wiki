import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RangeControl } from '../../src/components/lab/ControlField';
import { LabShell } from '../../src/components/lab/LabShell';

describe('LabShell', () => {
  it('uses the fallback path before interaction and the control-specific stage map afterward', () => {
    const { container } = render(
      <LabShell
        labId="stage-map-lab"
        title="Stage map instrument"
        question="어느 stage가 바뀔까?"
        description="마지막으로 조작한 control의 실제 경로만 보여줍니다."
        activeStages={['display']}
        stageMap={{
          'source-level': ['source', 'dut', 'display'],
          'trace-marker': ['display'],
        }}
        controls={(
          <>
            <RangeControl
              id="source-level"
              label="Source level"
              min={0}
              max={10}
              value={5}
              valueText="5 dBm"
              onChange={() => undefined}
            />
            <RangeControl
              id="trace-marker"
              label="Trace marker"
              min={0}
              max={10}
              value={5}
              valueText="5 MHz"
              onChange={() => undefined}
            />
          </>
        )}
        ledger={[
          { label: '변경', value: '한 control' },
          { label: '직접 효과', value: '해당 stage' },
          { label: '화면 결과', value: '경로 강조' },
          { label: '비용·한계', value: '교육 모델' },
        ]}
      >
        <div>linked result</div>
      </LabShell>,
    );

    const spine = container.querySelector('.signal-spine');
    const activeLabels = () => Array.from(
      container.querySelectorAll('.signal-spine li.is-active strong'),
      (element) => element.textContent,
    );

    expect(spine).toHaveAttribute('data-active-control', 'initial');
    expect(activeLabels()).toEqual(['Display']);

    fireEvent.change(screen.getByRole('slider', { name: 'Source level' }), {
      target: { value: '6' },
    });
    expect(spine).toHaveAttribute('data-active-control', 'source-level');
    expect(activeLabels()).toEqual(['Source', 'DUT', 'Display']);

    fireEvent.change(screen.getByRole('slider', { name: 'Trace marker' }), {
      target: { value: '7' },
    });
    expect(spine).toHaveAttribute('data-active-control', 'trace-marker');
    expect(activeLabels()).toEqual(['Display']);
  });

  it('restores a persisted completion after hydration and invalidates it on a new setting', async () => {
    localStorage.setItem('rf-wiki:v1:progress', JSON.stringify({
      'restored-lab': { completed: true, completedAt: '2026-07-11T00:00:00.000Z' },
    }));

    render(
      <LabShell
        labId="restored-lab"
        title="Restored instrument"
        question="이전 완료를 다시 보여줄까?"
        description="저장된 진도를 복원합니다."
        activeStages={['display']}
        controls={(
          <RangeControl
            id="restored-control"
            label="Restored setting"
            min={0}
            max={10}
            value={5}
            valueText="5"
            onChange={() => undefined}
          />
        )}
        ledger={[
          { label: '변경', value: '저장된 설정' },
          { label: '직접 효과', value: '저장된 결과' },
          { label: '화면 결과', value: '완료 복원' },
          { label: '비용·한계', value: '새 조작 시 다시 설명' },
        ]}
      >
        <div>restored result</div>
      </LabShell>,
    );

    expect(await screen.findByText(/이전 세션에서 완료/)).toBeVisible();
    fireEvent.change(screen.getByRole('slider', { name: 'Restored setting' }), {
      target: { value: '6' },
    });
    expect(screen.queryByText(/이전 세션에서 완료/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}')).not.toHaveProperty('restored-lab');
  });

  it('persists completion only after prediction, control interaction, and explanation', () => {
    const { container } = render(
      <LabShell
        labId="test-lab"
        title="Test instrument"
        question="설정은 왜 trace를 바꿀까?"
        description="동일 계산 상태를 확인합니다."
        activeStages={['dsp', 'display']}
        controls={(
          <RangeControl
            id="test-rbw"
            label="RBW"
            min={10}
            max={100}
            value={100}
            valueText="100 kHz"
            onChange={() => undefined}
          />
        )}
        ledger={[
          { label: '변경', value: 'RBW 100 kHz → 10 kHz' },
          { label: '직접 효과', value: 'Noise bandwidth 감소' },
          { label: '화면 결과', value: 'Noise 약 10 dB 감소' },
          { label: '비용·한계', value: 'Sweep time 증가' },
        ]}
        prediction={{
          id: 'test',
          prompt: 'Noise 방향은?',
          options: ['상승', '하강'],
          correctIndex: 1,
          explanation: 'Bandwidth가 줄었습니다.',
        }}
      >
        <div>linked result</div>
      </LabShell>,
    );

    const finish = screen.getByRole('button', { name: '설명으로 완료하기' });
    const explanation = screen.getByRole('textbox', { name: '내 원인 설명' });
    const slider = screen.getByRole('slider', { name: 'RBW' });
    const workbench = container.querySelector('.lab-shell__workbench');
    expect(Array.from(workbench?.children ?? []).map((element) => element.className)).toEqual([
      'lab-controls',
      'lab-prediction',
      'lab-views',
    ]);
    expect(finish).toBeDisabled();
    expect(explanation).toBeDisabled();
    expect(slider).toBeDisabled();

    fireEvent.change(slider, { target: { value: '90' } });
    fireEvent.click(screen.getByRole('radio', { name: '하강' }));
    fireEvent.click(screen.getByRole('button', { name: '예측 고정' }));
    expect(slider).toBeEnabled();
    expect(finish).toBeDisabled();
    expect(screen.getByText(/설정값을 실제로 한 번 바꾸세요/)).toBeVisible();

    fireEvent.change(slider, { target: { value: '10' } });
    expect(explanation).toBeEnabled();
    fireEvent.change(explanation, { target: { value: '너무 짧다' } });
    expect(finish).toBeDisabled();
    fireEvent.change(explanation, { target: { value: 'RBW를 줄였기 때문에 DSP filter 폭이 감소해 화면 noise가 내려갔지만 sweep 시간 비용이 늘었다.' } });
    expect(finish).toBeEnabled();
    fireEvent.click(finish);

    expect(screen.getByText(/완료가 저장되었습니다/)).toBeVisible();
    expect(JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}')).toMatchObject({
      'test-lab': { completed: true },
    });
    expect(localStorage.getItem('rf-wiki:v1:progress')).not.toContain('noise bandwidth');

    fireEvent.change(slider, { target: { value: '20' } });
    expect(explanation).toHaveValue('');
    expect(finish).toBeDisabled();
    expect(screen.queryByText(/완료가 저장되었습니다/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}')).not.toHaveProperty('test-lab');

    fireEvent.change(explanation, { target: { value: '새 설정 때문에 DSP filter 폭이 줄어 화면 noise가 감소했지만 sweep 시간 한계가 늘었다.' } });
    fireEvent.click(finish);
    expect(screen.getByText(/완료가 저장되었습니다/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '다시 선택' }));
    expect(slider).toBeDisabled();
    expect(finish).toBeDisabled();
    expect(explanation).toBeDisabled();
    expect(explanation).toHaveValue('');
    expect(screen.queryByText(/완료가 저장되었습니다/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('rf-wiki:v1:progress') ?? '{}')).not.toHaveProperty('test-lab');
  });
});
