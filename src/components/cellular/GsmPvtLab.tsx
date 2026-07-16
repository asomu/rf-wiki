import { useId, useMemo, useState } from 'react';
import {
  expectedPvtPrediction,
  PVT_DEFAULT_PARAMETERS,
  PVT_EDUCATIONAL_PROFILE,
  PVT_PARAMETER_DEFINITIONS,
  PVT_SCENARIOS,
  simulatePvt,
  type PvtParameters,
  type PvtPrediction,
  type PvtSimulationResult,
  type PvtTracePoint,
} from '@/lib/cellular/pvt';

const PREDICTION_OPTIONS: readonly {
  value: PvtPrediction;
  label: string;
  detail: string;
}[] = [
  { value: 'pass', label: 'PASS', detail: 'Corridor 안' },
  { value: 'ramp-up', label: 'RAMP ↑', detail: 'Leading edge' },
  { value: 'plateau', label: 'PLATEAU', detail: 'Settling 포함' },
  { value: 'ramp-down', label: 'RAMP ↓', detail: 'Trailing edge' },
  { value: 'off-region', label: 'OFF', detail: 'Burst 바깥' },
] as const;

const PREDICTION_LABELS: Record<PvtPrediction, string> = {
  pass: 'PASS',
  'ramp-up': 'RAMP ↑',
  plateau: 'PLATEAU',
  'ramp-down': 'RAMP ↓',
  'off-region': 'OFF',
};

const REGION_LABELS: Record<string, string> = {
  'pre-burst': 'PRE-BURST',
  'ramp-up': 'RAMP ↑',
  'early-settling': 'EARLY SETTLING',
  plateau: 'PLATEAU',
  'ramp-down': 'RAMP ↓',
  'post-burst': 'POST-BURST',
};

const SVG_FRAME = {
  left: 68,
  right: 874,
  top: 28,
  bottom: 348,
};

const X_TICKS = [-20, 0, 100, 200, 300, 400, 500, 543, 563] as const;
const Y_TICKS = [-60, -45, -30, -15, 0] as const;

function xFor(timeUs: number) {
  const { chartStartUs, chartEndUs } = PVT_EDUCATIONAL_PROFILE;
  return SVG_FRAME.left
    + ((timeUs - chartStartUs) / (chartEndUs - chartStartUs))
    * (SVG_FRAME.right - SVG_FRAME.left);
}

function yFor(powerDbc: number) {
  const maximum = 5;
  const minimum = -70;
  return SVG_FRAME.top
    + ((maximum - powerDbc) / (maximum - minimum))
    * (SVG_FRAME.bottom - SVG_FRAME.top);
}

function pathFor(
  points: readonly PvtTracePoint[],
  value: (point: PvtTracePoint) => number,
) {
  return points
    .map((point, index) => (
      (index === 0 ? 'M' : 'L')
      + xFor(point.timeUs).toFixed(2)
      + ' '
      + yFor(value(point)).toFixed(2)
    ))
    .join(' ');
}

function maskPath(value: 'upperDbc' | 'lowerDbc') {
  const paths: string[] = [];
  let current: string[] = [];
  for (const point of PVT_EDUCATIONAL_PROFILE.mask) {
    const level = point[value];
    if (level === null) {
      if (current.length > 1) paths.push(current.join(' '));
      current = [];
      continue;
    }
    current.push(
      (current.length === 0 ? 'M' : 'L')
      + xFor(point.timeUs).toFixed(2)
      + ' '
      + yFor(level).toFixed(2),
    );
  }
  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

function closestPoint(trace: readonly PvtTracePoint[], timeUs: number) {
  return trace.reduce((closest, candidate) => (
    Math.abs(candidate.timeUs - timeUs) < Math.abs(closest.timeUs - timeUs)
      ? candidate
      : closest
  ));
}

function tableRows(result: PvtSimulationResult) {
  const targetTimes = [-20, -10, 0, 8, 100, 300, 534.8, 542.8, 552.8, 562.8];
  if (result.evaluation.firstViolationTimeUs !== null) {
    targetTimes.push(result.evaluation.firstViolationTimeUs);
  }
  targetTimes.push(result.evaluation.worstTimeUs);
  const rows = new Map<number, PvtTracePoint>();
  for (const timeUs of targetTimes) {
    const point = closestPoint(result.trace, timeUs);
    rows.set(point.timeUs, point);
  }
  return [...rows.values()].sort((left, right) => left.timeUs - right.timeUs);
}

export default function GsmPvtLab() {
  const rawId = useId();
  const clipId = 'gsm-pvt-clip-' + rawId.replaceAll(':', '');
  const initialResult = useMemo(() => simulatePvt(PVT_DEFAULT_PARAMETERS), []);
  const [draft, setDraft] = useState<PvtParameters>(PVT_DEFAULT_PARAMETERS);
  const [evaluatedParameters, setEvaluatedParameters] = useState<PvtParameters>(PVT_DEFAULT_PARAMETERS);
  const [result, setResult] = useState(initialResult);
  const [history, setHistory] = useState<PvtParameters[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('baseline');
  const [prediction, setPrediction] = useState<PvtPrediction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => tableRows(result), [result]);
  const worstPoint = useMemo(
    () => closestPoint(result.trace, result.evaluation.worstTimeUs),
    [result],
  );
  const selectedScenarioData = PVT_SCENARIOS.find((scenario) => scenario.id === selectedScenario);
  const firstViolation = result.evaluation.violations[0];

  function arm(parameters: PvtParameters, scenarioId = '') {
    setDraft(parameters);
    setSelectedScenario(scenarioId);
    setPrediction(null);
    setFeedback(null);
    setPending(true);
  }

  function changeParameter(key: keyof PvtParameters, value: number) {
    arm({ ...draft, [key]: value });
  }

  function run() {
    if (!prediction) return;
    const next = simulatePvt(draft);
    const expected = expectedPvtPrediction(next);
    setHistory((current) => [...current, evaluatedParameters]);
    setEvaluatedParameters(draft);
    setResult(next);
    setPending(false);
    setFeedback(
      prediction === expected
        ? '예측이 맞았습니다. 첫 결과: ' + PREDICTION_LABELS[expected]
        : '첫 결과는 ' + PREDICTION_LABELS[expected] + ' 영역입니다. Trace와 margin을 확인하세요.',
    );
  }

  function reset() {
    setDraft(PVT_DEFAULT_PARAMETERS);
    setEvaluatedParameters(PVT_DEFAULT_PARAMETERS);
    setResult(initialResult);
    setSelectedScenario('baseline');
    setPrediction(null);
    setFeedback('기준 파형으로 초기화했습니다.');
    setPending(false);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    const next = simulatePvt(previous);
    setHistory((current) => current.slice(0, -1));
    setDraft(previous);
    setEvaluatedParameters(previous);
    setResult(next);
    setSelectedScenario('');
    setPrediction(null);
    setFeedback('이전 실행 결과로 돌아왔습니다.');
    setPending(false);
  }

  return (
    <section
      className="cellular-visual gsm-pvt"
      aria-labelledby={clipId + '-title'}
      data-lab-id="cellular:gsm:pvt-lab"
      data-result={result.evaluation.pass ? 'pass' : 'fail'}
    >
      <header className="cellular-visual__header">
        <div>
          <p>GSM Module PvT Workbench</p>
          <h3 id={clipId + '-title'}>예측 → trace → 첫 violation → 원인 후보</h3>
        </div>
        <p className="cellular-model-note">
          결정론적 교육 모델 · DCS 1800 MS uplink GMSK normal burst
        </p>
      </header>

      <section className="gsm-pvt__scenarios" aria-labelledby={clipId + '-scenarios'}>
        <div className="gsm-pvt__section-heading">
          <p className="data-label">01 · Scenario</p>
          <h4 id={clipId + '-scenarios'}>벤치 증상을 하나 선택하세요.</h4>
        </div>
        <div className="gsm-pvt__scenario-grid">
          {PVT_SCENARIOS.map((scenario) => (
            <button
              type="button"
              key={scenario.id}
              className="gsm-pvt__scenario"
              aria-pressed={selectedScenario === scenario.id}
              onClick={() => arm(scenario.parameters, scenario.id)}
            >
              <span>{scenario.title}</span>
              <strong>{scenario.shortTitle}</strong>
              <small>{scenario.cue}</small>
            </button>
          ))}
        </div>
        <p className="gsm-pvt__scenario-cue">
          {selectedScenarioData?.cue ?? 'Custom parameter 조합을 예측합니다.'}
        </p>
      </section>

      <section className="gsm-pvt__controls" aria-labelledby={clipId + '-controls'}>
        <div className="gsm-pvt__section-heading">
          <p className="data-label">02 · Control</p>
          <h4 id={clipId + '-controls'}>한 번에 한 parameter를 움직여 원인과 결과를 연결하세요.</h4>
        </div>
        <div className="gsm-pvt__parameter-grid">
          {PVT_PARAMETER_DEFINITIONS.map((definition) => (
            <label key={definition.key}>
              <span>
                <strong>{definition.shortLabel}</strong>
                <output>{draft[definition.key].toFixed(definition.step < 1 ? 1 : 0)} {definition.unit}</output>
              </span>
              <input
                type="range"
                aria-label={definition.label}
                min={definition.min}
                max={definition.max}
                step={definition.step}
                value={draft[definition.key]}
                onChange={(event) => changeParameter(definition.key, Number(event.currentTarget.value))}
              />
              <small>{definition.explanation}</small>
            </label>
          ))}
        </div>
        <div className="gsm-pvt__actions">
          <button type="button" className="button-secondary" onClick={reset}>기준값 복원</button>
          <button type="button" className="button-secondary" onClick={undo} disabled={history.length === 0}>
            이전 실행
          </button>
        </div>
      </section>

      <section className="gsm-pvt__prediction" aria-labelledby={clipId + '-prediction'}>
        <div className="gsm-pvt__section-heading">
          <p className="data-label">03 · Predict before run</p>
          <h4 id={clipId + '-prediction'}>첫 결과는 어디에서 나타날까요?</h4>
        </div>
        <div className="gsm-pvt__prediction-options">
          {PREDICTION_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={prediction === option.value}
              onClick={() => {
                setPrediction(option.value);
                setFeedback(null);
              }}
            >
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>
        <button type="button" className="button-primary" disabled={!prediction} onClick={run}>
          예측 제출 후 trace 실행
        </button>
        <p className="gsm-pvt__feedback" role="status">
          {feedback ?? 'Prediction을 고정해야 새 trace가 공개됩니다.'}
        </p>
      </section>

      <section className="gsm-pvt__linked" aria-labelledby={clipId + '-trace-title'}>
        <div className="gsm-pvt__section-heading gsm-pvt__section-heading--trace">
          <div>
            <p className="data-label">04 · Linked view</p>
            <h4 id={clipId + '-trace-title'}>Power vs time · trace와 교육용 corridor</h4>
          </div>
          <div className="gsm-pvt__legend" aria-label="그래프 선 종류">
            <span data-line="trace">Trace · 실선</span>
            <span data-line="upper">Upper · 파선</span>
            <span data-line="lower">Lower · 점선</span>
          </div>
        </div>

        <div className="gsm-pvt__chart-wrap">
          <svg
            className="gsm-pvt__chart"
            viewBox="0 0 920 410"
            role="img"
            aria-label={result.evaluation.pass
              ? '교육용 GSM burst power versus time trace가 corridor 안에서 PASS한 그래프'
              : '교육용 GSM burst power versus time trace가 '
                + (REGION_LABELS[firstViolation?.region ?? ''] ?? 'unknown')
                + ' 영역에서 corridor를 벗어난 그래프'}
          >
            <title>GSM burst PvT trace, upper and lower educational corridor</title>
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={SVG_FRAME.left}
                  y={SVG_FRAME.top}
                  width={SVG_FRAME.right - SVG_FRAME.left}
                  height={SVG_FRAME.bottom - SVG_FRAME.top}
                />
              </clipPath>
            </defs>
            <rect
              className="gsm-pvt__plot-background"
              x={SVG_FRAME.left}
              y={SVG_FRAME.top}
              width={SVG_FRAME.right - SVG_FRAME.left}
              height={SVG_FRAME.bottom - SVG_FRAME.top}
            />
            {Y_TICKS.map((tick) => (
              <g key={tick}>
                <line className="plot-grid" x1={SVG_FRAME.left} y1={yFor(tick)} x2={SVG_FRAME.right} y2={yFor(tick)} />
                <text className="plot-label" x={SVG_FRAME.left - 12} y={yFor(tick) + 4} textAnchor="end">{tick}</text>
              </g>
            ))}
            {X_TICKS.map((tick) => (
              <g key={tick}>
                <line className="plot-grid" x1={xFor(tick)} y1={SVG_FRAME.top} x2={xFor(tick)} y2={SVG_FRAME.bottom} />
                <text
                  className={`plot-label ${tick === -20 || tick === 563 ? 'gsm-pvt__edge-tick' : ''}`}
                  x={xFor(tick)}
                  y={SVG_FRAME.bottom + 24}
                  textAnchor="middle"
                >
                  {tick}
                </text>
              </g>
            ))}
            <text className="plot-label" x={SVG_FRAME.left} y={SVG_FRAME.top - 10}>POWER / dBc</text>
            <text className="plot-label" x={SVG_FRAME.right} y={SVG_FRAME.bottom + 48} textAnchor="end">TIME / µs</text>
            <g clipPath={'url(#' + clipId + ')'}>
              {result.evaluation.violations.map((violation, index) => (
                <rect
                  className="gsm-pvt__violation-band"
                  key={violation.region + '-' + violation.boundary + '-' + index}
                  x={xFor(violation.startUs)}
                  y={SVG_FRAME.top}
                  width={Math.max(2, xFor(violation.endUs) - xFor(violation.startUs))}
                  height={SVG_FRAME.bottom - SVG_FRAME.top}
                />
              ))}
              <path className="gsm-pvt__upper" d={maskPath('upperDbc')[0]} />
              {maskPath('lowerDbc').map((path, index) => (
                <path className="gsm-pvt__lower" d={path} key={index} />
              ))}
              <path className="gsm-pvt__trace" d={pathFor(result.trace, (point) => point.powerDbc)} />
              <line className="gsm-pvt__burst-marker" x1={xFor(0)} y1={SVG_FRAME.top} x2={xFor(0)} y2={SVG_FRAME.bottom} />
              <line className="gsm-pvt__burst-marker" x1={xFor(542.8)} y1={SVG_FRAME.top} x2={xFor(542.8)} y2={SVG_FRAME.bottom} />
              <circle
                className="gsm-pvt__worst-marker"
                cx={xFor(worstPoint.timeUs)}
                cy={yFor(worstPoint.powerDbc)}
                r="5"
              />
            </g>
            <text className="gsm-pvt__direct-label" x={xFor(270)} y={yFor(2.5)}>TRACE — SOLID</text>
            <text className="gsm-pvt__direct-label" x={xFor(430)} y={yFor(-4)}>UPPER – –</text>
            <text className="gsm-pvt__direct-label" x={xFor(430)} y={yFor(-10)}>LOWER · · ·</text>
          </svg>
          {pending && (
            <div className="gsm-pvt__pending" aria-live="polite">
              <span>TRACE ARMED</span>
              <strong>예측을 제출하면 새 파형이 나타납니다.</strong>
            </div>
          )}
        </div>

        <details className="cellular-data-alternative">
          <summary>그래프의 대표 sample과 margin을 표로 보기</summary>
          <div className="cellular-table-scroll" tabIndex={0} role="region" aria-label="GSM PvT 대표 sample 표">
            <table>
              <thead>
                <tr><th>Time</th><th>Trace</th><th>Upper</th><th>Lower</th><th>Margin</th></tr>
              </thead>
              <tbody>
                {rows.map((point) => (
                  <tr key={point.timeUs} data-violation={point.marginDb < 0}>
                    <td>{point.timeUs.toFixed(1)} µs</td>
                    <td>{point.powerDbc.toFixed(2)} dBc</td>
                    <td>{point.upperMaskDbc.toFixed(1)} dBc</td>
                    <td>{point.lowerMaskDbc === null ? 'N/A' : point.lowerMaskDbc.toFixed(1) + ' dBc'}</td>
                    <td>{point.marginDb.toFixed(2)} dB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <dl className="cellular-ledger gsm-pvt__ledger">
        <div>
          <dt>변경</dt>
          <dd>{selectedScenarioData?.shortTitle ?? 'Custom parameters'} · offset {evaluatedParameters.timingOffsetUs} µs</dd>
        </div>
        <div>
          <dt>판정</dt>
          <dd data-verdict={result.evaluation.pass ? 'pass' : 'fail'}>
            {result.evaluation.pass ? 'PASS' : 'FAIL'} · {result.evaluation.violations.length} violation groups
          </dd>
        </div>
        <div>
          <dt>첫 이탈</dt>
          <dd>
            {firstViolation
              ? REGION_LABELS[firstViolation.region]
                + ' · '
                + firstViolation.boundary
                + ' · '
                + firstViolation.startUs.toFixed(1)
                + ' µs'
              : '없음'}
          </dd>
        </div>
        <div>
          <dt>Worst margin</dt>
          <dd>{result.evaluation.worstMarginDb.toFixed(2)} dB @ {result.evaluation.worstTimeUs.toFixed(1)} µs</dd>
        </div>
      </dl>

      <section className="gsm-pvt__diagnosis" aria-labelledby={clipId + '-diagnosis'}>
        <div>
          <p className="data-label">05 · Diagnosis</p>
          <h4 id={clipId + '-diagnosis'}>Trace만 보고 부품을 단정하지 않습니다.</h4>
        </div>
        <ul>
          {result.evaluation.possibleCauses.map((cause) => <li key={cause}>{cause}</li>)}
        </ul>
        <p>
          다음 단계는 input/output 동시 비교, PA enable·bias·switch timing 확인과 조건 하나만 바꾸는
          discriminator입니다. <a href="/cellular/diagnostics/switching-transient/">Switching transient 진단으로 이동</a>
        </p>
      </section>

      <aside className="gsm-pvt__disclaimer">
        <strong>교육 모델의 한계</strong>
        <p>
          이 corridor는 source-family 구조를 설명하기 위한 상대 전력 모델이며 공식 3GPP conformance
          mask나 pass report를 대신하지 않습니다. 실제 판정은 적용 band, power class, test condition,
          장비 calibration과 최신 규격 clause를 함께 확인해야 합니다.
        </p>
      </aside>
    </section>
  );
}
