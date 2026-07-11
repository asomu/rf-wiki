import { useId } from 'react';

export interface PlotPoint {
  x: number;
  y: number;
}

export interface PlotSeries {
  label: string;
  points: readonly PlotPoint[];
  tone: 'forward' | 'reference' | 'reverse' | 'secondary';
  dash?: string;
}

interface Props {
  title: string;
  description: string;
  series: readonly PlotSeries[];
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  xLabel: string;
  yLabel: string;
  markerX?: number;
  markerLabel?: string;
}

const toneColor: Record<PlotSeries['tone'], string> = {
  forward: 'var(--color-forward-bright)',
  reference: 'var(--color-reference-bright)',
  reverse: 'var(--color-reverse-bright)',
  secondary: 'var(--color-secondary-bright)'
};

export function LinePlot({ title, description, series, xDomain, yDomain, xLabel, yLabel, markerX, markerLabel }: Props) {
  const id = useId();
  const width = 720;
  const height = 320;
  const margin = { top: 24, right: 32, bottom: 48, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const sx = (x: number) => margin.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const sy = (y: number) => margin.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;
  const pathFor = (points: readonly PlotPoint[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`).join(' ');
  const xTicks = Array.from({ length: 5 }, (_, index) => xDomain[0] + (index / 4) * (xDomain[1] - xDomain[0]));
  const yTicks = Array.from({ length: 5 }, (_, index) => yDomain[0] + (index / 4) * (yDomain[1] - yDomain[0]));

  return (
    <svg className="line-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <rect width={width} height={height} fill="var(--color-instrument)" aria-hidden="true" />
      <g className="plot-grid" aria-hidden="true">
        {xTicks.map((tick) => <line key={`x-${tick}`} x1={sx(tick)} x2={sx(tick)} y1={margin.top} y2={height - margin.bottom} />)}
        {yTicks.map((tick) => <line key={`y-${tick}`} x1={margin.left} x2={width - margin.right} y1={sy(tick)} y2={sy(tick)} />)}
      </g>
      <g className="plot-axis" aria-hidden="true">
        {xTicks.map((tick) => <text key={`xt-${tick}`} x={sx(tick)} y={height - 22} textAnchor="middle">{Number(tick.toPrecision(3))}</text>)}
        {yTicks.map((tick) => <text key={`yt-${tick}`} x={margin.left - 10} y={sy(tick) + 4} textAnchor="end">{Number(tick.toPrecision(3))}</text>)}
        <text x={margin.left + plotWidth / 2} y={height - 3} textAnchor="middle">{xLabel}</text>
        <text transform={`translate(15 ${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
      </g>
      {series.map((item) => (
        <g key={item.label}>
          <path d={pathFor(item.points)} fill="none" stroke={toneColor[item.tone]} strokeWidth="2" strokeDasharray={item.dash} vectorEffect="non-scaling-stroke" />
          {item.points.length > 0 && (
            <text className="plot-direct-label" x={sx(item.points[item.points.length - 1]!.x) - 4} y={sy(item.points[item.points.length - 1]!.y) - 8} textAnchor="end" fill={toneColor[item.tone]}>{item.label}</text>
          )}
        </g>
      ))}
      {markerX !== undefined && markerX >= xDomain[0] && markerX <= xDomain[1] && (
        <g className="plot-marker">
          <line x1={sx(markerX)} x2={sx(markerX)} y1={margin.top} y2={height - margin.bottom} />
          <circle cx={sx(markerX)} cy={margin.top + 6} r="4" />
          <text x={sx(markerX) + 7} y={margin.top + 12}>{markerLabel ?? `x=${markerX}`}</text>
        </g>
      )}
    </svg>
  );
}
