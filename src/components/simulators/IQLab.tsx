import { useMemo } from 'react';
import { analyzeSpectrum } from '@/lib/rf';
import { RangeControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { ComplexPlane } from '../plots/ComplexPlane';
import { LinePlot } from '../plots/LinePlot';
import { PlotFrame } from '../plots/PlotFrame';
import {
  useLinkedSignalState,
  type LinkedSignalLabState,
} from './useLinkedSignalState';

interface Props {
  signal?: LinkedSignalLabState;
}

export default function IQLab({ signal: sharedSignal }: Props = {}) {
  const localSignal = useLinkedSignalState();
  const signal = sharedSignal ?? localSignal;
  const {
    record,
    rbwKhz,
    frequencyOffsetKhz,
    commonPhaseDegrees,
    markerSymbolIndex,
    setFrequencyOffsetKhz,
    setCommonPhaseDegrees,
    setMarkerSymbolIndex,
  } = signal;
  const sampleRateHz = Number(record.capture.sampleRateHz);
  const spectrum = useMemo(() => analyzeSpectrum(record.capture.samples, {
    sampleRateHz,
    window: 'hann',
    displayFloorDbfs: -120,
  }), [record, sampleRateHz]);
  const markerSymbol = record.symbols[markerSymbolIndex] ?? record.symbols[0]!;
  const markerSample = record.capture.samples[markerSymbol.sampleIndex]!;
  const subsetStart = Math.max(0, markerSymbol.sampleIndex - 24);
  const subsetEnd = Math.min(record.capture.samples.length, subsetStart + 64);
  const timeSubset = record.capture.samples.slice(subsetStart, subsetEnd);
  const iTrace = timeSubset.map((sample) => ({ x: Number(sample.timeSeconds) * 1e6, y: sample.re }));
  const qTrace = timeSubset.map((sample) => ({ x: Number(sample.timeSeconds) * 1e6, y: sample.im }));
  const spectrumPoints = spectrum.bins.map((bin) => ({
    x: Number(bin.frequencyHz) / 1_000,
    y: bin.magnitudeDbfs,
  }));
  const magnitude = Math.hypot(markerSample.re, markerSample.im);
  const phase = Math.atan2(markerSample.im, markerSample.re) * 180 / Math.PI;
  const markerTimeUs = Number(markerSample.timeSeconds) * 1e6;
  const constellation = record.symbols.map((symbol) => ({
    x: symbol.value.re,
    y: symbol.value.im,
    label: symbol.index === markerSymbol.index ? `symbol ${symbol.index}` : '',
    tone: symbol.index === markerSymbol.index ? 'reference' as const : 'forward' as const,
  }));
  const ledger: LedgerEntry[] = [
    { label: '변경', value: `공유 QPSK record phase ${commonPhaseDegrees.toFixed(0)}° · offset ${frequencyOffsetKhz.toFixed(1)} kHz · symbol ${markerSymbol.index}` },
    { label: '직접 효과', value: `같은 ${record.capture.samples.length}개 complex sample의 I/Q 좌표와 sample-to-sample phase가 변화`, tone: 'active' },
    { label: '화면 결과', value: `symbol ${markerSymbol.index} |I+jQ| ${magnitude.toFixed(3)} · ∠ ${phase.toFixed(1)}° · FFT center ${frequencyOffsetKhz.toFixed(1)} kHz` },
    { label: '비용·한계', value: `SA tab의 RBW ${rbwKhz.toFixed(0)} kHz는 이 raw record 뒤의 표시 filter이며 IQ samples 자체를 바꾸지 않음 · 공통 trigger/reference 없이는 capture 간 절대 phase 비교 불가` },
  ];

  return (
    <LabShell
      labId="iq"
      title="89600 VSA IQ Lab"
      question="IQ를 30° 회전시켜도 magnitude spectrum은 왜 그대로일까?"
      description={`Shared record ${record.scenarioId}. SA tab과 동일한 complex samples에서 I/Q time, decision-point constellation과 FFT를 다시 계산합니다.`}
      activeStages={['source', 'acquisition', 'dsp', 'display']}
      stageMap={{
        'iq-shared-phase': ['source', 'acquisition', 'dsp', 'display'],
        'iq-shared-offset': ['source', 'acquisition', 'dsp', 'display'],
        'iq-shared-symbol-marker': ['display'],
      }}
      controls={<>
        <RangeControl id="iq-shared-phase" label="Common IQ phase" min={-180} max={180} step={5} value={commonPhaseDegrees} valueText={`${commonPhaseDegrees.toFixed(0)}°`} onChange={(event) => setCommonPhaseDegrees(Number(event.currentTarget.value))} help="I+jQ = A·eʲφ. SA magnitude trace는 유지되고 constellation은 회전합니다." />
        <RangeControl id="iq-shared-offset" label="Baseband frequency offset" min={-160} max={160} step={2} value={frequencyOffsetKhz} valueText={`${frequencyOffsetKhz.toFixed(0)} kHz`} onChange={(event) => setFrequencyOffsetKhz(Number(event.currentTarget.value))} help="phase의 시간 기울기와 SA spectrum center가 같은 방향으로 이동합니다." />
        <RangeControl id="iq-shared-symbol-marker" label="Symbol marker" min={0} max={record.symbols.length - 1} step={1} value={markerSymbolIndex} valueText={`${markerSymbolIndex}`} onChange={(event) => setMarkerSymbolIndex(Number(event.currentTarget.value))} help="SA tab에서 선택한 동일 QPSK decision sample입니다." />
      </>}
      ledger={ledger}
      prediction={{
        id: 'iq-rotation',
        prompt: '모든 IQ sample에 eʲ³⁰°를 곱하면 ordinary power spectrum과 constellation은?',
        options: ['둘 다 30° 이동', 'spectrum magnitude 유지 · constellation 30° 회전', '둘 다 유지'],
        correctIndex: 1,
        explanation: '복소 회전은 FFT 전체에 같은 phase factor를 곱하지만 magnitude는 바꾸지 않습니다.',
      }}
      note={`Shared record ${record.scenarioId}; RF reconstruction은 Re{(I+jQ)eʲ2πfct} convention입니다. Rectangular QPSK pulse와 deterministic noise를 사용한 교육 모델입니다.`}
    >
      <div className="lab-readout-grid">
        <Readout label="Linked marker" value={`symbol ${markerSymbol.index} · sample ${markerSymbol.sampleIndex}`} tone="reference" />
        <Readout label="|I+jQ|" value={magnitude.toFixed(3)} tone="forward" />
        <Readout label="∠(I+jQ)" value={`${phase.toFixed(1)}°`} tone="reference" />
        <Readout label="FFT / SA RBW" value={`${(Number(spectrum.resolutionBandwidthHz) / 1_000).toFixed(2)} / ${rbwKhz.toFixed(0)} kHz`} tone="secondary" />
      </div>
      <div className="linked-view-grid">
        <PlotFrame
          title="I/Q time · selected symbol window"
          observation={`marker symbol ${markerSymbol.index}의 decision sample ${markerSymbol.sampleIndex}를 중심으로 같은 record의 I와 Q를 봅니다.`}
          table={<table><tbody><tr><th>Record</th><td>{record.scenarioId}</td></tr><tr><th>Symbol / sample</th><td>{markerSymbol.index} / {markerSymbol.sampleIndex}</td></tr><tr><th>Time</th><td>{markerTimeUs.toFixed(3)} µs</td></tr><tr><th>I / Q</th><td>{markerSample.re.toFixed(4)} / {markerSample.im.toFixed(4)}</td></tr></tbody></table>}
        >
          <LinePlot
            title="I and Q from the shared QPSK record"
            description={`Complex samples around symbol ${markerSymbol.index} in shared record ${record.scenarioId}.`}
            series={[
              { label: 'I', points: iTrace, tone: 'forward' },
              { label: 'Q', points: qTrace, tone: 'secondary', dash: '5 4' },
            ]}
            xDomain={[Number(timeSubset[0]?.timeSeconds ?? 0) * 1e6, Number(timeSubset.at(-1)?.timeSeconds ?? 0) * 1e6]}
            yDomain={[-1.25, 1.25]}
            xLabel="time (µs)"
            yLabel="normalized amplitude"
            markerX={markerTimeUs}
            markerLabel={`symbol ${markerSymbol.index}`}
          />
        </PlotFrame>
        <PlotFrame
          title="QPSK decision samples"
          observation={`oxide marker는 symbol ${markerSymbol.index}; 모든 점은 같은 IQ record의 symbol-center sample입니다.`}
          table={<table><tbody><tr><th>Symbol</th><td>{markerSymbol.index}</td></tr><tr><th>QPSK label</th><td>{markerSymbol.label}</td></tr><tr><th>Magnitude</th><td>{magnitude.toFixed(4)}</td></tr><tr><th>Phase</th><td>{phase.toFixed(2)}°</td></tr></tbody></table>}
        >
          <ComplexPlane title="Shared-record QPSK constellation" description={`Decision samples from record ${record.scenarioId}; symbol ${markerSymbol.index} is selected. Select any point to move the shared marker in the IQ time view and tables.`} points={constellation} onPointSelect={setMarkerSymbolIndex} />
        </PlotFrame>
      </div>
      <PlotFrame
        title="Raw IQ FFT · SA와 같은 record"
        observation={`이 FFT magnitude에 SA tab이 ${rbwKhz.toFixed(0)} kHz Gaussian power-response filter와 detector를 적용합니다.`}
        table={<table><tbody><tr><th>Sample rate</th><td>{(sampleRateHz / 1e6).toFixed(3)} MSa/s</td></tr><tr><th>Record length</th><td>{record.capture.samples.length} samples</td></tr><tr><th>FFT bin</th><td>{(Number(spectrum.resolutionBandwidthHz) / 1_000).toFixed(3)} kHz</td></tr><tr><th>Frequency offset</th><td>{frequencyOffsetKhz.toFixed(1)} kHz</td></tr></tbody></table>}
      >
        <LinePlot
          title="FFT magnitude of the shared QPSK record"
          description={`Raw FFT magnitude of shared record ${record.scenarioId}, centered near ${frequencyOffsetKhz} kHz.`}
          series={[{ label: '|FFT{I+jQ}|', points: spectrumPoints, tone: 'forward' }]}
          xDomain={[-512, 512]}
          yDomain={[-120, 5]}
          xLabel="baseband frequency (kHz)"
          yLabel="magnitude (dBFS)"
          markerX={frequencyOffsetKhz}
          markerLabel={`${frequencyOffsetKhz.toFixed(0)} kHz`}
        />
      </PlotFrame>
    </LabShell>
  );
}
