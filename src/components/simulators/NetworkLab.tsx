import { useCallback, useMemo, useState } from 'react';
import {
  RF_NETWORK_SCENARIOS,
  fromPolarDegrees,
  gainSummary,
  getNetworkScenario,
  inputReflectionCoefficient,
  loadStabilityCircle,
  magnitude,
  networkMetrics,
  outputReflectionCoefficient,
  phaseDegrees,
  sourceStabilityCircle,
  stabilityMetrics,
  terminatedStability,
  type NetworkScenarioId,
} from '@/lib/rf';
import type { Complex } from '@/types';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { PlotFrame } from '../plots/PlotFrame';
import { StabilityCirclePlot } from '../plots/StabilityCirclePlot';

function formatDb(value: number, digits = 2) {
  return Number.isFinite(value) ? `${value.toFixed(digits)} dB` : 'undefined';
}

function formatComplex(value: Complex) {
  return `${value.re.toFixed(3)} ${value.im >= 0 ? '+' : '−'} j${Math.abs(value.im).toFixed(3)}`;
}

function sParameterCell(value: Complex) {
  return `${magnitude(value).toFixed(3)} ∠ ${phaseDegrees(value).toFixed(1)}°`;
}

export default function NetworkLab() {
  const [scenarioId, setScenarioId] = useState<NetworkScenarioId>('conditional-pa');
  const [sourceMagnitude, setSourceMagnitude] = useState(0.36);
  const [sourcePhase, setSourcePhase] = useState(35);
  const [loadMagnitude, setLoadMagnitude] = useState(0.46);
  const [loadPhase, setLoadPhase] = useState(-30);
  const scenario = getNetworkScenario(scenarioId);
  const network = scenario.network;
  const sourceGamma = fromPolarDegrees(sourceMagnitude, sourcePhase);
  const loadGamma = fromPolarDegrees(loadMagnitude, loadPhase);
  const metrics = networkMetrics(network);
  const gains = gainSummary(network, sourceGamma, loadGamma);
  const stability = stabilityMetrics(network);
  const sourceCircle = sourceStabilityCircle(network);
  const loadCircle = loadStabilityCircle(network);
  const sourceState = terminatedStability(network, sourceGamma, 'source');
  const loadState = terminatedStability(network, loadGamma, 'load');
  const gammaOut = outputReflectionCoefficient(network, sourceGamma);
  const gammaIn = inputReflectionCoefficient(network, loadGamma);
  const sourceStable = useCallback((gamma: Complex) => terminatedStability(network, gamma, 'source').stable, [network]);
  const loadStable = useCallback((gamma: Complex) => terminatedStability(network, gamma, 'load').stable, [network]);
  const isActive = scenario.deviceKind === 'active';
  const selectedStable = sourceState.stable && loadState.stable;
  const forwardValue = isActive ? metrics.forwardGainDb : metrics.passiveInsertionLossDb;
  const forwardLabel = isActive ? 'S21 forward gain' : 'S21 insertion loss';
  const ledger = useMemo<LedgerEntry[]>(() => [
    {
      label: '변경',
      value: `ΓS ${sourceMagnitude.toFixed(2)} ∠ ${sourcePhase.toFixed(0)}° · ΓL ${loadMagnitude.toFixed(2)} ∠ ${loadPhase.toFixed(0)}°`,
    },
    {
      label: '직접 효과',
      value: `S12·S21 feedback가 Γin=${formatComplex(gammaIn)}, Γout=${formatComplex(gammaOut)}로 변환`,
      tone: 'active',
    },
    {
      label: '화면 결과',
      value: `GT ${formatDb(Number(gains.transducerGainDb))} · K ${stability.rollettK.toFixed(2)} · ${selectedStable ? '선택 termination 안정' : '선택 termination 불안정'}`,
      tone: selectedStable ? 'neutral' : 'warning',
    },
    {
      label: '비용·한계',
      value: `${isActive ? 'S21은 active gain으로 읽고 −S21을 insertion loss라 부르지 않는다.' : '수동 reciprocal network라 S21을 양의 insertion loss로 표시한다.'} 단일 주파수 small-signal 판정이며 large-signal stability는 별도 확인한다.`,
    },
  ], [gammaIn, gammaOut, gains.transducerGainDb, isActive, loadMagnitude, loadPhase, selectedStable, sourceMagnitude, sourcePhase, stability.rollettK]);

  return (
    <LabShell
      labId="network"
      title="Two-port VNA / Stability Lab"
      question="S21이 같아도 ΓS와 ΓL을 바꾸면 delivered gain과 안정도가 왜 달라질까?"
      description="한 세트의 complex S-parameter에서 return loss, forward/reverse transmission, 세 gain 정의와 source/load stability circle을 함께 계산합니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{
        'network-scenario': ['dut', 'acquisition', 'dsp', 'display'],
        'source-gamma-mag': ['source', 'dut', 'acquisition', 'dsp', 'display'],
        'source-gamma-phase': ['source', 'dut', 'acquisition', 'dsp', 'display'],
        'load-gamma-mag': ['dut', 'acquisition', 'dsp', 'display'],
        'load-gamma-phase': ['dut', 'acquisition', 'dsp', 'display'],
      }}
      controls={<>
        <SelectControl id="network-scenario" label="검증된 two-port 시나리오" value={scenarioId} onChange={(event) => setScenarioId(event.currentTarget.value as NetworkScenarioId)} help={scenario.description}>
          {Object.values(RF_NETWORK_SCENARIOS).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </SelectControl>
        <RangeControl id="source-gamma-mag" label="Source |ΓS|" min={0} max={0.9} step={0.02} value={sourceMagnitude} valueText={sourceMagnitude.toFixed(2)} onChange={(event) => setSourceMagnitude(Number(event.currentTarget.value))} />
        <RangeControl id="source-gamma-phase" label="Source ∠ΓS" min={-180} max={180} step={5} value={sourcePhase} valueText={`${sourcePhase}°`} onChange={(event) => setSourcePhase(Number(event.currentTarget.value))} />
        <RangeControl id="load-gamma-mag" label="Load |ΓL|" min={0} max={0.9} step={0.02} value={loadMagnitude} valueText={loadMagnitude.toFixed(2)} onChange={(event) => setLoadMagnitude(Number(event.currentTarget.value))} />
        <RangeControl id="load-gamma-phase" label="Load ∠ΓL" min={-180} max={180} step={5} value={loadPhase} valueText={`${loadPhase}°`} onChange={(event) => setLoadPhase(Number(event.currentTarget.value))} />
      </>}
      ledger={ledger}
      prediction={{
        id: 's21-versus-gt',
        prompt: 'DUT의 S21을 고정하고 ΓS·ΓL만 움직이면 transducer gain GT는?',
        options: ['항상 S21과 같음', '입출력 mismatch와 feedback 때문에 달라짐', '항상 0 dB'],
        correctIndex: 1,
        explanation: 'S21은 matched test-port 조건의 파라미터이고 GT는 source/load acceptance와 multiple reflection까지 포함합니다.',
      }}
      note="S-parameter와 안정도 원은 한 bias·한 주파수의 small-signal 모델입니다. 실제 PA는 bias network, harmonic termination, drive level, 온도에 따라 다시 검증해야 합니다."
    >
      <div className="lab-readout-grid">
        <Readout label="S11 return loss" value={formatDb(metrics.inputReturnLossDb)} tone="reference" />
        <Readout label={forwardLabel} value={formatDb(forwardValue)} tone="forward" />
        <Readout label="S12 reverse isolation" value={formatDb(metrics.reverseIsolationDb)} tone="secondary" />
        <Readout label="S22 return loss" value={formatDb(metrics.outputReturnLossDb)} tone="reference" />
        <Readout label="Transducer gain GT" value={formatDb(Number(gains.transducerGainDb))} tone={selectedStable ? 'forward' : 'reverse'} />
        <Readout label="Stability K / μ / μ′" value={`${stability.rollettK.toFixed(2)} / ${stability.mu.toFixed(2)} / ${stability.muPrime.toFixed(2)}`} tone={stability.unconditionallyStable ? 'forward' : 'reverse'} />
      </div>

      <div className="linked-view-grid linked-view-grid--equal">
        <PlotFrame
          title="Source plane · ΓS stability circle"
          observation="ΓS를 옮기면 Γout이 변합니다. teal 점은 |Γout|<1, oxide ×는 |Γout|≥1인 termination입니다."
          table={<table><tbody><tr><th>Selected ΓS</th><td>{formatComplex(sourceGamma)}</td></tr><tr><th>Resulting Γout</th><td>{formatComplex(gammaOut)} · |Γout| {magnitude(gammaOut).toFixed(3)}</td></tr><tr><th>Selected region</th><td>{sourceState.stable ? 'stable' : 'unstable'}</td></tr><tr><th>Circle center / radius</th><td>{sourceCircle ? `${formatComplex(sourceCircle.center)} / ${sourceCircle.radius.toFixed(3)}` : 'degenerate'}</td></tr></tbody></table>}
        >
          <StabilityCirclePlot title="Source stability circle" description="Source termination stability calculated from output reflection coefficient." plane="source" circle={sourceCircle} marker={sourceGamma} markerStable={sourceState.stable} isStable={sourceStable} />
        </PlotFrame>
        <PlotFrame
          title="Load plane · ΓL stability circle"
          observation="ΓL을 옮기면 Γin이 변합니다. 원 자체보다 선택 점이 어느 안정 영역에 있는지 확인하세요."
          table={<table><tbody><tr><th>Selected ΓL</th><td>{formatComplex(loadGamma)}</td></tr><tr><th>Resulting Γin</th><td>{formatComplex(gammaIn)} · |Γin| {magnitude(gammaIn).toFixed(3)}</td></tr><tr><th>Selected region</th><td>{loadState.stable ? 'stable' : 'unstable'}</td></tr><tr><th>Circle center / radius</th><td>{loadCircle ? `${formatComplex(loadCircle.center)} / ${loadCircle.radius.toFixed(3)}` : 'degenerate'}</td></tr></tbody></table>}
        >
          <StabilityCirclePlot title="Load stability circle" description="Load termination stability calculated from input reflection coefficient." plane="load" circle={loadCircle} marker={loadGamma} markerStable={loadState.stable} isStable={loadStable} />
        </PlotFrame>
      </div>

      <PlotFrame
        title="같은 S-parameter에서 파생된 gain과 명칭"
        observation="GT는 source에서 load까지, GP는 DUT input accepted power 기준, GA는 source 쪽에서 DUT가 내줄 수 있는 available power 기준입니다."
        table={<table><thead><tr><th>항목</th><th>값</th><th>해석</th></tr></thead><tbody><tr><td>S11</td><td>{sParameterCell(network.s11)}</td><td>port 1 reflection</td></tr><tr><td>S21</td><td>{sParameterCell(network.s21)}</td><td>{isActive ? 'forward gain' : 'forward transmission'}</td></tr><tr><td>S12</td><td>{sParameterCell(network.s12)}</td><td>reverse transmission / isolation</td></tr><tr><td>S22</td><td>{sParameterCell(network.s22)}</td><td>port 2 reflection</td></tr><tr><td>GT</td><td>{formatDb(Number(gains.transducerGainDb))}</td><td>Pload / Pavs</td></tr><tr><td>GP</td><td>{formatDb(Number(gains.operatingGainDb))}</td><td>Pload / Pin,accepted</td></tr><tr><td>GA</td><td>{formatDb(Number(gains.availableGainDb))}</td><td>Pavn / Pavs</td></tr></tbody></table>}
      >
        <div className="instrument-equation">S21 <span>≠</span> GT <span>≠</span> GP <span>≠</span> GA</div>
      </PlotFrame>
    </LabShell>
  );
}
