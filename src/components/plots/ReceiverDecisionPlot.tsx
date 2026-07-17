import { useId } from 'react';
import type { Complex } from '@/types';

interface Props {
  readonly transmitted: Complex;
  readonly measured: Complex;
  readonly equalized: Complex;
  readonly transmittedDibit: string;
  readonly decidedDibit: string;
  readonly channelMagnitudeVoltsPerVolt: number;
  readonly channelPhaseDegrees: number;
  readonly residualFrequencyOffsetHz: number;
  readonly observationTimeMilliseconds: number;
  readonly noiseVectorMagnitudeNormalized: number;
  readonly noiseVectorPhaseDegrees: number;
}

const WIDTH = 560;
const HEIGHT = 420;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const PLOT_RADIUS = 158;
const AXIS_EXTENT = 1.65;
const SCALE = PLOT_RADIUS / AXIS_EXTENT;

function xFor(value: number): number {
  return CENTER_X + value * SCALE;
}

function yFor(value: number): number {
  return CENTER_Y - value * SCALE;
}

export function ReceiverDecisionPlot({
  transmitted,
  measured,
  equalized,
  transmittedDibit,
  decidedDibit,
  channelMagnitudeVoltsPerVolt,
  channelPhaseDegrees,
  residualFrequencyOffsetHz,
  observationTimeMilliseconds,
  noiseVectorMagnitudeNormalized,
  noiseVectorPhaseDegrees,
}: Props) {
  const id = useId();
  const idealPoints = [
    { re: Math.SQRT1_2, im: Math.SQRT1_2, label: '00' },
    { re: -Math.SQRT1_2, im: Math.SQRT1_2, label: '01' },
    { re: -Math.SQRT1_2, im: -Math.SQRT1_2, label: '11' },
    { re: Math.SQRT1_2, im: -Math.SQRT1_2, label: '10' },
  ] as const;
  const rawErrorLabelX = (xFor(transmitted.re) + xFor(measured.re)) / 2;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      className="receiver-decision-plot"
    >
      <title id={`${id}-title`}>Channel 보정 전후 QPSK decision plane</title>
      <desc id={`${id}-desc`}>
        송신 dibit {transmittedDibit}의 ideal point, channel과 noise를 통과한 measured point,
        common channel equalization 뒤의 point와 판정 dibit {decidedDibit}을 비교합니다.
        현재 H magnitude는 {channelMagnitudeVoltsPerVolt.toFixed(2)} volts per volt, H phase는
        {' '}{channelPhaseDegrees.toFixed(0)} degrees, residual frequency offset은
        {' '}{residualFrequencyOffsetHz.toFixed(0)} hertz, observation time은
        {' '}{observationTimeMilliseconds.toFixed(1)} milliseconds입니다. Deterministic additive noise는
        unit-power symbol 기준 magnitude {noiseVectorMagnitudeNormalized.toFixed(2)}, direction
        {' '}{noiseVectorPhaseDegrees.toFixed(0)} degrees이며 known-H division 전에 measured IQ에 더합니다.
      </desc>
      <rect width={WIDTH} height={HEIGHT} fill="var(--color-instrument)" />
      <g className="plot-grid" aria-hidden="true">
        {[-1, -0.5, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={xFor(tick)} x2={xFor(tick)} y1="36" y2={HEIGHT - 48} />
            <line x1="54" x2={WIDTH - 38} y1={yFor(tick)} y2={yFor(tick)} />
          </g>
        ))}
      </g>
      <g className="receiver-decision-plot__boundary" aria-hidden="true">
        <line x1={CENTER_X} x2={CENTER_X} y1="36" y2={HEIGHT - 48} />
        <line x1="54" x2={WIDTH - 38} y1={CENTER_Y} y2={CENTER_Y} />
      </g>
      <g className="plot-axis" aria-hidden="true">
        <text x={WIDTH - 40} y={CENTER_Y - 10} textAnchor="end">
          <tspan className="plot-label--wide">I / normalized</tspan>
          <tspan className="plot-label--narrow">I norm.</tspan>
        </text>
        <text x={CENTER_X + 10} y="52">
          <tspan className="plot-label--wide">Q / normalized</tspan>
          <tspan className="plot-label--narrow">Q norm.</tspan>
        </text>
        <text x="62" y="34">
          <tspan className="plot-label--wide">decision boundary: I=0, Q=0</tspan>
          <tspan className="plot-label--narrow">boundary I=0 Q=0</tspan>
        </text>
        {[-1, -0.5, 0.5, 1].map((tick) => (
          <g
            key={`tick-${tick}`}
            className={Math.abs(tick) === 0.5
              ? 'receiver-decision-plot__ticks receiver-decision-plot__ticks--inner'
              : 'receiver-decision-plot__ticks'}
          >
            <text
              x={xFor(tick)}
              y={CENTER_Y + (Math.abs(tick) === 0.5 ? 44 : 22)}
              textAnchor="middle"
            >
              {tick.toFixed(1)}
            </text>
            <text x={CENTER_X - 10} y={yFor(tick) + 4} textAnchor="end">{tick.toFixed(1)}</text>
          </g>
        ))}
      </g>

      {idealPoints.map((point) => (
        <g key={point.label}>
          <rect
            x={xFor(point.re) - 5}
            y={yFor(point.im) - 5}
            width="10"
            height="10"
            fill="none"
            stroke="var(--color-reference-bright)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <text
            className="plot-direct-label"
            x={xFor(point.re) + (point.re > 0 ? -10 : 10)}
            y={yFor(point.im) + (point.im > 0 ? 24 : -12)}
            textAnchor={point.re > 0 ? 'end' : 'start'}
            fill="var(--color-reference-bright)"
          >
            <tspan className="plot-label--wide">ideal {point.label}</tspan>
            <tspan className="plot-label--narrow">{point.label} □</tspan>
          </text>
        </g>
      ))}

      <line
        x1={xFor(transmitted.re)}
        y1={yFor(transmitted.im)}
        x2={xFor(measured.re)}
        y2={yFor(measured.im)}
        stroke="var(--color-reverse-bright)"
        strokeWidth="2"
        strokeDasharray="7 5"
        vectorEffect="non-scaling-stroke"
      />
      <text
        className="plot-direct-label"
        x={rawErrorLabelX + (rawErrorLabelX >= CENTER_X ? -8 : 8)}
        y={(yFor(transmitted.im) + yFor(measured.im)) / 2 - 8}
        textAnchor={rawErrorLabelX >= CENTER_X ? 'end' : 'start'}
        fill="var(--color-reverse-bright)"
      >
        <tspan className="plot-label--wide">raw error vector</tspan>
        <tspan className="plot-label--narrow">error</tspan>
      </text>

      <circle
        cx={xFor(measured.re)}
        cy={yFor(measured.im)}
        r="7"
        fill="var(--color-instrument)"
        stroke="var(--color-reverse-bright)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      <text
        className="plot-direct-label"
        x={xFor(measured.re) + (measured.re >= 0 ? -10 : 10)}
        y={yFor(measured.im) + 20}
        textAnchor={measured.re >= 0 ? 'end' : 'start'}
        fill="var(--color-reverse-bright)"
      >
        <tspan className="plot-label--wide">measured</tspan>
        <tspan className="plot-label--narrow">meas. ○</tspan>
      </text>

      <polygon
        points={`${xFor(equalized.re)},${yFor(equalized.im) - 8} ${xFor(equalized.re) + 8},${yFor(equalized.im)} ${xFor(equalized.re)},${yFor(equalized.im) + 8} ${xFor(equalized.re) - 8},${yFor(equalized.im)}`}
        fill="var(--color-forward-bright)"
        stroke="var(--color-instrument)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <text
        className="plot-direct-label"
        x={xFor(equalized.re) + (equalized.re >= 0 ? -10 : 10)}
        y={yFor(equalized.im) - 14}
        textAnchor={equalized.re >= 0 ? 'end' : 'start'}
        fill="var(--color-forward-bright)"
      >
        <tspan className="plot-label--wide">equalized → {decidedDibit}</tspan>
        <tspan className="plot-label--narrow">EQ → {decidedDibit} ◇</tspan>
      </text>
    </svg>
  );
}
