import { useId } from 'react';

interface Port {
  label: string;
  value: string;
  tone: 'forward' | 'reference' | 'reverse' | 'secondary';
}

interface Props {
  title: string;
  description: string;
  input: Port;
  through: Port;
  coupled: Port;
  isolated: Port;
}

export function PowerFlowDiagram({ title, description, input, through, coupled, isolated }: Props) {
  const id = useId();
  const tones: readonly Port['tone'][] = ['forward', 'reference', 'reverse', 'secondary'];
  const color = (tone: Port['tone']) => `var(--color-${tone === 'forward' ? 'forward-bright' : tone === 'reference' ? 'reference-bright' : tone === 'reverse' ? 'reverse-bright' : 'secondary-bright'})`;
  return (
    <svg viewBox="0 0 760 330" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="power-flow-diagram">
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <defs>
        {tones.map((tone) => (
          <marker key={tone} id={`${id}-${tone}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill={color(tone)} />
          </marker>
        ))}
      </defs>
      <rect x="270" y="84" width="220" height="150" rx="10" className="power-device" />
      <text x="380" y="132" textAnchor="middle" className="plot-label-strong">Directional coupler</text>
      <text x="380" y="160" textAnchor="middle">P1 input · P2 through</text>
      <text x="380" y="184" textAnchor="middle">P3 forward coupled</text>
      <text x="380" y="208" textAnchor="middle">P4 isolated / reverse</text>
      <line x1="64" y1="158" x2="266" y2="158" stroke={color(input.tone)} strokeWidth="4" markerEnd={`url(#${id}-${input.tone})`} />
      <line x1="494" y1="158" x2="704" y2="158" stroke={color(through.tone)} strokeWidth="4" markerEnd={`url(#${id}-${through.tone})`} />
      <line x1="330" y1="238" x2="330" y2="302" stroke={color(coupled.tone)} strokeWidth="3" markerEnd={`url(#${id}-${coupled.tone})`} />
      <line x1="435" y1="84" x2="435" y2="22" stroke={color(isolated.tone)} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${id}-${isolated.tone})`} />
      {[{ p: input, x: 62, y: 128, anchor: 'start' }, { p: through, x: 704, y: 128, anchor: 'end' }, { p: coupled, x: 342, y: 310, anchor: 'start' }, { p: isolated, x: 447, y: 28, anchor: 'start' }].map(({ p, x, y, anchor }) => (
        <g key={p.label}>
          <text x={x} y={y} textAnchor={anchor as 'start' | 'end'} fill={color(p.tone)} className="plot-label-strong">{p.label}</text>
          <text x={x} y={y + 20} textAnchor={anchor as 'start' | 'end'} fill={color(p.tone)}>{p.value}</text>
        </g>
      ))}
    </svg>
  );
}
