import { useId, useMemo } from 'react';
import type { Complex } from '@/types';
import type { StabilityCircle } from '@/lib/rf';

interface Props {
  title: string;
  description: string;
  plane: 'source' | 'load';
  circle: StabilityCircle | null;
  marker: Complex;
  markerStable: boolean;
  isStable: (gamma: Complex) => boolean;
}

export function StabilityCirclePlot({
  title,
  description,
  plane,
  circle,
  marker,
  markerStable,
  isStable,
}: Props) {
  const id = useId();
  const size = 440;
  const center = size / 2;
  const radius = 172;
  const mapX = (value: number) => center + value * radius;
  const mapY = (value: number) => center - value * radius;
  const samples = useMemo(() => {
    const result: Array<{ gamma: Complex; stable: boolean }> = [];
    for (let row = -8; row <= 8; row += 1) {
      for (let column = -8; column <= 8; column += 1) {
        const gamma = { re: column / 9, im: row / 9 };
        if (Math.hypot(gamma.re, gamma.im) <= 0.98) {
          result.push({ gamma, stable: isStable(gamma) });
        }
      }
    }
    return result;
  }, [isStable]);
  const markerX = mapX(marker.re);
  const markerY = mapY(marker.im);
  const markerLabel = `${plane === 'source' ? 'ΓS' : 'ΓL'} ${markerStable ? 'stable' : 'unstable'}`;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} className="smith-chart">
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description} Teal dots are stable samples and oxide crosses are unstable samples.</desc>
      <defs>
        <clipPath id={`${id}-clip`}><circle cx={center} cy={center} r={radius} /></clipPath>
      </defs>
      <circle cx={center} cy={center} r={radius} className="smith-boundary" />
      <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
        <line x1={center - radius} x2={center + radius} y1={center} y2={center} className="smith-axis" />
        <line x1={center} x2={center} y1={center - radius} y2={center + radius} className="smith-axis" />
        {[0.25, 0.5, 0.75].map((ratio) => <circle key={ratio} cx={center} cy={center} r={radius * ratio} className="smith-vswr" />)}
        {samples.map(({ gamma, stable }, index) => stable
          ? <circle key={index} cx={mapX(gamma.re)} cy={mapY(gamma.im)} r="2.2" fill="var(--color-forward-bright)" opacity="0.62" />
          : <g key={index} stroke="var(--color-reverse-bright)" strokeWidth="1.2" opacity="0.82">
              <line x1={mapX(gamma.re) - 3} y1={mapY(gamma.im) - 3} x2={mapX(gamma.re) + 3} y2={mapY(gamma.im) + 3} />
              <line x1={mapX(gamma.re) - 3} y1={mapY(gamma.im) + 3} x2={mapX(gamma.re) + 3} y2={mapY(gamma.im) - 3} />
            </g>)}
        {circle && <circle
          cx={mapX(circle.center.re)}
          cy={mapY(circle.center.im)}
          r={circle.radius * radius}
          fill="none"
          stroke="var(--color-secondary-bright)"
          strokeWidth="2.5"
          strokeDasharray="8 5"
        />}
      </g>
      <polygon
        points={`${markerX},${markerY - 9} ${markerX - 8},${markerY + 7} ${markerX + 8},${markerY + 7}`}
        fill={markerStable ? 'var(--color-forward-bright)' : 'var(--color-reverse-bright)'}
        stroke="var(--color-instrument)"
        strokeWidth="3"
      />
      <text x={Math.min(size - 126, markerX + 12)} y={Math.max(26, markerY - 10)} className={markerStable ? 'plot-label-forward' : 'plot-label-reference'}>{markerLabel}</text>
      <text x="26" y={size - 18} className="plot-label-forward">● stable · |Γeffective| &lt; 1</text>
      <text x={size - 26} y={size - 18} textAnchor="end" fill="var(--color-reverse-bright)">× unstable</text>
    </svg>
  );
}
