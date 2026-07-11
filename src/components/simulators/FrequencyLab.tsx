import { useMemo, useState } from 'react';
import { cosineWaveformByDuration, frequencyLinkState } from '@/lib/rf';
import { RangeControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { ComplexPlane } from '../plots/ComplexPlane';
import { LinePlot } from '../plots/LinePlot';
import { PlotFrame } from '../plots/PlotFrame';

export default function FrequencyLab() {
  const timeWindowNs = 3;
  const [frequencyGHz, setFrequencyGHz] = useState(1);
  const [cableLengthCm, setCableLengthCm] = useState(10);
  const [velocityFactor, setVelocityFactor] = useState(0.7);
  const state = frequencyLinkState(frequencyGHz, cableLengthCm, velocityFactor);
  const {
    periodNs,
    wavelengthMm,
    electricalLengthDegrees: phaseDegrees,
    wrappedPhaseDegrees: wrappedPhase,
    wrappedPhaseRadians: phaseRadians,
  } = state;

  const waveform = useMemo(
    () => cosineWaveformByDuration(frequencyGHz, timeWindowNs),
    [frequencyGHz],
  );

  const ledger: LedgerEntry[] = [
    { label: '변경', value: `주파수 ${frequencyGHz.toFixed(2)} GHz · 케이블 ${cableLengthCm.toFixed(1)} cm` },
    { label: '직접 효과', value: `주기 ${periodNs.toFixed(3)} ns, 케이블 파장 ${wavelengthMm.toFixed(1)} mm`, tone: 'active' },
    { label: '화면 결과', value: `동일 길이에서 위상 ${phaseDegrees.toFixed(1)}° 회전` },
    { label: '비용·한계', value: 'velocity factor와 dispersion을 모르면 실제 위상은 달라진다.' }
  ];

  const controls = (
    <>
      <RangeControl id="frequency-ghz" label="기본 주파수" min={0.5} max={3} step={0.1} value={frequencyGHz} valueText={`${frequencyGHz.toFixed(1)} GHz`} onChange={(event) => setFrequencyGHz(Number(event.currentTarget.value))} help="주파수는 1초 동안 반복되는 회전 수입니다." />
      <RangeControl id="cable-length" label="케이블 길이" min={0} max={30} step={0.5} value={cableLengthCm} valueText={`${cableLengthCm.toFixed(1)} cm`} onChange={(event) => setCableLengthCm(Number(event.currentTarget.value))} help="같은 길이도 주파수가 높아지면 더 큰 전기적 길이가 됩니다." />
      <RangeControl id="velocity-factor" label="Velocity factor" min={0.55} max={1} step={0.01} value={velocityFactor} valueText={velocityFactor.toFixed(2)} onChange={(event) => setVelocityFactor(Number(event.currentTarget.value))} help="케이블에서 파가 자유공간보다 얼마나 느린지 나타냅니다." />
    </>
  );

  return (
    <LabShell
      labId="frequency"
      title="주파수·케이블 위상 실험"
      question="주파수를 두 배로 올리면 같은 케이블은 왜 더 길어 보일까?"
      description="주파수, 시간 파형, 케이블 파장과 위상은 서로 다른 정보가 아니라 같은 신호 상태를 번역한 결과입니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{
        'frequency-ghz': ['source', 'dut', 'acquisition', 'dsp', 'display'],
        'cable-length': ['dut', 'acquisition', 'dsp', 'display'],
        'velocity-factor': ['dut', 'acquisition', 'dsp', 'display'],
      }}
      controls={controls}
      ledger={ledger}
      prediction={{
        id: 'frequency-double',
        prompt: '1 GHz를 2 GHz로 바꾸고 케이블 길이는 유지하면 주기와 위상 회전량은 어떻게 될까요?',
        options: ['주기 2배 · 위상 절반', '주기 절반 · 위상 회전 2배', '둘 다 그대로'],
        correctIndex: 1,
        explanation: '주기는 1/f이고, 같은 delay의 위상은 −2πfτ이므로 주파수에 비례해 회전합니다.'
      }}
      note="위상은 기준 신호와 reference plane이 있을 때만 비교 가능한 양입니다."
    >
      <div className="lab-readout-grid">
        <Readout label="Period" value={`${periodNs.toFixed(3)} ns`} tone="forward" />
        <Readout label="Cable wavelength" value={`${wavelengthMm.toFixed(1)} mm`} tone="secondary" />
        <Readout label="Electrical length" value={`${phaseDegrees.toFixed(1)}°`} tone="reference" />
      </div>
      <PlotFrame title="시간 파형" observation="주파수가 올라가면 같은 시간 폭에 더 많은 cycle이 들어옵니다." table={<table><thead><tr><th>Quantity</th><th>Value</th></tr></thead><tbody><tr><td>Frequency</td><td>{frequencyGHz.toFixed(2)} GHz</td></tr><tr><td>Period</td><td>{periodNs.toFixed(3)} ns</td></tr></tbody></table>}>
        <LinePlot title="Cosine time waveform" description={`${frequencyGHz} GHz cosine in a fixed ${timeWindowNs} ns observation window.`} series={[{ label: `${frequencyGHz.toFixed(1)} GHz`, points: waveform, tone: 'forward' }]} xDomain={[0, timeWindowNs]} yDomain={[-1.2, 1.2]} xLabel="time (ns)" yLabel="normalized voltage" markerX={periodNs} markerLabel="1 period" />
      </PlotFrame>
      <PlotFrame title="같은 순간의 phasor" observation="시간축의 cosine은 phasor를 실수축에 투영한 값입니다." table={<table><tbody><tr><th>Unwrapped cable phase</th><td>{phaseDegrees.toFixed(2)}°</td></tr><tr><th>Wrapped phase</th><td>{wrappedPhase.toFixed(2)}°</td></tr><tr><th>I / Q</th><td>{Math.cos(phaseRadians).toFixed(4)} / {Math.sin(phaseRadians).toFixed(4)}</td></tr><tr><th>Magnitude</th><td>1.0000</td></tr></tbody></table>}>
        <ComplexPlane title="Cable output phasor" description={`Cable output has wrapped phase ${wrappedPhase.toFixed(1)} degrees.`} points={[{ x: Math.cos(phaseRadians), y: Math.sin(phaseRadians), label: `${phaseDegrees.toFixed(1)}°`, tone: 'reference' }]} />
      </PlotFrame>
    </LabShell>
  );
}
