import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearLabCompletion,
  isLabComplete,
  persistLabCompletion,
  readLearningProgress,
} from '@/lib/progress';
import { assessCausalExplanation } from '@/lib/learning/explanation';
import { CauseEffectLedger } from './CauseEffectLedger';
import { LabControlInteractionProvider } from './LabControlInteraction';
import { LabPrediction } from './LabPrediction';
import { SignalSpine } from './SignalSpine';
import type { LabShellProps } from './types';
import './lab.css';

export function LabShell({
  labId,
  title,
  question,
  description,
  activeStages,
  stageMap,
  controls,
  children,
  ledger,
  prediction,
  note
}: LabShellProps) {
  const controlsRef = useRef<HTMLFieldSetElement>(null);
  const [predictionComplete, setPredictionComplete] = useState(false);
  const [controlInteracted, setControlInteracted] = useState(false);
  const [activeControlId, setActiveControlId] = useState<string>();
  const [explanation, setExplanation] = useState('');
  const [explanationChecked, setExplanationChecked] = useState(false);
  const [completionRestored, setCompletionRestored] = useState(false);
  const ledgerSignature = ledger.map(({ label, value, tone }) => `${label}:${value}:${tone ?? ''}`).join('|');
  const predictionRequired = prediction !== undefined;

  useEffect(() => {
    setCompletionRestored(isLabComplete(readLearningProgress(window.localStorage), labId));
  }, [labId]);

  useEffect(() => {
    setExplanationChecked(false);
  }, [ledgerSignature]);

  const completePrediction = useCallback(() => setPredictionComplete(true), []);
  const predictionReady = !prediction || predictionComplete;
  const explanationAssessment = assessCausalExplanation(explanation);
  const explanationReady = explanationAssessment.ready;
  const canFinish = predictionReady && controlInteracted && explanationReady;

  useEffect(() => {
    if (!predictionRequired || !predictionComplete) return;
    controlsRef.current
      ?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)')
      ?.focus();
  }, [predictionComplete, predictionRequired]);

  const recordControlInteraction = useCallback((controlId: string) => {
    if (explanationChecked || completionRestored) {
      clearLabCompletion(window.localStorage, labId);
      setCompletionRestored(false);
      setExplanationChecked(false);
    }
    if (!predictionReady) return;
    setActiveControlId(controlId);
    setControlInteracted(true);
    setExplanation('');
    setExplanationChecked(false);
  }, [completionRestored, explanationChecked, labId, predictionReady]);

  const resetPrediction = useCallback(() => {
    setPredictionComplete(false);
    setControlInteracted(false);
    setActiveControlId(undefined);
    setExplanation('');
    setExplanationChecked(false);
    setCompletionRestored(false);
    clearLabCompletion(window.localStorage, labId);
  }, [labId]);

  const currentActiveStages = activeControlId
    ? stageMap?.[activeControlId] ?? activeStages
    : activeStages;

  function finish() {
    if (!canFinish) return;
    setCompletionRestored(false);
    setExplanationChecked(true);
    persistLabCompletion(window.localStorage, labId);
  }

  const readinessMessage = !predictionReady
    ? '먼저 예측을 맞게 고정하세요.'
    : !controlInteracted
      ? '예측 후 설정값을 실제로 한 번 바꾸세요.'
      : !explanationReady
        ? `설명에 ${explanationAssessment.missing.join(' · ')}을(를) 더 적으세요.`
        : '원인 설명이 준비되었습니다. 이제 완료할 수 있습니다.';

  return (
    <section className="lab-shell" data-lab-id={labId} aria-labelledby={`${labId}-question`}>
      <header className="lab-shell__header">
        <div>
          <span className="lab-shell__name">{title}</span>
          <h2 id={`${labId}-question`}>{question}</h2>
          <p>{description}</p>
        </div>
        <p className="lab-shell__model-note">교육용 계산 모델 · 실제 장비 정확도나 compliance 판정을 대신하지 않습니다.</p>
      </header>

      <SignalSpine
        activeStages={currentActiveStages}
        {...(activeControlId ? { activeControlId } : {})}
      />

      <div className={`lab-shell__workbench${prediction ? '' : ' lab-shell__workbench--no-prediction'}`}>
        <LabControlInteractionProvider onInteraction={recordControlInteraction}>
          <aside
            className="lab-controls"
            aria-label={`${title} 초기 설정`}
            aria-describedby={`${labId}-controls-state`}
          >
            <div className="lab-controls__sticky">
              <div className="lab-controls__heading">
                <h3>초기 설정</h3>
                <span>먼저 값을 읽기</span>
              </div>
              <p id={`${labId}-controls-state`} className="lab-controls__state" aria-live="polite">
                {!prediction
                  ? '한 번에 한 설정만 바꾸고 연결된 결과를 비교하세요.'
                  : predictionReady
                    ? '예측이 고정되었습니다. 이제 한 번에 한 설정만 바꾸세요.'
                    : '현재 값을 확인한 뒤 결과를 예측하세요. 예측 전에는 설정이 잠겨 있습니다.'}
              </p>
              <fieldset ref={controlsRef} className="lab-controls__fields" disabled={!predictionReady}>
                <legend className="visually-hidden">{title} 설정값</legend>
                {controls}
              </fieldset>
            </div>
          </aside>
        </LabControlInteractionProvider>

        {prediction && <LabPrediction spec={prediction} onComplete={completePrediction} onReset={resetPrediction} />}

        <div className="lab-views" aria-label={`${title} 연결된 결과 화면`}>
          {children}
        </div>
      </div>

      <CauseEffectLedger entries={ledger} />

      <section className="lab-explain" aria-labelledby={`${labId}-explain-title`}>
        <div>
          <h3 id={`${labId}-explain-title`}>원인을 자기 말로 닫아보세요</h3>
          <p>바꾼 물리량 → 영향을 받은 stage → 화면에서 바뀐 부분 → 비용·한계 순서로 설명합니다.</p>
          <div className="lab-explain__field">
            <label htmlFor={`${labId}-explanation`}>내 원인 설명</label>
            <textarea
              id={`${labId}-explanation`}
              name={`${labId}-explanation`}
              rows={4}
              maxLength={400}
              autoComplete="off"
              placeholder="예: RBW를 줄였기 때문에 DSP filter 폭이 감소해 화면 noise가 내려갔지만 sweep 시간 비용이 늘었다."
              value={explanation}
              disabled={!predictionReady || !controlInteracted}
              aria-invalid={explanation.length > 0 && !explanationReady ? true : undefined}
              aria-describedby={`${labId}-finish-requirement`}
              onChange={(event) => {
                if (explanationChecked || completionRestored) {
                  clearLabCompletion(window.localStorage, labId);
                  setCompletionRestored(false);
                }
                setExplanation(event.currentTarget.value);
                setExplanationChecked(false);
              }}
            />
          </div>
          <p id={`${labId}-finish-requirement`} className="lab-explain__requirement" aria-live="polite">
            {readinessMessage}
          </p>
        </div>
        <button
          type="button"
          className="lab-button lab-button--secondary"
          onClick={finish}
          disabled={!canFinish}
          aria-describedby={`${labId}-finish-requirement`}
        >
          설명으로 완료하기
        </button>
        {(explanationChecked || completionRestored) && (
          <p role="status" className="lab-explain__done">
            {completionRestored
              ? '이 실험은 이전 세션에서 완료했습니다. 설정을 바꾸면 현재 결과로 다시 설명해야 합니다.'
              : '완료가 저장되었습니다. 실제 bench에서도 같은 네 단계를 확인하세요.'}
          </p>
        )}
      </section>

      {note && <p className="lab-shell__note">측정 주의 · {note}</p>}
    </section>
  );
}
