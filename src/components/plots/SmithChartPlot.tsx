import { useId } from 'react';

interface Props {
  gamma: { re: number; im: number };
  label: string;
  trace?: readonly { re: number; im: number }[];
}

export function SmithChartPlot({ gamma, label, trace = [] }: Props) {
  const id = useId();
  const size = 420;
  const center = size / 2;
  const radius = 170;
  const mapX = (value: number) => center + value * radius;
  const mapY = (value: number) => center - value * radius;
  const path = trace.map((point, index) => `${index ? 'L' : 'M'} ${mapX(point.re).toFixed(2)} ${mapY(point.im).toFixed(2)}`).join(' ');
  const markerX = mapX(gamma.re);
  const markerY = mapY(gamma.im);
  const magnitude = Math.hypot(gamma.re, gamma.im);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="smith-chart">
      <title id={`${id}-title`}>{`Smith chart · ${label}`}</title>
      <desc id={`${id}-desc`}>반사계수 실수 {gamma.re.toFixed(3)}, 허수 {gamma.im.toFixed(3)}, 크기 {magnitude.toFixed(3)}인 점.</desc>
      <defs>
        <clipPath id={`${id}-clip`}><circle cx={center} cy={center} r={radius} /></clipPath>
      </defs>
      <circle cx={center} cy={center} r={radius} className="smith-boundary" />
      <line x1={center - radius} x2={center + radius} y1={center} y2={center} className="smith-axis" />
      <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
        {[0.2, 0.5, 1, 2, 5].map((resistance) => {
          const cx = center + (resistance / (1 + resistance)) * radius;
          const r = radius / (1 + resistance);
          return <circle key={`r-${resistance}`} cx={cx} cy={center} r={r} className="smith-grid" />;
        })}
        {[0.2, 0.5, 1, 2, 5].flatMap((reactance) => [1, -1].map((sign) => {
          const cy = center - sign * (radius / reactance);
          const r = Math.abs(radius / reactance);
          return <circle key={`x-${reactance}-${sign}`} cx={center + radius} cy={cy} r={r} className="smith-grid" />;
        }))}
        {path && <path d={path} className="smith-trace" />}
        <circle cx={center} cy={center} r={magnitude * radius} className="smith-vswr" />
      </g>
      <line x1={center} y1={center} x2={markerX} y2={markerY} className="smith-vector" />
      <circle cx={markerX} cy={markerY} r="7" className="smith-marker" />
      <text x={markerX + 10} y={markerY - 10} className="plot-label-reference">{label}</text>
      <text x={center + radius - 2} y={center - 8} textAnchor="end">open</text>
      <text x={center - radius + 2} y={center - 8}>short</text>
      <text x={center + 8} y={center - 8}>50 Ω</text>
      <text x={center + 12} y="30">+jX inductive</text>
      <text x={center + 12} y={size - 20}>−jX capacitive</text>
    </svg>
  );
}
