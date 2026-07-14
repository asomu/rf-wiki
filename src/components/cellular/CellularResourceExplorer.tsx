import { useEffect, useMemo, useState } from 'react';
import {
  allocateBwpResourceBlocks,
  createResourceAllocationOfdm,
  getLteResourceGrid,
  getNrResourceGrid,
} from '@/lib/rf';
import type { QamOrder } from '@/types';

type Rat = 'LTE' | 'NR';

function paprDb(samples: readonly { re: number; im: number }[]): number {
  const powers = samples.map(({ re, im }) => re * re + im * im);
  const average = powers.reduce((sum, power) => sum + power, 0) / powers.length;
  return 10 * Math.log10(Math.max(...powers) / average);
}

export default function CellularResourceExplorer({ initialRat = 'NR', preset = '' }: { initialRat?: Rat; preset?: string }) {
  const [rat, setRat] = useState<Rat>(initialRat);
  const [lteBandwidth, setLteBandwidth] = useState(20);
  const [scsKhz, setScsKhz] = useState(preset === 'scs' ? 60 : 30);
  const [bwpStart, setBwpStart] = useState(0);
  const [bwpSize, setBwpSize] = useState(273);
  const [rbCount, setRbCount] = useState(preset === 'power-normalization' ? 10 : 100);
  const [location, setLocation] = useState(0);
  const [qamOrder, setQamOrder] = useState<QamOrder>(16);
  const [powerMode, setPowerMode] = useState<'total' | 'per-rb'>('total');
  const config = useMemo(
    () => rat === 'LTE' ? getLteResourceGrid(lteBandwidth) : getNrResourceGrid(100, scsKhz, 'FR1'),
    [lteBandwidth, rat, scsKhz],
  );
  const safeBwpStart = rat === 'LTE' ? 0 : Math.min(bwpStart, config.totalResourceBlocks - 1);
  const maximumBwpSize = config.totalResourceBlocks - safeBwpStart;
  const safeBwpSize = rat === 'LTE' ? config.totalResourceBlocks : Math.max(1, Math.min(bwpSize, maximumBwpSize));
  const safeCount = Math.max(1, Math.min(rbCount, safeBwpSize));
  const maxLocation = safeBwpSize - safeCount;
  const safeLocation = Math.min(location, maxLocation);
  const bwp = useMemo(() => allocateBwpResourceBlocks(config, {
    startResourceBlock: safeBwpStart,
    resourceBlockCount: safeBwpSize,
    allocationLocation: safeLocation,
    allocationResourceBlockCount: safeCount,
  }), [config, safeBwpSize, safeBwpStart, safeCount, safeLocation]);
  const ofdm = useMemo(() => createResourceAllocationOfdm(config, bwp.allocation.startResourceBlock, safeCount, {
    fftSize: 4096,
    cyclicPrefixSamples: 256,
    qamOrder,
    seed: 1701,
    powerNormalization: powerMode === 'total' ? 'fixed-carrier-total' : 'per-subcarrier',
  }), [bwp.allocation.startResourceBlock, config, powerMode, qamOrder, safeCount]);
  const allocationWidthMhz = Number(bwp.allocation.occupiedBandwidthHz) / 1e6;
  const lowMhz = Number(bwp.allocation.lowEdgeOffsetHz) / 1e6;
  const highMhz = Number(bwp.allocation.highEdgeOffsetHz) / 1e6;
  const psdDeltaDb = powerMode === 'total' ? 10 * Math.log10(config.totalResourceBlocks / safeCount) : 0;
  const papr = paprDb(ofdm.symbol.samplesWithCyclicPrefix);
  const bwpLeft = (safeBwpStart / config.totalResourceBlocks) * 100;
  const bwpWidth = (safeBwpSize / config.totalResourceBlocks) * 100;
  const allocationLeft = ((bwp.allocation.startResourceBlock) / config.totalResourceBlocks) * 100;
  const allocationWidth = (safeCount / config.totalResourceBlocks) * 100;

  useEffect(() => {
    setBwpStart(safeBwpStart);
    setBwpSize(safeBwpSize);
    setRbCount(safeCount);
    setLocation(safeLocation);
  }, [safeBwpSize, safeBwpStart, safeCount, safeLocation]);

  return (
    <section className="cellular-visual resource-explorer" aria-labelledby="resource-explorer-title">
      <header className="cellular-visual__header">
        <div><p>LTE/NR Resource Explorer</p><h3 id="resource-explorer-title">Carrier → BWP → RB allocation → IFFT samples</h3></div>
        <div className="cellular-segmented" role="group" aria-label="RAT 선택">
          {(['LTE', 'NR'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={rat === candidate} onClick={() => setRat(candidate)}>{candidate}</button>)}
        </div>
      </header>

      <div className="cellular-controls cellular-controls--resource">
        {rat === 'LTE' ? (
          <label>Channel BW<select value={lteBandwidth} onChange={(event) => setLteBandwidth(Number(event.currentTarget.value))}><option value={5}>5 MHz · 25 RB</option><option value={10}>10 MHz · 50 RB</option><option value={20}>20 MHz · 100 RB</option></select></label>
        ) : (
          <label>SCS<select value={scsKhz} onChange={(event) => setScsKhz(Number(event.currentTarget.value))}><option value={30}>30 kHz · 273 RB</option><option value={60}>60 kHz · 135 RB</option></select></label>
        )}
        {rat === 'NR' && <label>BWP start <output>{safeBwpStart}</output><input type="range" min="0" max={config.totalResourceBlocks - 1} value={safeBwpStart} onChange={(event) => setBwpStart(Number(event.currentTarget.value))} /></label>}
        {rat === 'NR' && <label>BWP size <output>{safeBwpSize} RB</output><input type="range" min="1" max={maximumBwpSize} value={safeBwpSize} onChange={(event) => setBwpSize(Number(event.currentTarget.value))} /></label>}
        <label>RB count <output>{safeCount}</output><input type="range" min="1" max={safeBwpSize} value={safeCount} onChange={(event) => setRbCount(Number(event.currentTarget.value))} /></label>
        <label>Location <output>{safeLocation}</output><input type="range" min="0" max={maxLocation} value={safeLocation} onChange={(event) => setLocation(Number(event.currentTarget.value))} /></label>
        <label>Modulation<select value={qamOrder} onChange={(event) => setQamOrder(Number(event.currentTarget.value) as QamOrder)}><option value={4}>QPSK</option><option value={16}>16QAM</option><option value={64}>64QAM</option><option value={256}>256QAM</option></select></label>
        <label>Power mode<select value={powerMode} onChange={(event) => setPowerMode(event.currentTarget.value as 'total' | 'per-rb')}><option value="total">Total fixed</option><option value="per-rb">Per RB fixed</option></select></label>
      </div>

      <div className="resource-strip" role="img" aria-label={`${rat} ${config.totalResourceBlocks} RB carrier, BWP ${safeBwpStart}부터 ${safeBwpSize} RB, allocation ${safeCount} RB at location ${safeLocation}`}>
        <span className="resource-strip__carrier">carrier · {config.totalResourceBlocks} RB</span>
        <span className="resource-strip__bwp" style={{ left: `${bwpLeft}%`, width: `${bwpWidth}%` }}>BWP</span>
        <span className="resource-strip__allocation" style={{ left: `${allocationLeft}%`, width: `${allocationWidth}%` }}>{safeCount} RB</span>
      </div>

      <div className="resource-readouts">
        <p><span>Carrier PRB</span><strong>{bwp.allocation.startResourceBlock}…{bwp.allocation.startResourceBlock + safeCount - 1}</strong></p>
        <p><span>Allocation BW</span><strong>{allocationWidthMhz.toFixed(2)} MHz</strong></p>
        <p><span>Low / high edge</span><strong>{lowMhz.toFixed(2)} / {highMhz.toFixed(2)} MHz</strong></p>
        <p><span>Active / IFFT</span><strong>{safeCount * 12} / 4096 bins</strong></p>
        <p><span>Calculated PAPR</span><strong>{papr.toFixed(2)} dB</strong></p>
        <p><span>Per-RB PSD Δ</span><strong>{psdDeltaDb.toFixed(2)} dB</strong></p>
      </div>

      <details className="cellular-data-alternative">
        <summary>Allocation 계산값을 표로 보기</summary>
        <table><tbody><tr><th>RAT / grid</th><td>{rat} · {config.totalResourceBlocks} RB · {Number(config.subcarrierSpacingKHz)} kHz</td></tr><tr><th>BWP</th><td>{safeBwpStart}…{safeBwpStart + safeBwpSize - 1}</td></tr><tr><th>Allocation</th><td>{safeCount} RB at BWP location {safeLocation}</td></tr><tr><th>IFFT convention</th><td>4096 point · 1/N inverse · deterministic QAM seed 1701</td></tr><tr><th>Model limit</th><td>DM-RS/control puncturing, windowing, RF filter와 PA distortion 생략</td></tr></tbody></table>
      </details>

      <dl className="cellular-ledger">
        <div><dt>변경</dt><dd>{rat} · SCS {Number(config.subcarrierSpacingKHz)} kHz · {safeCount} RB @ {safeLocation}</dd></div>
        <div><dt>직접 효과</dt><dd>{safeCount * 12} subcarrier를 IFFT bin {ofdm.firstActiveBinOffset}…{ofdm.lastActiveBinOffset}에 map</dd></div>
        <div><dt>화면 결과</dt><dd>{allocationWidthMhz.toFixed(2)} MHz span, center {(Number(bwp.allocation.centerOffsetHz) / 1e6).toFixed(2)} MHz</dd></div>
        <div><dt>비용·한계</dt><dd>{powerMode === 'total' ? `Total fixed: full grid 대비 per-RB +${psdDeltaDb.toFixed(1)} dB` : 'Per-RB fixed: RB 수와 total power가 함께 변함'}</dd></div>
      </dl>
    </section>
  );
}
