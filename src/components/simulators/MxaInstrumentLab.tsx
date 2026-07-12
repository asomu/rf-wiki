import { useMemo, useState, type ReactNode } from 'react';
import { LabShell } from '../lab/LabShell';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { PlotFrame } from '../plots/PlotFrame';
import type { LedgerEntry, PredictionSpec, SignalStageMap } from '../lab/types';
import {
  N9020B_DAMAGE_AVERAGE_DBM,
  N9020B_DAMAGE_PULSE_DBM,
  N9020B_WIDEBAND_ADC_FULL_SCALE_DBM,
  calculateAclrDb,
  calculateIqCapture,
  calculateOccupiedBandwidth,
  completeN9020bTrigger,
  createN9020bSession,
  estimateSweepTimeSeconds,
  evaluateN9020bInputSafety,
  generateN9020bSpectrum,
  n9020bPreampMaxGainDb,
  queryN9020bScpi,
  readN9020bScpi,
  writeN9020bScpi,
  type N9020bDetector,
  type N9020bSession,
  type SpectrumPoint,
} from '@/lib/instruments/sa';
import './mxa.css';

export type MxaScenarioId =
  | 'mxa-safe-input'
  | 'mxa-sweep-rbw'
  | 'mxa-iq-trigger'
  | 'mxa-scpi-measurements'
  | 'mxa-pa-analysis';

interface Props { scenario: MxaScenarioId }
interface TableRow { readonly metric: string; readonly value: string; readonly meaning: string }

const fmt = (value: number, digits = 1) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

function DataTable({ caption, rows }: { caption: string; rows: readonly TableRow[] }) {
  return (
    <table className="mxa-table">
      <caption>{caption}</caption>
      <thead><tr><th>항목</th><th>값</th><th>해석</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.metric}><th scope="row">{row.metric}</th><td>{row.value}</td><td>{row.meaning}</td></tr>)}</tbody>
    </table>
  );
}

function MxaPath({ active }: { active: readonly string[] }) {
  const stages = [
    ['PLANE', 'Coupler · pad'], ['ATTEN', '0–70 dB'], ['MIXER', 'LO · preselector'],
    ['IF', 'RBW · VBW'], ['ADC', 'IQ · trigger'], ['RESULT', 'Trace · power'],
  ] as const;
  return (
    <ol className="mxa-path" aria-label="N9020B signal-analysis path">
      {stages.map(([id, label]) => {
        const affected = active.includes(id);
        return <li key={id} className={affected ? 'is-active' : undefined} data-affected={affected} aria-label={`${id} · ${label} · ${affected ? '현재 설정 영향' : '직접 영향 없음'}`}><i aria-hidden="true">{affected ? '◆' : '◇'}</i><strong>{id}</strong><span>{label}</span></li>;
      })}
    </ol>
  );
}

function Readouts({ items }: { items: readonly { label: string; value: string; tone?: 'active' | 'reference' | 'warning' }[] }) {
  return <dl className="mxa-readouts">{items.map((item) => <div key={item.label} data-tone={item.tone ?? 'neutral'}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

function SafetyAxis({ connectorAverage, connectorPeak, mixerAverage, allowed }: {
  connectorAverage: number; connectorPeak: number; mixerAverage: number; allowed: boolean;
}) {
  const x = (value: number) => 70 + ((Math.max(-60, Math.min(50, value)) + 60) / 110) * 620;
  return (
    <svg viewBox="0 0 760 290" role="img" aria-labelledby="mxa-safety-title mxa-safety-desc">
      <title id="mxa-safety-title">Connector power와 mixer level의 서로 다른 경계</title>
      <desc id="mxa-safety-desc">Connector average {fmt(connectorAverage)} dBm, peak {fmt(connectorPeak)} dBm, mixer average {fmt(mixerAverage)} dBm이며 safety gate는 {allowed ? 'pass' : 'block'}입니다.</desc>
      <rect width="760" height="290" className="mxa-plot-bg" />
      <text x="70" y="40" className="mxa-axis-label">Connector plane</text>
      <line x1="70" x2="690" y1="112" y2="112" className="mxa-axis" />
      {[-60, -40, -20, 0, 20, 30, 50].map((tick) => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1="106" y2="118" className="mxa-axis" /><text x={x(tick)} y="138" textAnchor="middle" className="mxa-axis-label">{tick}</text></g>)}
      <line x1={x(30)} x2={x(30)} y1="52" y2="112" className="mxa-limit" strokeDasharray="7 5" />
      <text x={x(30) - 8} y="66" textAnchor="end" className="mxa-label mxa-label--warning">+30 average damage</text>
      <circle cx={x(connectorAverage)} cy="88" r="7" className="mxa-marker mxa-marker--active" />
      <text x={x(connectorAverage)} y="78" textAnchor="middle" className="mxa-label mxa-label--active">avg {fmt(connectorAverage)}</text>
      <path d={`M ${x(connectorPeak) - 7} 105 L ${x(connectorPeak)} 92 L ${x(connectorPeak) + 7} 105 Z`} className="mxa-marker mxa-marker--reference" />
      <text x={x(connectorPeak)} y="158" textAnchor="middle" className="mxa-label mxa-label--reference">peak {fmt(connectorPeak)}</text>
      <text x="70" y="194" className="mxa-axis-label">After input attenuator / preamp · mixer plan</text>
      <line x1="70" x2="690" y1="232" y2="232" className="mxa-axis" />
      <line x1={x(-12)} x2={x(-12)} y1="188" y2="250" className="mxa-reference" strokeDasharray="4 5" />
      <text x={x(-12) - 7} y="208" textAnchor="end" className="mxa-label mxa-label--reference">−12 conservative check</text>
      <circle cx={x(mixerAverage)} cy="232" r="7" className={allowed ? 'mxa-marker mxa-marker--active' : 'mxa-marker mxa-marker--warning'} />
      <text x={x(mixerAverage)} y="274" textAnchor="middle" className={allowed ? 'mxa-label mxa-label--active' : 'mxa-label mxa-label--warning'}>mixer {fmt(mixerAverage)} dBm</text>
    </svg>
  );
}

function SpectrumPlot({ trace, centerHz, spanHz, markerHz, titleId }: {
  trace: readonly SpectrumPoint[]; centerHz: number; spanHz: number; markerHz?: number; titleId: string;
}) {
  const minDbm = -130;
  const maxDbm = 10;
  const x = (frequency: number) => 68 + ((frequency - (centerHz - spanHz / 2)) / Math.max(1, spanHz)) * 638;
  const y = (power: number) => 32 + ((maxDbm - Math.max(minDbm, Math.min(maxDbm, power))) / (maxDbm - minDbm)) * 260;
  const path = trace.map((point, index) => `${index ? 'L' : 'M'}${x(point.frequencyHz).toFixed(2)},${y(point.powerDbm).toFixed(2)}`).join(' ');
  const nearest = markerHz === undefined || trace.length === 0 ? undefined : trace.reduce((best, point) => Math.abs(point.frequencyHz - markerHz) < Math.abs(best.frequencyHz - markerHz) ? point : best, trace[0]!);
  return (
    <svg viewBox="0 0 760 350" role="img" aria-labelledby={`${titleId}-title ${titleId}-desc`}>
      <title id={`${titleId}-title`}>N9020B spectrum trace</title>
      <desc id={`${titleId}-desc`}>Center {fmt(centerHz / 1e9, 3)} GHz, span {fmt(spanHz / 1e6, 0)} MHz의 deterministic educational trace입니다.</desc>
      <rect width="760" height="350" className="mxa-plot-bg" />
      {[-120, -90, -60, -30, 0].map((tick) => <g key={tick}><line x1="68" x2="706" y1={y(tick)} y2={y(tick)} className="mxa-grid" /><text x="58" y={y(tick) + 4} textAnchor="end" className="mxa-axis-label">{tick}</text></g>)}
      {[-0.5, -0.25, 0, 0.25, 0.5].map((ratio) => <g key={ratio}><line x1={68 + (ratio + 0.5) * 638} x2={68 + (ratio + 0.5) * 638} y1="32" y2="292" className="mxa-grid" /><text x={68 + (ratio + 0.5) * 638} y="320" textAnchor="middle" className="mxa-axis-label">{fmt((centerHz + ratio * spanHz) / 1e9, 3)}</text></g>)}
      <path d={path} className="mxa-trace" fill="none" />
      {nearest && <g><line x1={x(nearest.frequencyHz)} x2={x(nearest.frequencyHz)} y1="32" y2="292" className="mxa-marker-line" strokeDasharray="5 4" /><circle cx={x(nearest.frequencyHz)} cy={y(nearest.powerDbm)} r="6" className="mxa-marker mxa-marker--reference" /><text x={Math.min(680, x(nearest.frequencyHz) + 8)} y={Math.max(24, y(nearest.powerDbm) - 10)} className="mxa-label mxa-label--reference">M1 {fmt(nearest.powerDbm)} dBm</text></g>}
      <text x="388" y="344" textAnchor="middle" className="mxa-axis-label">Frequency · GHz</text>
      <text transform="translate(18 166) rotate(-90)" textAnchor="middle" className="mxa-axis-label">Power level · dBm</text>
    </svg>
  );
}

function IqLinkedView({ bandwidthMhz, sampleRateMsa, durationUs, pretriggerPercent }: {
  bandwidthMhz: number; sampleRateMsa: number; durationUs: number; pretriggerPercent: number;
}) {
  const gateX = 70 + (pretriggerPercent / 100) * 620;
  return (
    <svg viewBox="0 0 760 390" role="img" aria-labelledby="mxa-iq-title mxa-iq-desc">
      <title id="mxa-iq-title">IQ acquisition의 time, IQ plane과 spectrum linked views</title>
      <desc id="mxa-iq-desc">Analysis bandwidth {fmt(bandwidthMhz, 0)} MHz, sample rate {fmt(sampleRateMsa, 0)} mega samples per second, duration {fmt(durationUs, 1)} microseconds입니다.</desc>
      <rect width="760" height="390" className="mxa-plot-bg" />
      <text x="70" y="30" className="mxa-label mxa-label--active">TIME · complex samples</text>
      <line x1="70" x2="690" y1="116" y2="116" className="mxa-axis" />
      <path d="M70 116 C100 52 130 180 160 116 S220 52 250 116 S310 180 340 116 S400 52 430 116 S490 180 520 116 S580 52 610 116 S660 180 690 116" className="mxa-trace" fill="none" />
      <line x1={gateX} x2={gateX} y1="42" y2="150" className="mxa-marker-line" strokeDasharray="6 4" />
      <text x={gateX + 7} y="54" className="mxa-label mxa-label--reference">trigger 0</text>
      <text x="70" y="174" className="mxa-axis-label">pretrigger {fmt(pretriggerPercent, 0)}% · record {fmt(durationUs, 1)} µs</text>
      <text x="70" y="214" className="mxa-label mxa-label--reference">IQ PLANE · phase is angle</text>
      <circle cx="220" cy="298" r="70" className="mxa-iq-circle" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => { const rad = deg * Math.PI / 180; return <circle key={deg} cx={220 + Math.cos(rad) * 52} cy={298 + Math.sin(rad) * 52} r="5" className="mxa-marker mxa-marker--active" />; })}
      <line x1="220" x2="272" y1="298" y2="246" className="mxa-reference" />
      <text x="280" y="244" className="mxa-label mxa-label--reference">|IQ| ∠φ</text>
      <text x="410" y="214" className="mxa-label mxa-label--active">CAPTURE FILTER</text>
      <rect x="410" y="246" width="280" height="96" className="mxa-iq-band" />
      <line x1="550" x2="550" y1="238" y2="352" className="mxa-axis" />
      <text x="550" y="372" textAnchor="middle" className="mxa-axis-label">0 Hz complex baseband</text>
      <text x="420" y="292" className="mxa-label mxa-label--active">{fmt(bandwidthMhz, 0)} MHz analysis BW</text>
      <text x="420" y="320" className="mxa-axis-label">Fs = {fmt(sampleRateMsa, 0)} MSa/s</text>
    </svg>
  );
}

function ScpiEntry({ session, onSession }: { session: N9020bSession; onSession: (next: N9020bSession) => void }) {
  const interaction = useLabControlInteraction();
  const [command, setCommand] = useState('*IDN?');
  const execute = (kind: 'write' | 'query' | 'read') => {
    interaction('mxa-scpi-command');
    if (kind === 'read') onSession(readN9020bScpi(session).session);
    else onSession(kind === 'query' ? queryN9020bScpi(session, command) : writeN9020bScpi(session, command));
  };
  const isQuery = command.trim().split(/\s+/, 1)[0]?.endsWith('?') ?? false;
  return <div className="mxa-console-entry control-field"><label htmlFor="mxa-scpi-command">SCPI program message</label><input id="mxa-scpi-command" value={command} onChange={(event) => setCommand(event.currentTarget.value)} spellCheck={false} /><div><button type="button" className="lab-button lab-button--primary" onClick={() => execute('write')}>WRITE</button><button type="button" className="lab-button lab-button--secondary" onClick={() => execute('query')} disabled={!isQuery}>QUERY</button><button type="button" className="lab-button lab-button--secondary" onClick={() => execute('read')}>READ queue</button></div><p>한 줄에 한 command. Query response와 error record는 다른 FIFO입니다.</p></div>;
}

function SessionView({ session }: { session: N9020bSession }) {
  return <div className="mxa-console"><div className="mxa-console-status"><span>MODE <strong>{session.state.mode}</strong></span><span>ACQ <strong>{session.state.acquisitionPending ? 'WAIT TRIGGER' : 'IDLE'}</strong></span><span>TRACE <strong>{session.state.traceFresh ? 'FRESH' : 'STALE'}</strong></span><span>OUT Q <strong>{session.outputQueue.length}</strong></span><span>ERR Q <strong>{session.errorQueue.length}</strong></span></div><ol aria-live="polite">{session.transcript.slice(-9).map((entry) => <li key={entry.index} data-outcome={entry.outcome}><span>{entry.outcome === 'error' ? 'error' : entry.outcome === 'would-time-out' ? 'timeout' : entry.direction}</span><code>{entry.outcome === 'error' ? `${entry.message} · ${entry.error?.code}, "${entry.error?.message}"` : entry.message}</code></li>)}</ol></div>;
}

const stageMap: SignalStageMap = {
  'dut-output': ['dut', 'acquisition'], 'path-attenuation': ['dut', 'acquisition'], 'input-attenuation': ['acquisition'], preamp: ['acquisition'],
  span: ['acquisition', 'dsp', 'display'], rbw: ['dsp', 'display'], vbw: ['dsp', 'display'], detector: ['dsp', 'display'],
  'analysis-bandwidth': ['acquisition', 'dsp'], 'record-length': ['acquisition', 'dsp', 'display'], pretrigger: ['acquisition', 'display'],
  'mxa-scpi-command': ['acquisition', 'dsp', 'display'], 'channel-power': ['source', 'dut', 'acquisition', 'dsp', 'display'], aclr: ['dut', 'dsp', 'display'],
};

export default function MxaInstrumentLab({ scenario }: Props) {
  const [dutAverageDbm, setDutAverageDbm] = useState(40);
  const [paprDb, setPaprDb] = useState(8);
  const [pathAttenuationDb, setPathAttenuationDb] = useState(40);
  const [inputAttenuationDb, setInputAttenuationDb] = useState(30);
  const [preamp, setPreamp] = useState(false);
  const [guardDb, setGuardDb] = useState(2);
  const [spanMhz, setSpanMhz] = useState(300);
  const [rbwKhz, setRbwKhz] = useState(100);
  const [vbwKhz, setVbwKhz] = useState(300);
  const [detector, setDetector] = useState<N9020bDetector>('NORM');
  const [analysisBandwidthMhz, setAnalysisBandwidthMhz] = useState(100);
  const [recordLength, setRecordLength] = useState(131072);
  const [pretriggerPercent, setPretriggerPercent] = useState(20);
  const [session, setSession] = useState<N9020bSession>(() => createN9020bSession());
  const [channelPowerDbm, setChannelPowerDbm] = useState(-10);
  const [modelAclrDb, setModelAclrDb] = useState(45);

  let title: string;
  let question: string;
  let description: string;
  let controls: ReactNode;
  let views: ReactNode;
  let ledger: readonly LedgerEntry[];
  let prediction: PredictionSpec;
  let note: string;

  const baseTrace = useMemo(() => generateN9020bSpectrum({ centerHz: 3.5e9, spanHz: spanMhz * 1e6, channelBandwidthHz: 100e6, channelPowerDbm, aclrDb: modelAclrDb, rbwHz: rbwKhz * 1e3, vbwHz: vbwKhz * 1e3, detector, points: 1001 }), [spanMhz, channelPowerDbm, modelAclrDb, rbwKhz, vbwKhz, detector]);

  if (scenario === 'mxa-safe-input') {
    const preampGainDb = preamp ? n9020bPreampMaxGainDb(3.5e9) : 0;
    const decision = evaluateN9020bInputSafety({ dutOutputAverageDbm: dutAverageDbm, dutOutputPeakDbm: dutAverageDbm + paprDb, pathGainDb: -pathAttenuationDb, uncertaintyDb: 0.5, guardMarginDb: guardDb, pulseWidthSeconds: 100e-6, dutyCyclePercent: 20, dcVolts: 0, acCoupled: true, inputAttenuationDb, preampGainDb });
    title = 'MXA 입력 level plan';
    question = 'PA 출력이 connector에서는 안전해도 mixer와 ADC를 overload할 수 있는가?';
    description = 'DUT plane, 외부 path, analyzer connector, input attenuator, preamp와 mixer를 서로 다른 기준면으로 계산합니다.';
    controls = <><RangeControl id="dut-output" label="DUT average output" min={0} max={48} step={1} value={dutAverageDbm} valueText={`${fmt(dutAverageDbm)} dBm`} onChange={(event) => setDutAverageDbm(Number(event.currentTarget.value))} /><RangeControl id="papr" label="Waveform PAPR" min={0} max={12} step={0.5} value={paprDb} valueText={`${fmt(paprDb)} dB`} onChange={(event) => setPaprDb(Number(event.currentTarget.value))} /><RangeControl id="path-attenuation" label="External path attenuation" min={10} max={70} step={1} value={pathAttenuationDb} valueText={`${fmt(pathAttenuationDb)} dB`} onChange={(event) => setPathAttenuationDb(Number(event.currentTarget.value))} help="Coupler, pad와 cable loss의 합입니다." /><RangeControl id="input-attenuation" label="MXA input attenuation" min={0} max={70} step={2} value={inputAttenuationDb} valueText={`${fmt(inputAttenuationDb, 0)} dB`} onChange={(event) => setInputAttenuationDb(Number(event.currentTarget.value))} /><SelectControl id="preamp" label="P26 preamp" value={preamp ? 'ON' : 'OFF'} onChange={(event) => setPreamp(event.currentTarget.value === 'ON')}><option>OFF</option><option>ON</option></SelectControl><RangeControl id="guard" label="Bench guard" min={0} max={10} step={1} value={guardDb} valueText={`${fmt(guardDb, 0)} dB`} onChange={(event) => setGuardDb(Number(event.currentTarget.value))} /></>;
    views = <><PlotFrame title={decision.allowed ? 'Connector와 internal level gate를 통과했습니다' : '연결 또는 acquisition을 차단해야 합니다'} observation="Reference level은 화면 눈금이며 damage protector가 아닙니다." table={<DataTable caption="입력 안전 수치" rows={[{ metric: 'DUT Pavg / PEP', value: `${fmt(dutAverageDbm)} / ${fmt(dutAverageDbm + paprDb)} dBm`, meaning: 'PA output plane' }, { metric: 'Connector worst case', value: `${fmt(decision.worstCaseAverageDbm)} / ${fmt(decision.worstCasePeakDbm)} dBm`, meaning: 'Path + uncertainty + guard 포함' }, { metric: 'Average damage', value: `+${N9020B_DAMAGE_AVERAGE_DBM} dBm`, meaning: '정상 운용 목표가 아닌 damage level' }, { metric: 'Conditional pulse', value: `+${N9020B_DAMAGE_PULSE_DBM} dBm`, meaning: '≤10 µs, ≤1%, attenuation ≥30 dB만' }, { metric: 'Mixer average / peak', value: `${fmt(decision.mixerAverageDbm)} / ${fmt(decision.mixerPeakDbm)} dBm`, meaning: `Connector − input attenuation + P26 max nominal ${fmt(preampGainDb, 0)} dB` }, { metric: 'Wideband ADC check', value: `${N9020B_WIDEBAND_ADC_FULL_SCALE_DBM} dBm assumption`, meaning: decision.reasons.join('; ') || 'Band 0 · low IF gain 교육 가정 안; 실제 overload status 확인' }]} />}><SafetyAxis connectorAverage={decision.worstCaseAverageDbm} connectorPeak={decision.worstCasePeakDbm} mixerAverage={decision.mixerAverageDbm} allowed={decision.allowed} /></PlotFrame><PlotFrame title="한 knob가 어느 기준면에 작용하는지 확인합니다" observation="외부 attenuation은 connector 앞, input attenuation은 connector 뒤입니다."><MxaPath active={['PLANE', 'ATTEN', 'MIXER', 'ADC']} /><Readouts items={[{ label: 'Connector avg headroom', value: `${fmt(decision.averageHeadroomDb)} dB`, tone: decision.averageHeadroomDb > 0 ? 'active' : 'warning' }, { label: 'Mixer conservative headroom', value: `${fmt(decision.mixerHeadroomDb)} dB`, tone: decision.mixerHeadroomDb > 0 ? 'active' : 'warning' }, { label: 'Preamp', value: preamp ? `ON · max nominal ${fmt(preampGainDb, 0)} dB` : 'OFF', tone: preamp ? 'warning' : 'active' }, { label: 'Safety gate', value: decision.allowed ? 'PASS' : 'BLOCK', tone: decision.allowed ? 'active' : 'warning' }]} /></PlotFrame></>;
    ledger = [{ label: '변경', value: `DUT ${fmt(dutAverageDbm)} dBm average · 외부 ${fmt(pathAttenuationDb)} dB · 내부 ${fmt(inputAttenuationDb)} dB`, tone: 'active' }, { label: '직접 효과', value: `Connector worst case ${fmt(decision.worstCaseAverageDbm)} dBm, mixer average ${fmt(decision.mixerAverageDbm)} dBm입니다.` }, { label: '화면 결과', value: decision.allowed ? 'Damage와 ADC 경계 안에서 trace를 시작할 수 있습니다.' : `Safety gate BLOCK · ${decision.reasons.join('; ')}`, tone: decision.allowed ? 'neutral' : 'warning' }, { label: '비용·한계', value: '화면 밖 강한 신호, attenuator pulse rating, DC와 잘못 연결한 coupler는 software가 막지 못합니다.', tone: 'warning' }];
    prediction = { id: 'mxa-attenuation-plane', prompt: '외부 pad는 그대로 두고 MXA input attenuation만 10 dB 늘리면?', options: ['Connector power는 같고 mixer level만 10 dB 낮아짐', 'Connector와 mixer가 모두 10 dB 낮아짐', 'DUT Pout이 10 dB 낮아짐'], correctIndex: 0, explanation: 'Internal attenuator는 analyzer connector 뒤에 있어 connector damage level을 바꾸지 않고 downstream level만 낮춥니다.' };
    note = '고전력 연결은 물리적 coupler/pad/DC block과 power rating을 먼저 확인하고 preamp OFF, 높은 attenuation에서 시작하세요.';
  } else if (scenario === 'mxa-sweep-rbw') {
    const sweepTime = estimateSweepTimeSeconds(spanMhz * 1e6, rbwKhz * 1e3, 1001, vbwKhz * 1e3);
    const noiseFloor = -154 + 10 * Math.log10(rbwKhz * 1e3) + (detector === 'POS' ? 2.5 : detector === 'AVER' ? -1.2 : 0);
    title = 'Swept spectrum signal path'; question = '같은 입력인데 RBW·VBW·detector가 trace를 왜 다르게 만드는가?'; description = 'LO sweep/FFT acquisition, resolution filter, detector와 video smoothing을 한 trace에 연결합니다.';
    controls = <><RangeControl id="span" label="Frequency span" min={100} max={800} step={50} value={spanMhz} valueText={`${fmt(spanMhz, 0)} MHz`} onChange={(event) => setSpanMhz(Number(event.currentTarget.value))} /><RangeControl id="rbw" label="Resolution bandwidth" min={10} max={1000} step={10} value={rbwKhz} valueText={`${fmt(rbwKhz, 0)} kHz`} onChange={(event) => setRbwKhz(Number(event.currentTarget.value))} /><RangeControl id="vbw" label="Video bandwidth" min={10} max={1000} step={10} value={vbwKhz} valueText={`${fmt(vbwKhz, 0)} kHz`} onChange={(event) => setVbwKhz(Number(event.currentTarget.value))} /><SelectControl id="detector" label="Trace detector" value={detector} onChange={(event) => setDetector(event.currentTarget.value as N9020bDetector)}><option value="NORM">NORMAL</option><option value="POS">POSITIVE PEAK</option><option value="SAMP">SAMPLE</option><option value="AVER">AVERAGE</option></SelectControl></>;
    views = <><PlotFrame title="Spectrum trace는 RF 자체가 아니라 설정된 measurement 결과입니다" observation={`RBW noise estimate ${fmt(noiseFloor)} dBm · auto sweep 약 ${fmt(sweepTime * 1e3, 2)} ms`} table={<DataTable caption="Sweep 핵심 설정" rows={[{ metric: 'Center / span', value: `3.500 GHz / ${fmt(spanMhz, 0)} MHz`, meaning: '관찰 frequency range' }, { metric: 'RBW', value: `${fmt(rbwKhz, 0)} kHz`, meaning: '가까운 성분 분리와 noise bandwidth' }, { metric: 'VBW', value: `${fmt(vbwKhz, 0)} kHz`, meaning: 'Detection 뒤 trace smoothing' }, { metric: 'Detector', value: detector, meaning: '한 display bucket을 대표하는 방식' }, { metric: 'Sweep estimate', value: `${fmt(sweepTime * 1e3, 2)} ms`, meaning: '교육 모델; 실제 coupling은 architecture에 의존' }]} />}><SpectrumPlot trace={baseTrace} centerHz={3.5e9} spanHz={spanMhz * 1e6} markerHz={3.5e9} titleId="mxa-sweep" /><Readouts items={[{ label: 'RBW noise', value: `${fmt(noiseFloor)} dBm`, tone: 'active' }, { label: 'Trace points', value: '1001' }, { label: 'Detector', value: detector, tone: 'reference' }, { label: 'Sweep', value: `${fmt(sweepTime * 1e3, 2)} ms` }]} /></PlotFrame><PlotFrame title="SA가 spectrum trace를 만드는 순서" observation="RBW는 span을 줄이지 않고, VBW는 두 RF tone을 분리하지 않습니다."><MxaPath active={['MIXER', 'IF', 'ADC', 'RESULT']} /></PlotFrame></>;
    ledger = [{ label: '변경', value: `Span ${fmt(spanMhz, 0)} MHz · RBW ${fmt(rbwKhz, 0)} kHz · VBW ${fmt(vbwKhz, 0)} kHz · ${detector}`, tone: 'active' }, { label: '직접 효과', value: `RBW filter noise bandwidth와 detector bucket 대표값이 바뀝니다.` }, { label: '화면 결과', value: `Noise estimate ${fmt(noiseFloor)} dBm, sweep time은 약 ${fmt(sweepTime * 1e3, 2)} ms입니다.` }, { label: '비용·한계', value: '좁은 RBW는 분리와 noise를 개선하지만 acquisition 시간이 늘고 short burst를 놓칠 수 있습니다.', tone: 'warning' }];
    prediction = { id: 'mxa-rbw', prompt: 'Span과 detector를 유지하고 RBW를 100 kHz에서 10 kHz로 줄이면?', options: ['Noise power는 이상적으로 약 10 dB 낮고 sweep는 느려짐', 'Carrier frequency가 10배 낮아짐', 'VBW가 자동으로 10 MHz가 됨'], correctIndex: 0, explanation: 'White-noise power is proportional to bandwidth; narrower resolution filter also needs more acquisition/settling time.' };
    note = 'Span, analysis bandwidth와 RBW를 같은 “대역폭”으로 읽지 마세요. 각각 관찰 범위, 순간 digitizing 폭, 분해 filter 폭입니다.';
  } else if (scenario === 'mxa-iq-trigger') {
    const capture = calculateIqCapture(analysisBandwidthMhz * 1e6, recordLength, pretriggerPercent);
    title = 'IQ capture와 trigger window'; question = 'Spectrum trace와 complex IQ record는 같은 입력을 무엇이 다르게 보존하는가?'; description = 'Analysis bandwidth로 anti-alias filter와 sample rate를 정하고 record length·trigger 위치를 time/frequency linked view로 연결합니다.';
    controls = <><RangeControl id="analysis-bandwidth" label="Analysis bandwidth" min={10} max={160} step={10} value={analysisBandwidthMhz} valueText={`${fmt(analysisBandwidthMhz, 0)} MHz`} onChange={(event) => setAnalysisBandwidthMhz(Number(event.currentTarget.value))} /><SelectControl id="record-length" label="IQ record length" value={String(recordLength)} onChange={(event) => setRecordLength(Number(event.currentTarget.value))}><option value="32768">32,768 samples</option><option value="131072">131,072 samples</option><option value="524288">524,288 samples</option></SelectControl><RangeControl id="pretrigger" label="Pretrigger position" min={0} max={80} step={5} value={pretriggerPercent} valueText={`${fmt(pretriggerPercent, 0)} %`} onChange={(event) => setPretriggerPercent(Number(event.currentTarget.value))} /></>;
    views = <PlotFrame title="한 IQ record에서 time, magnitude/phase와 FFT를 다시 만들 수 있습니다" observation={`Fs ${fmt(capture.sampleRateHz / 1e6, 1)} MSa/s · duration ${fmt(capture.durationSeconds * 1e6, 1)} µs · Δf ${fmt(capture.binSpacingHz / 1e3, 3)} kHz`} table={<DataTable caption="IQ capture 핵심 수치" rows={[{ metric: 'Analysis bandwidth', value: `${fmt(analysisBandwidthMhz, 0)} MHz`, meaning: '한 번에 보존하는 complex-baseband 폭' }, { metric: 'Sample rate', value: `${fmt(capture.sampleRateHz / 1e6, 1)} MSa/s`, meaning: '교육 모델 Fs=1.25×analysis BW' }, { metric: 'Record', value: `${recordLength.toLocaleString('en-US')} complex samples`, meaning: 'I[n]+jQ[n]' }, { metric: 'Duration', value: `${fmt(capture.durationSeconds * 1e6, 2)} µs`, meaning: 'N/Fs' }, { metric: 'FFT bin spacing', value: `${fmt(capture.binSpacingHz / 1e3, 4)} kHz`, meaning: 'Fs/N; resolution bandwidth와 동일하지 않음' }, { metric: 'Pretrigger', value: `${capture.pretriggerSamples.toLocaleString('en-US')} samples`, meaning: 'Event 이전 complex history' }]} />}><IqLinkedView bandwidthMhz={analysisBandwidthMhz} sampleRateMsa={capture.sampleRateHz / 1e6} durationUs={capture.durationSeconds * 1e6} pretriggerPercent={pretriggerPercent} /></PlotFrame>;
    ledger = [{ label: '변경', value: `${fmt(analysisBandwidthMhz, 0)} MHz analysis BW · N=${recordLength.toLocaleString('en-US')} · pretrigger ${pretriggerPercent}%`, tone: 'active' }, { label: '직접 효과', value: `Fs ${fmt(capture.sampleRateHz / 1e6, 1)} MSa/s와 record duration ${fmt(capture.durationSeconds * 1e6, 2)} µs가 결정됩니다.` }, { label: '화면 결과', value: `Time waveform, IQ magnitude/phase와 ${fmt(capture.binSpacingHz / 1e3, 4)} kHz-bin FFT를 같은 samples에서 연결합니다.` }, { label: '비용·한계', value: 'Analysis BW 밖 신호는 보존되지 않고 long record는 memory·transfer·processing 시간을 늘립니다.', tone: 'warning' }];
    prediction = { id: 'mxa-record', prompt: 'Analysis bandwidth를 유지하고 record length를 4배 늘리면?', options: ['Duration은 4배, FFT bin spacing은 1/4', 'Sample rate가 4배', 'RF carrier가 1/4'], correctIndex: 0, explanation: 'Fs가 고정이면 duration=N/Fs, bin spacing=Fs/N이므로 N만 4배일 때 서로 반대로 변합니다.' };
    note = 'IQA basic subset은 raw complex acquisition을 설명합니다. 89600 VSA나 LTE/NR demod application의 command tree를 이 console과 섞지 않습니다.';
  } else if (scenario === 'mxa-scpi-measurements') {
    const stateTrace = generateN9020bSpectrum({ centerHz: session.state.centerHz, spanHz: session.state.spanHz, channelBandwidthHz: 100e6, channelPowerDbm: -10, aclrDb: 45, rbwHz: session.state.rbwHz, vbwHz: session.state.vbwHz, detector: session.state.detector, points: Math.min(session.state.sweepPoints, 1001) });
    const pendingTrigger = session.state.triggerSource === 'IMM' ? null : session.state.triggerSource;
    title = 'SA SCPI state console'; question = '설정, acquisition, marker, trace와 one-button measurement를 어떤 순서로 검증할까?'; description = '한 줄 SCPI subset에서 command/query, fresh acquisition, output/error queue와 자주 쓰는 측정 recipe를 연습합니다.';
    controls = <><ScpiEntry session={session} onSession={setSession} /><div className="mxa-recipe-buttons"><span>자주 쓰는 다음 동작</span><button type="button" className="lab-button lab-button--secondary" onClick={() => setSession(writeN9020bScpi(session, 'INIT:IMM'))}>Single acquire</button>{session.state.acquisitionPending && pendingTrigger && <button type="button" className="lab-button lab-button--secondary" onClick={() => setSession(completeN9020bTrigger(session, pendingTrigger))}>{pendingTrigger} event 주입</button>}<button type="button" className="lab-button lab-button--secondary" onClick={() => setSession(writeN9020bScpi(session, 'CALC:MARK1:MAX'))}>Marker peak</button><button type="button" className="lab-button lab-button--secondary" onClick={() => setSession(queryN9020bScpi(session, 'TRAC? TRACE1'))}>Trace query</button></div></>;
    views = <><PlotFrame title="Command 전후 analyzer state와 trace freshness를 함께 봅니다" observation="설정이 바뀌면 이전 trace는 stale입니다. INIT:IMM 뒤에 marker/data를 읽습니다." table={<DataTable caption="현재 SCPI state" rows={[{ metric: 'Mode', value: session.state.mode, meaning: 'SA / one-button application' }, { metric: 'Center / span', value: `${fmt(session.state.centerHz / 1e9, 3)} GHz / ${fmt(session.state.spanHz / 1e6, 0)} MHz`, meaning: 'Frequency state' }, { metric: 'RBW / VBW', value: `${fmt(session.state.rbwHz / 1e3, 0)} / ${fmt(session.state.vbwHz / 1e3, 0)} kHz`, meaning: 'Resolution / smoothing' }, { metric: 'Atten / preamp', value: `${fmt(session.state.attenuationDb, 0)} dB / ${session.state.preampEnabled ? 'ON' : 'OFF'}`, meaning: 'Front-end level plan' }, { metric: 'Trace', value: session.state.traceFresh ? 'FRESH' : 'STALE', meaning: 'Data query validity' }, { metric: 'Queues', value: `OUT ${session.outputQueue.length} · ERR ${session.errorQueue.length}`, meaning: 'Independent FIFO' }]} />}><SpectrumPlot trace={stateTrace} centerHz={session.state.centerHz} spanHz={session.state.spanHz} {...(session.state.markerEnabled ? { markerHz: session.state.markerHz } : {})} titleId="mxa-scpi" /></PlotFrame><PlotFrame title="SCPI transcript와 queue" observation="*OPC?는 operation 동기화이며 trace freshness나 error drain을 대신하지 않습니다."><SessionView session={session} /></PlotFrame></>;
    ledger = [{ label: '변경', value: `${session.state.mode} · center ${fmt(session.state.centerHz / 1e9, 3)} GHz · RBW ${fmt(session.state.rbwHz / 1e3, 0)} kHz`, tone: 'active' }, { label: '직접 효과', value: `Trace state ${session.state.traceFresh ? 'FRESH' : 'STALE'}, marker ${session.state.markerEnabled ? 'ON' : 'OFF'}입니다.` }, { label: '화면 결과', value: `Output queue ${session.outputQueue.length}, error queue ${session.errorQueue.length}, transcript ${session.transcript.length} entries입니다.` }, { label: '비용·한계', value: '이 parser는 한 줄 subset만 지원합니다. Full IEEE 488.2 message chaining, binary block transport와 vendor application 전체를 구현하지 않습니다.', tone: 'warning' }];
    prediction = { id: 'mxa-fresh-trace', prompt: 'Center frequency를 바꾼 직후 INIT 없이 TRAC1:DATA?를 읽으면?', options: ['이전/유효하지 않은 상태이므로 fresh acquisition이 필요', '자동으로 DUT frequency가 바뀜', '*CLS와 같은 효과'], correctIndex: 0, explanation: 'Configuration change와 acquisition/data retrieval은 다른 상태입니다. Query-back 후 single acquire와 completion을 기다려야 합니다.' };
    note = '실장비에서는 *IDN?/*OPT? 확인, high attenuation·preamp OFF, continuous OFF/ABOR, configure/query-back, INIT:IMM;*OPC?, data, bounded error drain 순서를 사용하세요.';
  } else {
    const paTrace = baseTrace;
    const aclr = calculateAclrDb(paTrace, 3.5e9, 100e6, rbwKhz * 1e3);
    const obw = calculateOccupiedBandwidth(paTrace, 99);
    title = 'PA spectrum result map'; question = 'PA compression과 analyzer overload를 어떤 재측정으로 구분할까?'; description = 'Channel power, OBW, ACLR, harmonic·spur와 입력 level plan을 하나의 DUT-plane result map에 연결합니다.';
    controls = <><RangeControl id="channel-power" label="DUT channel power model" min={-20} max={10} step={1} value={channelPowerDbm} valueText={`${fmt(channelPowerDbm)} dBm at MXA`} onChange={(event) => setChannelPowerDbm(Number(event.currentTarget.value))} /><RangeControl id="aclr" label="DUT ACLR model" min={25} max={60} step={1} value={modelAclrDb} valueText={`${fmt(modelAclrDb, 0)} dB`} onChange={(event) => setModelAclrDb(Number(event.currentTarget.value))} /><RangeControl id="rbw" label="Measurement RBW" min={10} max={1000} step={10} value={rbwKhz} valueText={`${fmt(rbwKhz, 0)} kHz`} onChange={(event) => setRbwKhz(Number(event.currentTarget.value))} /></>;
    views = <><PlotFrame title="PA spectrum 결과는 같은 reference plane·bandwidth 조건에서 비교합니다" observation="Input attenuation을 늘려도 DUT-plane result가 유지되면 analyzer linearity가 더 신뢰됩니다." table={<DataTable caption="PA spectrum 핵심 결과" rows={[{ metric: 'Channel power', value: `${fmt(channelPowerDbm)} dBm at MXA`, meaning: 'Path correction 전 analyzer plane model' }, { metric: 'OBW 99%', value: `${fmt(obw / 1e6, 2)} MHz`, meaning: '누적 integrated power 기준' }, { metric: 'Lower / upper ACLR', value: `${fmt(aclr.lowerDb, 2)} / ${fmt(aclr.upperDb, 2)} dB`, meaning: 'Main integrated power − adjacent integrated power' }, { metric: 'Harmonics', value: 'Center at 2f0, 3f0', meaning: 'Span 확대보다 각각 narrow span/RBW 재측정' }, { metric: 'SEM / EVM', value: 'Application-dependent', meaning: 'Spectrum trace만으로 EVM을 얻지 않음' }, { metric: 'Overload cross-check', value: '+10 dB input attenuation', meaning: 'Corrected result가 같아야 analyzer linearity 신뢰' }]} />}><SpectrumPlot trace={paTrace} centerHz={3.5e9} spanHz={spanMhz * 1e6} markerHz={3.5e9} titleId="mxa-pa" /></PlotFrame><PlotFrame title="PA KPI마다 필요한 acquisition을 나눕니다" observation="SA가 PAE를 직접 측정하지 않습니다."><table className="mxa-dependency"><caption>PA test result ownership</caption><thead><tr><th>결과</th><th>MXA 역할</th><th>추가 장비·조건</th></tr></thead><tbody><tr><td>Channel power·OBW</td><td>Integrated spectrum</td><td>Path correction·uncertainty</td></tr><tr><td>ACLR·SEM</td><td>Adjacent/mask application</td><td>Waveform standard settings</td></tr><tr><td>EVM</td><td>LTE/NR or VSA demod app</td><td>Reference signal·sync</td></tr><tr><td>Gain·PAE</td><td>Output spectrum context</td><td>SG/sensors/PSU 동시 data</td></tr></tbody></table></PlotFrame></>;
    ledger = [{ label: '변경', value: `MXA plane channel ${fmt(channelPowerDbm)} dBm · modeled ACLR ${fmt(modelAclrDb, 0)} dB · RBW ${fmt(rbwKhz, 0)} kHz`, tone: 'active' }, { label: '직접 효과', value: `Main/adjacent bands를 linear power로 적분하고 99% cumulative width를 찾습니다.` }, { label: '화면 결과', value: `OBW ${fmt(obw / 1e6, 2)} MHz · ACLR L/R ${fmt(aclr.lowerDb, 2)}/${fmt(aclr.upperDb, 2)} dB입니다.` }, { label: '비용·한계', value: 'Path correction, analyzer noise/linearity, application settings와 uncertainty가 없으면 compliance 결과가 아닙니다.', tone: 'warning' }];
    prediction = { id: 'mxa-overload-check', prompt: 'MXA input attenuation을 10 dB 늘리고 path-corrected ACLR이 크게 좋아지면?', options: ['기존 결과에 analyzer compression/overload 가능성', 'DUT가 자동으로 linear해짐', 'Carrier sample rate가 10배'], correctIndex: 0, explanation: 'DUT는 그대로인데 analyzer level만 낮춰 결과가 변하면 measurement path의 nonlinearity를 의심해야 합니다.' };
    note = 'PA compression 판정은 SG drive, DUT-plane Pin/Pout, bias/temperature와 MXA overload cross-check를 같은 sweep point에 저장해야 합니다.';
  }

  return <LabShell labId={`instrument:sa:${scenario}`} title={title} question={question} description={description} activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']} stageMap={stageMap} controls={controls} ledger={ledger} prediction={prediction} note={note}>{views}</LabShell>;
}
