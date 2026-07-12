import { useState, type CSSProperties, type ReactNode } from 'react';
import { LabShell } from '../lab/LabShell';
import { NumberControl, RangeControl, SelectControl } from '../lab/ControlField';
import { PlotFrame } from '../plots/PlotFrame';
import type { LedgerEntry, PredictionSpec, SignalStageMap } from '../lab/types';
import {
  calculatePaDcMetrics,
  createN6705cSafeBiasProgram,
  evaluateDigitizedCapture,
  evaluateN6752aOperatingPoint,
  evaluateRemoteSense,
  evaluateSlewTransient,
  getN6752aMaximumCurrentAtVoltage,
  N6752A_DIGITIZER_MAX_SAMPLE_RATE_HZ,
} from '@/lib/instruments/psu';
import './psu.css';

export type PsuScenarioId =
  | 'psu-safe-bias'
  | 'psu-cv-cc'
  | 'psu-remote-sense'
  | 'psu-scpi-sequence'
  | 'psu-pa-dc-power';

interface Props {
  scenario: PsuScenarioId;
}

interface TableRow {
  readonly metric: string;
  readonly value: string;
  readonly meaning: string;
}

const format = (value: number, digits = 2) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

function DataTable({ caption, rows }: { caption: string; rows: readonly TableRow[] }) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead><tr><th>항목</th><th>값</th><th>해석</th></tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.metric}><th scope="row">{row.metric}</th><td>{row.value}</td><td>{row.meaning}</td></tr>
      ))}</tbody>
    </table>
  );
}

function Readouts({ items }: {
  items: readonly { label: string; value: string; tone?: 'active' | 'warning' | 'reference' | undefined }[];
}) {
  return (
    <dl className="psu-readouts">
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone ?? 'neutral'}>
          <dt>{item.label}</dt><dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PsuPath({ active }: { active: readonly string[] }) {
  const stages = [
    ['SET', 'V · I limit'],
    ['PROTECT', 'OVP · OCP'],
    ['CONVERT', '100 W envelope'],
    ['RELAY', 'Option 761'],
    ['FORCE', '2-wire power'],
    ['SENSE', 'DUT feedback'],
    ['MEASURE', 'ADC · logger'],
  ] as const;
  return (
    <ol className="psu-path" aria-label="N6705C에서 DUT까지의 DC 전력 경로">
      {stages.map(([id, label]) => (
        <li key={id} className={active.includes(id) ? 'is-active' : undefined} data-affected={active.includes(id)} aria-label={`${id} · ${label} · ${active.includes(id) ? '현재 설정의 영향 stage' : '현재 설정의 직접 영향 없음'}`}>
          <i className="psu-path__cue" aria-hidden="true">{active.includes(id) ? '◆' : '◇'}</i><strong>{id}</strong><span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function OperatingEnvelope({ voltageSetpointV, currentLimitA, loadResistanceOhm, outputEnabled, ovpV, ocpEnabled, dwellMs }: {
  voltageSetpointV: number;
  currentLimitA: number;
  loadResistanceOhm: number;
  outputEnabled: boolean;
  ovpV: number;
  ocpEnabled: boolean;
  dwellMs: number;
}) {
  const point = evaluateN6752aOperatingPoint({
    voltageSetpointV,
    currentLimitA,
    loadResistanceOhm,
    outputEnabled,
    ovpLevelV: ovpV,
    ocpEnabled,
    ocpDelayMs: 20,
    timeInCurrentLimitMs: dwellMs,
  });
  const x = 58 + point.voltageV / 50 * 640;
  const y = 214 - point.currentA / 10 * 174;
  const requestedX = 58 + voltageSetpointV / 50 * 640;
  const requestedY = 214 - Math.min(10, point.demandedCurrentA) / 10 * 174;
  const envelope = Array.from({ length: 51 }, (_, index) => {
    const voltage = Math.max(index, 0.25);
    const current = getN6752aMaximumCurrentAtVoltage(voltage);
    return `${58 + index / 50 * 640},${214 - current / 10 * 174}`;
  }).join(' ');
  return (
    <>
      <svg viewBox="0 0 760 270" role="img" aria-labelledby="psu-envelope-title psu-envelope-desc">
        <title id="psu-envelope-title">N6752A voltage-current operating envelope</title>
        <desc id="psu-envelope-desc">
          요청점은 {format(voltageSetpointV)} V, {format(point.demandedCurrentA)} A이고 실제 교육 모델 operating point는 {format(point.voltageV)} V, {format(point.currentA)} A, {format(point.powerW)} W, {point.mode}입니다.
        </desc>
        <rect width="760" height="270" fill="var(--color-instrument)" />
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const gridX = 58 + index * 128;
          return <g key={`v-${index}`}><line x1={gridX} x2={gridX} y1="30" y2="214" className="psu-grid" /><text x={gridX} y="232" textAnchor="middle" className="psu-axis-label">{index * 10}</text></g>;
        })}
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const gridY = 214 - index * 34.8;
          return <g key={`i-${index}`}><line x1="58" x2="698" y1={gridY} y2={gridY} className="psu-grid" /><text x="50" y={gridY} textAnchor="end" dominantBaseline="middle" className="psu-axis-label">{index * 2}</text></g>;
        })}
        <line x1="58" x2="698" y1="214" y2="214" className="psu-axis" />
        <line x1="58" x2="58" y1="30" y2="214" className="psu-axis" />
        <polyline points={envelope} fill="none" className="psu-trace psu-trace--reference" strokeDasharray="7 5" />
        <text x="690" y="130" textAnchor="end" className="psu-label psu-label--reference">100 W autoranging 경계</text>
        <line x1={requestedX} x2={requestedX} y1={requestedY} y2="214" className="psu-request" strokeDasharray="4 4" />
        <circle cx={requestedX} cy={requestedY} r="5" className="psu-marker psu-marker--request" />
        <text x={Math.min(610, requestedX + 10)} y={Math.max(30, requestedY - 8)} className="psu-label psu-label--secondary">요청 V/R</text>
        <circle cx={x} cy={y} r="7" className={`psu-marker ${point.mode === 'TRIPPED' ? 'psu-marker--reverse' : 'psu-marker--forward'}`} />
        <text x={Math.min(610, x + 10)} y={Math.min(208, y + 18)} className={`psu-label ${point.mode === 'TRIPPED' ? 'psu-label--reverse' : 'psu-label--forward'}`}>{point.mode}</text>
        <text x="378" y="252" textAnchor="middle" className="psu-axis-label">Voltage at DUT model · V</text>
        <text x="20" y="132" transform="rotate(-90 20 132)" textAnchor="middle" className="psu-axis-label">Current · A</text>
      </svg>
      <Readouts items={[
        { label: 'Mode', value: point.mode, tone: point.mode === 'TRIPPED' ? 'warning' : 'active' },
        { label: 'Actual V', value: `${format(point.voltageV)} V` },
        { label: 'Actual I', value: `${format(point.currentA)} A` },
        { label: 'DC power', value: `${format(point.powerW)} W`, tone: point.powerW > 90 ? 'reference' : undefined },
      ]} />
    </>
  );
}

function SenseDiagram({ setVoltageV, currentA, resistanceOhm, remoteSense }: {
  setVoltageV: number;
  currentA: number;
  resistanceOhm: number;
  remoteSense: boolean;
}) {
  const result = evaluateRemoteSense({
    setVoltageV,
    loadCurrentA: currentA,
    forceLeadResistanceOhmPerLead: resistanceOhm,
    remoteSenseEnabled: remoteSense,
  });
  return (
    <>
      <svg viewBox="0 0 760 300" role="img" aria-labelledby="sense-title sense-desc">
        <title id="sense-title">2-wire force와 4-wire remote sense 기준면</title>
        <desc id="sense-desc">
          Force lead 전체 drop은 {format(result.totalLeadDropV, 3)} V이고 DUT 전압은 {format(result.dutVoltageV, 3)} V입니다. Remote sense는 {remoteSense ? '연결됨' : '연결되지 않음'} 상태입니다.
        </desc>
        <rect width="760" height="300" fill="var(--color-instrument)" />
        <rect x="38" y="70" width="154" height="154" rx="6" className="psu-block" />
        <text x="115" y="105" textAnchor="middle" className="psu-label psu-label--forward">N6752A</text>
        <text x="115" y="134" textAnchor="middle" className="psu-axis-label">terminal {format(result.outputTerminalVoltageV, 2)} V</text>
        <text x="115" y="160" textAnchor="middle" className="psu-axis-label">Option 761</text>
        <text x="115" y="186" textAnchor="middle" className="psu-axis-label">{remoteSense ? 'remote feedback' : 'local feedback'}</text>
        <rect x="574" y="86" width="146" height="122" rx="6" className="psu-block psu-block--dut" />
        <text x="647" y="126" textAnchor="middle" className="psu-label psu-label--reference">PA DUT</text>
        <text x="647" y="158" textAnchor="middle" className="psu-axis-label">VDD {format(result.dutVoltageV, 2)} V</text>
        <text x="647" y="184" textAnchor="middle" className="psu-axis-label">I {format(currentA, 2)} A</text>
        <line x1="192" x2="574" y1="108" y2="108" className="psu-force" />
        <line x1="192" x2="574" y1="196" y2="196" className="psu-force" />
        <text x="383" y="92" textAnchor="middle" className="psu-label psu-label--forward">FORCE + · lead drop {format(result.totalLeadDropV / 2, 3)} V</text>
        <text x="383" y="221" textAnchor="middle" className="psu-axis-label">FORCE − · lead drop {format(result.totalLeadDropV / 2, 3)} V</text>
        <path d="M574 132 H526 V54 H240 V132 H192" className={`psu-sense ${remoteSense ? 'is-active' : ''}`} />
        <path d="M574 174 H542 V250 H222 V174 H192" className={`psu-sense ${remoteSense ? 'is-active' : ''}`} />
        <text x="382" y="42" textAnchor="middle" className={`psu-label ${remoteSense ? 'psu-label--reference' : 'psu-label--muted'}`}>SENSE + / − · 거의 0 A</text>
        {result.compensationLimited && <text x="380" y="280" textAnchor="middle" className="psu-label psu-label--reverse">1 V/lead 또는 50 V headroom 한계 초과</text>}
      </svg>
      <Readouts items={[
        { label: 'Lead drop', value: `${format(result.totalLeadDropV, 3)} V`, tone: 'reference' },
        { label: 'Terminal', value: `${format(result.outputTerminalVoltageV, 3)} V` },
        { label: 'DUT plane', value: `${format(result.dutVoltageV, 3)} V`, tone: 'active' },
        { label: 'Regulation error', value: `${format(result.senseErrorV, 3)} V`, tone: result.compensationLimited ? 'warning' : undefined },
      ]} />
    </>
  );
}

function TransientPlot({ voltageStepV, slewVPerSecond, capacitanceUf, loadCurrentA, currentLimitA }: {
  voltageStepV: number;
  slewVPerSecond: number;
  capacitanceUf: number;
  loadCurrentA: number;
  currentLimitA: number;
}) {
  const result = evaluateSlewTransient({ voltageStepV, programmedSlewVPerSecond: slewVPerSecond, loadCapacitanceMicrofarad: capacitanceUf, steadyLoadCurrentA: loadCurrentA, currentLimitA });
  const programmedX = Math.min(690, 62 + result.programmedRiseTimeMs / Math.max(result.effectiveRiseTimeMs, 1) * 600);
  const actualX = 662;
  const currentY = 220 - Math.min(10, result.predictedPeakCurrentA) / 10 * 150;
  return (
    <svg viewBox="0 0 760 280" role="img" aria-labelledby="transient-title transient-desc">
      <title id="transient-title">Voltage slew와 capacitive inrush</title>
      <desc id="transient-desc">Programmed rise는 {format(result.programmedRiseTimeMs)} ms, 예상 peak current는 {format(result.predictedPeakCurrentA)} A이며 current limit 결과 실제 rise는 {Number.isFinite(result.effectiveRiseTimeMs) ? format(result.effectiveRiseTimeMs) : '무한'} ms입니다.</desc>
      <rect width="760" height="280" fill="var(--color-instrument)" />
      <line x1="62" x2="700" y1="220" y2="220" className="psu-axis" />
      <line x1="62" x2="62" y1="38" y2="220" className="psu-axis" />
      <polyline points={`62,220 ${programmedX},58 700,58`} fill="none" className="psu-trace psu-trace--reference" strokeDasharray="7 5" />
      <polyline points={`62,220 ${actualX},58 700,58`} fill="none" className="psu-trace psu-trace--forward" />
      <line x1="62" x2={actualX} y1={currentY} y2={currentY} className={`psu-trace ${result.currentLimited ? 'psu-trace--reverse' : 'psu-trace--secondary'}`} />
      <text x="690" y="50" textAnchor="end" className="psu-label psu-label--forward">actual V ramp</text>
      <text x="690" y="86" textAnchor="end" className="psu-label psu-label--reference">programmed ramp</text>
      <text x="690" y={Math.max(108, currentY - 8)} textAnchor="end" className={`psu-label ${result.currentLimited ? 'psu-label--reverse' : 'psu-label--secondary'}`}>Ipeak {format(result.predictedPeakCurrentA)} A</text>
      <text x="382" y="256" textAnchor="middle" className="psu-axis-label">Time · rise {Number.isFinite(result.effectiveRiseTimeMs) ? format(result.effectiveRiseTimeMs) : '∞'} ms</text>
      <text x="18" y="126" transform="rotate(-90 18 126)" textAnchor="middle" className="psu-axis-label">Normalized V / current</text>
    </svg>
  );
}

function SequenceTimeline({ gateDelayMs, drainDelayMs, offGapMs, listStepV, dwellMs }: {
  gateDelayMs: number;
  drainDelayMs: number;
  offGapMs: number;
  listStepV: number;
  dwellMs: number;
}) {
  const maximum = Math.max(1, gateDelayMs, drainDelayMs, dwellMs);
  const x = (value: number) => 142 + value / maximum * 510;
  const listStartX = 220;
  const listEndX = listStartX + dwellMs / maximum * (684 - listStartX);
  return (
    <svg viewBox="0 0 760 320" role="img" aria-labelledby="sequence-title sequence-desc">
      <title id="sequence-title">Multi-rail output delay와 LIST timeline</title>
      <desc id="sequence-desc">Gate rail은 {format(gateDelayMs, 0)} ms, drain rail은 {format(drainDelayMs, 0)} ms 뒤 켜지고 LIST step은 {format(listStepV, 1)} V에서 {format(dwellMs, 0)} ms 유지됩니다.</desc>
      <rect width="760" height="320" fill="var(--color-instrument)" />
      <line x1="142" x2="684" y1="272" y2="272" className="psu-axis" />
      <text x="126" y="75" textAnchor="end" className="psu-label psu-label--reference">Gate · ext/slot 2</text>
      <text x="126" y="143" textAnchor="end" className="psu-label psu-label--forward">Drain rail</text>
      <text x="126" y="214" textAnchor="end" className="psu-label psu-label--secondary">LIST VDD</text>
      <polyline points={`142,96 ${x(gateDelayMs)},96 ${x(gateDelayMs)},58 684,58`} fill="none" className="psu-trace psu-trace--reference" strokeDasharray="7 4" />
      <polyline points={`142,166 ${x(drainDelayMs)},166 ${x(drainDelayMs)},126 684,126`} fill="none" className="psu-trace psu-trace--forward" />
      <polyline points={`142,238 ${listStartX},238 ${listStartX},190 ${listEndX},190 ${listEndX},238 684,238`} fill="none" className="psu-trace psu-trace--secondary" />
      <line x1={x(gateDelayMs)} x2={x(gateDelayMs)} y1="46" y2="272" className="psu-marker-line" />
      <line x1={x(drainDelayMs)} x2={x(drainDelayMs)} y1="46" y2="272" className="psu-marker-line psu-marker-line--forward" />
      <text x="682" y="184" textAnchor="end" className="psu-label psu-label--secondary">{format(listStepV, 1)} V · {format(dwellMs, 0)} ms</text>
      <text x="410" y="305" textAnchor="middle" className="psu-axis-label">Coupled output state · shutdown gap {format(offGapMs, 0)} ms</text>
    </svg>
  );
}

function CommandProgram({ voltageV, currentA, ovpV, allowOutput }: { voltageV: number; currentA: number; ovpV: number; allowOutput: boolean }) {
  const envelopeMaximumA = getN6752aMaximumCurrentAtVoltage(voltageV);
  const envelopeLimited = currentA > envelopeMaximumA;
  const previewCurrentA = Math.min(currentA, envelopeMaximumA);
  const steps = createN6705cSafeBiasProgram({
    voltageV,
    currentLimitA: previewCurrentA,
    ovpV,
    includeOutputOn: allowOutput && !envelopeLimited,
  });
  return (
    <div className="psu-program" role="region" aria-label="SCPI program preview" tabIndex={0}>
      <div className="psu-program__header"><span>phase</span><span>SCPI program message</span></div>
      {envelopeLimited && (
        <p className="psu-program__warning" role="status">
          요청 current limit {format(currentA)} A는 {format(voltageV, 1)} V에서 100 W envelope를 넘습니다.
          Preview는 {format(previewCurrentA)} A로 낮추고 OUTP ON을 생략합니다.
        </p>
      )}
      <ol>{steps.map((step, index) => (
        <li key={`${step.phase}-${index}`}><span>{step.phase}</span><code>{step.message}</code></li>
      ))}</ol>
    </div>
  );
}

function PaDependencyMap({ voltageV, currentA, pinDbm, poutDbm }: { voltageV: number; currentA: number; pinDbm: number; poutDbm: number }) {
  const result = calculatePaDcMetrics({ voltageV, currentA, pinDbm, poutDbm });
  return (
    <>
      <div className="psu-pae-map" role="img" aria-label={`Power supply가 ${format(result.dcInputPowerW)} watt DC를, RF sensor가 Pin ${format(pinDbm, 1)} dBm과 Pout ${format(poutDbm, 1)} dBm을 제공해 PAE ${format(result.paePercent, 1)} percent를 계산합니다.`}>
        <ol className="psu-pae-map__rf" aria-hidden="true">
          <li data-role="source"><strong>SG</strong><span>Pin {format(pinDbm, 1)} dBm</span></li>
          <li data-role="dut"><strong>PA DUT</strong><span>RF + DC → heat</span></li>
          <li data-role="measure"><strong>Power sensor</strong><span>Pout {format(poutDbm, 1)} dBm</span></li>
        </ol>
        <div className="psu-pae-map__math" aria-hidden="true">
          <div data-role="rf-added"><strong>Added RF</strong><span>Pout − Pin · {format(result.addedRfPowerW)} W</span></div>
          <b>÷</b>
          <div data-role="supply"><strong>N6705C · Pdc</strong><span>{format(voltageV, 1)} V × {format(currentA, 2)} A</span></div>
          <b>=</b>
          <div data-role="math"><strong>PAE</strong><span>{format(result.paePercent, 1)} %</span></div>
        </div>
      </div>
      <Readouts items={[
        { label: 'Pdc', value: `${format(result.dcInputPowerW)} W`, tone: 'active' },
        { label: 'Added RF', value: `${format(result.addedRfPowerW)} W` },
        { label: 'PAE', value: `${format(result.paePercent, 1)} %`, tone: result.paePercent > 100 || result.paePercent < 0 ? 'warning' : 'reference' },
        { label: 'Loss → heat', value: `${format(result.dissipatedPowerW)} W`, tone: 'warning' },
      ]} />
    </>
  );
}

const commonStageMap: SignalStageMap = {
  'output-state': ['source', 'dut'],
  voltage: ['source', 'dut', 'acquisition', 'display'],
  current: ['source', 'dut', 'acquisition', 'display'],
  resistance: ['dut', 'source', 'display'],
  ovp: ['source', 'dut', 'display'],
  ocp: ['source', 'dut', 'display'],
  'sense-mode': ['dut', 'acquisition', 'display'],
  'lead-resistance': ['dut', 'acquisition', 'display'],
  slew: ['source', 'dut', 'acquisition', 'display'],
  capacitance: ['dut', 'source', 'acquisition', 'display'],
  'gate-delay': ['source', 'dut', 'display'],
  'drain-delay': ['source', 'dut', 'display'],
  'list-voltage': ['source', 'dut', 'display'],
  'list-dwell': ['source', 'dut', 'acquisition', 'display'],
  'allow-output': ['source', 'dut'],
  pin: ['dut', 'dsp', 'display'],
  pout: ['dut', 'acquisition', 'dsp', 'display'],
};

export default function PsuInstrumentLab({ scenario }: Props) {
  const [outputEnabled, setOutputEnabled] = useState(false);
  const [voltageV, setVoltageV] = useState(28);
  const [currentA, setCurrentA] = useState(2.5);
  const [resistanceOhm, setResistanceOhm] = useState(14);
  const [ovpV, setOvpV] = useState(32);
  const [ocpEnabled, setOcpEnabled] = useState(true);
  const [dwellMs, setDwellMs] = useState(0);
  const [remoteSense, setRemoteSense] = useState(true);
  const [leadResistance, setLeadResistance] = useState(0.08);
  const [slewVPerSecond, setSlewVPerSecond] = useState(500);
  const [capacitanceUf, setCapacitanceUf] = useState(2200);
  const [gateDelayMs, setGateDelayMs] = useState(0);
  const [drainDelayMs, setDrainDelayMs] = useState(100);
  const [offGapMs, setOffGapMs] = useState(25);
  const [listStepV, setListStepV] = useState(28);
  const [listDwellMs, setListDwellMs] = useState(500);
  const [allowOutput, setAllowOutput] = useState(false);
  const [pinDbm, setPinDbm] = useState(20);
  const [poutDbm, setPoutDbm] = useState(40);

  let title: string;
  let question: string;
  let description: string;
  let controls: ReactNode;
  let views: ReactNode;
  let ledger: readonly LedgerEntry[];
  let prediction: PredictionSpec;
  let note: string;

  if (scenario === 'psu-safe-bias') {
    const point = evaluateN6752aOperatingPoint({ voltageSetpointV: voltageV, currentLimitA: currentA, loadResistanceOhm: resistanceOhm, outputEnabled, ovpLevelV: ovpV, ocpEnabled: false, ocpDelayMs: 20, timeInCurrentLimitMs: 0 });
    title = '안전한 DC bias gate';
    question = '전압과 전류를 설정했어도 왜 Output Off에서 시작해야 할까?';
    description = 'Setpoint, 100 W envelope, relay, wiring과 DUT 상태를 분리해 마지막에만 output을 켭니다.';
    controls = <>
      <SelectControl id="output-state" label="Output state" value={outputEnabled ? 'on' : 'off'} onChange={(event) => setOutputEnabled(event.currentTarget.value === 'on')}><option value="off">OFF · prepare</option><option value="on">ON · energized</option></SelectControl>
      <RangeControl id="voltage" label="Voltage setpoint" min={0} max={50} step={1} value={voltageV} valueText={`${format(voltageV, 0)} V`} onChange={(event) => setVoltageV(Number(event.currentTarget.value))} />
      <RangeControl id="current" label="Current limit" min={0.1} max={10} step={0.1} value={currentA} valueText={`${format(currentA, 1)} A`} onChange={(event) => setCurrentA(Number(event.currentTarget.value))} />
      <RangeControl id="resistance" label="Expected DUT resistance" min={2} max={40} step={1} value={resistanceOhm} valueText={`${format(resistanceOhm, 0)} Ω`} onChange={(event) => setResistanceOhm(Number(event.currentTarget.value))} />
    </>;
    views = <>
      <PlotFrame title="설정값과 실제 energize 상태를 분리합니다" observation={`Output ${outputEnabled ? 'ON' : 'OFF'} · ${point.mode} · ${format(point.powerW)} W`} table={<DataTable caption="안전한 bias operating point" rows={[
        { metric: 'Setpoint', value: `${format(voltageV)} V / ${format(currentA)} A`, meaning: '설정된 voltage와 current limit' },
        { metric: 'Output', value: outputEnabled ? 'ON' : 'OFF', meaning: 'connector energize 상태' },
        { metric: 'Mode', value: point.mode, meaning: '예상 load에서의 regulation 결과' },
        { metric: 'Power', value: `${format(point.powerW)} W`, meaning: '100 W envelope 안의 실제 DC power' },
      ]} />}><PsuPath active={outputEnabled ? ['SET', 'PROTECT', 'CONVERT', 'RELAY', 'FORCE', 'MEASURE'] : ['SET', 'PROTECT']} /><OperatingEnvelope voltageSetpointV={voltageV} currentLimitA={currentA} loadResistanceOhm={resistanceOhm} outputEnabled={outputEnabled} ovpV={55} ocpEnabled={false} dwellMs={0} /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `Output ${outputEnabled ? 'ON' : 'OFF'} · ${format(voltageV)} V · ${format(currentA)} A limit`, tone: 'active' },
      { label: '직접 효과', value: outputEnabled ? 'Option 761 relay가 zero V/current 조건 뒤 닫히고 converter가 DUT로 DC를 전달합니다.' : 'Setpoint는 남지만 relay와 output stage가 DUT를 energize하지 않습니다.' },
      { label: '화면 결과', value: `예상 operating point는 ${point.mode}, ${format(point.voltageV)} V, ${format(point.currentA)} A입니다.` },
      { label: '비용·한계', value: 'Software OFF와 disconnect relay는 fuse, remote inhibit, bias 순서와 실제 front-panel 확인을 대신하지 않습니다.', tone: 'warning' },
    ];
    prediction = { id: 'psu-safe-state', prompt: 'Output OFF에서 voltage setpoint를 28 V로 바꾸면 DUT connector는?', options: ['0 V 상태를 유지하고 설정만 바뀜', '즉시 28 V가 인가됨', 'current limit이 사라짐'], correctIndex: 0, explanation: 'Setpoint와 output state는 별개입니다. 출력은 명시적으로 ON하기 전까지 energize되지 않습니다.' };
    note = 'Option 761 relay가 열려도 작은 AC network가 남습니다. Galvanic safety disconnect나 emergency stop으로 간주하지 않습니다.';
  } else if (scenario === 'psu-cv-cc') {
    const point = evaluateN6752aOperatingPoint({ voltageSetpointV: voltageV, currentLimitA: currentA, loadResistanceOhm: resistanceOhm, outputEnabled: true, ovpLevelV: ovpV, ocpEnabled, ocpDelayMs: 20, timeInCurrentLimitMs: dwellMs });
    title = 'CV·CC와 protection 경계';
    question = 'Current setting은 언제 출력값이고 언제 보호 한계가 될까?';
    description = '부하가 요구한 전류, current limit, 100 W envelope, OVP와 OCP delay를 같은 operating point에서 비교합니다.';
    controls = <>
      <RangeControl id="voltage" label="Voltage setpoint" min={1} max={50} step={1} value={voltageV} valueText={`${format(voltageV, 0)} V`} onChange={(event) => setVoltageV(Number(event.currentTarget.value))} />
      <RangeControl id="current" label="Current limit" min={0.1} max={10} step={0.1} value={currentA} valueText={`${format(currentA, 1)} A`} onChange={(event) => setCurrentA(Number(event.currentTarget.value))} />
      <RangeControl id="resistance" label="DUT equivalent R" min={1} max={50} step={1} value={resistanceOhm} valueText={`${format(resistanceOhm, 0)} Ω`} onChange={(event) => setResistanceOhm(Number(event.currentTarget.value))} />
      <RangeControl id="ovp" label="OVP threshold" min={1} max={55} step={1} value={ovpV} valueText={`${format(ovpV, 0)} V`} onChange={(event) => setOvpV(Number(event.currentTarget.value))} />
      <SelectControl id="ocp" label="OCP action" value={ocpEnabled ? 'on' : 'off'} onChange={(event) => setOcpEnabled(event.currentTarget.value === 'on')}><option value="off">OFF · stay in limit</option><option value="on">ON · trip after delay</option></SelectControl>
      <RangeControl id="ocp-dwell" label="Time in current limit" min={0} max={100} step={5} value={dwellMs} valueText={`${format(dwellMs, 0)} ms`} onChange={(event) => setDwellMs(Number(event.currentTarget.value))} />
    </>;
    views = <PlotFrame title={point.mode === 'TRIPPED' ? 'Protection이 output을 차단했습니다' : `${point.mode} operating point`} observation={point.protectionReason ?? `Demand ${format(point.demandedCurrentA)} A · actual ${format(point.currentA)} A`} table={<DataTable caption="CV CC protection 핵심 수치" rows={[
      { metric: 'Demand', value: `${format(point.demandedCurrentA)} A / ${format(point.demandedPowerW)} W`, meaning: 'Vset/R에서 부하가 요구하는 값' },
      { metric: 'Current limit', value: `${format(currentA)} A`, meaning: 'CC 진입 경계' },
      { metric: 'Envelope at Vset', value: `${format(point.maximumCurrentAtSetpointA)} A`, meaning: '100 W/Vset로 제한되는 current' },
      { metric: 'Status', value: `${point.mode} · bit value ${point.operationStatusValue}`, meaning: 'STAT:OPER:COND? 해석' },
    ]} />}><OperatingEnvelope voltageSetpointV={voltageV} currentLimitA={currentA} loadResistanceOhm={resistanceOhm} outputEnabled ovpV={ovpV} ocpEnabled={ocpEnabled} dwellMs={dwellMs} /></PlotFrame>;
    ledger = [
      { label: '변경', value: `${format(voltageV)} V / ${format(currentA)} A · load ${format(resistanceOhm)} Ω`, tone: 'active' },
      { label: '직접 효과', value: `DUT demand는 ${format(point.demandedCurrentA)} A, ${format(point.demandedPowerW)} W이고 current·100 W·OVP/OCP 경계가 적용됩니다.` },
      { label: '화면 결과', value: point.protectionReason ?? `${point.mode}에서 ${format(point.voltageV)} V × ${format(point.currentA)} A = ${format(point.powerW)} W입니다.`, tone: point.mode === 'TRIPPED' ? 'warning' : 'neutral' },
      { label: '비용·한계', value: 'CC 진입은 곧 고장이 아닐 수 있지만 PA bias에서 예상 밖 CC는 wiring, oscillation, inrush 또는 DUT fault를 의심해야 합니다.', tone: 'warning' },
    ];
    prediction = { id: 'psu-cv-cc-mode', prompt: '28 V setpoint, 2 A limit에서 DUT가 3 A를 요구하면?', options: ['Current limit에서 CC로 이동', '28 V CV를 무조건 유지', 'OVP가 반드시 동작'], correctIndex: 0, explanation: '부하 요구가 current limit을 넘으면 voltage를 낮춰 current를 제한합니다. OCP가 켜져 있으면 delay 뒤 output을 끕니다.' };
    note = 'OCP는 current limit 자체와 다릅니다. OCP ON은 CC 진입 뒤 output을 disable하는 추가 동작입니다.';
  } else if (scenario === 'psu-remote-sense') {
    const sense = evaluateRemoteSense({ setVoltageV: voltageV, loadCurrentA: currentA, forceLeadResistanceOhmPerLead: leadResistance, remoteSenseEnabled: remoteSense });
    const transient = evaluateSlewTransient({ voltageStepV: voltageV, programmedSlewVPerSecond: slewVPerSecond, loadCapacitanceMicrofarad: capacitanceUf, steadyLoadCurrentA: Math.min(currentA * 0.35, currentA), currentLimitA: currentA });
    title = 'Remote sense·slew·transient';
    question = 'DUT 전압을 맞추는 선과 DUT로 전력을 보내는 선은 왜 분리할까?';
    description = 'Force lead drop을 DUT 기준면으로 되돌리고, slew와 capacitance가 만드는 inrush를 같은 wiring state에서 봅니다.';
    controls = <>
      <RangeControl id="voltage" label="DUT target voltage" min={1} max={50} step={1} value={voltageV} valueText={`${format(voltageV, 0)} V`} onChange={(event) => setVoltageV(Number(event.currentTarget.value))} />
      <RangeControl id="current" label="Load current" min={0.1} max={10} step={0.1} value={currentA} valueText={`${format(currentA, 1)} A`} onChange={(event) => setCurrentA(Number(event.currentTarget.value))} />
      <RangeControl id="lead-resistance" label="Resistance per force lead" min={0} max={0.5} step={0.01} value={leadResistance} valueText={`${format(leadResistance, 2)} Ω`} onChange={(event) => setLeadResistance(Number(event.currentTarget.value))} />
      <SelectControl id="sense-mode" label="Voltage feedback plane" value={remoteSense ? 'remote' : 'local'} onChange={(event) => setRemoteSense(event.currentTarget.value === 'remote')}><option value="local">Local · supply terminal</option><option value="remote">Remote · DUT plane</option></SelectControl>
      <RangeControl id="slew" label="Programmed voltage slew" min={50} max={5000} step={50} value={slewVPerSecond} valueText={`${format(slewVPerSecond, 0)} V/s`} onChange={(event) => setSlewVPerSecond(Number(event.currentTarget.value))} />
      <RangeControl id="capacitance" label="DUT input capacitance" min={0} max={5000} step={100} value={capacitanceUf} valueText={`${format(capacitanceUf, 0)} µF`} onChange={(event) => setCapacitanceUf(Number(event.currentTarget.value))} />
    </>;
    views = <>
      <PlotFrame title={sense.compensationLimited ? 'Remote sense 보상 한계를 넘었습니다' : 'DUT 기준면 전압을 force lead drop과 분리합니다'} observation={`2 × I × R = ${format(sense.totalLeadDropV, 3)} V`} table={<DataTable caption="Remote sense wiring 핵심 수치" rows={[
        { metric: 'Lead drop', value: `${format(sense.totalLeadDropV, 3)} V`, meaning: '왕복 force lead의 I×R' },
        { metric: 'Terminal voltage', value: `${format(sense.outputTerminalVoltageV, 3)} V`, meaning: 'Power module 출력 단자' },
        { metric: 'DUT voltage', value: `${format(sense.dutVoltageV, 3)} V`, meaning: 'PA VDD 기준면' },
        { metric: 'Sense limit', value: '1 V / lead', meaning: 'N6752A specification 유지 조건' },
      ]} />}><SenseDiagram setVoltageV={voltageV} currentA={currentA} resistanceOhm={leadResistance} remoteSense={remoteSense} /></PlotFrame>
      <PlotFrame title={transient.currentLimited ? 'Capacitive inrush가 current limit을 넘습니다' : 'Programmed slew가 inrush를 제한합니다'} observation={`Icap = C·dV/dt = ${format(transient.capacitiveCurrentA)} A`} table={<DataTable caption="Slew transient 핵심 수치" rows={[
        { metric: 'Programmed rise', value: `${format(transient.programmedRiseTimeMs)} ms`, meaning: 'ΔV/slew' },
        { metric: 'Capacitive current', value: `${format(transient.capacitiveCurrentA)} A`, meaning: 'C·dV/dt' },
        { metric: 'Predicted peak', value: `${format(transient.predictedPeakCurrentA)} A`, meaning: 'steady load + capacitive current' },
        { metric: 'Effective rise', value: `${Number.isFinite(transient.effectiveRiseTimeMs) ? format(transient.effectiveRiseTimeMs) : '∞'} ms`, meaning: 'current limit 적용 뒤' },
      ]} />}><TransientPlot voltageStepV={voltageV} slewVPerSecond={slewVPerSecond} capacitanceUf={capacitanceUf} loadCurrentA={Math.min(currentA * 0.35, currentA)} currentLimitA={currentA} /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `${remoteSense ? 'Remote' : 'Local'} sense · ${format(currentA)} A · ${format(leadResistance, 2)} Ω/lead`, tone: 'active' },
      { label: '직접 효과', value: `Force lead에 ${format(sense.totalLeadDropV, 3)} V가 떨어지고 ${remoteSense ? 'DUT feedback이 terminal voltage를 올립니다.' : 'terminal feedback은 그 drop을 보상하지 않습니다.'}` },
      { label: '화면 결과', value: `DUT ${format(sense.dutVoltageV, 3)} V · inrush peak ${format(transient.predictedPeakCurrentA)} A`, tone: sense.compensationLimited || transient.currentLimited ? 'warning' : 'neutral' },
      { label: '비용·한계', value: 'Remote sense는 lead inductance와 unstable wiring을 없애지 않습니다. Sense open, reversed lead와 capacitive load는 별도 보호가 필요합니다.', tone: 'warning' },
    ];
    prediction = { id: 'psu-sense-plane', prompt: '부하 전류가 커져 force cable drop이 늘 때 remote sense가 정상이라면?', options: ['Supply terminal은 올라가고 DUT 전압은 유지', 'DUT 전압이 반드시 같은 만큼 내려감', 'Current 측정값이 0이 됨'], correctIndex: 0, explanation: 'Feedback가 DUT sense point를 유지하도록 supply terminal voltage를 높여 force lead drop을 보상합니다.' };
    note = 'Sense wire는 force current를 운반하지 않습니다. DUT terminal에서 Kelvin 연결하고 force와 꼬임·routing을 검토합니다.';
  } else if (scenario === 'psu-scpi-sequence') {
    const listEnvelopeMaximumA = getN6752aMaximumCurrentAtVoltage(listStepV);
    const listEnvelopeLimited = currentA > listEnvelopeMaximumA;
    title = 'SCPI·LIST·multi-rail sequence';
    question = '명령 순서와 실제 bias 순서를 어떻게 같은 상태기계로 만들까?';
    description = 'Output coupling, rise/fall delay, LIST dwell, query-back과 이중 output-enable gate를 한 timeline으로 읽습니다.';
    controls = <>
      <RangeControl id="gate-delay" label="Gate rail rise delay" min={0} max={500} step={10} value={gateDelayMs} valueText={`${format(gateDelayMs, 0)} ms`} onChange={(event) => setGateDelayMs(Number(event.currentTarget.value))} />
      <RangeControl id="drain-delay" label="Drain rail rise delay" min={0} max={500} step={10} value={drainDelayMs} valueText={`${format(drainDelayMs, 0)} ms`} onChange={(event) => setDrainDelayMs(Number(event.currentTarget.value))} />
      <RangeControl id="off-gap" label="Drain→gate shutdown gap" min={0} max={250} step={5} value={offGapMs} valueText={`${format(offGapMs, 0)} ms`} onChange={(event) => setOffGapMs(Number(event.currentTarget.value))} />
      <RangeControl id="list-voltage" label="LIST voltage step" min={1} max={50} step={1} value={listStepV} valueText={`${format(listStepV, 0)} V`} onChange={(event) => setListStepV(Number(event.currentTarget.value))} />
      <RangeControl id="list-dwell" label="LIST dwell" min={10} max={1000} step={10} value={listDwellMs} valueText={`${format(listDwellMs, 0)} ms`} onChange={(event) => setListDwellMs(Number(event.currentTarget.value))} />
      <SelectControl id="allow-output" label="Explicit output permission" value={allowOutput ? 'on' : 'off'} onChange={(event) => setAllowOutput(event.currentTarget.value === 'on')}><option value="off">Not granted</option><option value="on">Granted after verification</option></SelectControl>
    </>;
    views = <>
      <PlotFrame title="Coupling은 배선이 아니라 output-state synchronization입니다" observation={`Gate ${format(gateDelayMs, 0)} ms → Drain ${format(drainDelayMs, 0)} ms`} table={<DataTable caption="Multi-rail LIST timeline 핵심 수치" rows={[
        { metric: 'Gate rise', value: `${format(gateDelayMs, 0)} ms`, meaning: '추가 compatible module 또는 외부 bias source의 delay' },
        { metric: 'Drain rise', value: `${format(drainDelayMs, 0)} ms`, meaning: 'DUT data sheet가 정한 drain enable timing' },
        { metric: 'LIST step', value: `${format(listStepV, 1)} V`, meaning: 'trigger 뒤 transient output value' },
        { metric: 'Current limit guard', value: listEnvelopeLimited ? `${format(currentA)} → ${format(listEnvelopeMaximumA)} A` : `${format(currentA)} A`, meaning: listEnvelopeLimited ? '100 W envelope 때문에 preview clamp·output block' : '100 W envelope 안' },
        { metric: 'LIST dwell', value: `${format(listDwellMs, 0)} ms`, meaning: '512-step, max 262.144 s/step 범위 안' },
      ]} />}><SequenceTimeline gateDelayMs={gateDelayMs} drainDelayMs={drainDelayMs} offGapMs={offGapMs} listStepV={listStepV} dwellMs={listDwellMs} /></PlotFrame>
      <PlotFrame title={allowOutput ? '검증 뒤 별도 enable 단계가 나타납니다' : 'Configure program은 output을 켜지 않습니다'} observation="*IDN? → module/option → OFF → configure → query-back → error → optional ON → finally OFF"><CommandProgram voltageV={listStepV} currentA={currentA} ovpV={Math.min(55, listStepV + 4)} allowOutput={allowOutput} /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `Gate ${format(gateDelayMs, 0)} ms · Drain ${format(drainDelayMs, 0)} ms · LIST ${format(listStepV, 1)} V/${format(listDwellMs, 0)} ms`, tone: 'active' },
      { label: '직접 효과', value: 'Coupled output state가 rail별 RISE/FALL delay를 적용하고 BUS trigger 뒤 LIST address가 진행합니다.' },
      { label: '화면 결과', value: listEnvelopeLimited ? `요청 ${format(listStepV, 1)} V × ${format(currentA)} A가 100 W를 넘어 current preview를 ${format(listEnvelopeMaximumA)} A로 낮추고 OUTP ON을 차단합니다.` : allowOutput ? 'Identity·module·option·query-back 뒤에만 OUTP ON이 program에 포함됩니다.' : 'Output permission이 없어 program은 configure와 cleanup만 수행합니다.', tone: listEnvelopeLimited ? 'warning' : 'neutral' },
      { label: '비용·한계', value: 'OUTP:COUP 설정은 nonvolatile이고 *RST로 지워지지 않습니다. 시작 시 coupling state를 반드시 query해야 합니다.', tone: 'warning' },
    ];
    prediction = { id: 'psu-list-trigger', prompt: 'VOLT:MODE LIST와 INIT:TRAN을 보냈지만 BUS trigger를 보내지 않았다면?', options: ['Armed 상태에서 trigger를 기다림', 'LIST가 무조건 즉시 실행', 'Output coupling이 삭제됨'], correctIndex: 0, explanation: 'INIT는 trigger system을 arm하고, 선택한 source의 event가 와야 LIST transient가 시작됩니다.' };
    note = '고정 profile은 slot 1 N6752A 한 채널입니다. Gate rail은 추가 compatible module 또는 외부 bias source를 연결한 확장 예이며, 순서는 DUT 데이터시트와 interlock를 따라야 합니다.';
  } else {
    const capture = evaluateDigitizedCapture({ points: 4096, sampleIntervalSeconds: 10.24e-6, parameterCount: 1 });
    title = 'PA DC power·PAE dependency';
    question = 'Power supply가 읽은 V·I만으로 PAE를 완성할 수 없는 이유는?';
    description = 'DC input power, RF Pin/Pout, dissipated heat와 acquisition bandwidth를 장비별 책임으로 나눕니다.';
    controls = <>
      <RangeControl id="voltage" label="DUT drain voltage" min={1} max={50} step={1} value={voltageV} valueText={`${format(voltageV, 0)} V`} onChange={(event) => setVoltageV(Number(event.currentTarget.value))} />
      <RangeControl id="current" label="Average drain current" min={0.1} max={Math.min(10, 100 / Math.max(voltageV, 1))} step={0.05} value={Math.min(currentA, 100 / Math.max(voltageV, 1))} valueText={`${format(Math.min(currentA, 100 / Math.max(voltageV, 1)))} A`} onChange={(event) => setCurrentA(Number(event.currentTarget.value))} />
      <NumberControl id="pin" label="RF Pin at DUT plane" unit="dBm" min={-20} max={35} step={0.5} value={pinDbm} onChange={(event) => setPinDbm(Number(event.currentTarget.value))} />
      <NumberControl id="pout" label="RF Pout at DUT plane" unit="dBm" min={0} max={50} step={0.5} value={poutDbm} onChange={(event) => setPoutDbm(Number(event.currentTarget.value))} />
    </>;
    const safeCurrent = Math.min(currentA, 100 / Math.max(voltageV, 1));
    views = <>
      <PlotFrame title="PAE는 세 장비의 같은 시간 조건이 만나는 계산입니다" observation="PAE = (Pout − Pin) / Pdc" table={<DataTable caption="PA DC power와 PAE 핵심 수치" rows={[
        { metric: 'DC input', value: `${format(voltageV, 1)} V × ${format(safeCurrent)} A = ${format(voltageV * safeCurrent)} W`, meaning: 'N6705C measurement' },
        { metric: 'RF input', value: `${format(pinDbm, 1)} dBm`, meaning: 'SG calibration 또는 input sensor' },
        { metric: 'RF output', value: `${format(poutDbm, 1)} dBm`, meaning: 'Output power sensor/SA' },
        { metric: 'PAE', value: `${format(calculatePaDcMetrics({ voltageV, currentA: safeCurrent, pinDbm, poutDbm }).paePercent, 1)} %`, meaning: 'linear watt로 변환한 뒤 계산' },
      ]} />}><PaDependencyMap voltageV={voltageV} currentA={safeCurrent} pinDbm={pinDbm} poutDbm={poutDbm} /></PlotFrame>
      <PlotFrame title="97.656 kSa/s는 RF waveform sample rate가 아닙니다" observation={`${capture.points} current samples · ${format(capture.durationSeconds * 1000)} ms record`} table={<DataTable caption="N6752A digitized acquisition 핵심 수치" rows={[
        { metric: 'Sample interval', value: '10.24 µs', meaning: 'N6752A one-parameter minimum' },
        { metric: 'Sample rate', value: `${format(N6752A_DIGITIZER_MAX_SAMPLE_RATE_HZ / 1000, 3)} kSa/s`, meaning: '제품군 200 kHz가 아닌 module-specific 상한' },
        { metric: 'Record points', value: `${capture.points}`, meaning: 'current trace example' },
        { metric: 'Analog bandwidth', value: '10 kHz', meaning: 'N6752A voltage/current small-signal specification' },
      ]} />}><div className="psu-acquisition" style={{ '--capture-fill': `${Math.min(100, capture.durationSeconds * 1000)}%` } as CSSProperties}><div><span>current acquisition</span><i></i></div><p>Supply digitizer는 RF carrier나 수십 MHz OFDM envelope를 직접 재현하지 않습니다. Burst·thermal·bias droop처럼 더 느린 DC 거동을 관찰합니다.</p></div></PlotFrame>
    </>;
    const safe = calculatePaDcMetrics({ voltageV, currentA: safeCurrent, pinDbm, poutDbm });
    ledger = [
      { label: '변경', value: `${format(voltageV, 1)} V · ${format(safeCurrent)} A · Pin ${format(pinDbm, 1)} dBm · Pout ${format(poutDbm, 1)} dBm`, tone: 'active' },
      { label: '직접 효과', value: `Pdc ${format(safe.dcInputPowerW)} W와 added RF ${format(safe.addedRfPowerW)} W를 같은 DUT 기준면·시간 aperture로 결합합니다.` },
      { label: '화면 결과', value: `PAE ${format(safe.paePercent, 1)}% · dissipated power ${format(safe.dissipatedPowerW)} W`, tone: safe.paePercent < 0 || safe.paePercent > 100 ? 'warning' : 'neutral' },
      { label: '비용·한계', value: 'N6752A는 RF Pin/Pout과 junction temperature를 측정하지 않습니다. Sensor·SA와 thermal instrument가 필요합니다.', tone: 'warning' },
    ];
    prediction = { id: 'psu-pae-dependency', prompt: 'DC voltage/current만 정확히 읽었다면 PAE가 완성될까?', options: ['아니오 · 같은 조건의 RF Pin/Pout이 필요', '예 · Pdc만으로 충분', '예 · 온도만 추가하면 충분'], correctIndex: 0, explanation: 'PAE의 분자는 RF output과 input power의 차이이므로 DC source measurement만으로 계산할 수 없습니다.' };
    note = 'N6752A는 voltage와 current의 simultaneous power-array 측정 모듈이 아닙니다. 빠르게 변하는 Pdc에는 N676x/SMU 또는 외부 동기 측정을 검토합니다.';
  }

  return (
    <LabShell
      labId={`instrument:psu:${scenario}`}
      title={title}
      question={question}
      description={description}
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={commonStageMap}
      controls={controls}
      ledger={ledger}
      prediction={prediction}
      note={note}
    >
      {views}
    </LabShell>
  );
}
