import { useState, type CSSProperties, type ReactNode } from 'react';
import { LabShell } from '../lab/LabShell';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { NumberControl, RangeControl, SelectControl } from '../lab/ControlField';
import { PlotFrame } from '../plots/PlotFrame';
import type { LedgerEntry, PredictionSpec, SignalStageMap } from '../lab/types';
import {
  U2061XA_DAMAGE_AVERAGE_DBM,
  U2061XA_DAMAGE_DC_VOLTS,
  U2061XA_DAMAGE_PEAK_DBM,
  calculateDutPlanePowerDbm,
  calculatePaPowerMeasurement,
  calculateRectangularBurstPower,
  calculateU2061AverageReadingRate,
  calculateU2061Uncertainty,
  createU2061Session,
  evaluateU2061InputSafety,
  queryU2061Scpi,
  readU2061Scpi,
  writeU2061Scpi,
  type U2061Session,
  type U2061VideoBandwidth,
} from '@/lib/instruments/power-sensor';
import './power-sensor.css';

export type PowerSensorScenarioId =
  | 'sensor-safe-power'
  | 'sensor-average-peak'
  | 'sensor-correction'
  | 'sensor-scpi-trigger'
  | 'sensor-pa-power-budget';

interface Props {
  scenario: PowerSensorScenarioId;
}

interface DataTableRow {
  readonly metric: string;
  readonly value: string;
  readonly meaning: string;
}

const format = (value: number, digits = 1) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

function DataTable({ caption, rows }: { caption: string; rows: readonly DataTableRow[] }) {
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

function SensorPath({ active }: { active: readonly string[] }) {
  const stages = [
    ['PLANE', 'Cable · attenuator'],
    ['DIODE', '4-path detector'],
    ['ADC', '20 MSa/s max'],
    ['CORR', 'Frequency · zero'],
    ['GATE', 'Trigger · aperture'],
    ['READ', 'Average · peak'],
  ] as const;
  return (
    <ol className="power-sensor-path" aria-label="U2061XA 측정 경로">
      {stages.map(([id, label]) => (
        <li key={id} className={active.includes(id) ? 'is-active' : undefined} data-affected={active.includes(id)} aria-label={`${id} · ${label} · ${active.includes(id) ? '현재 설정의 영향 stage' : '현재 설정의 직접 영향 없음'}`}>
          <i className="power-sensor-path__cue" aria-hidden="true">{active.includes(id) ? '◆' : '◇'}</i><strong>{id}</strong><span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Readouts({ items }: { items: readonly { label: string; value: string; tone?: 'active' | 'warning' | 'reference' }[] }) {
  return (
    <dl className="power-sensor-readouts">
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone ?? 'neutral'}><dt>{item.label}</dt><dd>{item.value}</dd></div>
      ))}
    </dl>
  );
}

function SafetyPowerAxis({
  averageDbm,
  peakDbm,
  guardedAverageDbm,
  guardedPeakDbm,
}: {
  averageDbm: number;
  peakDbm: number;
  guardedAverageDbm: number;
  guardedPeakDbm: number;
}) {
  const x = (value: number) => 64 + ((value + 70) / 120) * 642;
  const labelAnchor = (value: number): 'start' | 'middle' | 'end' => {
    const position = x(value);
    if (position < 145) return 'start';
    if (position > 615) return 'end';
    return 'middle';
  };
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="sensor-safety-title sensor-safety-desc">
      <title id="sensor-safety-title">Sensor 입력 전력과 damage level 비교</title>
      <desc id="sensor-safety-desc">평균 입력 {format(averageDbm)} dBm, peak 입력 {format(peakDbm)} dBm을 guard 적용 한계와 비교합니다.</desc>
      <rect width="760" height="250" className="power-sensor-plot-bg" />
      <line x1="64" x2="706" y1="154" y2="154" className="power-sensor-axis" />
      {[-70, -40, -10, 20, 26, 29, 50].map((tick) => (
        <g key={tick}><line x1={x(tick)} x2={x(tick)} y1="148" y2="162" className="power-sensor-axis" /><text x={x(tick)} y="184" textAnchor="middle" className="power-sensor-axis-label">{tick}</text></g>
      ))}
      <line x1={x(guardedAverageDbm)} x2={x(guardedAverageDbm)} y1="44" y2="154" className="power-sensor-limit power-sensor-limit--average" strokeDasharray="6 5" />
      <text x={x(guardedAverageDbm) - 8} y="36" textAnchor="end" className="power-sensor-label power-sensor-label--reverse">guarded average {format(guardedAverageDbm)} dBm</text>
      <line x1={x(guardedPeakDbm)} x2={x(guardedPeakDbm)} y1="74" y2="154" className="power-sensor-limit power-sensor-limit--peak" strokeDasharray="2 5" />
      <text x={x(guardedPeakDbm) - 8} y="68" textAnchor="end" className="power-sensor-label power-sensor-label--reference">guarded peak {format(guardedPeakDbm)} dBm</text>
      <circle cx={x(averageDbm)} cy="126" r="7" className="power-sensor-marker power-sensor-marker--forward" />
      <text x={x(averageDbm)} y="112" textAnchor={labelAnchor(averageDbm)} className="power-sensor-label power-sensor-label--forward">average {format(averageDbm)}</text>
      <path d={`M ${x(peakDbm) - 7} 139 L ${x(peakDbm)} 126 L ${x(peakDbm) + 7} 139 Z`} className="power-sensor-marker power-sensor-marker--reference" />
      <text x={x(peakDbm)} y="104" textAnchor={labelAnchor(peakDbm)} className="power-sensor-label power-sensor-label--reference">peak {format(peakDbm)}</text>
      <text x="385" y="225" textAnchor="middle" className="power-sensor-axis-label">Power at U2061XA connector · dBm</text>
    </svg>
  );
}

function BurstTrace({ dutyPercent, pulseWidthUs, averageDbm, peakDbm, apertureUs }: {
  dutyPercent: number;
  pulseWidthUs: number;
  averageDbm: number;
  peakDbm: number;
  apertureUs: number;
}) {
  const periodUs = pulseWidthUs / (dutyPercent / 100);
  const onWidth = Math.max(10, 610 * dutyPercent / 100);
  const gateWidth = Math.max(8, Math.min(610, 610 * apertureUs / Math.max(periodUs, apertureUs)));
  return (
    <svg viewBox="0 0 760 270" role="img" aria-labelledby="sensor-burst-title sensor-burst-desc">
      <title id="sensor-burst-title">Burst의 peak, average와 aperture</title>
      <desc id="sensor-burst-desc">Pulse width {format(pulseWidthUs, 1)} microsecond, duty {format(dutyPercent, 0)} percent이며 peak {format(peakDbm)} dBm, period average {format(averageDbm)} dBm입니다.</desc>
      <rect width="760" height="270" className="power-sensor-plot-bg" />
      <line x1="76" x2="704" y1="206" y2="206" className="power-sensor-axis" />
      <path d={`M 76 206 L 76 72 L ${76 + onWidth} 72 L ${76 + onWidth} 206 L 704 206`} className="power-sensor-trace power-sensor-trace--forward" fill="none" />
      <line x1="76" x2="704" y1="156" y2="156" className="power-sensor-trace power-sensor-trace--secondary" strokeDasharray="8 5" />
      <rect x="76" y="40" width={gateWidth} height="186" className="power-sensor-gate" />
      <text x={76 + gateWidth / 2} y="32" textAnchor="middle" className="power-sensor-label power-sensor-label--reference">aperture {format(apertureUs, 0)} µs</text>
      <text x={86 + onWidth} y="66" className="power-sensor-label power-sensor-label--forward">on/peak {format(peakDbm)} dBm</text>
      <text x="696" y="149" textAnchor="end" className="power-sensor-label power-sensor-label--secondary">period average {format(averageDbm)} dBm</text>
      <text x="390" y="252" textAnchor="middle" className="power-sensor-axis-label">Time · one period {format(periodUs, 1)} µs</text>
      <text transform="translate(24 142) rotate(-90)" textAnchor="middle" className="power-sensor-axis-label">Envelope power · dBm</text>
    </svg>
  );
}

function CorrectionUncertaintyView({
  sensorReadingDbm,
  pathCorrectionDb,
  dutPlaneDbm,
  expandedPercent,
  mismatchPercent,
}: {
  sensorReadingDbm: number;
  pathCorrectionDb: number;
  dutPlaneDbm: number;
  expandedPercent: number;
  mismatchPercent: number;
}) {
  const halfWidth = Math.min(42, 5 + expandedPercent * 4);
  return (
    <div className="power-sensor-correction-view">
      <div className="power-sensor-correction-equation" role="img" aria-label={`Sensor ${format(sensorReadingDbm)} dBm plus path correction ${format(pathCorrectionDb)} dB equals DUT plane ${format(dutPlaneDbm)} dBm`}>
        <span><small>SENSOR</small><strong>{format(sensorReadingDbm)} dBm</strong></span>
        <i aria-hidden="true">+</i>
        <span><small>PATH CORRECTION</small><strong>{format(pathCorrectionDb)} dB</strong></span>
        <i aria-hidden="true">=</i>
        <span data-result><small>DUT PLANE</small><strong>{format(dutPlaneDbm)} dBm</strong></span>
      </div>
      <svg viewBox="0 0 760 210" role="img" aria-labelledby="sensor-uncertainty-title sensor-uncertainty-desc">
        <title id="sensor-uncertainty-title">DUT plane power와 expanded uncertainty</title>
        <desc id="sensor-uncertainty-desc">DUT plane 중앙값 {format(dutPlaneDbm)} dBm에서 mismatch 표준 불확도 {format(mismatchPercent, 2)} percent와 전체 expanded uncertainty {format(expandedPercent, 2)} percent를 구분합니다.</desc>
        <rect width="760" height="210" className="power-sensor-plot-bg" />
        <line x1="80" x2="690" y1="112" y2="112" className="power-sensor-axis" />
        <line x1={380 - halfWidth} x2={380 + halfWidth} y1="112" y2="112" className="power-sensor-uncertainty-range" />
        <line x1={380 - halfWidth} x2={380 - halfWidth} y1="96" y2="128" className="power-sensor-uncertainty-cap" />
        <line x1={380 + halfWidth} x2={380 + halfWidth} y1="96" y2="128" className="power-sensor-uncertainty-cap" />
        <circle cx="380" cy="112" r="7" className="power-sensor-marker power-sensor-marker--forward" />
        <text x="380" y="82" textAnchor="middle" className="power-sensor-label power-sensor-label--forward">{format(dutPlaneDbm)} dBm</text>
        <text x="380" y="156" textAnchor="middle" className="power-sensor-label power-sensor-label--reference">U(k=2) · {format(expandedPercent, 2)}%</text>
        <text x="380" y="184" textAnchor="middle" className="power-sensor-axis-label">범위는 장식이 아니라 결합 불확도를 나타냅니다</text>
      </svg>
    </div>
  );
}

function TriggerTimeline({ session }: { session: U2061Session }) {
  const { state } = session;
  const apertureUs = state.apertureSeconds * 1e6;
  const delayUs = state.triggerDelaySeconds * 1e6;
  const start = Math.max(96, Math.min(520, 210 + delayUs / 4));
  const width = Math.max(16, Math.min(360, apertureUs / 4));
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="sensor-trigger-title sensor-trigger-desc">
      <title id="sensor-trigger-title">Trigger, delay와 aperture timeline</title>
      <desc id="sensor-trigger-desc">{state.triggerSource} trigger에서 {format(delayUs, 1)} microsecond 뒤 {format(apertureUs, 0)} microsecond aperture로 평균합니다.</desc>
      <rect width="760" height="250" className="power-sensor-plot-bg" />
      <line x1="70" x2="704" y1="174" y2="174" className="power-sensor-axis" />
      <line x1="210" x2="210" y1="54" y2="194" className="power-sensor-trigger-line" />
      <text x="210" y="40" textAnchor="middle" className="power-sensor-label power-sensor-label--reference">{state.triggerSource} trigger</text>
      <line x1="210" x2={start} y1="82" y2="82" className="power-sensor-delay-line" strokeDasharray="6 5" />
      <text x={(210 + start) / 2} y="72" textAnchor="middle" className="power-sensor-axis-label">delay {format(delayUs, 1)} µs</text>
      <rect x={start} y="104" width={Math.min(width, 704 - start)} height="70" className="power-sensor-gate" />
      <text x={start + Math.min(width, 704 - start) / 2} y="142" textAnchor="middle" className="power-sensor-label power-sensor-label--forward">aperture {format(apertureUs, 0)} µs</text>
      <text x="390" y="226" textAnchor="middle" className="power-sensor-axis-label">Acquisition time · trigger reference</text>
    </svg>
  );
}

function ScpiConsoleControl({
  onWrite,
  onQuery,
  onRead,
}: {
  onWrite: (command: string) => void;
  onQuery: (command: string) => void;
  onRead: () => void;
}) {
  const reportInteraction = useLabControlInteraction();
  const [command, setCommand] = useState('*IDN?');
  const normalized = command.trim();
  const executeWrite = () => {
    onWrite(normalized);
    reportInteraction('power-sensor-scpi-command');
  };
  const executeQuery = () => {
    onQuery(normalized);
    reportInteraction('power-sensor-scpi-command');
  };
  const executeRead = () => {
    onRead();
    reportInteraction('power-sensor-scpi-command');
  };
  return (
    <div className="power-sensor-console__entry control-field">
      <label htmlFor="power-sensor-scpi-command">SCPI program message</label>
      <input
        id="power-sensor-scpi-command"
        name="power-sensor-scpi-command"
        value={command}
        onChange={(event) => setCommand(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            executeWrite();
          }
        }}
        spellCheck={false}
        autoComplete="off"
      />
      <div>
        <button type="button" className="lab-button lab-button--primary" onClick={executeWrite}>WRITE만</button>
        <button type="button" className="lab-button lab-button--secondary" disabled={!normalized.endsWith('?')} onClick={executeQuery}>QUERY + READ</button>
        <button type="button" className="lab-button lab-button--secondary" onClick={executeRead}>READ queue</button>
      </div>
      <p>교육 console은 한 줄에 한 command만 처리합니다. Query response와 error queue는 서로 다른 FIFO입니다.</p>
    </div>
  );
}

function ScpiSessionView({ session }: { session: U2061Session }) {
  const latest = session.transcript.slice(-9);
  return (
    <div className="power-sensor-console">
      <div className="power-sensor-queue-strip" aria-label="SCPI queue 상태">
        <span>OUTPUT Q <strong>{session.outputQueue.length}</strong></span>
        <span>ERROR Q <strong>{session.errorQueue.length}</strong></span>
        <span>ARMED <strong>{session.state.armed ? 'YES' : 'NO'}</strong></span>
      </div>
      <ol className="power-sensor-transcript" aria-label="SCPI transaction transcript" aria-live="polite">
        {latest.map((entry) => (
          <li key={entry.index} data-direction={entry.outcome === 'error' ? 'error' : entry.direction}>
            <span>{entry.outcome === 'error' ? 'error' : entry.direction}</span>
            <code>{entry.outcome === 'error' ? `${entry.message} · ${entry.error?.code},"${entry.error?.message}"` : entry.message}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PaPowerChain({ result, outputSensorPeakDbm, safetyAllowed, simultaneous }: {
  result: ReturnType<typeof calculatePaPowerMeasurement>;
  outputSensorPeakDbm: number;
  safetyAllowed: boolean;
  simultaneous: boolean;
}) {
  const stages = [
    ['P1 forward · DUT plane', result.inputDutPlaneDbm, 'reference'],
    ['P2 forward · DUT plane', result.outputDutPlaneDbm, 'forward'],
    ['Output sensor peak', outputSensorPeakDbm, safetyAllowed ? 'forward' : 'reverse'],
  ] as const;
  return (
    <div className="power-sensor-pa-chain">
      <div className="power-sensor-pa-chain__status" data-allowed={safetyAllowed}>
        <span>{safetyAllowed ? 'SENSOR INPUT · PASS' : 'SENSOR INPUT · BLOCK'}</span>
        <strong>{format(result.gainDb)} dB forward gain · {format(result.paePercent, 2)}% forward-wave PAE estimate</strong>
        <p>{simultaneous ? '두 RF sensor를 같은 trigger로 읽는 상태' : '한 sensor를 옮겨 순차 측정하는 상태 · drift/switch 오차 추가'}</p>
      </div>
      <div className="power-sensor-pa-bars" role="img" aria-label={`DUT input ${format(result.inputDutPlaneDbm)} dBm, DUT output ${format(result.outputDutPlaneDbm)} dBm, output sensor peak ${format(outputSensorPeakDbm)} dBm`}>
        {stages.map(([label, value, tone]) => (
          <div key={label} data-tone={tone}><span>{label}</span><i style={{ '--power-level': `${Math.max(3, Math.min(100, (value + 30) / 0.8))}%` } as CSSProperties}></i><strong>{format(value)} dBm</strong></div>
        ))}
      </div>
      <dl className="power-sensor-pa-equations">
        <div><dt>Forward-wave gain</dt><dd>{format(result.outputDutPlaneDbm)} − ({format(result.inputDutPlaneDbm)}) = <strong>{format(result.gainDb)} dB</strong></dd></div>
        <div><dt>DC power</dt><dd><strong>{format(result.dcPowerW, 2)} W</strong></dd></div>
        <div><dt>PAE estimate</dt><dd>(P2,fwd − P1,fwd) / Pdc = <strong>{format(result.paePercent, 2)}%</strong></dd></div>
      </dl>
    </div>
  );
}

const stageMap: SignalStageMap = {
  'dut-average': ['dut', 'acquisition', 'display'],
  papr: ['dut', 'acquisition', 'dsp', 'display'],
  attenuation: ['dut', 'acquisition', 'dsp', 'display'],
  'peak-duration': ['acquisition', 'dsp', 'display'],
  guard: ['dsp', 'display'],
  'on-power': ['source', 'dut', 'acquisition', 'display'],
  duty: ['source', 'acquisition', 'dsp', 'display'],
  'pulse-width': ['source', 'acquisition', 'display'],
  'envelope-bandwidth': ['acquisition', 'dsp', 'display'],
  vbw: ['acquisition', 'dsp', 'display'],
  'sensor-reading': ['acquisition', 'dsp', 'display'],
  'path-correction': ['dut', 'dsp', 'display'],
  'sensor-swr': ['dut', 'dsp', 'display'],
  'dut-swr': ['dut', 'dsp', 'display'],
  'system-uncertainty': ['dsp', 'display'],
  aperture: ['acquisition', 'dsp', 'display'],
  average: ['dsp', 'display'],
  'trigger-source': ['source', 'acquisition', 'display'],
  'trigger-level': ['acquisition', 'display'],
  'input-sensor': ['source', 'dut', 'acquisition', 'dsp', 'display'],
  'input-correction': ['dut', 'dsp', 'display'],
  'output-sensor': ['dut', 'acquisition', 'dsp', 'display'],
  'output-correction': ['dut', 'dsp', 'display'],
  voltage: ['dut', 'acquisition', 'dsp', 'display'],
  current: ['dut', 'acquisition', 'dsp', 'display'],
  simultaneity: ['acquisition', 'display'],
};

export default function PowerSensorInstrumentLab({ scenario }: Props) {
  const [dutAverageDbm, setDutAverageDbm] = useState(30);
  const [paprDb, setPaprDb] = useState(8);
  const [attenuationDb, setAttenuationDb] = useState(30);
  const [peakDurationUs, setPeakDurationUs] = useState(5);
  const [guardDb, setGuardDb] = useState(3);

  const [onPowerDbm, setOnPowerDbm] = useState(10);
  const [dutyPercent, setDutyPercent] = useState(25);
  const [pulseWidthUs, setPulseWidthUs] = useState(10);
  const [envelopeBandwidthMhz, setEnvelopeBandwidthMhz] = useState(3);
  const [vbw, setVbw] = useState<U2061VideoBandwidth>('HIGH');

  const [sensorReadingDbm, setSensorReadingDbm] = useState(-12);
  const [pathCorrectionDb, setPathCorrectionDb] = useState(30.7);
  const [sensorSwr, setSensorSwr] = useState(1.15);
  const [dutSwr, setDutSwr] = useState(1.5);
  const [systemStandardPercent, setSystemStandardPercent] = useState(2);

  const [scpiSession, setScpiSession] = useState<U2061Session>(createU2061Session);

  const [inputSensorDbm, setInputSensorDbm] = useState(-10);
  const [inputCorrectionDb, setInputCorrectionDb] = useState(20);
  const [outputSensorDbm, setOutputSensorDbm] = useState(0);
  const [outputCorrectionDb, setOutputCorrectionDb] = useState(40);
  const [supplyVoltageV, setSupplyVoltageV] = useState(28);
  const [supplyCurrentA, setSupplyCurrentA] = useState(0.5);
  const [simultaneity, setSimultaneity] = useState('two');

  let title: string;
  let question: string;
  let description: string;
  let controls: ReactNode;
  let views: ReactNode;
  let ledger: readonly LedgerEntry[];
  let prediction: PredictionSpec;
  let note: string;

  if (scenario === 'sensor-safe-power') {
    const sensorAverageDbm = dutAverageDbm - attenuationDb;
    const sensorPeakDbm = sensorAverageDbm + paprDb;
    const decision = evaluateU2061InputSafety({
      sensorAveragePowerDbm: sensorAverageDbm,
      sensorPeakPowerDbm: sensorPeakDbm,
      peakDurationSeconds: peakDurationUs * 1e-6,
      dcVoltage: 0,
      guardMarginDb: guardDb,
    });
    title = 'U2061XA 입력 안전 예산';
    question = 'PA를 연결하기 전에 sensor connector에 도착할 average와 peak를 계산했는가?';
    description = 'DUT 출력에서 attenuator·coupler를 지난 average/peak를 각각 계산하고 vendor damage level에서 운영 guard를 뺀 한계와 비교합니다.';
    controls = <>
      <RangeControl id="dut-average" label="DUT average output" min={0} max={45} step={1} value={dutAverageDbm} valueText={`${format(dutAverageDbm)} dBm`} onChange={(event) => setDutAverageDbm(Number(event.currentTarget.value))} />
      <RangeControl id="papr" label="Waveform PAPR" min={0} max={12} step={0.5} value={paprDb} valueText={`${format(paprDb)} dB`} onChange={(event) => setPaprDb(Number(event.currentTarget.value))} />
      <RangeControl id="attenuation" label="Total path attenuation" min={10} max={60} step={1} value={attenuationDb} valueText={`${format(attenuationDb)} dB`} onChange={(event) => setAttenuationDb(Number(event.currentTarget.value))} help="Coupler coupling, attenuator와 cable loss를 합친 값입니다." />
      <RangeControl id="peak-duration" label="Peak duration" min={1} max={20} step={0.5} value={peakDurationUs} valueText={`${format(peakDurationUs)} µs`} onChange={(event) => setPeakDurationUs(Number(event.currentTarget.value))} />
      <RangeControl id="guard" label="Operating guard" min={0} max={10} step={1} value={guardDb} valueText={`${format(guardDb)} dB`} onChange={(event) => setGuardDb(Number(event.currentTarget.value))} help="Keysight specification이 아니라 bench 운영 정책입니다." />
    </>;
    views = <>
      <PlotFrame title={decision.allowed ? '입력이 guarded damage limit 아래입니다' : '연결·출력을 차단해야 합니다'} observation="+26/+29 dBm은 측정 목표가 아니라 damage level입니다." table={<DataTable caption="U2061XA 입력 안전 핵심 수치" rows={[
        { metric: 'DUT average', value: `${format(dutAverageDbm)} dBm`, meaning: 'PA output reference plane' },
        { metric: 'Path attenuation', value: `${format(attenuationDb)} dB`, meaning: 'Coupler + attenuator + cable' },
        { metric: 'Sensor average', value: `${format(sensorAverageDbm)} dBm`, meaning: 'DUT average − attenuation' },
        { metric: 'Sensor peak', value: `${format(sensorPeakDbm)} dBm`, meaning: 'Sensor average + PAPR' },
        { metric: 'Vendor damage', value: '+26 dBm average · +29 dBm peak', meaning: '+29 dBm은 <10 µs pulse에만 적용' },
        { metric: 'DC damage', value: `${U2061XA_DAMAGE_DC_VOLTS} V`, meaning: 'DC block 필요 여부 확인' },
        { metric: 'Safety gate', value: decision.allowed ? 'PASS' : 'BLOCK', meaning: decision.reasons.join(' ') || 'Guard 적용 한계 아래' },
      ]} />}><SafetyPowerAxis averageDbm={sensorAverageDbm} peakDbm={sensorPeakDbm} guardedAverageDbm={decision.guardedAverageLimitDbm} guardedPeakDbm={decision.guardedPeakLimitDbm} /></PlotFrame>
      <PlotFrame title="Reference plane에서 detector까지 손실을 따라갑니다" observation="Sensor는 upstream PA 출력이 아니라 자신의 connector에 도착한 power를 견딥니다."><SensorPath active={['PLANE', 'DIODE', 'ADC', 'READ']} /><Readouts items={[
        { label: 'Average damage', value: `+${U2061XA_DAMAGE_AVERAGE_DBM} dBm`, tone: 'warning' },
        { label: 'Peak damage', value: `+${U2061XA_DAMAGE_PEAK_DBM} dBm · <10 µs`, tone: 'reference' },
        { label: 'Average headroom', value: `${format(decision.averageHeadroomDb)} dB`, tone: decision.averageHeadroomDb > 0 ? 'active' : 'warning' },
        { label: 'Peak headroom', value: `${format(decision.peakHeadroomDb)} dB`, tone: decision.peakHeadroomDb > 0 ? 'active' : 'warning' },
      ]} /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `DUT ${format(dutAverageDbm)} dBm average · PAPR ${format(paprDb)} dB · attenuation ${format(attenuationDb)} dB`, tone: 'active' },
      { label: '직접 효과', value: `Sensor connector에는 ${format(sensorAverageDbm)} dBm average와 ${format(sensorPeakDbm)} dBm peak가 도착합니다.` },
      { label: '화면 결과', value: decision.allowed ? `Average ${format(decision.averageHeadroomDb)} dB, peak ${format(decision.peakHeadroomDb)} dB의 guarded headroom입니다.` : 'Damage level과 같거나 넘기 전에 safety gate가 연결을 차단합니다.', tone: decision.allowed ? 'neutral' : 'warning' },
      { label: '비용·한계', value: 'Software 계산은 잘못된 coupler 방향, DC 유입, attenuator pulse rating 또는 통신 단절을 막지 못합니다.', tone: 'warning' },
    ];
    prediction = { id: 'sensor-attenuation', prompt: 'DUT 출력과 PAPR을 유지하고 attenuation을 10 dB 줄이면?', options: ['Sensor average와 peak가 모두 10 dB 상승', 'Peak만 10 dB 상승', 'Sensor frequency가 10 MHz 이동'], correctIndex: 0, explanation: '같은 RF path attenuation은 average와 peak에 동일한 dB 변화로 작용합니다.' };
    note = 'Connector 변경 전 SG RF OFF, DUT bias safe state, DC block과 attenuator/coupler power rating을 물리적으로 확인하세요.';
  } else if (scenario === 'sensor-average-peak') {
    const burst = calculateRectangularBurstPower({ onPowerDbm, dutyCyclePercent: dutyPercent });
    const apertureUs = Math.max(20, pulseWidthUs);
    const vbwMhz = { LOW: 0.3, MED: 1.5, HIGH: 5, OFF: 5 }[vbw];
    const peakBandwidthPass = envelopeBandwidthMhz <= vbwMhz;
    title = 'Average·peak·burst 연결 보기';
    question = '같은 burst인데 average와 peak 숫자가 다른 이유를 시간축에서 설명할 수 있는가?';
    description = 'On power, duty cycle, aperture와 peak-path VBW를 한 trace에 연결해 true-average와 envelope peak가 포함하는 시간을 분리합니다.';
    controls = <>
      <RangeControl id="on-power" label="Burst on power" min={-20} max={20} step={1} value={onPowerDbm} valueText={`${format(onPowerDbm)} dBm`} onChange={(event) => setOnPowerDbm(Number(event.currentTarget.value))} />
      <RangeControl id="duty" label="Duty cycle" min={5} max={100} step={5} value={dutyPercent} valueText={`${format(dutyPercent, 0)} %`} onChange={(event) => setDutyPercent(Number(event.currentTarget.value))} />
      <RangeControl id="pulse-width" label="Pulse width" min={1} max={100} step={1} value={pulseWidthUs} valueText={`${format(pulseWidthUs, 0)} µs`} onChange={(event) => setPulseWidthUs(Number(event.currentTarget.value))} />
      <RangeControl id="envelope-bandwidth" label="Envelope bandwidth" min={0.1} max={10} step={0.1} value={envelopeBandwidthMhz} valueText={`${format(envelopeBandwidthMhz, 1)} MHz`} onChange={(event) => setEnvelopeBandwidthMhz(Number(event.currentTarget.value))} />
      <SelectControl id="vbw" label="Normal-mode video bandwidth" value={vbw} onChange={(event) => setVbw(event.currentTarget.value as U2061VideoBandwidth)}><option>LOW</option><option>MED</option><option>HIGH</option><option>OFF</option></SelectControl>
    </>;
    views = <PlotFrame title="Duty cycle이 average를 낮추고 peak는 on level에 남깁니다" observation={peakBandwidthPass ? '설정한 envelope bandwidth가 선택 VBW 안에 있습니다.' : 'Envelope bandwidth가 선택 VBW를 넘어 peak가 낮게 보일 수 있습니다.'} table={<DataTable caption="Average·peak·burst 핵심 수치" rows={[
      { metric: 'On / peak power', value: `${format(burst.onPowerDbm)} dBm`, meaning: 'Pulse가 켜진 구간의 power' },
      { metric: 'Period average', value: `${format(burst.averagePowerDbm, 2)} dBm`, meaning: 'On과 off를 모두 포함한 true average' },
      { metric: 'Peak-to-average', value: `${format(burst.peakToAverageDb, 2)} dB`, meaning: 'Rectangular pulse의 −10log10(duty)' },
      { metric: 'Pulse / period', value: `${format(pulseWidthUs, 0)} / ${format(pulseWidthUs / (dutyPercent / 100), 1)} µs`, meaning: 'Duty cycle이 정한 반복 구조' },
      { metric: 'Peak path VBW', value: `${format(vbwMhz, 1)} MHz`, meaning: peakBandwidthPass ? '입력 envelope bandwidth 포함' : '입력 envelope bandwidth보다 좁음' },
      { metric: 'Wideband average', value: '별도 square-law path', meaning: '100 MHz급 변조 average와 5 MHz peak capability를 혼동하지 않음' },
    ]} />}><BurstTrace dutyPercent={dutyPercent} pulseWidthUs={pulseWidthUs} averageDbm={burst.averagePowerDbm} peakDbm={burst.onPowerDbm} apertureUs={apertureUs} /><Readouts items={[
      { label: 'Average', value: `${format(burst.averagePowerDbm, 2)} dBm`, tone: 'active' },
      { label: 'Peak', value: `${format(burst.onPowerDbm)} dBm`, tone: 'reference' },
      { label: 'P/A', value: `${format(burst.peakToAverageDb, 2)} dB` },
      { label: 'Peak BW check', value: peakBandwidthPass ? 'PASS' : 'LIMITED', tone: peakBandwidthPass ? 'active' : 'warning' },
    ]} /></PlotFrame>;
    ledger = [
      { label: '변경', value: `${format(onPowerDbm)} dBm on · duty ${format(dutyPercent, 0)}% · envelope ${format(envelopeBandwidthMhz, 1)} MHz`, tone: 'active' },
      { label: '직접 효과', value: `Off time까지 적분한 period average는 ${format(burst.averagePowerDbm, 2)} dBm, on 구간 peak는 ${format(burst.onPowerDbm)} dBm입니다.` },
      { label: '화면 결과', value: `Peak-to-average 차이는 ${format(burst.peakToAverageDb, 2)} dB이며 peak bandwidth 검사는 ${peakBandwidthPass ? '통과' : '제한'}입니다.`, tone: peakBandwidthPass ? 'neutral' : 'warning' },
      { label: '비용·한계', value: '5 MHz peak VBW는 광대역 OFDM의 모든 순간 peak나 CCDF를 보장하지 않습니다. Average path의 wideband capability와 별도입니다.', tone: 'warning' },
    ];
    prediction = { id: 'sensor-duty', prompt: 'On power를 유지하고 duty cycle을 25%에서 50%로 올리면?', options: ['Period average는 약 3.01 dB 상승하고 peak는 유지', 'Peak만 3.01 dB 상승', 'Average와 peak가 모두 유지'], correctIndex: 0, explanation: 'Duty가 두 배가 되면 한 period의 energy가 두 배가 되어 average는 3.01 dB 오르지만 on-level peak는 같습니다.' };
    note = '100 MHz NR/LTE average는 측정할 수 있지만 U2061XA의 5 MHz peak path로 true PAPR·CCDF compliance를 대신하지 마세요.';
  } else if (scenario === 'sensor-correction') {
    const dutPlaneDbm = calculateDutPlanePowerDbm(sensorReadingDbm, pathCorrectionDb);
    const uncertainty = calculateU2061Uncertainty({ sensorSwr, dutSwr, systemStandardPercent });
    title = 'Correction과 uncertainty ledger';
    question = 'Sensor frequency와 path correction을 넣으면 어느 기준면의 숫자가 되는가?';
    description = 'Raw connector reading, frequency response, external path correction, mismatch와 coverage factor를 순서대로 분리해 DUT plane 결과를 만듭니다.';
    controls = <>
      <RangeControl id="sensor-reading" label="Sensor connector reading" min={-50} max={20} step={0.5} value={sensorReadingDbm} valueText={`${format(sensorReadingDbm)} dBm`} onChange={(event) => setSensorReadingDbm(Number(event.currentTarget.value))} />
      <RangeControl id="path-correction" label="Signed path correction" min={0} max={50} step={0.1} value={pathCorrectionDb} valueText={`+${format(pathCorrectionDb)} dB`} onChange={(event) => setPathCorrectionDb(Number(event.currentTarget.value))} help="DUT에서 sensor까지의 attenuation을 되돌리는 양의 correction입니다." />
      <RangeControl id="sensor-swr" label="Sensor SWR" min={1} max={1.24} step={0.01} value={sensorSwr} valueText={format(sensorSwr, 2)} onChange={(event) => setSensorSwr(Number(event.currentTarget.value))} />
      <RangeControl id="dut-swr" label="DUT source SWR" min={1} max={3} step={0.05} value={dutSwr} valueText={format(dutSwr, 2)} onChange={(event) => setDutSwr(Number(event.currentTarget.value))} />
      <RangeControl id="system-uncertainty" label="Other standard uncertainty" min={0} max={6} step={0.1} value={systemStandardPercent} valueText={`${format(systemStandardPercent, 1)} %`} onChange={(event) => setSystemStandardPercent(Number(event.currentTarget.value))} />
    </>;
    views = <>
      <PlotFrame title="Correction은 숫자를 DUT plane으로 옮기고 uncertainty는 폭을 남깁니다" observation="Frequency setting은 RF tuner가 아니라 sensor response correction용 metadata입니다." table={<DataTable caption="Correction·uncertainty 핵심 수치" rows={[
        { metric: 'Sensor reading', value: `${format(sensorReadingDbm)} dBm`, meaning: 'U2061XA connector 기준' },
        { metric: 'Path correction', value: `+${format(pathCorrectionDb)} dB`, meaning: 'Cable/coupler/attenuator loss의 역보정' },
        { metric: 'DUT plane', value: `${format(dutPlaneDbm)} dBm`, meaning: 'Reading + signed correction' },
        { metric: '|Γsensor|', value: format(uncertainty.sensorGammaMagnitude, 4), meaning: '(SWR−1)/(SWR+1)' },
        { metric: '|ΓDUT|', value: format(uncertainty.dutGammaMagnitude, 4), meaning: '(SWR−1)/(SWR+1)' },
        { metric: 'Mismatch standard', value: `${format(uncertainty.mismatchStandardPercent, 3)} %`, meaning: '|Γs||Γd|/√2' },
        { metric: 'Combined standard', value: `${format(uncertainty.combinedStandardPercent, 3)} %`, meaning: 'System과 mismatch RSS' },
        { metric: 'Expanded', value: `${format(uncertainty.expandedPercent, 3)} %`, meaning: `k=${uncertainty.coverageFactor}` },
      ]} />}><CorrectionUncertaintyView sensorReadingDbm={sensorReadingDbm} pathCorrectionDb={pathCorrectionDb} dutPlaneDbm={dutPlaneDbm} expandedPercent={uncertainty.expandedPercent} mismatchPercent={uncertainty.mismatchStandardPercent} /></PlotFrame>
      <PlotFrame title="Zero, calibration과 correction의 순서를 분리합니다" observation="Internal zero는 연결을 유지할 수 있어도 safe sequence에서는 SG RF OFF를 먼저 확인합니다."><SensorPath active={['PLANE', 'DIODE', 'CORR', 'READ']} /><Readouts items={[
        { label: 'Frequency', value: '3.500 GHz', tone: 'reference' },
        { label: 'Zero type', value: 'INTERNAL' },
        { label: 'Calibration', value: 'PASS', tone: 'active' },
        { label: 'FDO / S-parameter', value: 'External path' },
      ]} /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `Reading ${format(sensorReadingDbm)} dBm + path correction ${format(pathCorrectionDb)} dB`, tone: 'active' },
      { label: '직접 효과', value: `DUT plane 중앙값은 ${format(dutPlaneDbm)} dBm이고 mismatch 표준 성분은 ${format(uncertainty.mismatchStandardPercent, 3)}%입니다.` },
      { label: '화면 결과', value: `다른 표준 성분과 RSS한 뒤 k=2 expanded uncertainty는 ${format(uncertainty.expandedPercent, 3)}%입니다.` },
      { label: '비용·한계', value: 'Basic accuracy 하나만 total uncertainty로 쓰지 않습니다. Zero, drift, noise, calibration, path와 mismatch의 조건을 기록해야 합니다.', tone: 'warning' },
    ];
    prediction = { id: 'sensor-frequency-correction', prompt: 'Sensor의 frequency setting을 1 GHz에서 3.5 GHz로 바꾸면?', options: ['RF를 tune하지 않고 해당 주파수의 response correction을 선택', '입력 RF를 3.5 GHz로 변환', 'Aperture가 자동으로 3.5초가 됨'], correctIndex: 0, explanation: 'Power sensor frequency는 수신 중심주파수가 아니라 calibration factor와 frequency-dependent correction을 선택하는 metadata입니다.' };
    note = 'FDO와 S-parameter correction을 중복 적용하지 말고, correction table의 reference plane과 주파수 범위를 함께 저장하세요.';
  } else if (scenario === 'sensor-scpi-trigger') {
    const state = scpiSession.state;
    const readingRate = state.detectorMode === 'AVER'
      ? calculateU2061AverageReadingRate(state.frequencyHz, state.apertureSeconds)
      : 25_000;
    const triggerGuaranteeDbm = state.detectorMode === 'AVER' ? -40 : -25;
    const write = (command: string) => setScpiSession((current) => writeU2061Scpi(current, command));
    const query = (command: string) => setScpiSession((current) => queryU2061Scpi(current, command).session);
    const read = () => setScpiSession((current) => readU2061Scpi(current).session);
    title = 'SCPI trigger state console';
    question = 'Configure, arm, trigger, fetch와 error drain을 서로 다른 상태로 읽고 있는가?';
    description = 'Aperture·averaging·trigger state와 output/error queue를 하나의 결정론적 U2061XA session으로 연결합니다.';
    controls = <>
      <SelectControl id="trigger-source" label="Trigger source" value={state.triggerSource} onChange={(event) => write(`TRIG:SOUR ${event.currentTarget.value}`)}><option value="IMM">IMMEDIATE</option><option value="INT">INTERNAL</option><option value="EXT">EXTERNAL</option><option value="BUS">BUS</option><option value="HOLD">HOLD</option></SelectControl>
      <RangeControl id="aperture" label="Average aperture" min={20} max={2000} step={20} value={state.apertureSeconds * 1e6} valueText={`${format(state.apertureSeconds * 1e6, 0)} µs`} onChange={(event) => write(`SENS:SWE:APER ${event.currentTarget.value}US`)} help="3.5 GHz에서 20 µs가 최소, 200 ms가 최대입니다." />
      <RangeControl id="average" label="Average count" min={1} max={128} step={1} value={state.averageCount} valueText={`${state.averageCount}`} onChange={(event) => write(`SENS:AVER:COUN ${event.currentTarget.value}`)} />
      <NumberControl id="trigger-level" label="Internal trigger level" unit="dBm" min={-48} max={20} step={0.5} value={state.triggerLevelDbm} onChange={(event) => {
        let next = scpiSession;
        if (next.state.triggerSource !== 'INT') next = writeU2061Scpi(next, 'TRIG:SOUR INT');
        setScpiSession(writeU2061Scpi(next, `TRIG:LEV ${event.currentTarget.value}DBM`));
      }} help={`Command range와 다르게 guaranteed sensitivity는 ${triggerGuaranteeDbm} dBm입니다.`} />
      <ScpiConsoleControl onWrite={write} onQuery={query} onRead={read} />
    </>;
    views = <>
      <PlotFrame title="Trigger event 뒤 delay와 aperture가 측정 구간을 자릅니다" observation={`${state.detectorMode} mode · 약 ${format(readingRate, 0)} readings/s · trigger guarantee ${triggerGuaranteeDbm} dBm`} table={<DataTable caption="SCPI trigger 핵심 상태" rows={[
        { metric: 'Detector mode', value: state.detectorMode, meaning: 'AVER는 aperture, NORM은 peak trace/VBW' },
        { metric: 'Frequency', value: `${format(state.frequencyHz / 1e9, 3)} GHz`, meaning: 'Correction frequency' },
        { metric: 'Aperture', value: `${format(state.apertureSeconds * 1e6, 0)} µs`, meaning: 'Average integration interval' },
        { metric: 'Reading rate', value: `${format(readingRate, 0)} /s`, meaning: '1/aperture, 최대 50,000/s' },
        { metric: 'Trigger source', value: state.triggerSource, meaning: state.armed ? 'Wait-for-trigger' : 'Idle or complete' },
        { metric: 'Trigger level', value: `${format(state.triggerLevelDbm)} dBm`, meaning: `Command 범위와 guaranteed ${triggerGuaranteeDbm} dBm를 구분` },
        { metric: 'Queues', value: `OUT ${scpiSession.outputQueue.length} · ERR ${scpiSession.errorQueue.length}`, meaning: '각각 독립된 FIFO' },
      ]} />}><TriggerTimeline session={scpiSession} /><Readouts items={[
        { label: 'Detector', value: state.detectorMode, tone: 'active' },
        { label: 'Trigger', value: state.triggerSource, tone: 'reference' },
        { label: 'Acquisition', value: state.armed ? 'ARMED' : 'IDLE' },
        { label: 'Last result', value: state.lastMeasurementDbm === null ? 'NONE' : `${format(state.lastMeasurementDbm)} dBm` },
      ]} /></PlotFrame>
      <PlotFrame title="한 줄 SCPI와 queue 변화를 같은 transcript에서 확인합니다" observation="WRITE만으로 query를 보내면 response가 output queue에 남습니다."><ScpiSessionView session={scpiSession} /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `${state.triggerSource} trigger · aperture ${format(state.apertureSeconds * 1e6, 0)} µs · average ${state.averageCount}`, tone: 'active' },
      { label: '직접 효과', value: `INIT가 wait-for-trigger state를 만들고 event 뒤 aperture가 평균 구간을 정합니다.` },
      { label: '화면 결과', value: `출력 queue ${scpiSession.outputQueue.length}, error queue ${scpiSession.errorQueue.length}, acquisition은 ${state.armed ? 'ARMED' : 'IDLE'}입니다.` },
      { label: '비용·한계', value: 'Web console은 transport timeout, USB disconnect와 실제 RF envelope를 재현하지 않습니다. Query마다 response를 읽고 error queue를 별도 drain해야 합니다.', tone: 'warning' },
    ];
    prediction = { id: 'sensor-init-fetch', prompt: 'TRIG:SOUR BUS 뒤 INIT만 보내고 *TRG 없이 FETC?를 호출하면?', options: ['새 유효 측정값을 보장하지 못함', '자동으로 immediate trigger됨', 'Sensor가 RF를 출력함'], correctIndex: 0, explanation: 'INIT는 arm만 하고 BUS event가 와야 acquisition이 끝납니다. FETCh?는 이미 완료된 memory data를 가져올 뿐 trigger하지 않습니다.' };
    note = 'Error queue는 최대 30 record이므로 31회 안에 +0 종결을 확인하고, query response를 읽기 전에 다음 command를 보내지 마세요.';
  } else {
    const result = calculatePaPowerMeasurement({ inputSensorDbm, inputPathCorrectionDb: inputCorrectionDb, outputSensorDbm, outputPathCorrectionDb: outputCorrectionDb, supplyVoltageV, supplyCurrentA });
    const outputSensorPeakDbm = outputSensorDbm + paprDb;
    const outputSafety = evaluateU2061InputSafety({ sensorAveragePowerDbm: outputSensorDbm, sensorPeakPowerDbm: outputSensorPeakDbm, peakDurationSeconds: 5e-6, dcVoltage: 0, guardMarginDb: guardDb });
    const simultaneous = simultaneity === 'two';
    title = 'PA RF·DC power budget';
    question = 'Pin, Pout, gain과 PAE가 어느 장비의 어느 기준면에서 만들어지는가?';
    description = '두 RF sensor의 connector reading을 DUT plane으로 옮기고 PSU의 V·I와 같은 시험점에서 결합해 gain·PAE를 계산합니다.';
    controls = <>
      <RangeControl id="input-sensor" label="Input sensor reading" min={-40} max={10} step={1} value={inputSensorDbm} valueText={`${format(inputSensorDbm)} dBm`} onChange={(event) => setInputSensorDbm(Number(event.currentTarget.value))} />
      <RangeControl id="input-correction" label="Input path correction" min={0} max={30} step={1} value={inputCorrectionDb} valueText={`+${format(inputCorrectionDb)} dB`} onChange={(event) => setInputCorrectionDb(Number(event.currentTarget.value))} />
      <RangeControl id="output-sensor" label="Output sensor average" min={-30} max={20} step={1} value={outputSensorDbm} valueText={`${format(outputSensorDbm)} dBm`} onChange={(event) => setOutputSensorDbm(Number(event.currentTarget.value))} />
      <RangeControl id="output-correction" label="Output path correction" min={20} max={60} step={1} value={outputCorrectionDb} valueText={`+${format(outputCorrectionDb)} dB`} onChange={(event) => setOutputCorrectionDb(Number(event.currentTarget.value))} />
      <RangeControl id="papr" label="Output waveform PAPR" min={0} max={12} step={0.5} value={paprDb} valueText={`${format(paprDb)} dB`} onChange={(event) => setPaprDb(Number(event.currentTarget.value))} />
      <RangeControl id="voltage" label="PSU voltage readback" min={1} max={50} step={1} value={supplyVoltageV} valueText={`${format(supplyVoltageV)} V`} onChange={(event) => setSupplyVoltageV(Number(event.currentTarget.value))} />
      <RangeControl id="current" label="PSU current readback" min={0.05} max={5} step={0.05} value={supplyCurrentA} valueText={`${format(supplyCurrentA, 2)} A`} onChange={(event) => setSupplyCurrentA(Number(event.currentTarget.value))} />
      <SelectControl id="simultaneity" label="RF measurement topology" value={simultaneity} onChange={(event) => setSimultaneity(event.currentTarget.value)}><option value="two">두 sensor · 동시 trigger</option><option value="one">한 sensor · 순차 이동</option></SelectControl>
    </>;
    views = <>
      <PlotFrame title="Sensor connector reading을 Pin·Pout 기준면으로 되돌립니다" observation="RF sensor와 PSU가 같은 시험 상태를 공유해야 PAE가 의미를 가집니다." table={<DataTable caption="PA power budget 핵심 수치" rows={[
        { metric: 'P1,fwd sensor / DUT', value: `${format(inputSensorDbm)} / ${format(result.inputDutPlaneDbm)} dBm`, meaning: 'Forward input reading + path correction' },
        { metric: 'P2,fwd sensor / DUT', value: `${format(outputSensorDbm)} / ${format(result.outputDutPlaneDbm)} dBm`, meaning: 'Forward output reading + path correction' },
        { metric: 'Output sensor peak', value: `${format(outputSensorPeakDbm)} dBm`, meaning: 'Average reading + waveform PAPR' },
        { metric: 'Forward gain', value: `${format(result.gainDb)} dB`, meaning: 'P2,fwd(DUT plane) − P1,fwd(DUT plane)' },
        { metric: 'DC power', value: `${format(result.dcPowerW, 2)} W`, meaning: 'PSU voltage × current readback' },
        { metric: 'Drain efficiency estimate', value: `${format(result.drainEfficiencyPercent, 2)} %`, meaning: 'P2,fwd / Pdc; load-delivered power requires reverse wave' },
        { metric: 'PAE estimate', value: `${format(result.paePercent, 2)} %`, meaning: '(P2,fwd − P1,fwd) / Pdc' },
        { metric: 'Topology', value: simultaneous ? '2 sensors · simultaneous' : '1 sensor · sequential', meaning: simultaneous ? '같은 trigger/time state' : 'Drift·switch repeatability 추가' },
        { metric: 'Sensor safety', value: outputSafety.allowed ? 'PASS' : 'BLOCK', meaning: 'Output branch의 sensor connector 기준' },
      ]} />}><PaPowerChain result={result} outputSensorPeakDbm={outputSensorPeakDbm} safetyAllowed={outputSafety.allowed} simultaneous={simultaneous} /></PlotFrame>
      <PlotFrame title="한 KPI를 여러 장비의 책임으로 나눕니다" observation="Power sensor는 EVM·ACLR·SEM을 측정하지 않습니다."><table className="power-sensor-dependency-table"><caption>PA 시험값과 담당 장비</caption><thead><tr><th>결과</th><th>필요 장비</th><th>같이 저장할 조건</th></tr></thead><tbody>
        <tr><td>Forward-wave power·gain</td><td>U2061XA 1–2대</td><td>Path correction · trigger; accepted/delivered는 reverse path 추가</td></tr>
        <tr><td>PAE</td><td>RF sensors + PSU</td><td>동일 시간점의 V·I</td></tr>
        <tr><td>EVM·ACLR·SEM</td><td>SA / VSA</td><td>Waveform · reference level</td></tr>
        <tr><td>AM-PM</td><td>VSA IQ 또는 VNA 방법</td><td>Phase reference</td></tr>
      </tbody></table></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `Pin sensor ${format(inputSensorDbm)} dBm · Pout sensor ${format(outputSensorDbm)} dBm · ${format(supplyVoltageV)} V / ${format(supplyCurrentA, 2)} A`, tone: 'active' },
      { label: '직접 효과', value: `Path correction 후 P1,fwd ${format(result.inputDutPlaneDbm)} dBm, P2,fwd ${format(result.outputDutPlaneDbm)} dBm, Pdc ${format(result.dcPowerW, 2)} W입니다.` },
      { label: '화면 결과', value: `Gain ${format(result.gainDb)} dB, drain efficiency ${format(result.drainEfficiencyPercent, 2)}%, PAE ${format(result.paePercent, 2)}%입니다.` },
      { label: '비용·한계', value: simultaneous ? '두 sensor의 correction·trigger skew·uncertainty를 각각 관리해야 합니다.' : '순차 이동은 한 sensor calibration을 공유하지만 PA drift와 switch/connector repeatability가 결과에 들어갑니다.', tone: 'warning' },
    ];
    prediction = { id: 'sensor-pae-reference', prompt: 'RF Pout과 Pin은 그대로인데 PSU current가 20% 늘면?', options: ['DC power가 늘어 PAE는 낮아짐', 'RF gain이 20% 상승', 'Sensor peak bandwidth가 넓어짐'], correctIndex: 0, explanation: 'PAE 분모인 Pdc=V·I가 증가하고 RF 차이는 같으므로 PAE는 낮아집니다.' };
    note = '이 lab의 RF 값은 forward-wave convention입니다. Accepted/delivered power에는 reverse reading과 같은 reference impedance가 필요하며 RF OFF·bias cleanup은 orchestration layer가 책임져야 합니다.';
  }

  return (
    <LabShell
      labId={`instrument:sensor:${scenario}`}
      title={title}
      question={question}
      description={description}
      activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']}
      stageMap={stageMap}
      controls={controls}
      ledger={ledger}
      prediction={prediction}
      note={note}
    >
      {views}
    </LabShell>
  );
}
