import { useId, useState } from 'react';
import { defaultSignalStages, type SignalStageId } from './types';

interface Props {
  activeStages: readonly SignalStageId[];
  activeControlId?: string;
}

export function SignalSpine({ activeStages, activeControlId }: Props) {
  const [flowPaused, setFlowPaused] = useState(false);
  const impactStatusId = `${useId()}-impact-status`;
  const activePath = defaultSignalStages
    .filter((stage) => activeStages.includes(stage.id))
    .map((stage) => stage.label)
    .join(' → ');

  return (
    <section
      className="signal-spine"
      aria-label="현재 설정이 영향을 주는 신호 경로"
      data-active-control={activeControlId ?? 'initial'}
      data-flow-state={flowPaused ? 'paused' : 'running'}
    >
      <div className="signal-spine__toolbar">
        <p id={impactStatusId} aria-live="polite">
          {activeControlId
            ? `${activePath}가 마지막 설정에 반응합니다.`
            : `초기 영향 경로 · ${activePath}`}
        </p>
        <button
          type="button"
          className="signal-spine__motion-control"
          aria-pressed={flowPaused}
          onClick={() => setFlowPaused((paused) => !paused)}
        >
          {flowPaused ? '신호 흐름 재생' : '신호 흐름 일시정지'}
        </button>
      </div>
      <ol aria-label="Source부터 Display까지의 처리 순서" aria-describedby={impactStatusId}>
        {defaultSignalStages.map((stage, index) => {
          const active = activeStages.includes(stage.id);
          return (
            <li key={stage.id} className={active ? 'is-active' : undefined} data-affected={active}>
              {active && <span className="signal-spine__flow-indicator" aria-hidden="true" />}
              <span className="signal-spine__index" aria-hidden="true">{index + 1}</span>
              <span>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
                {active && (
                  <span className="visually-hidden">
                    {activeControlId ? '현재 설정 변경의 영향 stage' : '초기 상태에서 관찰하는 stage'}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
