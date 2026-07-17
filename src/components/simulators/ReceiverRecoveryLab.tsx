import { useMemo, useState } from 'react';
import {
  createResidualPhaseTrace,
  QPSK_DIBITS,
  simulateQpskRecovery,
  type QpskDibit,
} from '@/lib/cellular';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { LinePlot } from '../plots/LinePlot';
import { PlotFrame } from '../plots/PlotFrame';
import { ReceiverDecisionPlot } from '../plots/ReceiverDecisionPlot';

const OBSERVATION_TIME_MILLISECONDS = 1;
const PHASE_TRACE_DURATION_MILLISECONDS = 2;
const DETERMINISTIC_NOISE_PHASE_DEGREES = -32;

export default function ReceiverRecoveryLab() {
  const [transmittedDibit, setTransmittedDibit] = useState<QpskDibit>('00');
  const [channelMagnitude, setChannelMagnitude] = useState(0.75);
  const [channelPhaseDegrees, setChannelPhaseDegrees] = useState(-35);
  const [residualFrequencyOffsetHz, setResidualFrequencyOffsetHz] = useState(40);
  const [noiseVectorMagnitude, setNoiseVectorMagnitude] = useState(0.04);

  const result = useMemo(() => simulateQpskRecovery({
    transmittedDibit,
    channelMagnitude,
    channelPhaseDegrees,
    residualFrequencyOffsetHz,
    noiseVectorMagnitude,
    observationTimeMilliseconds: OBSERVATION_TIME_MILLISECONDS,
  }), [
    transmittedDibit,
    channelMagnitude,
    channelPhaseDegrees,
    residualFrequencyOffsetHz,
    noiseVectorMagnitude,
  ]);

  const phaseTrace = useMemo(() => createResidualPhaseTrace(
    residualFrequencyOffsetHz,
    PHASE_TRACE_DURATION_MILLISECONDS,
    41,
  ), [residualFrequencyOffsetHz]);
  const phasePoints = phaseTrace.map((point) => ({
    x: point.timeMilliseconds,
    y: point.phaseDegrees,
  }));
  const phaseExtentDegrees = Math.max(
    36,
    ...phaseTrace.map((point) => Math.abs(point.phaseDegrees)),
  );

  const ledger: LedgerEntry[] = [
    {
      label: '변경',
      value: `dibit ${transmittedDibit} · H ${channelMagnitude.toFixed(2)} ∠ ${channelPhaseDegrees.toFixed(0)}° · Δf ${residualFrequencyOffsetHz.toFixed(0)} Hz · |n| ${noiseVectorMagnitude.toFixed(2)}`,
    },
    {
      label: '직접 효과',
      value: `known common H 제거 후 ${result.phaseDriftDegrees.toFixed(1)}° phase drift와 deterministic noise vector가 남음`,
      tone: 'active',
    },
    {
      label: '화면 결과',
      value: `equalized EVM ${result.equalizedEvmPercent.toFixed(2)}% · decision ${result.transmittedDibit} → ${result.decidedDibit} · ${result.bitErrorCount} bit error`,
      tone: result.bitErrorCount > 0 ? 'warning' : 'neutral',
    },
    {
      label: '비용·한계',
      value: 'scalar H·고정 noise만 사용 · residual CFO tracking, multipath equalizer, decoder와 CRC 판정은 구현하지 않음',
      tone: 'warning',
    },
  ];

  return (
    <LabShell
      labId="cellular:foundations:receiver-iq-to-bits"
      title="Receiver IQ 복원 실험"
      question="알려진 channel을 보정한 뒤에도 constellation이 decision boundary를 넘는 이유는 무엇일까?"
      description="Unit-power QPSK 한 점에 공통 복소 채널 H, residual frequency offset와 deterministic noise를 적용하고 보정 전후를 비교합니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{
        'receiver-dibit': ['source', 'dsp', 'display'],
        'receiver-channel-magnitude': ['dut', 'acquisition', 'dsp', 'display'],
        'receiver-channel-phase': ['dut', 'acquisition', 'dsp', 'display'],
        'receiver-residual-frequency': ['acquisition', 'dsp', 'display'],
        'receiver-noise': ['acquisition', 'dsp', 'display'],
      }}
      controls={<>
        <SelectControl
          id="receiver-dibit"
          label="QPSK transmitted dibit"
          value={transmittedDibit}
          onChange={(event) => setTransmittedDibit(event.currentTarget.value as QpskDibit)}
          help="Gray-ordered educational QPSK point를 선택합니다."
        >
          {QPSK_DIBITS.map((dibit) => <option key={dibit} value={dibit}>{dibit}</option>)}
        </SelectControl>
        <RangeControl
          id="receiver-channel-magnitude"
          label="Channel magnitude |H|"
          min={0.3}
          max={1.3}
          step={0.05}
          value={channelMagnitude}
          valueText={`${channelMagnitude.toFixed(2)} V/V`}
          onChange={(event) => setChannelMagnitude(Number(event.currentTarget.value))}
          help="DM-RS-like observation으로 이미 알고 있다고 가정한 공통 linear voltage ratio입니다."
        />
        <RangeControl
          id="receiver-channel-phase"
          label="Channel phase"
          min={-120}
          max={120}
          step={5}
          value={channelPhaseDegrees}
          valueText={`${channelPhaseDegrees.toFixed(0)}°`}
          onChange={(event) => setChannelPhaseDegrees(Number(event.currentTarget.value))}
        />
        <RangeControl
          id="receiver-residual-frequency"
          label="Residual frequency offset"
          min={-200}
          max={200}
          step={10}
          value={residualFrequencyOffsetHz}
          valueText={`${residualFrequencyOffsetHz.toFixed(0)} Hz`}
          onChange={(event) => setResidualFrequencyOffsetHz(Number(event.currentTarget.value))}
          help={`t = ${OBSERVATION_TIME_MILLISECONDS.toFixed(1)} ms에서 phase drift 360·Δf·t를 관찰합니다.`}
        />
        <RangeControl
          id="receiver-noise"
          label="Deterministic noise-vector magnitude"
          min={0}
          max={0.18}
          step={0.01}
          value={noiseVectorMagnitude}
          valueText={`${noiseVectorMagnitude.toFixed(2)} normalized`}
          onChange={(event) => setNoiseVectorMagnitude(Number(event.currentTarget.value))}
          help="재현성을 위해 −32° 방향의 고정 complex noise vector를 사용합니다."
        />
      </>}
      ledger={ledger}
      prediction={{
        id: 'receiver-common-channel-limit',
        prompt: '알려진 공통 channel H를 정확히 나누면 무엇이 남을까요?',
        options: [
          'gain·phase·frequency offset·noise가 모두 사라진다',
          '고정 gain·phase는 보정되고 residual rotation·noise는 남는다',
          'channel coding이 자동으로 RF noise를 제거한다',
        ],
        correctIndex: 1,
        explanation: 'Scalar H 보정은 고정 gain/phase만 제거합니다. 시간에 누적되는 residual frequency rotation과 additive noise는 별도 추정·tracking·decoding이 필요합니다.',
      }}
      note="known common H equalization을 가정합니다. DM-RS reference sequence를 생성하지 않으며, scalar channel·deterministic noise 교육 모델은 propagation/fading, 실제 receiver architecture, EVM compliance와 CRC 판정을 대신하지 않습니다."
    >
      <div className="lab-readout-grid">
        <Readout label="Transmitted dibit" value={result.transmittedDibit} tone="reference" />
        <Readout label="Decided dibit" value={result.decidedDibit} tone={result.bitErrorCount === 0 ? 'forward' : 'reverse'} />
        <Readout label="Bit errors" value={`${result.bitErrorCount} bit`} tone={result.bitErrorCount === 0 ? 'forward' : 'reverse'} />
        <Readout label="Raw EVM" value={`${result.rawEvmPercent.toFixed(2)}%`} tone="secondary" />
        <Readout label="Equalized EVM" value={`${result.equalizedEvmPercent.toFixed(2)}%`} tone={result.bitErrorCount === 0 ? 'forward' : 'reverse'} />
      </div>

      <div className="linked-view-grid linked-view-grid--equal receiver-recovery__views">
        <PlotFrame
          title="QPSK decision plane"
          observation={`Square ideal point, circle measured point와 diamond equalized point를 같은 normalized I/Q axis에서 비교합니다. H ${channelMagnitude.toFixed(2)} V/V ∠ ${channelPhaseDegrees.toFixed(0)}°, residual CFO ${residualFrequencyOffsetHz.toFixed(0)} Hz, additive noise ${noiseVectorMagnitude.toFixed(2)} normalized ∠ ${DETERMINISTIC_NOISE_PHASE_DEGREES}°입니다.`}
          table={<table><tbody>
            <tr><th>Signal convention</th><td>unit-average-power QPSK · normalized I/Q · t={OBSERVATION_TIME_MILLISECONDS.toFixed(1)} ms</td></tr>
            <tr><th>Known channel H</th><td>|H| {channelMagnitude.toFixed(2)} V/V · phase {channelPhaseDegrees.toFixed(0)}°</td></tr>
            <tr><th>Residual CFO</th><td>{residualFrequencyOffsetHz.toFixed(0)} Hz · known common H equalization does not remove accumulated rotation</td></tr>
            <tr><th>Deterministic noise</th><td>|n| {noiseVectorMagnitude.toFixed(2)} normalized · direction {DETERMINISTIC_NOISE_PHASE_DEGREES}° · additive in measured I/Q before known-H division</td></tr>
            <tr><th>Transmitted</th><td>{result.transmittedSymbol.re.toFixed(4)} {result.transmittedSymbol.im >= 0 ? '+' : '−'} j{Math.abs(result.transmittedSymbol.im).toFixed(4)}</td></tr>
            <tr><th>Measured</th><td>{result.measuredSymbol.re.toFixed(4)} {result.measuredSymbol.im >= 0 ? '+' : '−'} j{Math.abs(result.measuredSymbol.im).toFixed(4)}</td></tr>
            <tr><th>Equalized</th><td>{result.equalizedSymbol.re.toFixed(4)} {result.equalizedSymbol.im >= 0 ? '+' : '−'} j{Math.abs(result.equalizedSymbol.im).toFixed(4)}</td></tr>
            <tr><th>Decision</th><td>{result.decidedDibit} · {result.bitErrorCount} bit error</td></tr>
          </tbody></table>}
        >
          <ReceiverDecisionPlot
            transmitted={result.transmittedSymbol}
            measured={result.measuredSymbol}
            equalized={result.equalizedSymbol}
            transmittedDibit={result.transmittedDibit}
            decidedDibit={result.decidedDibit}
            channelMagnitudeVoltsPerVolt={channelMagnitude}
            channelPhaseDegrees={channelPhaseDegrees}
            residualFrequencyOffsetHz={residualFrequencyOffsetHz}
            observationTimeMilliseconds={OBSERVATION_TIME_MILLISECONDS}
            noiseVectorMagnitudeNormalized={noiseVectorMagnitude}
            noiseVectorPhaseDegrees={DETERMINISTIC_NOISE_PHASE_DEGREES}
          />
        </PlotFrame>

        <PlotFrame
          title="Residual phase drift"
          observation={`Δf ${residualFrequencyOffsetHz.toFixed(0)} Hz이면 t=${OBSERVATION_TIME_MILLISECONDS.toFixed(1)} ms marker에서 ${result.phaseDriftDegrees.toFixed(1)}°가 누적됩니다.`}
          table={<table><thead><tr><th>Time</th><th>Residual phase</th></tr></thead><tbody>
            {phaseTrace.filter((_, index) => index % 10 === 0).map((point) => (
              <tr key={point.timeMilliseconds}><th>{point.timeMilliseconds.toFixed(2)} ms</th><td>{point.phaseDegrees.toFixed(2)}°</td></tr>
            ))}
          </tbody></table>}
        >
          <LinePlot
            title="Residual frequency-offset phase trace"
            description={`Residual frequency offset ${residualFrequencyOffsetHz.toFixed(0)} hertz over ${PHASE_TRACE_DURATION_MILLISECONDS.toFixed(1)} milliseconds.`}
            series={[{ label: 'residual phase', points: phasePoints, tone: 'forward' }]}
            xDomain={[0, PHASE_TRACE_DURATION_MILLISECONDS]}
            yDomain={[-phaseExtentDegrees, phaseExtentDegrees]}
            xLabel="Time (ms)"
            yLabel="Phase drift (degree)"
            markerX={OBSERVATION_TIME_MILLISECONDS}
            markerLabel={`${result.phaseDriftDegrees.toFixed(1)}°`}
          />
        </PlotFrame>
      </div>
    </LabShell>
  );
}
