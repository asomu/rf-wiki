interface Props {
  label: string;
  value: string;
  tone?: 'forward' | 'reference' | 'reverse' | 'secondary' | 'neutral';
}

export function Readout({ label, value, tone = 'neutral' }: Props) {
  return (
    <div className="lab-readout" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
