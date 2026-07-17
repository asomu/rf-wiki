import { useId } from 'react';
import type { Complex } from '@/types';

export interface PaConstellationPair {
  readonly label: string;
  readonly ideal: Complex;
  readonly output: Complex;
}

interface Props {
  readonly points: readonly PaConstellationPair[];
  readonly driveDbm: number;
  readonly averageDriveNormalized: number;
  readonly axisExtent?: number;
}

export function PaConstellationPlot({
  points,
  driveDbm,
  averageDriveNormalized,
  axisExtent = 1.6,
}: Props) {
  const id = useId();
  const width = 560;
  const height = 420;
  const center = { x: width / 2, y: height / 2 };
  const radius = 160;
  const scale = radius / axisExtent;
  const sx = (value: number) => center.x + value * scale;
  const sy = (value: number) => center.y - value * scale;
  const marker = points.at(-1);
  const ticks = [-axisExtent, -axisExtent / 2, axisExtent / 2, axisExtent];

  return (
    <svg className="pa-constellation" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>16QAM PA compression 전후 constellation</title>
      <desc id={`${id}-desc`}>
        PA drive {driveDbm.toFixed(1)} dBm에서 saturation amplitude로 정규화한 ideal 16QAM square marker와
        memoryless AM-AM/AM-PM 변환 뒤의 circle marker를 비교합니다.
      </desc>
      <rect width={width} height={height} fill="var(--color-instrument)" />
      <g className="plot-grid" aria-hidden="true">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={sx(tick)} x2={sx(tick)} y1="38" y2={height - 54} />
            <line x1="72" x2={width - 44} y1={sy(tick)} y2={sy(tick)} />
          </g>
        ))}
      </g>
      <g className="pa-constellation__axis" aria-hidden="true">
        <line x1="72" x2={width - 44} y1={center.y} y2={center.y} />
        <line x1={center.x} x2={center.x} y1="38" y2={height - 54} />
        <text x={width - 48} y={center.y - 10} textAnchor="end">
          <tspan className="plot-label--wide">I / Asat normalized</tspan>
          <tspan className="plot-label--narrow">I / Asat</tspan>
        </text>
        <text x={center.x + 10} y="56">
          <tspan className="plot-label--wide">Q / Asat normalized</tspan>
          <tspan className="plot-label--narrow">Q / Asat</tspan>
        </text>
        <text x="82" y="26">
          <tspan className="plot-label--wide">Pin {driveDbm.toFixed(1)} dBm · avg drive {averageDriveNormalized.toFixed(3)}</tspan>
          <tspan className="plot-label--narrow">Pin {driveDbm.toFixed(1)} · avg {averageDriveNormalized.toFixed(2)}</tspan>
        </text>
        {ticks.map((tick) => (
          <g
            key={`labels-${tick}`}
            className={Math.abs(tick) === axisExtent / 2 ? 'pa-constellation__ticks--inner' : undefined}
          >
            <text
              x={sx(tick)}
              y={center.y + (Math.abs(tick) === axisExtent / 2 ? 46 : 24)}
              textAnchor="middle"
            >
              {tick.toFixed(2)}
            </text>
            <text x={center.x - 10} y={sy(tick) + 4} textAnchor="end">{tick.toFixed(2)}</text>
          </g>
        ))}
      </g>

      {points.map((point) => (
        <g key={point.label}>
          <rect
            x={sx(point.ideal.re) - 4}
            y={sy(point.ideal.im) - 4}
            width="8"
            height="8"
            className="pa-constellation__ideal"
          />
          <circle
            cx={sx(point.output.re)}
            cy={sy(point.output.im)}
            r="5"
            className="pa-constellation__output"
          />
        </g>
      ))}

      {marker && (
        <g>
          <line
            x1={sx(marker.ideal.re)}
            y1={sy(marker.ideal.im)}
            x2={sx(marker.output.re)}
            y2={sy(marker.output.im)}
            className="pa-constellation__error-vector"
          />
          <text
            x={sx(marker.ideal.re) + (marker.ideal.re >= 0 ? -10 : 10)}
            y={sy(marker.ideal.im) - 10}
            textAnchor={marker.ideal.re >= 0 ? 'end' : 'start'}
            className="pa-constellation__ideal-label"
          >
            <tspan className="plot-label--wide">M1 ideal · square</tspan>
            <tspan className="plot-label--narrow">M1 □</tspan>
          </text>
          <text
            x={sx(marker.output.re) + (marker.output.re >= 0 ? -10 : 10)}
            y={sy(marker.output.im) + 20}
            textAnchor={marker.output.re >= 0 ? 'end' : 'start'}
            className="pa-constellation__output-label"
          >
            <tspan className="plot-label--wide">PA output · circle</tspan>
            <tspan className="plot-label--narrow">PA ○</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
