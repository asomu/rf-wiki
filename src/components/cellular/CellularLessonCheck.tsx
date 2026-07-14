import { useEffect, useId, useMemo, useState } from 'react';
import {
  clearLabCompletion,
  isLabComplete,
  persistLabCompletion,
  readLearningProgress,
} from '@/lib/progress';
import { assessCausalExplanation } from '@/lib/learning/explanation';

interface Props {
  labId: string;
  question: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
}

export default function CellularLessonCheck({
  labId,
  question,
  options,
  correctIndex,
  explanation,
}: Props) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [answerChecked, setAnswerChecked] = useState(false);
  const [selfExplanation, setSelfExplanation] = useState('');
  const [complete, setComplete] = useState(false);
  const correct = selected === correctIndex;
  const assessment = useMemo(
    () => assessCausalExplanation(selfExplanation),
    [selfExplanation],
  );

  useEffect(() => {
    setComplete(isLabComplete(readLearningProgress(window.localStorage), labId));
  }, [labId]);

  function resetCompletion() {
    if (!complete) return;
    clearLabCompletion(window.localStorage, labId);
    setComplete(false);
  }

  function checkAnswer() {
    if (selected === null) return;
    setAnswerChecked(true);
  }

  function finish() {
    if (!correct || !assessment.ready) return;
    persistLabCompletion(window.localStorage, labId);
    setComplete(true);
    window.dispatchEvent(new CustomEvent('rf-wiki:progress-changed'));
  }

  const requirement = !answerChecked || !correct
    ? '먼저 원리 문제를 맞게 고정하세요.'
    : !assessment.ready
      ? `설명에 ${assessment.missing.join(' · ')}을(를) 더 적으세요.`
      : '원인 설명이 준비되었습니다.';

  return (
    <section className="cellular-check" aria-labelledby={`${id}-title`} data-lab-id={labId}>
      <header>
        <p>학습 확인</p>
        <h2 id={`${id}-title`}>결과를 예측하고 stage까지 설명하세요.</h2>
      </header>

      <div className="cellular-check__question">
        <h3>{question}</h3>
        <div className="cellular-check__options" role="radiogroup" aria-describedby={answerChecked ? `${id}-answer` : undefined}>
          {options.map((option, index) => (
            <label key={option}>
              <input
                type="radio"
                name={`${id}-answer`}
                checked={selected === index}
                onChange={() => {
                  resetCompletion();
                  setSelected(index);
                  setAnswerChecked(false);
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <button type="button" className="button-secondary" onClick={checkAnswer} disabled={selected === null}>
          예측 확인
        </button>
        {answerChecked && (
          <p id={`${id}-answer`} className="cellular-check__feedback" data-correct={correct} role="status">
            <strong>{correct ? '맞습니다.' : '다른 기준을 확인하세요.'}</strong> {explanation}
          </p>
        )}
      </div>

      <div className="cellular-check__explain">
        <label htmlFor={`${id}-explain`}>내 원인 설명</label>
        <p>바뀐 값 → 영향받은 source/DUT/filter/PA stage → 화면 결과 → 한계·오차 순서로 적습니다.</p>
        <textarea
          id={`${id}-explain`}
          rows={4}
          maxLength={500}
          value={selfExplanation}
          disabled={!answerChecked || !correct}
          aria-describedby={`${id}-requirement`}
          onChange={(event) => {
            resetCompletion();
            setSelfExplanation(event.currentTarget.value);
          }}
        />
        <p id={`${id}-requirement`} className="cellular-check__requirement" aria-live="polite">{requirement}</p>
        <button type="button" className="button-primary" onClick={finish} disabled={!correct || !assessment.ready}>
          이 페이지 완료
        </button>
        {complete && <p className="cellular-check__complete" role="status">완료가 이 기기의 cellular 진도에 저장되었습니다.</p>}
      </div>
    </section>
  );
}
