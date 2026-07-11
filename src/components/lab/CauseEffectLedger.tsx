import { useId } from 'react';
import type { LedgerEntry } from './types';

interface Props {
  entries: readonly LedgerEntry[];
}

export function CauseEffectLedger({ entries }: Props) {
  const titleId = useId();
  return (
    <section className="cause-ledger" aria-labelledby={titleId}>
      <div className="cause-ledger__heading">
        <h3 id={titleId}>지금 보이는 변화의 원인</h3>
        <span>같은 계산 state</span>
      </div>
      <dl>
        {entries.map((entry) => (
          <div key={entry.label} data-tone={entry.tone ?? 'neutral'}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
