import { useMemo, useState } from 'react';

type Rat = 'GSM' | 'LTE' | 'NR';

const RAT_DATA = {
  GSM: {
    context: '200 kHz carrier · TDMA',
    time: ['TDMA frame 4.615 ms', 'timeslot 576.9 µs', 'burst field', 'symbol 3.692 µs'],
    frequency: ['ARFCN carrier', '200 kHz raster', 'single burst spectrum'],
    modulation: 'GMSK / EDGE 8PSK',
    path: 'Burst RF → GSM PA → harmonic filter → ASM → antenna',
    analyzer: 'Power-vs-time + gated ORFS',
  },
  LTE: {
    context: '15 kHz SCS · UL DFT-s-OFDM',
    time: ['radio frame 10 ms', 'subframe 1 ms', 'slot 0.5 ms', 'SC-FDMA symbol'],
    frequency: ['channel carrier', 'RB 180 kHz', '12 subcarriers', 'RE'],
    modulation: 'QPSK / 16·64·256QAM',
    path: 'PUSCH RF → FDD PAMiD → duplexer/ASM → antenna',
    analyzer: 'Resource grid + EVM/ACLR',
  },
  NR: {
    context: 'FR1 · scalable SCS · UL PUSCH',
    time: ['radio frame 10 ms', 'subframe 1 ms', 'slot 1/2^μ ms', 'OFDM symbol'],
    frequency: ['Point A / CRB', 'BWP', 'PRB', 'RE'],
    modulation: 'π/2-BPSK / QPSK / QAM',
    path: 'PUSCH RF → FDD PAMiD or TDD TxM → antenna',
    analyzer: 'BWP/grid + EVM/SEM + switching',
  },
} as const;

export default function CrossRatAtlas() {
  const [rat, setRat] = useState<Rat>('NR');
  const data = RAT_DATA[rat];
  const ledger = useMemo(() => [
    ['선택', `${rat} · ${data.context}`],
    ['시간 좌표', data.time.join(' → ')],
    ['주파수 좌표', data.frequency.join(' → ')],
    ['DVT 화면', data.analyzer],
  ], [data, rat]);

  return (
    <section className="cellular-visual cellular-atlas" aria-labelledby="cross-rat-atlas-title">
      <header className="cellular-visual__header">
        <div><p>Cross-RAT Time/Frequency Atlas</p><h3 id="cross-rat-atlas-title">같은 신호를 시간·주파수·module path로 이어보기</h3></div>
        <div className="cellular-segmented" role="group" aria-label="비교할 RAT">
          {(['GSM', 'LTE', 'NR'] as const).map((candidate) => (
            <button key={candidate} type="button" aria-pressed={rat === candidate} onClick={() => setRat(candidate)}>{candidate}</button>
          ))}
        </div>
      </header>

      <div className="cellular-atlas__axis" role="group" aria-label={`${rat} 시간 구조`}>
        <span className="cellular-atlas__axis-label">TIME</span>
        {data.time.map((label, index) => <div key={label} data-level={index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>)}
      </div>
      <div className="cellular-atlas__axis cellular-atlas__axis--frequency" role="group" aria-label={`${rat} 주파수 구조`}>
        <span className="cellular-atlas__axis-label">FREQ</span>
        {data.frequency.map((label, index) => <div key={label} data-level={index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>)}
      </div>

      <div className="cellular-atlas__linked">
        <div><span>MODULATION</span><strong>{data.modulation}</strong></div>
        <div><span>MODULE PATH</span><strong>{data.path}</strong></div>
        <div><span>ANALYZER</span><strong>{data.analyzer}</strong></div>
      </div>

      <dl className="cellular-ledger">
        {ledger.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  );
}
