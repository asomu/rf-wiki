import { useMemo, useState } from 'react';
import {
  impedanceToReflectionCoefficient,
  reflectionCoefficientToImpedance,
  reflectionMetricsFromGamma,
  shiftReflectionReferencePlane
} from '@/lib/rf';
import { impedance } from '@/types';
import { NumberControl, RangeControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { LinePlot } from '../plots/LinePlot';
import { PlotFrame } from '../plots/PlotFrame';
import { SmithChartPlot } from '../plots/SmithChartPlot';

export default function SmithLab() {
  const [resistance, setResistance] = useState(75);
  const [reactance, setReactance] = useState(0);
  const [electricalLength, setElectricalLength] = useState(0);
  const z0 = 50;
  const load = impedance(resistance, reactance);
  const loadGamma = impedanceToReflectionCoefficient(load, z0);
  const displayedGamma = shiftReflectionReferencePlane(loadGamma, electricalLength);
  const planeImpedance = reflectionCoefficientToImpedance(displayedGamma, z0);
  const metrics = reflectionMetricsFromGamma(displayedGamma);
  const phaseDegrees = Math.atan2(displayedGamma.im, displayedGamma.re) * 180 / Math.PI;
  const standingWave = useMemo(() => Array.from({ length: 181 }, (_, index) => {
    const positionLambda = (index / 180) * 0.5;
    const betaZ = 2 * Math.PI * positionLambda;
    const forward = { re: Math.cos(-betaZ), im: Math.sin(-betaZ) };
    const reflectedPhase = Math.atan2(displayedGamma.im, displayedGamma.re) + betaZ;
    const reflected = { re: metrics.gammaMagnitude * Math.cos(reflectedPhase), im: metrics.gammaMagnitude * Math.sin(reflectedPhase) };
    return { x: positionLambda, y: Math.hypot(forward.re + reflected.re, forward.im + reflected.im) };
  }), [displayedGamma, metrics.gammaMagnitude]);
  const standingWaveMinimum = Math.min(...standingWave.map((point) => point.y));
  const standingWaveMaximum = Math.max(...standingWave.map((point) => point.y));
  const quarterWaveMagnitude = standingWave[90]?.y ?? 0;
  const ledger: LedgerEntry[] = [
    { label: '변경', value: `ZL = ${resistance.toFixed(0)} ${reactance >= 0 ? '+' : '−'} j${Math.abs(reactance).toFixed(0)} Ω · added line ${electricalLength.toFixed(0)}°` },
    { label: '직접 효과', value: `Γ = ${displayedGamma.re.toFixed(3)} ${displayedGamma.im >= 0 ? '+' : '−'} j${Math.abs(displayedGamma.im).toFixed(3)}`, tone: 'active' },
    { label: '화면 결과', value: `|Γ| ${metrics.gammaMagnitude.toFixed(3)} · ∠Γ ${phaseDegrees.toFixed(1)}° · VSWR ${Number.isFinite(metrics.vswr) ? metrics.vswr.toFixed(2) : '∞'}` },
    { label: '비용·한계', value: 'Line 추가는 −2θ, 그 delay를 제거해 plane을 load 쪽으로 옮기는 port extension은 반대 +2θ다. Loss 제거에는 de-embedding이 필요하다.' }
  ];

  return (
    <LabShell
      labId="smith"
      title="VNA / Smith Lab"
      question="VSWR가 같아도 25 Ω과 100 Ω은 왜 반대쪽에 있을까?"
      description="한 reflection coefficient에서 impedance, return loss, VSWR, reflected power, standing wave를 모두 파생합니다."
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={{
        resistance: ['dut', 'acquisition', 'dsp', 'display'],
        reactance: ['dut', 'acquisition', 'dsp', 'display'],
        plane: ['dut', 'acquisition', 'dsp', 'display'],
      }}
      controls={<>
        <NumberControl id="resistance" label="Resistance R" unit="Ω" min={0} max={200} step={1} value={resistance} onChange={(event) => setResistance(Number(event.currentTarget.value))} />
        <NumberControl id="reactance" label="Reactance X" unit="Ω" min={-150} max={150} step={1} value={reactance} onChange={(event) => setReactance(Number(event.currentTarget.value))} help="+jX는 inductive, −jX는 capacitive입니다." />
        <RangeControl id="plane" label="Added lossless-line length" min={0} max={180} step={5} value={electricalLength} valueText={`${electricalLength}° one-way`} onChange={(event) => setElectricalLength(Number(event.currentTarget.value))} help="measurement plane이 generator 쪽으로 멀어져 Γ가 −2θ 회전합니다. Delay를 제거하는 port extension은 반대 방향입니다." />
      </>}
      ledger={ledger}
      prediction={{
        id: 'same-vswr',
        prompt: '50 Ω 기준에서 25 Ω과 100 Ω load의 VSWR와 Smith 위치는?',
        options: ['VSWR 다름 · 같은 위치', 'VSWR 같음 · center의 서로 반대쪽', '둘 다 완전 match'],
        correctIndex: 1,
        explanation: '두 load 모두 |Γ|=1/3이지만 25 Ω은 Γ=−1/3, 100 Ω은 Γ=+1/3입니다.'
      }}
      note="표시된 Smith chart는 real positive 50 Ω reference를 사용합니다. calibration plane과 connector repeatability를 별도로 관리해야 합니다."
    >
      <div className="lab-readout-grid">
        <Readout label="Return loss" value={Number.isFinite(metrics.returnLossDb) ? `${metrics.returnLossDb.toFixed(2)} dB` : '∞ dB'} tone="forward" />
        <Readout label="VSWR" value={Number.isFinite(metrics.vswr) ? metrics.vswr.toFixed(3) : '∞'} tone="reference" />
        <Readout label="Reflected power" value={`${(metrics.gammaMagnitude ** 2 * 100).toFixed(2)}%`} tone="reverse" />
        <Readout label="Mismatch loss" value={Number.isFinite(metrics.mismatchLossDb) ? `${metrics.mismatchLossDb.toFixed(3)} dB` : '∞ dB'} tone="secondary" />
      </div>
      <div className="linked-view-grid linked-view-grid--equal">
        <PlotFrame title="Smith chart · S11 marker" observation="반지름은 |Γ|/VSWR, 각도는 impedance의 저항·리액턴스 정보를 보존합니다." table={<table><tbody><tr><th>Γ</th><td>{displayedGamma.re.toFixed(4)} {displayedGamma.im >= 0 ? '+' : '−'} j{Math.abs(displayedGamma.im).toFixed(4)}</td></tr><tr><th>|Γ| / phase</th><td>{metrics.gammaMagnitude.toFixed(4)} / {phaseDegrees.toFixed(2)}°</td></tr><tr><th>Plane impedance</th><td>{Number(planeImpedance.resistanceOhms).toFixed(2)} {Number(planeImpedance.reactanceOhms) >= 0 ? '+' : '−'} j{Math.abs(Number(planeImpedance.reactanceOhms)).toFixed(2)} Ω</td></tr><tr><th>VSWR</th><td>{Number.isFinite(metrics.vswr) ? metrics.vswr.toFixed(4) : '∞'}</td></tr></tbody></table>}>
          <SmithChartPlot gamma={displayedGamma} label={`${Number(planeImpedance.resistanceOhms).toFixed(1)}${Number(planeImpedance.reactanceOhms) >= 0 ? '+' : '−'}j${Math.abs(Number(planeImpedance.reactanceOhms)).toFixed(1)} Ω @ plane`} trace={Array.from({ length: 37 }, (_, index) => shiftReflectionReferencePlane(loadGamma, index * 5))} />
        </PlotFrame>
        <PlotFrame title="Cable 위 standing-wave envelope" observation="같은 VSWR라도 maximum의 위치가 Γ phase에 따라 이동합니다." table={<table><tbody><tr><th>|V|min</th><td>{standingWaveMinimum.toFixed(4)}</td></tr><tr><th>|V|max</th><td>{standingWaveMaximum.toFixed(4)}</td></tr><tr><th>|V| at λ/4 marker</th><td>{quarterWaveMagnitude.toFixed(4)}</td></tr><tr><th>Expected ratio</th><td>{Number.isFinite(metrics.vswr) ? metrics.vswr.toFixed(4) : '∞'} = |V|max / |V|min</td></tr></tbody></table>}>
          <LinePlot title="Standing wave magnitude" description={`Standing-wave envelope for reflection coefficient magnitude ${metrics.gammaMagnitude.toFixed(3)}.`} series={[{ label: '|V(z)|', points: standingWave, tone: 'forward' }]} xDomain={[0, 0.5]} yDomain={[0, Math.max(2.05, 1 + metrics.gammaMagnitude + 0.1)]} xLabel="distance toward generator (λ)" yLabel="normalized |V|" markerX={0.25} markerLabel="λ/4" />
        </PlotFrame>
      </div>
      <PlotFrame title="같은 marker의 해석 표" observation="S11 trace는 signed dB이고, line을 추가하면 load ZL과 measurement-plane Zin은 달라집니다." table={<table><thead><tr><th>Representation</th><th>Value</th></tr></thead><tbody><tr><td>S11 log magnitude</td><td>{metrics.gammaMagnitude === 0 ? '−∞' : (20 * Math.log10(metrics.gammaMagnitude)).toFixed(2)} dB</td></tr><tr><td>Return loss</td><td>{Number.isFinite(metrics.returnLossDb) ? metrics.returnLossDb.toFixed(2) : '∞'} dB</td></tr><tr><td>Load ZL</td><td>{resistance.toFixed(1)} {reactance >= 0 ? '+' : '−'} j{Math.abs(reactance).toFixed(1)} Ω</td></tr><tr><td>Plane Zin</td><td>{Number(planeImpedance.resistanceOhms).toFixed(1)} {Number(planeImpedance.reactanceOhms) >= 0 ? '+' : '−'} j{Math.abs(Number(planeImpedance.reactanceOhms)).toFixed(1)} Ω</td></tr><tr><td>Reference</td><td>{z0} Ω</td></tr></tbody></table>}>
        <div className="instrument-equation">Γ = (Z − Z₀) / (Z + Z₀) <span>→</span> RL = −20 log₁₀|Γ| <span>→</span> VSWR = (1+|Γ|)/(1−|Γ|)</div>
      </PlotFrame>
    </LabShell>
  );
}
