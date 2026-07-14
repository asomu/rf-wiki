import { useMemo, useState } from 'react';
import { getPamidTopology } from '@/lib/cellular';
import type { PamidTopology } from '@/types';

function presetTopology(preset: string): PamidTopology['id'] {
  if (preset.includes('tdd') || preset.includes('nr')) return 'tdd-txm';
  if (preset.includes('gsm')) return 'gsm-pa-asm';
  return 'fdd-pamid';
}

export default function ModulePathDiagram({ preset = 'fdd-pamid' }: { preset?: string }) {
  const [topologyId, setTopologyId] = useState<PamidTopology['id']>(presetTopology(preset));
  const [direction, setDirection] = useState<'TX' | 'RX'>(preset === 'desense' ? 'RX' : 'TX');
  const topology = getPamidTopology(topologyId);
  const activePath = direction === 'TX' ? topology.txPath : topology.rxPath;
  const blocks = useMemo(
    () => topology.blocks.filter((block) => activePath.includes(block.id)),
    [activePath, topology.blocks],
  );

  return (
    <section className="cellular-visual module-path" aria-labelledby="module-path-title">
      <header className="cellular-visual__header">
        <div><p>Module Path Diagram</p><h3 id="module-path-title">Control state가 실제 RF path를 선택하는 위치</h3></div>
        <div className="cellular-segmented" role="group" aria-label="TX 또는 RX path">
          {(['TX', 'RX'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={direction === candidate} onClick={() => setDirection(candidate)}>{candidate}</button>)}
        </div>
      </header>

      <label className="module-path__topology">대표 DUT<select value={topologyId} onChange={(event) => setTopologyId(event.currentTarget.value as PamidTopology['id'])}><option value="gsm-pa-asm">GSM PA + filter + ASM</option><option value="fdd-pamid">FDD PAMiD</option><option value="tdd-txm">NR FR1 TDD TxM</option></select></label>

      <ol className="module-path__blocks" aria-label={`${topology.label} ${direction} active path`}>
        {blocks.map((block, index) => (
          <li key={block.id} data-kind={block.kind}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{block.label}</strong>
            <small>{block.role}</small>
            {block.controlledBy && <em>{block.controlledBy}</em>}
          </li>
        ))}
      </ol>

      <div className="module-path__state">
        <p><span>DUPLEX</span><strong>{topology.duplex}</strong></p>
        <p><span>ACTIVE</span><strong>{direction}</strong></p>
        <p><span>CONTROL</span><strong>{topologyId === 'tdd-txm' ? 'trigger + PA/T-R state' : topologyId === 'fdd-pamid' ? 'band + gain + supply mode' : 'burst + band path'}</strong></p>
      </div>

      <dl className="cellular-ledger">
        <div><dt>선택</dt><dd>{topology.label} · {direction}</dd></div>
        <div><dt>Active path</dt><dd>{blocks.map(({ label }) => label).join(' → ')}</dd></div>
        <div><dt>핵심 위험</dt><dd>{topologyId === 'tdd-txm' ? 'D/U/F 경계의 trigger·supply·switch settling' : topologyId === 'fdd-pamid' ? 'TX noise와 duplexer/ASM TX→RX isolation' : 'Burst ramp, PA duty와 harmonic filter/ASM state'}</dd></div>
        <div><dt>한계</dt><dd>Generic topology이며 실제 vendor block/register map과 timing limit를 대신하지 않음</dd></div>
      </dl>
    </section>
  );
}
