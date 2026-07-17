import { useMemo, useState } from 'react';
import {
  DEFAULT_EDUCATIONAL_PA,
  evaluatePa,
  generateLoadPullSweep,
  generatePaTransferCurve,
  generateSourcePullSweep,
  getNetworkScenario,
  nearestPullPoint,
  stabilityMetrics,
  transformNormalizedPaSample,
  terminatedStability
} from '@/lib/rf';
import type { PullInputPowerCondition, PullMetric, PullMetricOptima } from '@/types';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { ContourPlot, createContourAccessibilityModel } from '../plots/ContourPlot';
import { LinePlot } from '../plots/LinePlot';
import { PaConstellationPlot } from '../plots/PaConstellationPlot';
import { PlotFrame } from '../plots/PlotFrame';

type PullKind = 'load' | 'source';
type Metric = PullMetric;

const metricMeta: Record<Metric, { label: string; unit: string; lowerIsBetter: boolean }> = {
  outputPowerDbm: { label: 'Pout', unit: 'dBm', lowerIsBetter: false },
  paePercent: { label: 'PAE', unit: '%', lowerIsBetter: false },
  gainDb: { label: 'Gain', unit: 'dB', lowerIsBetter: false },
  evmPercent: { label: 'EVM', unit: '%', lowerIsBetter: true },
  aclrDbc: { label: 'ACLR', unit: 'dBc', lowerIsBetter: true }
};

const LOAD_OPTIMA: PullMetricOptima = {
  outputPowerDbm: { re: 0.45, im: -0.25 },
  gainDb: { re: 0.45, im: -0.25 },
  paePercent: { re: 0.28, im: -0.36 },
  evmPercent: { re: 0.10, im: -0.16 },
  aclrDbc: { re: 0.18, im: -0.05 }
};

const SOURCE_OPTIMA: PullMetricOptima = {
  outputPowerDbm: { re: 0.24, im: 0.16 },
  gainDb: { re: 0.24, im: 0.16 },
  paePercent: { re: 0.13, im: 0.27 },
  evmPercent: { re: -0.02, im: 0.10 },
  aclrDbc: { re: 0.08, im: -0.02 }
};

const PULL_NETWORK = getNetworkScenario('conditional-pa').network;
const PULL_STABILITY = stabilityMetrics(PULL_NETWORK);

export default function LoadPullLab() {
  const [kind, setKind] = useState<PullKind>('load');
  const [driveDbm, setDriveDbm] = useState(4);
  const [gammaMagnitude, setGammaMagnitude] = useState(0.46);
  const [gammaPhase, setGammaPhase] = useState(-30);
  const [metric, setMetric] = useState<Metric>('paePercent');
  const [sourcePowerCondition, setSourcePowerCondition] = useState<PullInputPowerCondition>('constant-available');
  const pa = useMemo(() => evaluatePa(driveDbm), [driveDbm]);
  const optima = kind === 'load' ? LOAD_OPTIMA : SOURCE_OPTIMA;
  const sweep = useMemo(() => {
    const options = {
      optimumGamma: optima.outputPowerDbm,
      paeOptimumGamma: optima.paePercent,
      evmOptimumGamma: optima.evmPercent,
      aclrOptimumGamma: optima.aclrDbc,
      inputMatchGamma: optima.outputPowerDbm,
      inputPowerCondition: kind === 'load' ? 'constant-accepted' as const : sourcePowerCondition,
      inputPowerDbm: driveDbm,
      peakOutputPowerDbm: Number(pa.outputPowerDbm),
      peakPaePercent: pa.paePercent,
      minimumEvmPercent: Math.max(1.2, pa.evmPercent * 0.62),
      bestAclrDbc: Number(pa.aclrDbc) - 2,
      powerSensitivity: kind === 'load' ? 1.3 : 0.9,
      paeExponent: 0.65,
      evmSensitivity: kind === 'load' ? 0.52 : 0.42,
      aclrSensitivity: kind === 'load' ? 0.9 : 0.72,
      resolution: 31,
      smithRadius: 0.9,
      isStable: (gamma: { re: number; im: number }) => terminatedStability(
        PULL_NETWORK,
        gamma,
        kind === 'load' ? 'load' : 'source'
      ).stable
    };
    return kind === 'load' ? generateLoadPullSweep(options) : generateSourcePullSweep(options);
  }, [driveDbm, kind, optima, pa.aclrDbc, pa.evmPercent, pa.outputPowerDbm, pa.paePercent, sourcePowerCondition]);
  const phaseRad = gammaPhase * Math.PI / 180;
  const marker = { re: gammaMagnitude * Math.cos(phaseRad), im: gammaMagnitude * Math.sin(phaseRad) };
  const selected = nearestPullPoint(sweep, marker);
  const values = sweep.points.map((point) => Number(point[metric]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const contourAccessibility = createContourAccessibilityModel(
    min,
    max,
    metricMeta[metric].unit,
    metricMeta[metric].lowerIsBetter,
  );
  const contourPoints = sweep.points.filter((_, index) => index % 3 === 0).map((point) => ({ re: point.gamma.re, im: point.gamma.im, value: Number(point[metric]) }));
  const metricOptimum = sweep.metricOptima[metric];
  const curve = useMemo(() => generatePaTransferCurve(-18, 10, 1), []);
  const actualCurve = curve.map((point) => ({ x: Number(point.inputPowerDbm), y: Number(point.outputPowerDbm) }));
  const idealCurve = curve.map((point) => ({ x: Number(point.inputPowerDbm), y: Number(point.idealOutputPowerDbm) }));
  const phaseCurve = curve.map((point) => ({ x: Number(point.inputPowerDbm), y: Number(point.phaseShiftDegrees) }));
  const averageDriveNormalized = Math.sqrt(10 ** (
    (driveDbm + DEFAULT_EDUCATIONAL_PA.smallSignalGainDb - DEFAULT_EDUCATIONAL_PA.saturationOutputPowerDbm) / 10
  ));
  const constellationPairs = useMemo(() => {
    const scale = Math.sqrt(10);
    const levels = [-3, -1, 1, 3] as const;
    return levels.flatMap((q) => levels.map((i) => {
      const ideal = {
        re: i * averageDriveNormalized / scale,
        im: q * averageDriveNormalized / scale,
      };
      const transformed = transformNormalizedPaSample(ideal);
      return {
        label: `I${i >= 0 ? '+' : ''}${i} Q${q >= 0 ? '+' : ''}${q}`,
        ideal,
        output: transformed.outputSampleNormalized,
        compressionDb: Number(transformed.compressionDb),
        phaseShiftDegrees: Number(transformed.phaseShiftDegrees),
      };
    }));
  }, [averageDriveNormalized]);
  const constellationAxisExtent = Math.max(
    0.5,
    ...constellationPairs.flatMap((point) => [
      Math.abs(point.ideal.re),
      Math.abs(point.ideal.im),
      Math.abs(point.output.re),
      Math.abs(point.output.im),
    ]),
  ) * 1.18;
  const impedanceValue = selected.impedance;
  const inputCondition = kind === 'load'
    ? 'DUT accepted Pin 고정'
    : sourcePowerCondition === 'constant-available'
      ? 'source available power 고정'
      : 'DUT accepted Pin 고정';
  const inputEffect = kind === 'load'
    ? `accepted Pin ${Number(selected.acceptedInputPowerDbm).toFixed(2)} dBm 고정`
    : sourcePowerCondition === 'constant-available'
      ? `Pavs ${Number(selected.availableInputPowerDbm).toFixed(2)} dBm 고정 → DUT accepted ${Number(selected.acceptedInputPowerDbm).toFixed(2)} dBm`
      : `DUT accepted ${Number(selected.acceptedInputPowerDbm).toFixed(2)} dBm 고정 → 필요한 Pavs ${Number(selected.availableInputPowerDbm).toFixed(2)} dBm`;
  const ledger: LedgerEntry[] = [
    { label: '변경', value: `${kind === 'load' ? 'ΓL' : 'ΓS'} = ${gammaMagnitude.toFixed(2)} ∠ ${gammaPhase.toFixed(0)}° · ${inputCondition}` },
    { label: '직접 효과', value: `${kind === 'load' ? 'output voltage/current termination' : 'input match와 accepted drive'} 변화 · ${inputEffect}`, tone: 'active' },
    { label: '화면 결과', value: `Pout ${Number(selected.outputPowerDbm).toFixed(2)} dBm · PAE ${selected.paePercent.toFixed(1)}% · EVM ${selected.evmPercent.toFixed(2)}% · ACLR ${Number(selected.aclrDbc).toFixed(1)} dBc` },
    { label: '비용·한계', value: `${selected.stable ? 'small-signal S-parameter 안정 영역' : 'small-signal |Γeffective|≥1 영역'} · K ${PULL_STABILITY.rollettK.toFixed(2)}, μ ${PULL_STABILITY.mu.toFixed(2)}인 조건부 안정 PA 시나리오를 mask로 사용하며 large-signal 안정도는 별도 확인`, tone: selected.stable ? 'neutral' : 'warning' }
  ];

  return (
    <LabShell
      labId="load-pull"
      title="Source / Load Pull Lab"
      question="최대 Pout 점이 왜 최소 EVM·최대 PAE 점과 같지 않을까?"
      description="작은 신호 S-parameter의 conjugate match와 큰 신호 PA의 성능 contour를 분리해 보여주는 합성 검증 모델입니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{
        'pull-kind': ['source', 'dut', 'dsp', 'display'],
        'source-power-condition': ['source', 'dut', 'dsp', 'display'],
        drive: ['source', 'dut', 'acquisition', 'dsp', 'display'],
        'gamma-mag': ['source', 'dut', 'acquisition', 'dsp', 'display'],
        'gamma-phase': ['source', 'dut', 'acquisition', 'dsp', 'display'],
        'contour-metric': ['dsp', 'display'],
      }}
      controls={<>
        <SelectControl id="pull-kind" label="Tuner being swept" value={kind} onChange={(event) => setKind(event.currentTarget.value as PullKind)} help="source-pull은 ΓS, load-pull은 ΓL을 바꿉니다."><option value="load">Load-pull · ΓL</option><option value="source">Source-pull · ΓS</option></SelectControl>
        {kind === 'source' && <SelectControl id="source-power-condition" label="Source-pull power held" value={sourcePowerCondition} onChange={(event) => setSourcePowerCondition(event.currentTarget.value as PullInputPowerCondition)} help="Pavs 고정이면 accepted drive가 변하고, accepted Pin 고정이면 generator/tuner가 필요한 Pavs를 보정합니다."><option value="constant-available">Available source power fixed</option><option value="constant-accepted">DUT accepted input fixed</option></SelectControl>}
        <RangeControl id="drive" label="PA input drive" min={-10} max={10} step={0.5} value={driveDbm} valueText={`${driveDbm.toFixed(1)} dBm`} onChange={(event) => setDriveDbm(Number(event.currentTarget.value))} help="Rapp AM-AM과 saturating AM-PM 교육 모델에 적용합니다." />
        <RangeControl id="gamma-mag" label="|Γ|" min={0} max={0.9} step={0.02} value={gammaMagnitude} valueText={gammaMagnitude.toFixed(2)} onChange={(event) => setGammaMagnitude(Number(event.currentTarget.value))} />
        <RangeControl id="gamma-phase" label="∠Γ" min={-180} max={180} step={5} value={gammaPhase} valueText={`${gammaPhase}°`} onChange={(event) => setGammaPhase(Number(event.currentTarget.value))} help="같은 |Γ|/VSWR라도 phase에 따라 PA가 보는 voltage/current trajectory가 달라집니다." />
        <SelectControl id="contour-metric" label="Contour metric" value={metric} onChange={(event) => setMetric(event.currentTarget.value as Metric)}><option value="paePercent">PAE (%) · higher better</option><option value="outputPowerDbm">Output power (dBm) · higher better</option><option value="gainDb">Gain (dB) · higher better</option><option value="evmPercent">EVM (%) · lower better</option><option value="aclrDbc">ACLR (dBc) · more negative better</option></SelectControl>
      </>}
      ledger={ledger}
      prediction={{
        id: 'optimum-tradeoff',
        prompt: 'PAE maximum marker에서 Γ phase만 움직이면 VSWR가 같을 때 Pout·PAE도 유지될까요?',
        options: ['모두 유지', 'VSWR만 유지되고 Pout·PAE는 달라질 수 있음', 'VSWR만 달라짐'],
        correctIndex: 1,
        explanation: '|Γ|는 같아도 load phase가 transistor의 RF voltage/current 관계와 harmonic condition을 바꿉니다.'
      }}
      note="이 contour는 특정 transistor의 실측 데이터가 아닙니다. 실제 load-pull은 tuner/coupler/fixture loss, DUT plane calibration, thermal drift와 stability를 포함해야 합니다."
    >
      <div className="lab-readout-grid">
        <Readout label="Selected Pout" value={`${Number(selected.outputPowerDbm).toFixed(2)} dBm`} tone="forward" />
        <Readout label="Selected PAE" value={`${selected.paePercent.toFixed(1)}%`} tone="reference" />
        <Readout label="Synthetic EVM" value={`${selected.evmPercent.toFixed(2)}%`} tone={selected.evmPercent <= 3 ? 'secondary' : 'reverse'} />
        <Readout label="Synthetic ACLR" value={`${Number(selected.aclrDbc).toFixed(1)} dBc`} tone={Number(selected.aclrDbc) <= -45 ? 'secondary' : 'reverse'} />
        <Readout label="S-parameter stability" value={selected.stable ? 'stable termination' : 'unstable termination'} tone={selected.stable ? 'forward' : 'reverse'} />
      </div>
      <div className="linked-view-grid linked-view-grid--equal">
        <PlotFrame title={`${kind === 'load' ? 'Load' : 'Source'}-pull ${metricMeta[metric].label} contour`} observation={`teal dashed marker는 ${metricMeta[metric].label} optimum, oxide marker는 현재 선택 Γ입니다. 원·사각형·마름모가 불리·중간·유리한 세 수치 영역을 색과 별개로 표시합니다.`} table={<table><thead><tr><th>Contour reading</th><th>Value / encoding</th></tr></thead><tbody><tr><th>Γ</th><td>{selected.gamma.re.toFixed(3)} {selected.gamma.im >= 0 ? '+' : '−'} j{Math.abs(selected.gamma.im).toFixed(3)}</td></tr><tr><th>Z</th><td>{Number(impedanceValue.resistanceOhms).toFixed(1)} {Number(impedanceValue.reactanceOhms) >= 0 ? '+' : '−'} j{Math.abs(Number(impedanceValue.reactanceOhms)).toFixed(1)} Ω</td></tr><tr><th>Selected {metricMeta[metric].label}</th><td>{Number(selected[metric]).toFixed(2)} {metricMeta[metric].unit}</td></tr>{contourAccessibility.levels.map((level) => <tr key={level.id}><th>{level.label}</th><td>{level.valueLabel} · {level.shape}{level.dash ? ` · dash ${level.dash}` : ' · solid'}</td></tr>)}<tr><th>Pavs / Paccepted</th><td>{Number(selected.availableInputPowerDbm).toFixed(2)} / {Number(selected.acceptedInputPowerDbm).toFixed(2)} dBm</td></tr></tbody></table>}>
          <ContourPlot title={`${metricMeta[metric].label} synthetic pull surface`} description={`Synthetic ${kind}-pull ${metricMeta[metric].label} values over a Smith disk, with selected and metric-optimum reflection coefficients.`} points={contourPoints} marker={selected.gamma} optimum={metricOptimum} optimumLabel={`${metricMeta[metric].label} optimum`} min={min} max={max} unit={metricMeta[metric].unit} lowerIsBetter={metricMeta[metric].lowerIsBetter} accessibilityModel={contourAccessibility} />
        </PlotFrame>
        <PlotFrame title="AM-AM compression" observation="S-parameter의 작은 신호 gain은 drive가 커지면 그대로 유지되지 않습니다." table={<table><tbody><tr><th>Pin</th><td>{Number(pa.inputPowerDbm).toFixed(2)} dBm</td></tr><tr><th>Ideal Pout</th><td>{Number(pa.idealOutputPowerDbm).toFixed(2)} dBm</td></tr><tr><th>Actual Pout</th><td>{Number(pa.outputPowerDbm).toFixed(2)} dBm</td></tr><tr><th>Compression</th><td>{Number(pa.compressionDb).toFixed(3)} dB</td></tr><tr><th>AM-PM</th><td>{Number(pa.phaseShiftDegrees).toFixed(2)}°</td></tr></tbody></table>}>
          <LinePlot title="PA transfer curve" description="Educational Rapp output compared with small-signal extrapolation." series={[{ label: 'ideal small-signal', points: idealCurve, tone: 'secondary', dash: '6 5' }, { label: 'Rapp AM-AM', points: actualCurve, tone: 'forward' }]} xDomain={[-18, 10]} yDomain={[6, 38]} xLabel="Pin (dBm)" yLabel="Pout (dBm)" markerX={driveDbm} markerLabel={`Pin ${driveDbm.toFixed(1)}`} />
        </PlotFrame>
      </div>
      <div className="linked-view-grid linked-view-grid--equal" data-visual-target="pa-linearity">
        <PlotFrame title="AM-PM phase transfer" observation="같은 drive sweep에서 amplitude compression과 함께 증가하는 memoryless phase rotation을 직접 비교합니다." table={<table><tbody><tr><th>Pin</th><td>{driveDbm.toFixed(2)} dBm</td></tr><tr><th>AM-PM</th><td>{Number(pa.phaseShiftDegrees).toFixed(3)}°</td></tr><tr><th>Model limit</th><td>memoryless saturating phase law · measured PA 아님</td></tr></tbody></table>}>
          <LinePlot title="PA AM-PM curve" description="Educational saturating phase shift versus PA input drive." series={[{ label: 'AM-PM phase', points: phaseCurve, tone: 'forward' }]} xDomain={[-18, 10]} yDomain={[DEFAULT_EDUCATIONAL_PA.phaseAtSaturationDegrees, 0]} xLabel="Pin (dBm)" yLabel="Phase shift (degree)" markerX={driveDbm} markerLabel={`Pin ${driveDbm.toFixed(1)}`} />
        </PlotFrame>
        <PlotFrame title="16QAM compression 전후" observation="Square는 ideal linear output, circle은 같은 sample에 Rapp AM-AM/AM-PM을 적용한 결과입니다. M1 error vector는 amplitude와 phase가 함께 바뀜을 보여줍니다." table={<table><thead><tr><th>Symbol</th><th>Ideal I+jQ / Asat</th><th>PA output I+jQ / Asat</th><th>Comp. / AM-PM</th></tr></thead><tbody>{constellationPairs.map((point) => <tr key={point.label}><th>{point.label}</th><td>{point.ideal.re.toFixed(3)} {point.ideal.im >= 0 ? '+' : '−'} j{Math.abs(point.ideal.im).toFixed(3)}</td><td>{point.output.re.toFixed(3)} {point.output.im >= 0 ? '+' : '−'} j{Math.abs(point.output.im).toFixed(3)}</td><td>{point.compressionDb.toFixed(3)} dB / {point.phaseShiftDegrees.toFixed(3)}°</td></tr>)}</tbody></table>}>
          <PaConstellationPlot points={constellationPairs} driveDbm={driveDbm} averageDriveNormalized={averageDriveNormalized} axisExtent={constellationAxisExtent} />
        </PlotFrame>
      </div>
      <PlotFrame title="한 marker에서 닫히는 power·linearity 관계" observation="source-pull에서는 고정한 power 정의에 따라 gain 분모와 accepted drive가 달라집니다." table={<table><thead><tr><th>Metric</th><th>Selected</th><th>Meaning</th></tr></thead><tbody><tr><td>Gain</td><td>{Number(selected.gainDb).toFixed(2)} dB</td><td>{sweep.inputPowerCondition === 'constant-available' ? 'Pout/Pavs transducer-style' : 'Pout/Paccepted operating-style'}</td></tr><tr><td>PAE</td><td>{selected.paePercent.toFixed(2)}%</td><td>Independent synthetic efficiency contour</td></tr><tr><td>EVM</td><td>{selected.evmPercent.toFixed(2)}%</td><td>Lower is better; own Γ optimum</td></tr><tr><td>ACLR</td><td>{Number(selected.aclrDbc).toFixed(2)} dBc</td><td>More negative is better; own Γ optimum</td></tr></tbody></table>}>
        <div className="tradeoff-strip">
          <span>Pout</span><span>Gain compression</span><span>AM-PM</span><span>PAE</span><span>EVM</span><span>ACLR</span>
        </div>
      </PlotFrame>
    </LabShell>
  );
}
