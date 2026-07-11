import { useId, useState } from 'react';
import type { PredictionSpec } from './types';

interface Props {
  spec: PredictionSpec;
  onComplete?: () => void;
  onReset?: () => void;
}

export function LabPrediction({ spec, onComplete, onReset }: Props) {
  const groupId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = selected === spec.correctIndex;

  function check() {
    if (selected === null) return;
    setChecked(true);
    if (correct) onComplete?.();
  }

  function reset() {
    setSelected(null);
    setChecked(false);
    onReset?.();
  }

  return (
    <section className="lab-prediction" aria-labelledby={`${groupId}-title`}>
      <div>
        <h3 id={`${groupId}-title`}>먼저 결과를 예측해보세요</h3>
        <p>{spec.prompt}</p>
      </div>
      <div className="lab-prediction__choices" role="radiogroup" aria-describedby={checked ? `${groupId}-feedback` : undefined}>
        {spec.options.map((option, index) => (
          <label key={option}>
            <input
              type="radio"
              name={`${groupId}-${spec.id}`}
              value={index}
              checked={selected === index}
              disabled={checked}
              onChange={() => {
                setSelected(index);
                setChecked(false);
              }}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className={`lab-button ${checked ? 'lab-button--secondary' : 'lab-button--primary'}`}
        onClick={checked ? reset : check}
        disabled={!checked && selected === null}
      >
        {checked ? '다시 선택' : '예측 고정'}
      </button>
      {checked && (
        <p id={`${groupId}-feedback`} className="lab-prediction__feedback" data-correct={correct} role="status">
          <strong>{correct ? '예측이 맞습니다.' : '놓친 stage가 있습니다.'}</strong>{' '}
          {spec.explanation}
        </p>
      )}
    </section>
  );
}
