import { useMemo, useState } from 'react';
import { analyzeRbwSpectrum } from '@/lib/rf';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { LinePlot } from '../plots/LinePlot';
import { PlotFrame } from '../plots/PlotFrame';
import {
  useLinkedSignalState,
  type LinkedSignalLabState,
} from './useLinkedSignalState';

interface Props {
  signal?: LinkedSignalLabState;
}

const detectorNoiseAdjustmentDb: Readonly<Record<string, number>> = Object.freeze({
  rms: 0,
  sample: -1.05,
  'positive-peak': 2.5,
});

export default function SpectrumLab({ signal: sharedSignal }: Props = {}) {
  const localSignal = useLinkedSignalState();
  const signal = sharedSignal ?? localSignal;
  const {
    record,
    rbwKhz,
    frequencyOffsetKhz,
    commonPhaseDegrees,
    markerSymbolIndex,
    setRbwKhz,
    setFrequencyOffsetKhz,
    setCommonPhaseDegrees,
    setMarkerSymbolIndex,
  } = signal;
  const [detector, setDetector] = useState('rms');
  const noiseFigureDb = 15;
  const fullScaleInputDbm = -30;
  const detectorAdjustmentDb = detectorNoiseAdjustmentDb[detector] ?? 0;
  const noiseDbm = -174 + noiseFigureDb + 10 * Math.log10(rbwKhz * 1_000) + detectorAdjustmentDb;
  const spectrum = useMemo(() => analyzeRbwSpectrum(record.capture, {
    rbwHz: rbwKhz * 1_000,
    window: 'hann',
    displayFloorDbfs: -150,
  }), [rbwKhz, record]);
  const trace = spectrum.bins.map((bin) => ({
    x: bin.frequencyHz / 1_000,
    y: Math.max(noiseDbm, fullScaleInputDbm + bin.powerDbfs),
  }));
  const noise = [
    { x: -512, y: noiseDbm },
    { x: 512, y: noiseDbm },
  ];
  const markerSymbol = record.symbols[markerSymbolIndex] ?? record.symbols[0]!;
  const relativeSweepCost = (100 / rbwKhz) ** 2;
  const ledger: LedgerEntry[] = [
    { label: '변경', value: `RBW ${rbwKhz.toFixed(0)} kHz · QPSK offset ${frequencyOffsetKhz.toFixed(1)} kHz · phase ${commonPhaseDegrees.toFixed(0)}°` },
    { label: '직접 효과', value: `같은 ${record.capture.samples.length}-sample IQ record에 noise bandwidth가 ${rbwKhz.toFixed(0)} kHz인 Gaussian power filter 적용`, tone: 'active' },
    { label: '화면 결과', value: `QPSK spectrum center ${frequencyOffsetKhz.toFixed(1)} kHz · displayed noise ${noiseDbm.toFixed(1)} dBm · marker symbol ${markerSymbol.index}` },
    { label: '비용·한계', value: `classic swept 상대 시간 약 ${relativeSweepCost.toFixed(0)}× · ${detector} detector의 교육용 noise correction ${detectorAdjustmentDb >= 0 ? '+' : ''}${detectorAdjustmentDb.toFixed(2)} dB` },
  ];

  return (
    <LabShell
      labId="spectrum"
      title="X-Series Spectrum Lab"
      question="RBW를 줄이면 왜 CW 기준 tone은 유지되는데 noise가 내려갈까?"
      description={`Shared record ${record.scenarioId}. Spectrum과 IQ tab은 이 한 complex QPSK record를 서로 다른 acquisition/display 경로로 읽습니다.`}
      activeStages={['source', 'acquisition', 'dsp', 'display']}
      stageMap={{
        rbw: ['acquisition', 'dsp', 'display'],
        'shared-frequency-offset': ['source', 'acquisition', 'dsp', 'display'],
        'shared-common-phase': ['source', 'acquisition', 'dsp', 'display'],
        'shared-symbol-marker': ['display'],
        detector: ['dsp', 'display'],
      }}
      controls={<>
        <RangeControl id="rbw" label="Resolution bandwidth" min={5} max={100} step={5} value={rbwKhz} valueText={`${rbwKhz} kHz`} onChange={(event) => setRbwKhz(Number(event.currentTarget.value))} help="동일 IQ FFT bin의 power를 RBW filter response로 적분합니다." />
        <RangeControl id="shared-frequency-offset" label="Baseband frequency offset" min={-160} max={160} step={2} value={frequencyOffsetKhz} valueText={`${frequencyOffsetKhz.toFixed(0)} kHz`} onChange={(event) => setFrequencyOffsetKhz(Number(event.currentTarget.value))} help="같은 QPSK record의 complex phase ramp와 spectrum center를 함께 이동합니다." />
        <RangeControl id="shared-common-phase" label="Common IQ phase" min={-180} max={180} step={5} value={commonPhaseDegrees} valueText={`${commonPhaseDegrees.toFixed(0)}°`} onChange={(event) => setCommonPhaseDegrees(Number(event.currentTarget.value))} help="Spectrum magnitude는 유지되지만 IQ/constellation은 회전합니다." />
        <RangeControl id="shared-symbol-marker" label="Symbol marker" min={0} max={record.symbols.length - 1} step={1} value={markerSymbolIndex} valueText={`${markerSymbolIndex}`} onChange={(event) => setMarkerSymbolIndex(Number(event.currentTarget.value))} help="IQ tab에서도 동일 symbol decision sample이 선택됩니다." />
        <SelectControl id="detector" label="Detector" value={detector} onChange={(event) => setDetector(event.currentTarget.value)} help="한 record의 signal shape는 같고 noise 표시 통계가 달라집니다.">
          <option value="rms">RMS</option>
          <option value="sample">Sample</option>
          <option value="positive-peak">Positive peak</option>
        </SelectControl>
      </>}
      ledger={ledger}
      prediction={{
        id: 'rbw-decade',
        prompt: 'RBW를 100 kHz에서 10 kHz로 줄이면 bin-centered CW 기준 tone과 white-noise 표시값은?',
        options: ['tone −10 dB · noise 동일', 'tone 거의 동일 · noise 약 −10 dB', '둘 다 −10 dB'],
        correctIndex: 1,
        explanation: '바뀐 것은 동일 complex record 뒤의 분석 filter입니다. Center-frequency coherent tone은 RBW별 gain calibration으로 유지되고 적분 noise bandwidth는 줄어듭니다.',
      }}
      note={`Detector=${detector}. 0 dBFS complex-envelope peak를 ${fullScaleInputDbm} dBm input-referred로 명시 매핑했습니다. Gaussian power-response RBW 교육 모델이며 실제 filter shape, log averaging과 sweep time은 analyzer 구조에 의존합니다.`}
    >
      <div className="lab-readout-grid">
        <Readout label="Displayed noise" value={`${noiseDbm.toFixed(1)} dBm`} tone="secondary" />
        <Readout label="FFT bin width" value={`${(spectrum.fftBinWidthHz / 1_000).toFixed(2)} kHz`} tone="forward" />
        <Readout label="Shared symbol" value={`${markerSymbol.index} · QPSK label ${markerSymbol.label}`} tone="reference" />
        <Readout label="Full-scale calibration" value={`0 dBFS = ${fullScaleInputDbm} dBm`} tone="neutral" />
      </div>
      <PlotFrame
        title="SA power trace · same IQ record"
        observation={`관찰: offset ${frequencyOffsetKhz.toFixed(0)} kHz는 spectrum center와 IQ phase slope를 함께 움직이고, common phase는 magnitude trace를 바꾸지 않습니다.`}
        table={<table><thead><tr><th>Setting</th><th>Value</th></tr></thead><tbody><tr><td>Shared record</td><td>{record.scenarioId}</td></tr><tr><td>Input calibration</td><td>0 dBFS = {fullScaleInputDbm} dBm</td></tr><tr><td>RBW</td><td>{rbwKhz} kHz</td></tr><tr><td>FFT bin</td><td>{(spectrum.fftBinWidthHz / 1_000).toFixed(3)} kHz</td></tr><tr><td>Marker symbol/sample</td><td>{markerSymbol.index} / {markerSymbol.sampleIndex}</td></tr><tr><td>Noise result</td><td>{noiseDbm.toFixed(2)} dBm</td></tr></tbody></table>}
      >
        <LinePlot
          title="QPSK record through analyzer RBW"
          description={`FFT of shared record ${record.scenarioId} through a ${rbwKhz} kHz RBW filter.`}
          series={[
            { label: 'RBW-filtered QPSK', points: trace, tone: 'forward' },
            { label: `${detector} noise`, points: noise, tone: 'secondary', dash: '6 5' },
          ]}
          xDomain={[-512, 512]}
          yDomain={[-145, -24]}
          xLabel="baseband frequency (kHz)"
          yLabel="input-referred power (dBm)"
          markerX={frequencyOffsetKhz}
          markerLabel={`record center ${frequencyOffsetKhz.toFixed(0)} kHz`}
        />
      </PlotFrame>
    </LabShell>
  );
}
