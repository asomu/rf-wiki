import { useEffect, useMemo, useState } from 'react';
import {
  allocateBwpResourceBlocks,
  createResourceAllocationOfdm,
  getLteResourceGrid,
  getNrResourceGrid,
  ofdmAveragePower,
} from '@/lib/rf';
import type { QamOrder } from '@/types';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { PlotFrame } from '../plots/PlotFrame';
import { ComplexPlane } from '../plots/ComplexPlane';
import { LinePlot } from '../plots/LinePlot';
import { ResourceGridPlot } from '../plots/ResourceGridPlot';

function downsampleComplexWaveform(
  samples: readonly { readonly re: number; readonly im: number }[],
  samplePeriodUs: number,
  maximumPoints = 420,
) {
  const stride = Math.max(1, Math.ceil(samples.length / maximumPoints));
  const selected = samples
    .map((sample, index) => ({ sample, index }))
    .filter(({ index }) => index % stride === 0 || index === samples.length - 1);
  return {
    i: selected.map(({ sample, index }) => ({ x: index * samplePeriodUs, y: sample.re })),
    q: selected.map(({ sample, index }) => ({ x: index * samplePeriodUs, y: sample.im })),
  };
}

export default function ResourceGridLab() {
  const [rat, setRat] = useState<'LTE' | 'NR'>('NR');
  const [scsKhz, setScsKhz] = useState(30);
  const [bwpStart, setBwpStart] = useState(0);
  const [bwpSize, setBwpSize] = useState(273);
  const [rbCount, setRbCount] = useState(100);
  const [location, setLocation] = useState(0);
  const [powerMode, setPowerMode] = useState<'total' | 'per-rb'>('total');
  const [qamOrder, setQamOrder] = useState<QamOrder>(16);
  const config = useMemo(
    () => rat === 'LTE' ? getLteResourceGrid(20) : getNrResourceGrid(100, scsKhz, 'FR1'),
    [rat, scsKhz],
  );

  const safeBwpStart = rat === 'LTE'
    ? 0
    : Math.min(bwpStart, config.totalResourceBlocks - 1);
  const maximumBwpSize = config.totalResourceBlocks - safeBwpStart;
  const safeBwpSize = rat === 'LTE'
    ? config.totalResourceBlocks
    : Math.max(1, Math.min(bwpSize, maximumBwpSize));
  const safeCount = Math.max(1, Math.min(rbCount, safeBwpSize));
  const maxLocation = Math.max(0, safeBwpSize - safeCount);
  const safeLocation = Math.min(location, maxLocation);
  const bwpAllocation = useMemo(() => allocateBwpResourceBlocks(config, {
    startResourceBlock: safeBwpStart,
    resourceBlockCount: safeBwpSize,
    allocationLocation: safeLocation,
    allocationResourceBlockCount: safeCount,
  }), [config, safeBwpSize, safeBwpStart, safeCount, safeLocation]);
  const allocation = bwpAllocation.allocation;
  const carrierStart = allocation.startResourceBlock;
  const occupiedMhz = Number(allocation.occupiedBandwidthHz) / 1e6;
  const totalPsdDeltaDb = powerMode === 'total'
    ? 10 * Math.log10(config.totalResourceBlocks / safeCount)
    : 0;
  const ofdmModel = useMemo(() => createResourceAllocationOfdm(
    config,
    carrierStart,
    safeCount,
    {
      fftSize: 4096,
      cyclicPrefixSamples: 256,
      qamOrder,
      seed: 1701,
      powerNormalization: powerMode === 'total'
        ? 'fixed-carrier-total'
        : 'per-subcarrier',
    },
  ), [carrierStart, config, powerMode, qamOrder, safeCount]);
  const samplePeriodUs = 1e6 / Number(ofdmModel.sampleRateHz);
  const cpDurationUs = Number(ofdmModel.cyclicPrefixDurationSeconds) * 1e6;
  const usefulDurationUs = Number(ofdmModel.usefulSymbolDurationSeconds) * 1e6;
  const waveform = useMemo(() => downsampleComplexWaveform(
    ofdmModel.symbol.samplesWithCyclicPrefix,
    samplePeriodUs,
  ), [ofdmModel, samplePeriodUs]);
  const waveformLimit = Math.max(
    0.05,
    ...ofdmModel.symbol.samplesWithCyclicPrefix.map((sample) => (
      Math.max(Math.abs(sample.re), Math.abs(sample.im))
    )),
  ) * 1.18;
  const constellationStride = Math.max(1, Math.floor(ofdmModel.symbol.mappedSubcarriers.length / 24));
  const constellation = ofdmModel.symbol.mappedSubcarriers
    .filter((_, index) => index % constellationStride === 0)
    .slice(0, 24)
    .map((mapped, index) => ({
      x: mapped.value.re,
      y: mapped.value.im,
      label: index === 0 ? `k=${mapped.offsetFromDc}` : '',
      tone: index === 0 ? 'reference' as const : 'forward' as const,
    }));
  const constellationAxisExtent = Math.max(
    1,
    ...constellation.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]),
  ) * 1.12;
  const locationBinShift = safeLocation * config.subcarriersPerResourceBlock;
  const locationFrequencyShiftMhz = safeLocation * 12 * Number(config.subcarrierSpacingKHz) / 1_000;
  const mappedCountText = `${ofdmModel.symbol.mappedSubcarriers.length.toLocaleString('en-US')} / ${ofdmModel.symbol.fftSize.toLocaleString('en-US')}`;
  const bwpEnd = safeBwpStart + safeBwpSize - 1;
  const bwpLabel = `${rat === 'NR' ? 'BWP' : 'carrier'} ${safeBwpStart}…${bwpEnd}`;

  useEffect(() => {
    setBwpStart(safeBwpStart);
    setBwpSize(safeBwpSize);
    setRbCount(safeCount);
    setLocation(safeLocation);
  }, [safeBwpSize, safeBwpStart, safeCount, safeLocation]);

  const ledger: LedgerEntry[] = [
    { label: '변경', value: `${rat} ${rat === 'LTE' ? '20' : '100'} MHz · SCS ${Number(config.subcarrierSpacingKHz)} kHz · ${bwpLabel} · ${safeCount} RB @ BWP location ${safeLocation}` },
    { label: '직접 효과', value: `${safeCount * 12} physical subcarriers를 IFFT bin ${ofdmModel.firstActiveBinOffset}…${ofdmModel.lastActiveBinOffset}에 배치 · BWP-relative bin shift ${locationBinShift}`, tone: 'active' },
    { label: '화면 결과', value: `carrier PRB ${carrierStart}…${carrierStart + safeCount - 1} · allocation ${occupiedMhz.toFixed(2)} MHz · center ${(Number(allocation.centerOffsetHz) / 1e6).toFixed(2)} MHz · location phase-ramp equivalent ${locationFrequencyShiftMhz.toFixed(2)} MHz` },
    { label: '비용·한계', value: `${powerMode === 'total' ? `총전력 고정이면 full-grid 대비 PSD +${totalPsdDeltaDb.toFixed(1)} dB` : 'RB당 전력 고정이면 RB 수와 함께 총전력이 변함'} · 4096-point 1/N IFFT는 모든 allocated subcarrier를 계산하지만 DM-RS/guard/DC puncturing과 filtering은 생략` },
  ];

  return (
    <LabShell
      labId="resource-grid"
      title="Signal Studio Resource Grid Lab"
      question="100 MHz에서 RB100 location 0은 실제로 어디에 놓일까?"
      description="Channel BW, SCS, carrier grid, BWP, allocation count와 location을 실제 active IFFT bins와 한 상태로 연결합니다."
      activeStages={['source', 'dsp', 'display']}
      stageMap={{
        rat: ['source', 'dsp', 'display'],
        scs: ['source', 'dsp', 'display'],
        'bwp-start': ['source', 'dsp', 'display'],
        'bwp-size': ['source', 'dsp', 'display'],
        'rb-count': ['source', 'dsp', 'display'],
        'rb-location': ['source', 'dsp', 'display'],
        'power-mode': ['source', 'dsp', 'display'],
        'qam-order': ['source', 'dsp', 'display'],
      }}
      controls={<>
        <SelectControl id="rat" label="Radio access technology" value={rat} onChange={(event) => setRat(event.currentTarget.value as 'LTE' | 'NR')} help={rat === 'LTE' ? 'LTE 단일 CC 최대는 20 MHz / 100 RB입니다.' : 'NR FR1 100 MHz resource grid를 사용합니다.'}>
          <option value="NR">NR FR1 · 100 MHz</option>
          <option value="LTE">LTE · 20 MHz</option>
        </SelectControl>
        {rat === 'NR' && <SelectControl id="scs" label="Subcarrier spacing" value={scsKhz} onChange={(event) => setScsKhz(Number(event.currentTarget.value))}><option value={30}>30 kHz · 273 RB</option><option value={60}>60 kHz · 135 RB</option></SelectControl>}
        {rat === 'NR' && <RangeControl id="bwp-start" label="BWP start (CRB)" min={0} max={config.totalResourceBlocks - 1} step={1} value={safeBwpStart} valueText={`${safeBwpStart}`} onChange={(event) => setBwpStart(Number(event.currentTarget.value))} help="BWP의 carrier-RB 기준 시작점입니다." />}
        {rat === 'NR' && <RangeControl id="bwp-size" label="BWP size" min={1} max={maximumBwpSize} step={1} value={safeBwpSize} valueText={`${safeBwpSize} RB`} onChange={(event) => setBwpSize(Number(event.currentTarget.value))} help={`BWP는 carrier PRB ${safeBwpStart}…${bwpEnd}입니다.`} />}
        <RangeControl id="rb-count" label="Allocation RB count" min={1} max={safeBwpSize} step={1} value={safeCount} valueText={`${safeCount} RB`} onChange={(event) => setRbCount(Number(event.currentTarget.value))} />
        <RangeControl id="rb-location" label="Location within BWP" min={0} max={maxLocation} step={1} value={safeLocation} valueText={`${safeLocation}`} onChange={(event) => setLocation(Number(event.currentTarget.value))} help={`carrier PRB start = ${safeBwpStart} + ${safeLocation} = ${carrierStart}; bin shift ${locationBinShift}.`} />
        <SelectControl id="power-mode" label="Power normalization" value={powerMode} onChange={(event) => setPowerMode(event.currentTarget.value as 'total' | 'per-rb')}><option value="total">Total carrier power fixed</option><option value="per-rb">Power per RB fixed</option></SelectControl>
        <SelectControl id="qam-order" label="Allocated subcarrier modulation" value={qamOrder} onChange={(event) => setQamOrder(Number(event.currentTarget.value) as QamOrder)} help="모든 allocated subcarrier에 deterministic complex symbol을 실제로 map합니다."><option value={4}>QPSK</option><option value={16}>16QAM</option><option value={64}>64QAM</option><option value={256}>256QAM</option></SelectControl>
      </>}
      ledger={ledger}
      prediction={{
        id: 'nr-rb100',
        prompt: 'NR 100 MHz에서 RB100을 유지하고 SCS를 30 kHz에서 60 kHz로 바꾸면 allocation 폭은?',
        options: ['36 MHz → 72 MHz', '72 MHz → 36 MHz', '항상 100 MHz'],
        correctIndex: 0,
        explanation: 'RB는 항상 12 subcarrier이므로 SCS가 두 배가 되면 한 RB와 RB100의 주파수 폭도 두 배입니다.',
      }}
      note="Release 17 grid lookup과 모든 allocated subcarrier의 4096-point IFFT를 사용합니다. 1/N IFFT, rectangular allocation, deterministic QAM이며 reference/control RE, windowing, RF filtering과 PA distortion은 생략합니다."
    >
      <div className="lab-readout-grid">
        <Readout label="Carrier / BWP" value={`${config.totalResourceBlocks} RB · ${safeBwpStart}…${bwpEnd}`} tone="secondary" />
        <Readout label="Allocation BW" value={`${occupiedMhz.toFixed(2)} MHz`} tone="forward" />
        <Readout label="Carrier PRB range" value={`${carrierStart}…${carrierStart + safeCount - 1}`} tone="reference" />
        <Readout label="Active / IFFT bins" value={mappedCountText} tone="neutral" />
      </div>
      <PlotFrame
        title="Carrier overview + BWP-relative allocation"
        observation={`${bwpLabel}; location ${safeLocation}은 carrier PRB ${safeBwpStart} + ${safeLocation} = ${carrierStart}, IFFT bin shift ${locationBinShift}로 연결됩니다.`}
        table={<table><thead><tr><th>Quantity</th><th>Value</th></tr></thead><tbody><tr><td>BWP</td><td>{safeBwpStart}…{bwpEnd} ({safeBwpSize} RB)</td></tr><tr><td>Allocation PRB</td><td>{carrierStart}…{carrierStart + safeCount - 1}</td></tr><tr><td>Low / high edge</td><td>{(Number(allocation.lowEdgeOffsetHz) / 1e6).toFixed(2)} / {(Number(allocation.highEdgeOffsetHz) / 1e6).toFixed(2)} MHz</td></tr><tr><td>Active / IFFT bins</td><td>{mappedCountText}</td></tr><tr><td>Location bin shift</td><td>{locationBinShift}</td></tr><tr><td>PSD delta</td><td>{totalPsdDeltaDb.toFixed(2)} dB</td></tr></tbody></table>}
      >
        <ResourceGridPlot totalRb={config.totalResourceBlocks} bwpStartRb={safeBwpStart} bwpCountRb={safeBwpSize} startRb={carrierStart} countRb={safeCount} scsKhz={Number(config.subcarrierSpacingKHz)} label={`${rat} allocation`} />
      </PlotFrame>
      <div className="linked-view-grid linked-view-grid--equal">
        <PlotFrame
          title="Actual allocated bins → OFDM time waveform"
          observation={`${safeCount} RB의 ${safeCount * 12}개 subcarrier가 IFFT에 직접 들어갑니다. location ${safeLocation}은 time samples에 ${locationFrequencyShiftMhz.toFixed(2)} MHz 상당의 linear phase ramp를 더합니다.`}
          table={<table><tbody><tr><th>Useful symbol</th><td>{usefulDurationUs.toFixed(3)} µs = 1/SCS</td></tr><tr><th>Cyclic prefix</th><td>{cpDurationUs.toFixed(3)} µs · 256 samples</td></tr><tr><th>IFFT normalization</th><td>4096 point · inverse 1/N · forward unscaled</td></tr><tr><th>Power normalization</th><td>{ofdmModel.powerNormalization} · scale {ofdmModel.subcarrierAmplitudeScale.toFixed(4)}</td></tr><tr><th>Mapped Σ|X|²</th><td>{ofdmModel.mappedSubcarrierPower.toFixed(3)}</td></tr><tr><th>Average sample power</th><td>{ofdmAveragePower(ofdmModel.symbol).toExponential(3)} · Σ|X|²/N²</td></tr><tr><th>Active / IFFT bins</th><td>{mappedCountText}</td></tr><tr><th>First / last offset</th><td>{ofdmModel.firstActiveBinOffset} / {ofdmModel.lastActiveBinOffset}</td></tr></tbody></table>}
        >
          <LinePlot
            title="OFDM I and Q samples from the selected RB allocation"
            description={`${qamOrder}-QAM on all ${safeCount * 12} allocated subcarriers, transformed by a 4096-point IFFT with a 256-sample cyclic prefix.`}
            series={[
              { label: 'I(t)', points: waveform.i, tone: 'forward' },
              { label: 'Q(t)', points: waveform.q, tone: 'secondary', dash: '5 4' },
            ]}
            xDomain={[0, (ofdmModel.symbol.samplesWithCyclicPrefix.length - 1) * samplePeriodUs]}
            yDomain={[-waveformLimit, waveformLimit]}
            xLabel="time (µs)"
            yLabel="1/N normalized amplitude"
            markerX={cpDurationUs}
            markerLabel="CP 끝 / FFT window"
          />
        </PlotFrame>
        <PlotFrame
          title={`${qamOrder === 4 ? 'QPSK' : `${qamOrder}QAM`} mapped subcarrier samples`}
          observation={`표시는 24개를 표본화했지만 계산에는 ${safeCount * 12}개 allocated subcarrier가 모두 들어갑니다.`}
          table={<table><tbody><tr><th>Seed</th><td>1701</td></tr><tr><th>Mapped subcarriers</th><td>{safeCount * 12}</td></tr><tr><th>QAM order</th><td>{qamOrder}</td></tr><tr><th>Power scale</th><td>{ofdmModel.subcarrierAmplitudeScale.toFixed(4)}×</td></tr><tr><th>I/Q axis</th><td>±{constellationAxisExtent.toFixed(2)} normalized</td></tr><tr><th>Display sample</th><td>{constellation.length} points</td></tr></tbody></table>}
        >
          <ComplexPlane title={`${qamOrder}-QAM allocated subcarrier symbols`} description={`Deterministic QAM samples from the ${safeCount * 12} subcarriers mapped into the current IFFT allocation. I and Q axes span plus or minus ${constellationAxisExtent.toFixed(2)} normalized units so the selected power normalization remains visible.`} points={constellation} axisExtent={constellationAxisExtent} />
        </PlotFrame>
      </div>
    </LabShell>
  );
}
