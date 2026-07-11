import { useId } from 'react';

interface ComplexPoint {
  x: number;
  y: number;
  label: string;
  tone?: 'forward' | 'reference' | 'reverse' | 'secondary';
}

interface Props {
  title: string;
  description: string;
  points: readonly ComplexPoint[];
  unitCircle?: boolean;
  /** Absolute I/Q value represented by the plot radius. Defaults to one. */
  axisExtent?: number;
  /** Optional marker selection for linked views. Point order is preserved. */
  onPointSelect?: (index: number) => void;
}

const toneColor = {
  forward: 'var(--color-forward-bright)',
  reference: 'var(--color-reference-bright)',
  reverse: 'var(--color-reverse-bright)',
  secondary: 'var(--color-secondary-bright)'
};

export function ComplexPlane({
  title,
  description,
  points,
  unitCircle = true,
  axisExtent = 1,
  onPointSelect,
}: Props) {
  const id = useId();
  const width = 420;
  const height = 360;
  const center = { x: width / 2, y: height / 2 };
  const plotRadius = 135;
  const safeAxisExtent = Number.isFinite(axisExtent) && axisExtent > 0 ? axisExtent : 1;
  const scale = plotRadius / safeAxisExtent;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role={onPointSelect ? 'group' : 'img'} aria-labelledby={`${id}-title ${id}-desc`} className="complex-plane">
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <line x1="30" x2={width - 30} y1={center.y} y2={center.y} className="plot-axis-line" />
      <line x1={center.x} x2={center.x} y1="28" y2={height - 28} className="plot-axis-line" />
      {unitCircle && <circle cx={center.x} cy={center.y} r={scale} className="plot-unit-circle" />}
      <text x={width - 35} y={center.y - 8}>I / Re</text>
      <text x={center.x + 8} y="38">Q / Im</text>
      {points.map((point, index) => {
        const color = toneColor[point.tone ?? 'forward'];
        const x = center.x + point.x * scale;
        const y = center.y - point.y * scale;
        return (
          <g
            key={`${index}-${point.label}-${point.x}-${point.y}`}
            className={onPointSelect ? 'complex-point complex-point--interactive' : 'complex-point'}
            role={onPointSelect ? 'button' : undefined}
            tabIndex={onPointSelect ? 0 : undefined}
            aria-label={onPointSelect ? `marker ${index} 선택 · I ${point.x.toFixed(3)}, Q ${point.y.toFixed(3)}` : undefined}
            onClick={onPointSelect ? () => onPointSelect(index) : undefined}
            onKeyDown={onPointSelect ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPointSelect(index);
              }
            } : undefined}
          >
            {onPointSelect && (
              <circle
                cx={x}
                cy={y}
                r="22"
                className="complex-point__hit-area"
                aria-hidden="true"
              />
            )}
            <line x1={center.x} y1={center.y} x2={x} y2={y} stroke={color} strokeDasharray="4 4" />
            <circle className="complex-point__marker" cx={x} cy={y} r="5" fill={color} stroke="var(--color-instrument)" strokeWidth="2" />
            <text x={x + 8} y={y - 8} fill={color}>{point.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
