import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { LabShell } from '../lab/LabShell';
import { NumberControl, RangeControl, SelectControl } from '../lab/ControlField';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import { PlotFrame } from '../plots/PlotFrame';
import type { LedgerEntry, PredictionSpec, SignalStageMap } from '../lab/types';
import {
  createN5182bSession,
  evaluatePaPowerBudget,
  getN5182bArbSampleRateMaxHz,
  n5182bSafeCwPreview,
  queryN5182bScpi,
  readN5182bScpi,
  writeN5182bScpi,
} from '@/lib/instruments';
import type { MxgSession, PaSafetyDecision } from '@/types/instruments';
import { dbm, decibels } from '@/types/units';
import './mxg.css';

export type MxgScenarioId =
  | 'mxg-safe-cw'
  | 'mxg-waveform-iq'
  | 'mxg-arb-playback'
  | 'mxg-scpi-pyvisa'
  | 'mxg-pa-test-program';

interface Props {
  scenario: MxgScenarioId;
}

const format = (value: number, digits = 1) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const MXG_BASELINE_OPTIONS = ['506', '656'] as const;
const MXG_BASELINE_SAMPLE_RATE_MAX_MHZ = (
  getN5182bArbSampleRateMaxHz(MXG_BASELINE_OPTIONS) ?? 0
) / 1e6;
const SAFE_CW_SCPI_PREVIEW = n5182bSafeCwPreview.map(({ message }) => message).join('\n');
const IQ_DEMO_SAMPLES = Array.from({ length: 96 }, (_, index) => {
  const t = index / 96;
  const envelope = 0.48 + 0.35 * Math.cos(2 * Math.PI * 3 * t) + 0.14 * Math.cos(2 * Math.PI * 11 * t);
  const phase = 2 * Math.PI * (7 * t + 0.12 * Math.sin(2 * Math.PI * 2 * t));
  return { i: envelope * Math.cos(phase), q: envelope * Math.sin(phase) };
});

function getIqDemoMetrics(sampleRateMhz: number) {
  const peak = Math.max(...IQ_DEMO_SAMPLES.map((sample) => sample.i ** 2 + sample.q ** 2));
  const average = IQ_DEMO_SAMPLES.reduce(
    (sum, sample) => sum + sample.i ** 2 + sample.q ** 2,
    0,
  ) / IQ_DEMO_SAMPLES.length;
  return {
    sampleCount: IQ_DEMO_SAMPLES.length,
    durationUs: IQ_DEMO_SAMPLES.length / sampleRateMhz,
    binKhz: sampleRateMhz * 1000 / IQ_DEMO_SAMPLES.length,
    paprDb: 10 * Math.log10(peak / average),
  };
}

interface DataTableRow {
  readonly metric: string;
  readonly value: string;
  readonly meaning: string;
}

function DataTable({ caption, rows }: { caption: string; rows: readonly DataTableRow[] }) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead><tr><th>항목</th><th>값</th><th>해석</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.metric}>
            <th scope="row">{row.metric}</th>
            <td>{row.value}</td>
            <td>{row.meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReadoutStrip({ items }: { items: readonly { label: string; value: string; tone?: 'active' | 'warning' }[] }) {
  return (
    <dl className="mxg-readouts">
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone ?? 'neutral'}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MxgPath({ active }: { active: readonly string[] }) {
  const stages = [
    ['STATE', 'Front panel / SCPI'],
    ['ARB', 'I/Q memory'],
    ['DAC', 'Interpolation'],
    ['IQ MOD', 'LO upconversion'],
    ['LEVEL', 'ALC / attenuator'],
    ['RF OUT', 'DUT 기준면'],
  ] as const;
  return (
    <ol className="mxg-path" aria-label="N5182B 내부 신호 경로">
      {stages.map(([id, label]) => (
        <li key={id} className={active.includes(id) ? 'is-active' : undefined}>
          <strong>{id}</strong>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function CwSpectrum({ frequencyGhz, powerDbm }: { frequencyGhz: number; powerDbm: number }) {
  const width = 760;
  const height = 260;
  const x = 72 + (frequencyGhz / 6) * 620;
  const y = 210 - ((powerDbm + 60) / 80) * 160;
  const harmonicFrequencyGhz = frequencyGhz * 2;
  const harmonicInSpan = harmonicFrequencyGhz <= 6;
  const harmonicX = 72 + (harmonicFrequencyGhz / 6) * 620;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="cw-spectrum-title cw-spectrum-desc">
      <title id="cw-spectrum-title">CW 출력 spectrum</title>
      <desc id="cw-spectrum-desc">
        현재 carrier는 {format(frequencyGhz, 3)} GHz, 평균 전력은 {format(powerDbm)} dBm입니다.{' '}
        {harmonicInSpan
          ? `두 번째 harmonic ${format(harmonicFrequencyGhz, 3)} GHz는 교육용 상대값으로 표시합니다.`
          : `두 번째 harmonic ${format(harmonicFrequencyGhz, 3)} GHz는 0–6 GHz 표시 범위 밖입니다.`}
      </desc>
      <rect width={width} height={height} fill="var(--color-instrument)" />
      {[0, 1, 2, 3, 4].map((index) => (
        <line key={index} x1="72" x2="700" y1={42 + index * 42} y2={42 + index * 42} className="mxg-grid" />
      ))}
      <line x1="72" x2="700" y1="210" y2="210" className="mxg-axis" />
      <line x1="72" x2="72" y1="28" y2="210" className="mxg-axis" />
      <line x1={x} x2={x} y1={Math.max(28, y)} y2="210" className="mxg-trace mxg-trace--forward" />
      <circle cx={x} cy={Math.max(28, y)} r="5" className="mxg-marker mxg-marker--forward" />
      <text x={Math.min(620, x + 10)} y={Math.max(28, y) + 4} className="mxg-label mxg-label--forward">Carrier {format(powerDbm)} dBm</text>
      {harmonicInSpan ? (
        <>
          <line x1={harmonicX} x2={harmonicX} y1={Math.min(190, Math.max(78, y + 76))} y2="210" className="mxg-trace mxg-trace--reference" strokeDasharray="6 5" />
          <text x={Math.min(600, harmonicX + 8)} y={Math.min(184, Math.max(72, y + 70))} className="mxg-label mxg-label--reference">2f · relative</text>
        </>
      ) : (
        <text x="690" y="32" textAnchor="end" className="mxg-label mxg-label--reference">
          2f {format(harmonicFrequencyGhz, 3)} GHz · span 밖
        </text>
      )}
      <text x="386" y="247" textAnchor="middle" className="mxg-axis-label">RF frequency · 0–6 GHz</text>
      <text transform="translate(18 125) rotate(-90)" textAnchor="middle" className="mxg-axis-label">Power · dBm</text>
    </svg>
  );
}

function IqLinkedView({ sampleRateMhz, runtimeScale, carrierGhz }: { sampleRateMhz: number; runtimeScale: number; carrierGhz: number }) {
  const samples = IQ_DEMO_SAMPLES;
  const { durationUs, binKhz, paprDb } = getIqDemoMetrics(sampleRateMhz);
  const scale = runtimeScale / 100;
  const point = (sample: { i: number; q: number }, index: number, key: 'i' | 'q') => {
    const x = 54 + index * (652 / (samples.length - 1));
    const y = 92 - sample[key] * scale * 52;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const iPoints = samples.map((sample, index) => point(sample, index, 'i')).join(' ');
  const qPoints = samples.map((sample, index) => point(sample, index, 'q')).join(' ');
  const constellation = samples.filter((_, index) => index % 5 === 0);
  return (
    <div className="mxg-linked">
      <svg viewBox="0 0 760 190" role="img" aria-labelledby="iq-time-title iq-time-desc">
        <title id="iq-time-title">I와 Q sample의 시간 파형</title>
        <desc id="iq-time-desc">96개 sample을 {format(sampleRateMhz, 0)} MSa/s로 재생해 record 길이는 {format(durationUs, 3)} microsecond입니다.</desc>
        <rect width="760" height="190" fill="var(--color-instrument)" />
        <line x1="54" x2="706" y1="92" y2="92" className="mxg-axis" />
        <polyline points={iPoints} className="mxg-trace mxg-trace--forward" fill="none" />
        <polyline points={qPoints} className="mxg-trace mxg-trace--secondary" fill="none" strokeDasharray="7 4" />
        <text x="694" y="38" textAnchor="end" className="mxg-label mxg-label--forward">I[n] solid</text>
        <text x="694" y="58" textAnchor="end" className="mxg-label mxg-label--secondary">Q[n] dashed</text>
        <text x="380" y="179" textAnchor="middle" className="mxg-axis-label">Time · 0–{format(durationUs, 3)} µs</text>
        <text x="18" y="96" className="mxg-axis-label">0</text>
      </svg>
      <div className="mxg-linked__lower">
        <svg viewBox="0 0 340 270" role="img" aria-labelledby="iq-plane-title iq-plane-desc">
          <title id="iq-plane-title">IQ complex plane</title>
          <desc id="iq-plane-desc">같은 sample의 I와 Q 좌표입니다. runtime scaling은 반지름을 바꾸지만 sample rate는 좌표 자체를 바꾸지 않습니다.</desc>
          <rect width="340" height="270" fill="var(--color-instrument)" />
          <line x1="34" x2="306" y1="135" y2="135" className="mxg-axis" />
          <line x1="170" x2="170" y1="18" y2="252" className="mxg-axis" />
          {constellation.map((sample, index) => (
            <circle key={index} cx={170 + sample.i * scale * 112} cy={135 - sample.q * scale * 102} r="3.5" className="mxg-marker mxg-marker--forward" />
          ))}
          <text x="300" y="130" className="mxg-axis-label">I</text>
          <text x="178" y="28" className="mxg-axis-label">Q</text>
        </svg>
        <div className="mxg-data-panel">
          <p>같은 sample, 다른 기준</p>
          <dl>
            <div><dt>Carrier</dt><dd>{format(carrierGhz, 3)} GHz</dd></div>
            <div><dt>Sample rate</dt><dd>{format(sampleRateMhz, 0)} MSa/s</dd></div>
            <div><dt>Record</dt><dd>{format(durationUs, 3)} µs</dd></div>
            <div><dt>FFT bin</dt><dd>{format(binKhz, 1)} kHz</dd></div>
            <div><dt>Runtime scale</dt><dd>{format(runtimeScale, 0)} %</dd></div>
            <div><dt>PAPR</dt><dd>{format(paprDb, 2)} dB</dd></div>
          </dl>
          <p className="mxg-data-panel__note">Carrier는 RF 위치, sample rate는 시간·baseband 폭, scaling은 DAC headroom을 바꿉니다.</p>
        </div>
      </div>
    </div>
  );
}

function ArbTimeline({ waveform, trigger, loops, markerIndex }: {
  waveform: string;
  trigger: string;
  loops: number;
  markerIndex: number;
}) {
  const segments = Array.from({ length: Math.min(loops, 4) }, (_, index) => index);
  const waveformLabel = {
    'Single-tone': 'WFM1:SINGLE_TONE',
    'Two-tone': 'WFM1:TWO_TONE',
    'OFDM-like': 'WFM1:OFDM_LIKE',
  }[waveform] ?? 'WFM1:PA_TEST';
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="arb-timeline-title arb-timeline-desc">
      <title id="arb-timeline-title">ARB waveform 재생 timeline</title>
      <desc id="arb-timeline-desc">{trigger} trigger 뒤 waveform segment를 {loops}회 반복하며 marker는 sample {markerIndex}에서 발생합니다.</desc>
      <rect width="760" height="250" fill="var(--color-instrument)" />
      <line x1="72" x2="710" y1="72" y2="72" className="mxg-axis" />
      <line x1="72" x2="72" y1="48" y2="206" className="mxg-trigger" />
      <text x="72" y="34" textAnchor="middle" className="mxg-label mxg-label--reference">{trigger} trigger</text>
      {segments.map((segment) => {
        const x = 88 + segment * 150;
        return (
          <g key={segment}>
            <rect x={x} y="92" width="132" height="74" rx="4" className="mxg-segment" />
            <text x={x + 66} y="122" textAnchor="middle" className="mxg-label mxg-label--forward">{waveformLabel}</text>
            <text x={x + 66} y="146" textAnchor="middle" className="mxg-axis-label">loop {segment + 1}</text>
            <line x1={x + 10 + (markerIndex / 1024) * 112} x2={x + 10 + (markerIndex / 1024) * 112} y1="84" y2="176" className="mxg-marker-line" />
          </g>
        );
      })}
      {loops > 4 && <text x="690" y="132" textAnchor="end" className="mxg-label mxg-label--secondary">… +{loops - 4} loops</text>}
      <text x="385" y="226" textAnchor="middle" className="mxg-axis-label">Playback time · sample clock 기준</text>
    </svg>
  );
}

function ScpiConsoleControl({ onWrite, onQuery, onRead }: {
  onWrite: (command: string) => void;
  onQuery: (command: string) => void;
  onRead: () => void;
}) {
  const reportInteraction = useLabControlInteraction();
  const [command, setCommand] = useState('*IDN?');
  const normalized = command.trim();
  function executeWrite() {
    onWrite(normalized);
    reportInteraction('scpi-command');
  }
  function executeQuery() {
    onQuery(normalized);
    reportInteraction('scpi-command');
  }
  function executeRead() {
    onRead();
    reportInteraction('scpi-command');
  }
  return (
    <div className="mxg-console-control control-field">
      <label htmlFor="mxg-scpi-command">SCPI program message</label>
      <div className="mxg-console-control__input">
        <input
          id="mxg-scpi-command"
          name="mxg-scpi-command"
          value={command}
          onChange={(event) => setCommand(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              executeWrite();
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="mxg-console-control__actions">
        <button type="button" className="lab-button lab-button--primary" onClick={executeWrite}>WRITE만</button>
        <button type="button" className="lab-button" onClick={executeQuery} disabled={!normalized.endsWith('?')}>QUERY + READ</button>
        <button type="button" className="lab-button" onClick={executeRead}>READ queue</button>
      </div>
      <p>WRITE만으로 query를 보내면 output queue에 응답이 남습니다. READ queue로 꺼내며, 새 write가 오면 unread query는 −410으로 중단됩니다.</p>
    </div>
  );
}

function CodeTabs() {
  const [tab, setTab] = useState<'scpi' | 'python'>('scpi');
  const tabRefs = useRef<Record<'scpi' | 'python', HTMLButtonElement | null>>({
    scpi: null,
    python: null,
  });
  function selectTab(next: 'scpi' | 'python') {
    setTab(next);
    requestAnimationFrame(() => tabRefs.current[next]?.focus());
  }
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectTab(tab === 'scpi' ? 'python' : 'scpi');
    }
    if (event.key === 'Home') {
      event.preventDefault();
      selectTab('scpi');
    }
    if (event.key === 'End') {
      event.preventDefault();
      selectTab('python');
    }
  }
  return (
    <section className="mxg-code" aria-label="SCPI와 Python 비교">
      <div className="mxg-code__tabs" role="tablist" aria-label="코드 형식">
        <button
          ref={(node) => { tabRefs.current.scpi = node; }}
          id="mxg-code-tab-scpi"
          type="button"
          role="tab"
          aria-controls="mxg-code-panel"
          aria-selected={tab === 'scpi'}
          tabIndex={tab === 'scpi' ? 0 : -1}
          onClick={() => setTab('scpi')}
          onKeyDown={handleKeyDown}
        >Raw SCPI</button>
        <button
          ref={(node) => { tabRefs.current.python = node; }}
          id="mxg-code-tab-python"
          type="button"
          role="tab"
          aria-controls="mxg-code-panel"
          aria-selected={tab === 'python'}
          tabIndex={tab === 'python' ? 0 : -1}
          onClick={() => setTab('python')}
          onKeyDown={handleKeyDown}
        >Python · PyVISA</button>
      </div>
      <pre id="mxg-code-panel" role="tabpanel" aria-labelledby={`mxg-code-tab-${tab}`}><code>{tab === 'scpi'
        ? SAFE_CW_SCPI_PREVIEW
        : 'from examples.mxg_pyvisa.transport import VisaTransport\nfrom examples.mxg_pyvisa.workflow import RunConfig, run_session\n\ntransport = VisaTransport.open("MXG", timeout_ms=10_000)\nrun_session(transport, RunConfig(\n    frequency_hz=3.5e9,\n    power_dbm=-30.0,\n    rf_on=False,\n))'}</code></pre>
    </section>
  );
}

function ScpiView({ session }: { session: MxgSession }) {
  const transcript = session.transcript.slice(-10).map((entry) => ({
    index: entry.index,
    direction: entry.outcome === 'error'
      ? 'error'
      : entry.direction === 'read'
        ? 'response'
        : entry.message.trim().endsWith('?')
          ? 'query'
          : 'write',
    text: entry.outcome === 'error'
      ? `${entry.message} · ${entry.error?.code ?? -113},"${entry.error?.message ?? 'Command error'}"`
      : entry.message,
  }));
  return (
    <div className="mxg-scpi-view">
      <div className="mxg-state-diff">
        <div><span>BEFORE</span><strong>RF OFF</strong><small>state unknown</small></div>
        <i aria-hidden="true">→</i>
        <div>
          <span>AFTER</span>
          <strong>{format(session.instrumentState.frequencyHz / 1e9, 3)} GHz · {format(session.instrumentState.powerDbm)} dBm</strong>
          <small>RF {session.instrumentState.rfOutputEnabled ? 'ON' : 'OFF'} · output {session.outputQueue.length} · pending {session.pendingOperations.length} · errors {session.errorQueue.length}</small>
        </div>
      </div>
      <div className="mxg-queue-strip" aria-label="SCPI queue 상태">
        <span>OUTPUT Q <strong>{session.outputQueue.length}</strong></span>
        <span>ERROR Q <strong>{session.errorQueue.length}</strong></span>
        <span>OPERATIONS <strong>{session.pendingOperations.length}</strong></span>
      </div>
      {session.pendingOperations.length > 0 && (
        <ul className="mxg-pending-operations" aria-label="완료 대기 operation">
          {session.pendingOperations.map((operation) => (
            <li key={operation.id}><span>{operation.kind}</span>{operation.description}</li>
          ))}
        </ul>
      )}
      <ol className="mxg-transcript" aria-label="SCPI transaction transcript" aria-live="polite">
        {transcript.map((entry) => (
          <li key={entry.index} data-direction={entry.direction}>
            <span>{entry.direction}</span><code>{entry.text}</code>
          </li>
        ))}
      </ol>
      <CodeTabs />
    </div>
  );
}

function createConsoleSession(): MxgSession {
  let session = createN5182bSession({ installedOptions: MXG_BASELINE_OPTIONS });
  session = writeN5182bScpi(session, 'OUTP:STAT OFF');
  session = writeN5182bScpi(session, 'SOUR:FREQ:CW 3.5GHz');
  session = writeN5182bScpi(session, 'SOUR:POW:LEV:IMM:AMPL -30dBm');
  return session;
}

function PowerBudget({ averageDbm, paprDb, pathGainDb, uncertaintyDb, marginDb, dutLimitDbm, decision }: {
  averageDbm: number;
  paprDb: number;
  pathGainDb: number;
  uncertaintyDb: number;
  marginDb: number;
  dutLimitDbm: number;
  decision: PaSafetyDecision;
}) {
  const peak = averageDbm + paprDb;
  const estimatedDutInputDbm = decision.estimatedDutInputDbm;
  const permittedDutInputDbm = decision.permittedDutInputDbm;
  const stages = [
    ['SG average', averageDbm],
    ['SG PEP', peak],
    ['DUT estimate', estimatedDutInputDbm],
    ['Permitted', permittedDutInputDbm],
  ] as const;
  return (
    <div className="mxg-power-budget">
      <div className="mxg-power-budget__status" data-allowed={decision.allowed}>
        <span>{decision.allowed ? 'SAFETY GATE · PASS' : 'SAFETY GATE · RF ON BLOCKED'}</span>
        <strong>{format(estimatedDutInputDbm)} dBm estimated · {format(permittedDutInputDbm)} dBm permitted</strong>
        <p>물리 입력 추정치와 guard를 적용한 허용 한계를 따로 비교합니다.</p>
      </div>
      <div className="mxg-power-bars" role="img" aria-label={`DUT 물리 추정 입력 ${format(estimatedDutInputDbm)} dBm, guard 적용 허용 한계 ${format(permittedDutInputDbm)} dBm`}>
        {stages.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <i style={{ '--level': `${Math.max(5, ((value + 50) / 70) * 100)}%` } as CSSProperties}></i>
            <strong>{format(value)} dBm</strong>
          </div>
        ))}
      </div>
      <dl className="mxg-power-budget__equations">
        <div>
          <dt>Physical estimate</dt>
          <dd>P<sub>DUT,est</sub> = {format(averageDbm)} + {format(paprDb)} + ({format(pathGainDb)}) + {format(uncertaintyDb)} = <strong>{format(estimatedDutInputDbm)} dBm</strong></dd>
        </div>
        <div>
          <dt>Permitted limit</dt>
          <dd>P<sub>permit</sub> = {format(dutLimitDbm)} − {format(marginDb)} guard = <strong>{format(permittedDutInputDbm)} dBm</strong></dd>
        </div>
      </dl>
    </div>
  );
}

function PaDependencyMap() {
  const rows = [
    ['Gain·P1dB·Psat', 'SG stimulus', 'Power sensor + SA'],
    ['EVM·ACLR·SEM', 'OFDM-like IQ', 'SA / VSA'],
    ['AM-AM·AM-PM', 'Power sweep', 'VSA IQ capture'],
    ['PAE', 'RF input', 'Power sensor + PSU'],
    ['Stability', 'Low-power stimulus', 'NA / VNA'],
  ];
  return (
    <table className="mxg-dependency-table">
      <caption>SG가 만드는 조건과 후속 장비가 측정하는 결과</caption>
      <thead><tr><th>시험</th><th>SG 역할</th><th>결과 장비</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

const commonStageMap: SignalStageMap = {
  frequency: ['source', 'dut', 'acquisition', 'display'],
  power: ['source', 'dut', 'acquisition', 'display'],
  carrier: ['source', 'dut', 'acquisition', 'display'],
  'path-gain': ['source', 'dut', 'acquisition', 'display'],
  'sample-rate': ['source', 'dut', 'acquisition', 'dsp', 'display'],
  'runtime-scale': ['source', 'dut', 'acquisition', 'display'],
  waveform: ['source', 'dut', 'acquisition', 'dsp', 'display'],
  trigger: ['source', 'acquisition', 'display'],
  loops: ['source', 'acquisition', 'display'],
  marker: ['source', 'acquisition', 'display'],
  'scpi-command': ['source', 'display'],
  'average-power': ['source', 'dut', 'acquisition', 'display'],
  papr: ['source', 'dut', 'acquisition', 'dsp', 'display'],
  uncertainty: ['dsp', 'display'],
  guard: ['dsp', 'display'],
  'dut-limit': ['dsp', 'display'],
};

export default function MxgInstrumentLab({ scenario }: Props) {
  const [frequencyGhz, setFrequencyGhz] = useState(3.5);
  const [powerDbm, setPowerDbm] = useState(-30);
  const [pathGainDb, setPathGainDb] = useState(-3);
  const [sampleRateMhz, setSampleRateMhz] = useState(MXG_BASELINE_SAMPLE_RATE_MAX_MHZ);
  const [runtimeScale, setRuntimeScale] = useState(70);
  const [carrierGhz, setCarrierGhz] = useState(3.5);
  const [waveform, setWaveform] = useState('OFDM-like');
  const [trigger, setTrigger] = useState('BUS');
  const [loops, setLoops] = useState(3);
  const [markerIndex, setMarkerIndex] = useState(192);
  const [scpiSession, setScpiSession] = useState<MxgSession>(createConsoleSession);
  const [averageDbm, setAverageDbm] = useState(-25);
  const [paprDb, setPaprDb] = useState(8);
  const [uncertaintyDb, setUncertaintyDb] = useState(0.7);
  const [marginDb, setMarginDb] = useState(2);
  const [dutLimitDbm, setDutLimitDbm] = useState(-10);

  const writeScpi = (command: string) => setScpiSession((current) => writeN5182bScpi(current, command));
  const queryScpi = (command: string) => setScpiSession((current) => queryN5182bScpi(current, command).session);
  const readScpi = () => setScpiSession((current) => readN5182bScpi(current).session);

  let title = '';
  let question = '';
  let description = '';
  let controls: ReactNode;
  let views: ReactNode;
  let ledger: readonly LedgerEntry[];
  let prediction: PredictionSpec;
  let note = '';

  if (scenario === 'mxg-safe-cw') {
    const dutAverage = powerDbm + pathGainDb;
    const harmonicFrequencyGhz = frequencyGhz * 2;
    title = 'MXG safe CW bench';
    question = 'RF ON 전에 어떤 값을 확인해야 DUT를 지킬 수 있을까?';
    description = 'Front panel 설정과 SCPI state가 ALC·attenuator·RF output을 지나 DUT 기준면 전력이 되는 경로를 확인합니다.';
    controls = <>
      <RangeControl id="frequency" label="CW frequency" min={0.1} max={6} step={0.1} value={frequencyGhz} valueText={`${format(frequencyGhz, 3)} GHz`} onChange={(event) => setFrequencyGhz(Number(event.currentTarget.value))} help="carrier의 RF 위치를 바꿉니다." />
      <RangeControl id="power" label="Average RF power" min={-40} max={10} step={1} value={powerDbm} valueText={`${format(powerDbm)} dBm`} onChange={(event) => setPowerDbm(Number(event.currentTarget.value))} help="DUT 기준면 path correction 전의 source 설정입니다." />
      <RangeControl id="path-gain" label="Signed path gain" min={-12} max={0} step={0.5} value={pathGainDb} valueText={`${format(pathGainDb)} dB`} onChange={(event) => setPathGainDb(Number(event.currentTarget.value))} help="cable loss는 음수로 입력합니다." />
    </>;
    views = <>
      <PlotFrame
        title="Carrier를 옮기면 peak 위치가 따라갑니다"
        observation="frequency는 가로 위치, power는 세로 높이를 바꿉니다."
        table={<DataTable caption="CW spectrum 핵심 수치" rows={[
          { metric: 'Carrier', value: `${format(frequencyGhz, 3)} GHz`, meaning: '0–6 GHz span 안의 RF 위치' },
          { metric: 'Source average', value: `${format(powerDbm)} dBm`, meaning: 'MXG RF connector 기준 설정' },
          { metric: '2nd harmonic', value: `${format(harmonicFrequencyGhz, 3)} GHz`, meaning: harmonicFrequencyGhz <= 6 ? 'span 안 · 상대값 표시' : 'span 밖 · trace를 6 GHz에 고정하지 않음' },
          { metric: 'DUT average estimate', value: `${format(dutAverage)} dBm`, meaning: 'source + signed path gain' },
        ]} />}
      >
        <CwSpectrum frequencyGhz={frequencyGhz} powerDbm={powerDbm} />
      </PlotFrame>
      <PlotFrame title="같은 설정을 내부 RF stage로 읽기" observation="RF OFF 상태에서 configure와 query-back을 먼저 끝냅니다.">
        <MxgPath active={['STATE', 'LEVEL', 'RF OUT']} />
        <ReadoutStrip items={[
          { label: 'RF output', value: 'OFF', tone: 'active' },
          { label: 'ALC', value: 'ON' },
          { label: 'DUT average', value: `${format(dutAverage)} dBm`, ...(dutAverage > -10 ? { tone: 'warning' as const } : {}) },
          { label: 'Reference', value: 'INT 10 MHz' },
        ]} />
      </PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `MXG ${format(frequencyGhz, 3)} GHz · ${format(powerDbm)} dBm · path ${format(pathGainDb)} dB`, tone: 'active' },
      { label: '직접 효과', value: 'PLL/LO가 carrier를 이동하고 ALC·attenuator가 평균 RF level을 맞춥니다.' },
      { label: '화면 결과', value: `carrier peak와 DUT 예상 평균 입력 ${format(dutAverage)} dBm이 함께 갱신됩니다.` },
      { label: '비용·한계', value: '표시 power는 DUT 기준면 실측값이 아닙니다. cable·fixture loss와 source accuracy를 검증해야 합니다.', tone: 'warning' },
    ];
    prediction = { id: 'mxg-cw-power', prompt: 'frequency를 유지하고 source power를 10 dB 높이면?', options: ['peak와 DUT 평균 입력이 모두 10 dB 상승', 'carrier만 10 MHz 이동', 'sample rate가 두 배'], correctIndex: 0, explanation: 'Power control은 RF 경로의 level을 바꾸며 carrier frequency나 sample clock은 바꾸지 않습니다.' };
    note = '실제 RF ON 전에는 external attenuation, DUT maximum input, bias sequence와 hardware interlock를 확인하세요.';
  } else if (scenario === 'mxg-waveform-iq') {
    const iqMetrics = getIqDemoMetrics(sampleRateMhz);
    title = 'IQ waveform linked views';
    question = 'Carrier, sample rate, runtime scaling은 각각 무엇을 움직일까?';
    description = '같은 복소 sample을 시간축, IQ 평면과 계산 readout으로 동시에 보며 세 설정의 역할을 분리합니다.';
    controls = <>
      <RangeControl id="sample-rate" label="Sample rate · Option 656" min={10} max={MXG_BASELINE_SAMPLE_RATE_MAX_MHZ} step={10} value={sampleRateMhz} valueText={`${sampleRateMhz} MSa/s`} onChange={(event) => setSampleRateMhz(Number(event.currentTarget.value))} help="Option 656은 최대 100 MSa/s입니다. 200 MSa/s는 656+657 구성이 필요합니다." />
      <RangeControl id="runtime-scale" label="Runtime scaling" min={40} max={100} step={5} value={runtimeScale} valueText={`${runtimeScale} %`} onChange={(event) => setRuntimeScale(Number(event.currentTarget.value))} help="sample clock이 아니라 DAC amplitude headroom을 바꿉니다." />
      <RangeControl id="carrier" label="RF carrier" min={0.5} max={6} step={0.1} value={carrierGhz} valueText={`${format(carrierGhz, 3)} GHz`} onChange={(event) => setCarrierGhz(Number(event.currentTarget.value))} help="복소 baseband를 올려놓을 RF 중심 위치입니다." />
    </>;
    views = (
      <PlotFrame
        title="같은 IQ sample을 세 좌표계로 연결하기"
        observation="선은 색과 solid/dashed 표기를 함께 사용합니다."
        table={<DataTable caption="IQ linked view 핵심 수치" rows={[
          { metric: 'Sample count', value: `${iqMetrics.sampleCount}`, meaning: '복소 I/Q sample 개수 N' },
          { metric: 'Sample rate', value: `${format(sampleRateMhz, 0)} MSa/s`, meaning: '시간 간격과 baseband 주파수 눈금' },
          { metric: 'Record duration', value: `${format(iqMetrics.durationUs, 3)} µs`, meaning: 'N / Fs' },
          { metric: 'FFT bin', value: `${format(iqMetrics.binKhz, 1)} kHz`, meaning: 'Fs / N' },
          { metric: 'Runtime scaling', value: `${format(runtimeScale, 0)} %`, meaning: 'DAC amplitude와 headroom' },
          { metric: 'Waveform PAPR', value: `${format(iqMetrics.paprDb, 2)} dB`, meaning: '동일 sample 배열의 peak/average 비' },
          { metric: 'RF carrier', value: `${format(carrierGhz, 3)} GHz`, meaning: 'complex baseband가 놓이는 RF 중심' },
        ]} />}
      >
        <IqLinkedView sampleRateMhz={sampleRateMhz} runtimeScale={runtimeScale} carrierGhz={carrierGhz} />
      </PlotFrame>
    );
    ledger = [
      { label: '변경', value: `${sampleRateMhz} MSa/s · runtime ${runtimeScale}% · carrier ${format(carrierGhz, 3)} GHz`, tone: 'active' },
      { label: '직접 효과', value: `96 samples의 재생 시간은 ${format(96 / sampleRateMhz, 3)} µs가 되고 IQ 반지름은 scale에 비례합니다.` },
      { label: '화면 결과', value: 'sample rate는 시간·baseband 주파수 눈금을, carrier는 RF 위치를, scaling은 DAC headroom을 바꿉니다.' },
      { label: '비용·한계', value: 'Option 656에서는 100 MSa/s가 상한입니다. 200 MSa/s와 160 MHz nominal RF bandwidth는 656+657 구성이 필요합니다.', tone: 'warning' },
    ];
    prediction = { id: 'mxg-sample-rate', prompt: 'sample 값과 N을 그대로 두고 sample rate만 두 배로 만들면?', options: ['record 시간은 절반, baseband frequency scale은 두 배', 'IQ 좌표 반지름만 두 배', 'RF carrier가 두 배'], correctIndex: 0, explanation: 'Fs는 sample 간 시간과 FFT 주파수 눈금을 정하지만 normalized IQ 값과 carrier 설정은 그대로입니다.' };
    note = 'N5182B Option 656의 bandwidth·sample-rate 한계와 waveform header의 clock 값을 함께 확인합니다.';
  } else if (scenario === 'mxg-arb-playback') {
    title = 'ARB waveform player';
    question = 'Upload한 IQ record는 언제, 어디서 반복될까?';
    description = 'Waveform segment, marker, trigger와 loop boundary를 sample clock 위에 놓고 deterministic playback을 구성합니다.';
    controls = <>
      <SelectControl id="waveform" label="Waveform segment" value={waveform} onChange={(event) => setWaveform(event.currentTarget.value)} help="교육 모델의 내장 waveform만 사용합니다.">
        <option>Single-tone</option><option>Two-tone</option><option>OFDM-like</option>
      </SelectControl>
      <SelectControl id="trigger" label="Trigger source" value={trigger} onChange={(event) => setTrigger(event.currentTarget.value)}>
        <option>BUS</option><option>EXT</option><option>KEY</option>
      </SelectControl>
      <RangeControl id="loops" label="Sequence loops" min={1} max={8} step={1} value={loops} valueText={`${loops} loops`} onChange={(event) => setLoops(Number(event.currentTarget.value))} />
      <RangeControl id="marker" label="Marker sample" min={0} max={1023} step={16} value={markerIndex} valueText={`n=${markerIndex}`} onChange={(event) => setMarkerIndex(Number(event.currentTarget.value))} />
    </>;
    views = <>
      <PlotFrame
        title="Trigger 뒤 segment와 marker가 같은 clock을 공유합니다"
        observation={`${waveform} · ${trigger} trigger · marker n=${markerIndex}`}
        table={<DataTable caption="ARB playback timeline 핵심 수치" rows={[
          { metric: 'Waveform', value: waveform, meaning: '선택된 ARB memory segment' },
          { metric: 'Trigger source', value: trigger, meaning: 'address counter 시작 event' },
          { metric: 'Sequence loops', value: `${loops}`, meaning: 'segment 반복 횟수' },
          { metric: 'Marker sample', value: `n=${markerIndex}`, meaning: '각 loop에서 marker가 발생하는 sample index' },
          { metric: 'Timeline display', value: `${Math.min(loops, 4)} of ${loops} loops`, meaning: loops > 4 ? '나머지 loop는 축약 표시' : '모든 loop 표시' },
        ]} />}
      ><ArbTimeline waveform={waveform} trigger={trigger} loops={loops} markerIndex={markerIndex} /></PlotFrame>
      <PlotFrame title="재생은 file 선택만으로 시작되지 않습니다" observation="load, select, clock, trigger와 RF/modulation state가 모두 필요합니다."><MxgPath active={['STATE', 'ARB', 'DAC', 'IQ MOD', 'LEVEL']} /><ol className="mxg-lifecycle"><li>encode I/Q</li><li>binary block upload</li><li>select WFM1</li><li>set clock·scale</li><li>arm trigger</li><li>enable MOD·ARB</li></ol></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `${waveform} · ${trigger} trigger · ${loops} loops · marker sample ${markerIndex}`, tone: 'active' },
      { label: '직접 효과', value: '선택한 trigger event 이후 ARB address counter가 segment sample을 순서대로 읽습니다.' },
      { label: '화면 결과', value: `marker가 n=${markerIndex}에서 반복되고 segment boundary가 ${loops}회 나타납니다.` },
      { label: '비용·한계', value: 'record의 처음과 끝이 불연속이면 매 loop마다 spectral splatter가 반복됩니다.', tone: 'warning' },
    ];
    prediction = { id: 'mxg-trigger', prompt: 'BUS trigger로 single playback을 arm했지만 *TRG를 보내지 않았다면?', options: ['armed 상태에서 재생을 기다림', '자동으로 continuous 재생', 'carrier frequency가 0 Hz로 이동'], correctIndex: 0, explanation: 'Trigger source와 playback mode가 정한 event가 오기 전까지 ARB는 armed 상태를 유지합니다.' };
    note = 'marker polarity와 routing은 waveform header·front-panel I/O 설정에 따라 달라질 수 있습니다.';
  } else if (scenario === 'mxg-scpi-pyvisa') {
    title = 'SCPI state console';
    question = '명령을 보냈다는 사실과 장비가 끝냈다는 사실은 왜 다를까?';
    description = 'write/query, output queue, error queue와 pending operation을 한 transaction timeline에서 분리합니다.';
    controls = <ScpiConsoleControl onWrite={writeScpi} onQuery={queryScpi} onRead={readScpi} />;
    views = <PlotFrame title="Host와 MXG 사이의 program message를 시간순으로 읽기" observation="query에는 반드시 response read가 필요하며 error queue는 별도로 확인합니다."><ScpiView session={scpiSession} /></PlotFrame>;
    const last = scpiSession.transcript.at(-1);
    ledger = [
      { label: '변경', value: last ? `${last.direction.toUpperCase()} · ${last.message}` : 'SCPI command 대기', tone: 'active' },
      { label: '직접 효과', value: 'parser가 command header와 parameter를 확인해 instrument state 또는 output/error queue를 갱신합니다.' },
      { label: '화면 결과', value: `output ${scpiSession.outputQueue.length} · pending ${scpiSession.pendingOperations.length} · errors ${scpiSession.errorQueue.length}. write, response와 error가 transcript에 따로 남습니다.` },
      { label: '비용·한계', value: '교육 console은 한 줄 한 command만 지원하며 실제 timeout·SRQ·transport latency를 재현하지 않습니다.', tone: 'warning' },
    ];
    prediction = { id: 'mxg-opc', prompt: '긴 waveform load 뒤 즉시 다음 설정을 확실히 적용하려면?', options: ['*OPC? 응답과 error queue를 확인', '같은 write를 세 번 반복', 'timeout을 0 ms로 설정'], correctIndex: 0, explanation: '*OPC?는 앞선 operation 완료를 동기화하고 SYST:ERR?는 실행 실패가 남았는지 확인합니다.' };
    note = 'N5186A의 native command tree는 다릅니다. 이 console과 예제는 N5182B B.01.96 범위입니다.';
  } else {
    const peakDbm = averageDbm + paprDb;
    const paDecision = evaluatePaPowerBudget({
      sourceAveragePowerDbm: dbm(averageDbm),
      waveformCrestFactorDb: decibels(paprDb),
      envelope: {
        dutMaxInputDbm: dbm(dutLimitDbm),
        sourceToDutGainDb: decibels(pathGainDb),
        pathUncertaintyDb: decibels(uncertaintyDb),
        guardMarginDb: decibels(marginDb),
        maximumDutyCyclePercent: 100,
        requireRfOffForStimulusChange: true,
      },
    });
    const estimatedDutInputDbm = paDecision.estimatedDutInputDbm;
    const permittedDutInputDbm = paDecision.permittedDutInputDbm;
    const allowed = paDecision.allowed;
    title = 'PA stimulus safety gate';
    question = 'PA 시험에서 SG가 만드는 값과 다른 장비가 측정하는 값은 어디서 갈릴까?';
    description = '평균 전력, PAPR, path correction과 uncertainty로 보수적 DUT 입력을 추정하고 guard 적용 허용 한계와 시험 의존 장비를 분리합니다.';
    controls = <>
      <RangeControl id="average-power" label="SG average power" min={-40} max={0} step={1} value={averageDbm} valueText={`${format(averageDbm)} dBm`} onChange={(event) => setAverageDbm(Number(event.currentTarget.value))} />
      <RangeControl id="papr" label="Waveform PAPR" min={3} max={12} step={0.5} value={paprDb} valueText={`${format(paprDb)} dB`} onChange={(event) => setPaprDb(Number(event.currentTarget.value))} />
      <RangeControl id="path-gain" label="Signed path gain" min={-12} max={0} step={0.5} value={pathGainDb} valueText={`${format(pathGainDb)} dB`} onChange={(event) => setPathGainDb(Number(event.currentTarget.value))} />
      <RangeControl id="uncertainty" label="Path uncertainty" min={0} max={2} step={0.1} value={uncertaintyDb} valueText={`${format(uncertaintyDb)} dB`} onChange={(event) => setUncertaintyDb(Number(event.currentTarget.value))} />
      <RangeControl id="guard" label="Guard margin" min={0} max={5} step={0.5} value={marginDb} valueText={`${format(marginDb)} dB`} onChange={(event) => setMarginDb(Number(event.currentTarget.value))} />
      <NumberControl id="dut-limit" label="DUT maximum input" unit="dBm" min={-30} max={10} step={1} value={dutLimitDbm} onChange={(event) => setDutLimitDbm(Number(event.currentTarget.value))} />
    </>;
    views = <>
      <PlotFrame
        title={allowed ? '물리 추정 입력이 guard 적용 한계 아래입니다' : 'RF ON을 막아야 합니다'}
        observation="Guard는 실제 입력 추정치에 더하지 않고, 허용 한계를 낮추는 정책값으로 적용합니다."
        table={<DataTable caption="PA stimulus power budget 핵심 수치" rows={[
          { metric: 'SG average', value: `${format(averageDbm)} dBm`, meaning: 'MXG RF connector 기준 평균 전력' },
          { metric: 'Waveform PAPR', value: `${format(paprDb)} dB`, meaning: '평균에서 peak까지의 차이' },
          { metric: 'SG PEP', value: `${format(peakDbm)} dBm`, meaning: 'average + PAPR' },
          { metric: 'Signed path gain', value: `${format(pathGainDb)} dB`, meaning: 'MXG에서 DUT 입력 기준면까지' },
          { metric: 'Path uncertainty', value: `${format(uncertaintyDb)} dB`, meaning: '물리 추정치에 적용하는 최악 방향 오차' },
          { metric: 'DUT physical estimate', value: `${format(estimatedDutInputDbm)} dBm`, meaning: 'PEP + path + uncertainty; guard 제외' },
          { metric: 'DUT maximum', value: `${format(dutLimitDbm)} dBm`, meaning: 'DUT 데이터시트 또는 검증된 한계' },
          { metric: 'Guard margin', value: `${format(marginDb)} dB`, meaning: '허용 한계를 낮추는 운영 정책' },
          { metric: 'Permitted input', value: `${format(permittedDutInputDbm)} dBm`, meaning: 'DUT maximum − guard' },
          { metric: 'Headroom', value: `${format(paDecision.headroomDb)} dB`, meaning: allowed ? 'RF enable 조건 통과' : '음수이므로 RF enable 차단' },
        ]} />}
      >
        <PowerBudget averageDbm={averageDbm} paprDb={paprDb} pathGainDb={pathGainDb} uncertaintyDb={uncertaintyDb} marginDb={marginDb} dutLimitDbm={dutLimitDbm} decision={paDecision} />
      </PlotFrame>
      <PlotFrame title="SG는 stimulus를 만들고 결과는 후속 장비가 측정합니다" observation="측정값의 주인이 누구인지 분리하면 automation interface가 선명해집니다."><PaDependencyMap /></PlotFrame>
    </>;
    ledger = [
      { label: '변경', value: `average ${format(averageDbm)} dBm + PAPR ${format(paprDb)} dB`, tone: 'active' },
      { label: '직접 효과', value: `SG PEP ${format(peakDbm)} dBm에서 DUT 물리 추정 입력은 ${format(estimatedDutInputDbm)} dBm, guard 적용 허용 한계는 ${format(permittedDutInputDbm)} dBm입니다.` },
      { label: '화면 결과', value: allowed ? `headroom ${format(paDecision.headroomDb)} dB로 safety gate가 통과합니다.` : `headroom ${format(paDecision.headroomDb)} dB이므로 RF ON이 차단됩니다.`, tone: allowed ? 'neutral' : 'warning' },
      { label: '비용·한계', value: 'SG만으로 Pout·EVM·ACLR·PAE를 얻을 수 없습니다. sensor, SA/VSA와 PSU의 동기화·보정이 필요합니다.', tone: 'warning' },
    ];
    prediction = { id: 'mxg-pa-peak', prompt: '평균 power를 유지한 채 PAPR이 3 dB 늘면 worst-case DUT peak는?', options: ['3 dB 상승', '3 dB 하강', '변하지 않음'], correctIndex: 0, explanation: 'PEP는 average power + PAPR이므로 path와 uncertainty가 같으면 DUT의 보수적 물리 peak도 3 dB 상승합니다.' };
    note = 'Software RF OFF는 통신 단절 시 보장되지 않습니다. 실제 bench에는 hardware limit와 interlock가 필요합니다.';
  }

  return (
    <LabShell
      labId={`instrument:sg:${scenario}`}
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
