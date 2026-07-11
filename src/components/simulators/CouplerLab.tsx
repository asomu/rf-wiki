import { useMemo, useState } from 'react';
import { couplerPowerFlow, createDirectionalCoupler, dbmToWatts, theoreticalMainLineLossDb, wattsToDbm } from '@/lib/rf';
import { RangeControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { Readout } from '../lab/Readout';
import type { LedgerEntry } from '../lab/types';
import { PlotFrame } from '../plots/PlotFrame';
import { PowerFlowDiagram } from '../plots/PowerFlowDiagram';

export default function CouplerLab() {
  const [inputDbm, setInputDbm] = useState(30);
  const [couplingDb, setCouplingDb] = useState(20);
  const [directivityDb, setDirectivityDb] = useState(30);
  const [excessLossDb, setExcessLossDb] = useState(0.45);
  const [loadReturnLossDb, setLoadReturnLossDb] = useState(20);
  const model = useMemo(() => createDirectionalCoupler(couplingDb, directivityDb, excessLossDb), [couplingDb, directivityDb, excessLossDb]);
  const flow = useMemo(() => couplerPowerFlow(inputDbm, model), [inputDbm, model]);
  const throughWatts = dbmToWatts(Number(flow.throughPowerDbm));
  const gammaMagnitude = 10 ** (-loadReturnLossDb / 20);
  const reflectedWatts = throughWatts * gammaMagnitude ** 2;
  const deliveredWatts = throughWatts - reflectedWatts;
  const idealDiversionLoss = theoreticalMainLineLossDb(couplingDb);
  const ledger: LedgerEntry[] = [
    { label: '변경', value: `Coupling ${couplingDb.toFixed(1)} dB · directivity ${directivityDb.toFixed(1)} dB · load RL ${loadReturnLossDb.toFixed(1)} dB` },
    { label: '직접 효과', value: `P3는 input의 ${(100 * 10 ** (-couplingDb / 10)).toFixed(3)}%를 sample · P4 leakage는 P3보다 ${directivityDb.toFixed(1)} dB 낮음`, tone: 'active' },
    { label: '화면 결과', value: `Isolation ${Number(model.isolationDb).toFixed(1)} dB · through ${Number(flow.throughPowerDbm).toFixed(2)} dBm · delivered ${wattsToDbm(deliveredWatts).toFixed(2)} dBm` },
    { label: '비용·한계', value: `ideal division floor ${idealDiversionLoss.toFixed(3)} dB · useful-port excess ${excessLossDb.toFixed(2)} dB → main-line ${Number(model.mainLineLossDb).toFixed(3)} dB · finite directivity가 reverse dynamic range를 제한` }
  ];

  return (
    <LabShell
      labId="coupler"
      title="Power Flow / Coupler Lab"
      question="Coupling 20 dB인데 through path는 왜 20 dB 손실되지 않을까?"
      description="P1 input, P2 through, P3 forward-coupled, P4 isolated의 포트 convention을 고정하고 모든 power를 같은 reference plane에서 계산합니다."
      activeStages={['source', 'dut', 'acquisition', 'display']}
      stageMap={{
        'input-power': ['source', 'dut', 'acquisition', 'display'],
        coupling: ['dut', 'acquisition', 'display'],
        directivity: ['dut', 'acquisition', 'display'],
        'excess-loss': ['dut', 'acquisition', 'display'],
        'load-return-loss': ['dut', 'acquisition', 'display'],
      }}
      controls={<>
        <RangeControl id="input-power" label="Input power" min={0} max={40} step={1} value={inputDbm} valueText={`${inputDbm} dBm`} onChange={(event) => setInputDbm(Number(event.currentTarget.value))} />
        <RangeControl id="coupling" label="Coupling factor C" min={6} max={40} step={1} value={couplingDb} valueText={`${couplingDb} dB`} onChange={(event) => setCouplingDb(Number(event.currentTarget.value))} help="양의 loss magnitude입니다: C = Pin − Pcoupled." />
        <RangeControl id="directivity" label="Directivity D" min={10} max={50} step={1} value={directivityDb} valueText={`${directivityDb} dB`} onChange={(event) => setDirectivityDb(Number(event.currentTarget.value))} help="same-plane convention: D = isolation − coupling." />
        <RangeControl id="excess-loss" label="Excess loss" min={0.15} max={1.5} step={0.05} value={excessLossDb} valueText={`${excessLossDb.toFixed(2)} dB`} onChange={(event) => setExcessLossDb(Number(event.currentTarget.value))} help="Lₑ = −10log₁₀((Pthrough+Pcoupled)/Pinput). P4 leakage는 별도 power path로 보존합니다." />
        <RangeControl id="load-return-loss" label="Load return loss" min={6} max={40} step={1} value={loadReturnLossDb} valueText={`${loadReturnLossDb} dB`} onChange={(event) => setLoadReturnLossDb(Number(event.currentTarget.value))} help="through incident power에서 load가 반사하는 양을 계산합니다." />
      </>}
      ledger={ledger}
      prediction={{
        id: 'coupling-factor',
        prompt: '30 dBm(1 W)을 20 dB coupler에 넣으면 ideal coupled port의 power는?',
        options: ['20 dBm · 100 mW', '10 dBm · 10 mW', '−20 dBm · 10 µW'],
        correctIndex: 1,
        explanation: '20 dB coupling은 input power의 1%를 sample하므로 30 dBm − 20 dB = 10 dBm입니다.'
      }}
      note="이 화면은 useful-port excess loss Lₑ=−10log₁₀((P2+P3)/P1), same-plane directivity D=Isolation−Coupling을 사용합니다. Datasheet convention이 다르면 식과 port plane을 먼저 맞추세요."
    >
      <div className="lab-readout-grid">
        <Readout label="Main-line loss" value={`${Number(model.mainLineLossDb).toFixed(3)} dB`} tone="forward" />
        <Readout label="Coupled P3" value={`${Number(flow.coupledPowerDbm).toFixed(2)} dBm`} tone="reference" />
        <Readout label="Isolated P4" value={`${Number(flow.isolatedPowerDbm).toFixed(2)} dBm`} tone="reverse" />
        <Readout label="Directivity" value={`${Number(model.directivityDb).toFixed(1)} dB`} tone="secondary" />
      </div>
      <PlotFrame title="4-port power flow" observation="Isolation은 사라진 전력이 아니라 원하지 않는 방향으로 누설된 매우 작은 sample입니다." table={<table><thead><tr><th>Plane</th><th>Power</th></tr></thead><tbody><tr><td>P1 input</td><td>{Number(flow.inputPowerDbm).toFixed(2)} dBm</td></tr><tr><td>P2 through</td><td>{Number(flow.throughPowerDbm).toFixed(2)} dBm</td></tr><tr><td>P3 coupled</td><td>{Number(flow.coupledPowerDbm).toFixed(2)} dBm</td></tr><tr><td>P4 isolated</td><td>{Number(flow.isolatedPowerDbm).toFixed(2)} dBm</td></tr></tbody></table>}>
        <PowerFlowDiagram title="Directional coupler port flow" description="Input, through, forward-coupled and isolated power at one reference plane." input={{ label: 'P1 input', value: `${Number(flow.inputPowerDbm).toFixed(1)} dBm`, tone: 'forward' }} through={{ label: 'P2 through', value: `${Number(flow.throughPowerDbm).toFixed(1)} dBm`, tone: 'forward' }} coupled={{ label: 'P3 coupled', value: `${Number(flow.coupledPowerDbm).toFixed(1)} dBm`, tone: 'reference' }} isolated={{ label: 'P4 isolated', value: `${Number(flow.isolatedPowerDbm).toFixed(1)} dBm`, tone: 'reverse' }} />
      </PlotFrame>
      <PlotFrame title="Accepted와 delivered power" observation="dBm끼리 빼지 않고 watt에서 incident − reflected를 계산합니다." table={<table><tbody><tr><th>Through incident</th><td>{throughWatts.toFixed(5)} W</td></tr><tr><th>Reflected back</th><td>{reflectedWatts.toFixed(5)} W</td></tr><tr><th>Delivered to load</th><td>{deliveredWatts.toFixed(5)} W</td></tr></tbody></table>}>
        <div className="power-balance">
          <div><span>Forward at load plane</span><strong>{wattsToDbm(throughWatts).toFixed(2)} dBm</strong></div>
          <span aria-hidden="true">−</span>
          <div><span>Reflected</span><strong>{wattsToDbm(reflectedWatts).toFixed(2)} dBm</strong></div>
          <span aria-hidden="true">=</span>
          <div><span>Delivered</span><strong>{wattsToDbm(deliveredWatts).toFixed(2)} dBm</strong></div>
        </div>
      </PlotFrame>
    </LabShell>
  );
}
