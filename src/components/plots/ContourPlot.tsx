import { useId } from 'react';

export interface ContourPoint {
  re: number;
  im: number;
  value: number;
}

export type ContourLevelId = 'low' | 'middle' | 'high';
export type ContourLevelShape = 'ring' | 'square' | 'diamond';

export interface ContourLevelDescriptor {
  id: ContourLevelId;
  label: string;
  quality: number;
  value: number;
  valueLabel: string;
  shape: ContourLevelShape;
  dash: string;
}

export interface ContourAccessibilityModel {
  summary: string;
  levels: readonly ContourLevelDescriptor[];
}

export interface ContourPlotProps {
  title: string;
  description: string;
  points: readonly ContourPoint[];
  marker: { re: number; im: number };
  optimum?: { re: number; im: number };
  optimumLabel?: string;
  min: number;
  max: number;
  unit: string;
  lowerIsBetter?: boolean;
  accessibilityModel?: ContourAccessibilityModel;
}

const levelEncoding = [
  { id: 'low', label: '불리한 영역', quality: 0.2, shape: 'ring', dash: '1 2' },
  { id: 'middle', label: '중간 영역', quality: 0.5, shape: 'square', dash: '4 2' },
  { id: 'high', label: '유리한 영역', quality: 0.8, shape: 'diamond', dash: '' },
] as const;

function formatLevelValue(value: number, span: number, unit: string): string {
  const decimals = Math.abs(span) < 2 ? 2 : Math.abs(span) < 20 ? 1 : 0;
  return `≈ ${value.toFixed(decimals)} ${unit}`;
}

export function createContourAccessibilityModel(
  min: number,
  max: number,
  unit: string,
  lowerIsBetter = false,
): ContourAccessibilityModel {
  const span = max - min;
  const levels = levelEncoding.map((encoding) => {
    const rawPosition = lowerIsBetter ? 1 - encoding.quality : encoding.quality;
    const value = min + rawPosition * span;
    return {
      ...encoding,
      value,
      valueLabel: formatLevelValue(value, span, unit),
    };
  });

  return {
    levels,
    summary: levels
      .map((level) => `${level.label}은 ${level.valueLabel}, ${level.shape} 표식${level.dash ? `과 ${level.dash} dash` : '과 실선'}`)
      .join('. '),
  };
}

function qualityForValue(value: number, min: number, max: number, lowerIsBetter: boolean): number {
  const scaled = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  return lowerIsBetter ? 1 - scaled : scaled;
}

function nearestLevel(quality: number, levels: readonly ContourLevelDescriptor[]): ContourLevelDescriptor {
  return levels.reduce((nearest, level) => (
    Math.abs(level.quality - quality) < Math.abs(nearest.quality - quality) ? level : nearest
  ));
}

interface LevelGlyphProps {
  cx: number;
  cy: number;
  level: ContourLevelDescriptor;
  keyGlyph?: boolean;
}

function LevelGlyph({ cx, cy, level, keyGlyph = false }: LevelGlyphProps) {
  const radius = keyGlyph ? 6 : 3.5;
  const className = `contour-sample-glyph contour-sample-glyph--${level.id}`;

  if (level.shape === 'square') {
    return <rect className={className} x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} />;
  }

  if (level.shape === 'diamond') {
    return <path className={className} d={`M ${cx} ${cy - radius} L ${cx + radius} ${cy} L ${cx} ${cy + radius} L ${cx - radius} ${cy} Z`} />;
  }

  return <circle className={className} cx={cx} cy={cy} r={radius} />;
}

export function ContourPlot({
  title,
  description,
  points,
  marker,
  optimum,
  optimumLabel = 'metric optimum',
  min,
  max,
  unit,
  lowerIsBetter = false,
  accessibilityModel,
}: ContourPlotProps) {
  const id = useId();
  const size = 440;
  const height = 530;
  const center = size / 2;
  const radius = 172;
  const x = (value: number) => center + value * radius;
  const y = (value: number) => center - value * radius;
  const normalize = (value: number) => qualityForValue(value, min, max, lowerIsBetter);
  const accessibleScale = accessibilityModel ?? createContourAccessibilityModel(min, max, unit, lowerIsBetter);

  return (
    <svg viewBox={`0 0 ${size} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="contour-plot">
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description} {accessibleScale.summary} 선택점과 metric optimum은 별도 marker로 표시한다.</desc>
      <defs><clipPath id={`${id}-clip`}><circle cx={center} cy={center} r={radius} /></clipPath></defs>
      <circle cx={center} cy={center} r={radius} className="smith-boundary" />
      <g clipPath={`url(#${id}-clip)`}>
        {points.map((point, index) => {
          const quality = normalize(point.value);
          const level = nearestLevel(quality, accessibleScale.levels);
          const fill = `color-mix(in srgb, var(--color-reference-bright) ${Math.round(20 + quality * 75)}%, var(--color-instrument))`;
          const cx = x(point.re);
          const cy = y(point.im);
          return (
            <g key={index} data-contour-level={level.id}>
              <circle cx={cx} cy={cy} r="8" fill={fill} opacity="0.82" />
              <LevelGlyph cx={cx} cy={cy} level={level} />
            </g>
          );
        })}
        {[0.25, 0.5, 0.75].map((ratio) => <circle key={ratio} cx={center} cy={center} r={radius * ratio} className="contour-ring" />)}
        <line x1={center - radius} x2={center + radius} y1={center} y2={center} className="smith-axis" />
        <line x1={center} x2={center} y1={center - radius} y2={center + radius} className="smith-axis" />
      </g>
      {optimum && <>
        <circle cx={x(optimum.re)} cy={y(optimum.im)} r="11" className="contour-optimum-marker" />
        <text x={x(optimum.re) + 14} y={y(optimum.im) + 20} className="plot-label-forward">{optimumLabel}</text>
      </>}
      <circle cx={x(marker.re)} cy={y(marker.im)} r="8" className="smith-marker" />
      <text x={x(marker.re) + 12} y={y(marker.im) - 10} className="plot-label-reference">selected Γ</text>
      <text x="26" y="422">{lowerIsBetter ? 'best' : 'low'} {min.toFixed(1)} {unit}</text>
      <text x={size - 26} y="422" textAnchor="end">{lowerIsBetter ? 'worst' : 'high'} {max.toFixed(1)} {unit}</text>
      <g className="contour-level-key" aria-hidden="true">
        {accessibleScale.levels.map((level, index) => {
          const rowY = 458 + index * 28;
          return (
            <g key={level.id}>
              <LevelGlyph cx={28} cy={rowY - 4} level={level} keyGlyph />
              <text x="46" y={rowY}>{level.label} · {level.valueLabel}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
