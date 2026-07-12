import { useMemo, useState } from 'react';
import { RangeControl, SelectControl } from '../lab/ControlField';
import { LabShell } from '../lab/LabShell';
import { useLabControlInteraction } from '../lab/LabControlInteraction';
import type { LedgerEntry } from '../lab/types';
import { PlotFrame } from '../plots/PlotFrame';
import {
  calculateGroupDelaySeconds,
  calibrateEna,
  createE5080bSession,
  deembedSymmetricFixture,
  enaLogMagnitudeDb,
  enaMagnitude,
  enaPhaseDegrees,
  enaReturnLossDb,
  enaVswr,
  estimateSweepTimeSeconds,
  estimateEnaPaCompressionDb,
  estimateEnaTraceNoiseDbRms,
  evaluateCalibrationValidity,
  evaluateEnaReceiverSafety,
  gammaToImpedance,
  generateEnaSweep,
  queryE5080bScpi,
  readE5080bScpi,
  signalE5080bTriggerEvent,
  writeE5080bScpi,
  type EnaCalibrationState,
  type EnaSession,
  type EnaSweepPoint,
  type EnaSweepState,
} from '@/lib/instruments/ena';
import './ena.css';

export type EnaScenarioId =
  | 'ena-safe-sweep'
  | 'ena-calibration'
  | 'ena-sparameters'
  | 'ena-scpi-data'
  | 'ena-pa-characterization';

interface Props { readonly scenario: EnaScenarioId }

const format = (value: number, digits = 2) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

interface TableRow { readonly metric: string; readonly value: string; readonly meaning: string }

function DataTable({ caption, rows }: { readonly caption: string; readonly rows: readonly TableRow[] }) {
  return <table><caption>{caption}</caption><thead><tr><th>항목</th><th>값</th><th>해석</th></tr></thead><tbody>{rows.map((row) => <tr key={row.metric}><th scope="row">{row.metric}</th><td>{row.value}</td><td>{row.meaning}</td></tr>)}</tbody></table>;
}

function Readouts({ items }: { readonly items: readonly { label: string; value: string; tone?: 'active' | 'warning' | 'reference' }[] }) {
  return <dl className="ena-readouts">{items.map((item) => <div key={item.label} data-tone={item.tone ?? 'neutral'}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

const pathStages = [
  ['STIM', 'Source sweep'], ['SEP', 'a / b waves'], ['RX', 'R1 · A · B'],
  ['CAL', 'Error terms'], ['MATH', 'Complex ratio'], ['VIEW', 'Trace · Smith'],
] as const;

function EnaPath({ active }: { readonly active: readonly string[] }) {
  return <ol className="ena-path" aria-label="E5080B complex measurement path">{pathStages.map(([id, label]) => {
    const affected = active.includes(id);
    return <li key={id} className={affected ? 'is-active' : undefined} data-affected={affected} aria-label={`${id} · ${label} · ${affected ? '현재 설정의 영향 stage' : '현재 설정의 직접 영향 없음'}`}><i className="ena-path__cue" aria-hidden="true">{affected ? '◆' : '◇'}</i><strong>{id}</strong><span>{label}</span></li>;
  })}</ol>;
}

function linePath(values: readonly number[], min: number, max: number, width = 640, height = 190) {
  const range = Math.max(max - min, Number.EPSILON);
  return values.map((value, index) => {
    const x = 62 + index * ((width - 92) / Math.max(1, values.length - 1));
    const y = 22 + ((max - value) / range) * (height - 58);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function SweepPlot({ points, markerIndex }: { readonly points: readonly EnaSweepPoint[]; readonly markerIndex: number }) {
  const values = points.map((point) => enaLogMagnitudeDb(point.s21));
  const min = Math.floor(Math.min(...values) - 0.5);
  const max = Math.ceil(Math.max(...values) + 0.5);
  const marker = points[Math.min(points.length - 1, markerIndex)]!;
  const markerValue = values[Math.min(values.length - 1, markerIndex)]!;
  const markerX = 62 + markerIndex * (548 / Math.max(1, values.length - 1));
  const markerY = 22 + ((max - markerValue) / Math.max(max - min, 1)) * 132;
  return <svg viewBox="0 0 640 210" role="img" aria-labelledby="ena-sweep-title ena-sweep-desc">
    <title id="ena-sweep-title">E5080B S21 frequency sweep</title>
    <desc id="ena-sweep-desc">{format(points[0]!.frequencyHz / 1e9, 3)} to {format(points.at(-1)!.frequencyHz / 1e9, 3)} gigahertz sweep. Marker is {format(marker.frequencyHz / 1e9, 3)} gigahertz and {format(markerValue)} decibels.</desc>
    <rect width="640" height="210" fill="var(--color-instrument)" />
    {[0, 1, 2, 3, 4].map((index) => {
      const y = 22 + index * 33;
      const tick = max - index * ((max - min) / 4);
      return <g key={index}><line x1="62" x2="610" y1={y} y2={y} className="ena-grid" /><text x="55" y={y} textAnchor="end" dominantBaseline="middle" className="ena-axis-label">{format(tick, 1)}</text></g>;
    })}
    <line x1="62" x2="610" y1="154" y2="154" className="ena-axis" /><line x1="62" x2="62" y1="22" y2="154" className="ena-axis" />
    <path d={linePath(values, min, max)} className="ena-trace ena-trace--forward" fill="none" />
    <line x1={markerX} x2={markerX} y1={markerY} y2="154" className="ena-marker-line" />
    <circle cx={markerX} cy={markerY} r="4" className="ena-marker" />
    <text x={Math.min(markerX + 8, 510)} y={Math.max(markerY - 8, 18)} className="ena-label ena-label--forward">M1 {format(marker.frequencyHz / 1e9, 3)} GHz · {format(markerValue)} dB</text>
    <text x="62" y="174" textAnchor="start" className="ena-axis-label">{format(points[0]!.frequencyHz / 1e9, 3)}</text>
    <text x="610" y="174" textAnchor="end" className="ena-axis-label">{format(points.at(-1)!.frequencyHz / 1e9, 3)}</text>
    <text x="336" y="192" textAnchor="middle" className="ena-axis-label">Frequency · GHz</text>
    <text transform="translate(18 90) rotate(-90)" textAnchor="middle" className="ena-axis-label">S21 LogMag · dB</text>
  </svg>;
}

function CalibrationPlot({ state }: { readonly state: EnaCalibrationState }) {
  const raw = [-18, -19, -17, -20, -16, -18, -17, -19, -18];
  const correctionAvailable = state.status !== 'none' && state.status !== 'outside-range';
  const calibrated = correctionAvailable ? [-31, -32, -30, -33, -29, -31, -30, -32, -31] : raw;
  const startGhz = state.originalSweep ? format(state.originalSweep.startHz / 1e9, 3) : '—';
  const stopGhz = state.originalSweep ? format(state.originalSweep.stopHz / 1e9, 3) : '—';
  return <svg viewBox="0 0 640 220" role="img" aria-labelledby="ena-cal-title ena-cal-desc">
    <title id="ena-cal-title">Raw and corrected reflection comparison</title>
    <desc id="ena-cal-desc">Uncorrected reflection ripple is shown with an amber dashed line. Corrected data is shown with a teal solid line. Current calibration state is {state.status}.</desc>
    <rect width="640" height="220" fill="var(--color-instrument)" />
    {[0, 1, 2, 3, 4].map((index) => {
      const y = 25 + index * 34;
      return <g key={index}><line x1="62" x2="610" y1={y} y2={y} className="ena-grid" /><text x="55" y={y} textAnchor="end" dominantBaseline="middle" className="ena-axis-label">{-12 - index * 6}</text></g>;
    })}
    <path d={linePath(raw, -36, -12, 640, 210)} className="ena-trace ena-trace--reference" fill="none" strokeDasharray="7 5" />
    <path d={linePath(calibrated, -36, -12, 640, 210)} className="ena-trace ena-trace--forward" fill="none" />
    <text x="590" y="28" textAnchor="end" className="ena-label ena-label--reference">Raw · dashed</text>
    <text x="590" y="49" textAnchor="end" className="ena-label ena-label--forward">{correctionAvailable ? 'Corrected · solid' : 'Correction unavailable · solid overlaps raw'}</text>
    <text x="336" y="204" textAnchor="middle" className="ena-axis-label">Calibrated range · {startGhz}–{stopGhz} GHz</text>
    <text transform="translate(18 105) rotate(-90)" textAnchor="middle" className="ena-axis-label">S11 · dB</text>
  </svg>;
}

function SmithPlot({ point }: { readonly point: EnaSweepPoint }) {
  const gamma = point.s11;
  const x = 210 + gamma.re * 150;
  const y = 180 - gamma.im * 150;
  const impedance = gammaToImpedance(gamma);
  return <svg viewBox="0 0 420 360" role="img" aria-labelledby="ena-smith-title ena-smith-desc">
    <title id="ena-smith-title">S11 Smith chart</title>
    <desc id="ena-smith-desc">At {format(point.frequencyHz / 1e9, 3)} gigahertz the reflection coefficient magnitude is {format(enaMagnitude(gamma), 3)}, phase is {format(enaPhaseDegrees(gamma), 1)} degrees, and impedance is {format(impedance.re, 1)} plus j {format(impedance.im, 1)} ohms.</desc>
    <rect width="420" height="360" fill="var(--color-instrument)" />
    <circle cx="210" cy="180" r="150" className="ena-smith-boundary" />
    <line x1="60" x2="360" y1="180" y2="180" className="ena-axis" />
    {[0.2, 0.5, 1, 2, 5].map((resistance) => {
      const cx = 210 + 150 * resistance / (1 + resistance); const radius = 150 / (1 + resistance);
      return <circle key={resistance} cx={cx} cy="180" r={radius} className="ena-grid" />;
    })}
    <path d="M60 180 Q210 30 360 180 M60 180 Q210 330 360 180" className="ena-grid" fill="none" />
    <line x1="210" x2={x} y1="180" y2={y} className="ena-trace ena-trace--reference" strokeDasharray="5 4" />
    <circle cx={x} cy={y} r="6" className="ena-marker" />
    <text x={Math.min(290, x + 10)} y={Math.max(28, y - 10)} className="ena-label ena-label--forward">S11 · M1</text>
    <text x="210" y="344" textAnchor="middle" className="ena-axis-label">Normalized impedance · Z0 = 50 Ω</text>
  </svg>;
}

function SafeSweepLab() {
  const [startGhz, setStartGhz] = useState(1);
  const [stopGhz, setStopGhz] = useState(6);
  const [points, setPoints] = useState(201);
  const [ifBandwidthHz, setIfBandwidthHz] = useState(1000);
  const [powerDbm, setPowerDbm] = useState(-30);
  const sweep: EnaSweepState = { startHz: startGhz * 1e9, stopHz: stopGhz * 1e9, points, ifBandwidthHz, sourcePowerDbm: powerDbm, averagingEnabled: false, averagingCount: 4, sweepType: 'LIN' };
  const data = generateEnaSweep(sweep);
  const markerIndex = Math.floor(data.length / 2);
  const timeSeconds = estimateSweepTimeSeconds(sweep);
  const traceNoiseDbRms = estimateEnaTraceNoiseDbRms(sweep);
  const marker = data[markerIndex]!;
  const ledger: readonly LedgerEntry[] = [
    { label: '변경', value: `${points} points · IFBW ${format(ifBandwidthHz, 0)} Hz · ${format(powerDbm, 0)} dBm` },
    { label: '직접 효과', value: 'Source가 각 주파수에서 coherent a/b receiver ratio를 만들고 IF filter가 noise bandwidth를 제한합니다.', tone: 'active' },
    { label: '화면 결과', value: `예상 sweep ${format(timeSeconds, 3)} s · M1 S21 ${format(enaLogMagnitudeDb(marker.s21))} dB` },
    { label: '비용·한계', value: '좁은 IFBW와 많은 point는 noise를 줄이고 grid를 촘촘하게 하지만 sweep time과 DUT dwell을 늘립니다.', tone: 'warning' },
  ];
  return <LabShell labId="instrument:vna:ena-safe-sweep" title="E5080B Safe Sweep" question="IFBW와 point 수를 바꾸면 같은 DUT trace가 왜 더 느리거나 매끈해질까?" description="RF OFF에서 source power limit, frequency grid와 receiver bandwidth를 먼저 정하고 한 sweep의 시간·DUT stress를 연결합니다." activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']} stageMap={{ 'ena-points': ['source', 'acquisition', 'dsp', 'display'], 'ena-ifbw': ['acquisition', 'dsp', 'display'], 'ena-power': ['source', 'dut', 'acquisition', 'display'] }} controls={<>
    <RangeControl id="ena-start" label="Start frequency" min={0.5} max={4} step={0.25} value={startGhz} valueText={`${format(startGhz, 2)} GHz`} onChange={(event) => setStartGhz(Math.min(Number(event.currentTarget.value), stopGhz - 0.25))} />
    <RangeControl id="ena-stop" label="Stop frequency" min={2} max={20} step={0.5} value={stopGhz} valueText={`${format(stopGhz, 2)} GHz`} onChange={(event) => setStopGhz(Math.max(Number(event.currentTarget.value), startGhz + 0.25))} />
    <SelectControl id="ena-points" label="Sweep points" value={points} onChange={(event) => setPoints(Number(event.currentTarget.value))}><option value="101">101</option><option value="201">201</option><option value="401">401</option><option value="801">801</option></SelectControl>
    <SelectControl id="ena-ifbw" label="IF bandwidth" value={ifBandwidthHz} onChange={(event) => setIfBandwidthHz(Number(event.currentTarget.value))}><option value="10000">10 kHz</option><option value="1000">1 kHz</option><option value="100">100 Hz</option></SelectControl>
    <RangeControl id="ena-power" label="Source power" min={-60} max={-10} step={1} value={powerDbm} valueText={`${powerDbm} dBm`} onChange={(event) => setPowerDbm(Number(event.currentTarget.value))} />
  </>} ledger={ledger} prediction={{ id: 'ena-ifbw-prediction', prompt: 'IFBW를 10 kHz에서 100 Hz로 줄이면 가장 직접적인 변화는?', options: ['RF carrier가 이동한다', 'Receiver noise bandwidth와 sweep 속도가 함께 줄어든다', 'DUT impedance가 50 Ω이 된다'], correctIndex: 1, explanation: 'IFBW는 receiver filter 폭입니다. 좁히면 noise가 줄지만 한 point의 settling/acquisition 시간이 늘어납니다.' }} note="Factory preset은 source를 켤 수 있고 일반 power limit 기본값은 보호값이 아닙니다. OUTP OFF와 명시적 power limit query-back을 먼저 수행하세요.">
    <EnaPath active={['STIM', 'SEP', 'RX', 'MATH', 'VIEW']} />
    <Readouts items={[{ label: 'Sweep time model', value: `${format(timeSeconds, 3)} s`, tone: 'active' }, { label: 'Trace noise model', value: `${format(traceNoiseDbRms, 3)} dB rms` }, { label: 'Source state', value: 'RF OFF · limit first', tone: 'warning' }, { label: 'M1 phase', value: `${format(enaPhaseDegrees(marker.s21), 1)}°` }]} />
    <PlotFrame title="S21 sweep · complex ratio b2/a1" observation="Point 수는 frequency grid를, IFBW는 deterministic receiver-noise ripple과 sweep time을 함께 바꿉니다. DUT의 underlying S21 모델은 그대로입니다." table={<DataTable caption="Safe sweep 핵심 수치" rows={[{ metric: 'Start / stop', value: `${format(startGhz, 2)} / ${format(stopGhz, 2)} GHz`, meaning: '요청한 calibrated frequency range' }, { metric: 'Points / step', value: `${points} / ${format((sweep.stopHz - sweep.startHz) / (points - 1) / 1e6, 3)} MHz`, meaning: 'Complex sample grid' }, { metric: 'IFBW / noise model', value: `${format(ifBandwidthHz, 0)} Hz / ${format(traceNoiseDbRms, 3)} dB rms`, meaning: 'Receiver noise bandwidth가 trace smoothness에 반영됨' }, { metric: 'M1 S21', value: `${format(enaLogMagnitudeDb(marker.s21))} dB ∠ ${format(enaPhaseDegrees(marker.s21), 1)}°`, meaning: 'Corrected complex transmission ratio' }]} />}><SweepPlot points={data} markerIndex={markerIndex} /></PlotFrame>
  </LabShell>;
}

function CalibrationLab() {
  const original: EnaSweepState = { startHz: 1e9, stopHz: 6e9, points: 201, ifBandwidthHz: 1000, sourcePowerDbm: -30, averagingEnabled: false, averagingCount: 4, sweepType: 'LIN' };
  const [method, setMethod] = useState<'SOLT' | 'ECal'>('ECal');
  const [change, setChange] = useState<'same' | 'narrower' | 'wider' | 'power' | 'ifbw'>('same');
  const calibrated = calibrateEna(original, method, 'N4691D cable-end plane');
  const current = { ...original };
  if (change === 'narrower') { current.startHz = 1.5e9; current.stopHz = 5.5e9; current.points = 301; }
  if (change === 'wider') { current.startHz = 0.5e9; current.stopHz = 7e9; }
  if (change === 'power') current.sourcePowerDbm = -15;
  if (change === 'ifbw') current.ifBandwidthHz = 100;
  const validity = evaluateCalibrationValidity(calibrated, current);
  const ledger: readonly LedgerEntry[] = [
    { label: '변경', value: `${method} correction 뒤 ${change} stimulus` },
    { label: '직접 효과', value: validity.reasons.join(' '), tone: validity.status === 'valid' ? 'active' : 'warning' },
    { label: '화면 결과', value: `Correction state · ${validity.status}` },
    { label: '비용·한계', value: 'Calibration은 connector·kit·torque·cable 움직임과 지정 power에서만 유효합니다. 보간은 새 측정이 아닙니다.' },
  ];
  return <LabShell labId="instrument:vna:ena-calibration" title="E5080B Calibration Plane" question="Calibration 뒤 sweep 조건을 바꾸면 언제 correction을 믿을 수 없게 될까?" description="Directivity, source/load match와 tracking error를 표준물로 분리하고 저장한 correction의 유효 범위를 추적합니다." activeStages={['source', 'acquisition', 'dsp', 'display']} stageMap={{ 'ena-cal-method': ['source', 'acquisition', 'dsp'], 'ena-cal-change': ['source', 'acquisition', 'dsp', 'display'] }} controls={<>
    <SelectControl id="ena-cal-method" label="Calibration method" value={method} onChange={(event) => setMethod(event.currentTarget.value as 'SOLT' | 'ECal')}><option value="ECal">N4691D ECal</option><option value="SOLT">Mechanical SOLT</option></SelectControl>
    <SelectControl id="ena-cal-change" label="Cal 뒤 변경" value={change} onChange={(event) => setChange(event.currentTarget.value as typeof change)}><option value="same">동일 stimulus</option><option value="narrower">범위 축소 + point 변경</option><option value="wider">범위 밖 확장</option><option value="power">Source power 변경</option><option value="ifbw">IFBW 변경</option></SelectControl>
  </>} ledger={ledger} prediction={{ id: 'ena-cal-plane-prediction', prompt: 'Cable 끝에서 2-port calibration한 뒤 DUT 쪽 adapter를 새로 추가하면 기준면은?', options: ['자동으로 DUT connector로 이동한다', '여전히 calibration 당시 cable 끝이며 adapter error가 다시 포함된다', '항상 test-set 내부다'], correctIndex: 1, explanation: 'Calibration plane 이후에 추가한 network는 measured DUT의 일부로 보입니다. Port extension/de-embedding 또는 새 calibration이 필요합니다.' }} note="N4691D의 일반 3.5 mm 범위는 300 kHz–26.5 GHz입니다. 교육 프로필의 9–300 kHz 구간에는 해당 ECal 범위를 그대로 주장하지 않습니다.">
    <EnaPath active={['STIM', 'SEP', 'RX', 'CAL', 'MATH', 'VIEW']} />
    <Readouts items={[{ label: 'Correction', value: validity.status, tone: validity.status === 'valid' ? 'active' : 'warning' }, { label: 'Method', value: method }, { label: 'Reference plane', value: validity.referencePlane, tone: 'reference' }, { label: 'Cal power limit', value: 'must enable explicitly', tone: 'warning' }]} />
    <PlotFrame title="Raw receiver ratio와 corrected S11" observation="Correction은 trace를 보기 좋게 만드는 filter가 아니라, calibration plane까지의 systematic error model을 complex ratio에서 제거하는 연산입니다." table={<DataTable caption="Calibration 유효성 상태" rows={[{ metric: 'Original range', value: '1–6 GHz · 201 points', meaning: 'Correction을 구한 stimulus' }, { metric: 'Current state', value: validity.status, meaning: validity.reasons.join(' ') }, { metric: 'Plane', value: validity.referencePlane, meaning: '이 위치에서 DUT S-parameter가 정의됨' }, { metric: 'Cal source limit', value: 'SCPI에서 별도 ON', meaning: '일반 limit과 자동 연동되지 않음' }]} />}><CalibrationPlot state={validity} /></PlotFrame>
  </LabShell>;
}

function SParameterLab() {
  const sweep: EnaSweepState = { startHz: 1e9, stopHz: 6e9, points: 201, ifBandwidthHz: 1000, sourcePowerDbm: -30, averagingEnabled: false, averagingCount: 4, sweepType: 'LIN' };
  const data = useMemo(() => generateEnaSweep(sweep), []);
  const [markerGhz, setMarkerGhz] = useState(3.5);
  const [fixtureEachDb, setFixtureEachDb] = useState(0.4);
  const markerIndex = Math.round((markerGhz - 1) / 5 * (data.length - 1));
  const point = data[Math.max(0, Math.min(data.length - 1, markerIndex))]!;
  const impedance = gammaToImpedance(point.s11);
  const groupDelay = calculateGroupDelaySeconds(data)[markerIndex]!;
  const measured = enaLogMagnitudeDb(point.s21) - 2 * fixtureEachDb;
  const fixture = deembedSymmetricFixture(measured, fixtureEachDb);
  const ledger: readonly LedgerEntry[] = [
    { label: '변경', value: `Marker ${format(markerGhz, 2)} GHz · fixture ${format(fixtureEachDb)} dB/side` },
    { label: '직접 효과', value: `같은 complex S11을 Γ, impedance, return loss와 VSWR로 변환하고 fixture 2개를 inverse network로 제거합니다.`, tone: 'active' },
    { label: '화면 결과', value: `Z = ${format(impedance.re, 1)} ${impedance.im >= 0 ? '+' : '−'} j${format(Math.abs(impedance.im), 1)} Ω · de-embedded S21 ${format(fixture.deembeddedS21Db)} dB` },
    { label: '비용·한계', value: `Fixture model error ±${format(fixture.residualUncertaintyDb)} dB는 역연산으로 사라지지 않습니다. AFR/S2P/TRL의 validity와 passivity를 확인해야 합니다.`, tone: 'warning' },
  ];
  return <LabShell labId="instrument:vna:ena-sparameters" title="S-parameter · Smith · Time" question="같은 complex S11과 S21이 네 화면에서 왜 다른 물리량처럼 보일까?" description="LogMag, phase, Smith impedance, group delay와 fixture de-embedding을 같은 marker에 연결합니다." activeStages={['dut', 'acquisition', 'dsp', 'display']} stageMap={{ 'ena-marker': ['dsp', 'display'], 'ena-fixture-loss': ['dut', 'dsp', 'display'] }} controls={<>
    <RangeControl id="ena-marker" label="Linked marker" min={1} max={6} step={0.05} value={markerGhz} valueText={`${format(markerGhz, 2)} GHz`} onChange={(event) => setMarkerGhz(Number(event.currentTarget.value))} />
    <RangeControl id="ena-fixture-loss" label="Fixture loss / side" min={0} max={2} step={0.05} value={fixtureEachDb} valueText={`${format(fixtureEachDb)} dB`} onChange={(event) => setFixtureEachDb(Number(event.currentTarget.value))} />
  </>} ledger={ledger} prediction={{ id: 'ena-smith-prediction', prompt: '|Γ|가 그대로이고 phase만 바뀌면 무엇이 그대로인가?', options: ['Return loss와 VSWR', 'Complex impedance의 R과 X', 'Group delay'], correctIndex: 0, explanation: 'Return loss와 VSWR은 |Γ|만으로 정해집니다. Smith chart 위치와 impedance는 phase가 바뀌면 이동합니다.' }} note="Port extension은 주로 delay/phase 이동, S2P de-embedding은 fixture network 역연산, AFR은 fixture extraction입니다. 같은 버튼 이름으로 섞지 마세요.">
    <EnaPath active={['SEP', 'RX', 'CAL', 'MATH', 'VIEW']} />
    <Readouts items={[{ label: 'S11', value: `${format(enaMagnitude(point.s11), 3)} ∠ ${format(enaPhaseDegrees(point.s11), 1)}°`, tone: 'reference' }, { label: 'Return loss / VSWR', value: `${format(enaReturnLossDb(point.s11))} dB / ${format(enaVswr(point.s11), 3)}` }, { label: 'Impedance', value: `${format(impedance.re, 1)} ${impedance.im >= 0 ? '+' : '−'} j${format(Math.abs(impedance.im), 1)} Ω`, tone: 'active' }, { label: 'Group delay', value: `${format(groupDelay * 1e9, 3)} ns` }]} />
    <div className="ena-linked-grid">
      <PlotFrame title="Smith view · S11 marker" observation="Smith chart는 Γ와 normalized impedance의 같은 complex point를 다른 좌표 문법으로 보여 줍니다." table={<DataTable caption="Smith marker 핵심 수치" rows={[{ metric: 'Frequency', value: `${format(point.frequencyHz / 1e9, 3)} GHz`, meaning: 'Linked marker' }, { metric: 'Γ', value: `${format(enaMagnitude(point.s11), 3)} ∠ ${format(enaPhaseDegrees(point.s11), 1)}°`, meaning: 'b1/a1' }, { metric: 'Z', value: `${format(impedance.re, 1)} ${impedance.im >= 0 ? '+' : '−'} j${format(Math.abs(impedance.im), 1)} Ω`, meaning: 'Z0 = 50 Ω transform' }]} />}><SmithPlot point={point} /></PlotFrame>
      <PlotFrame title="LogMag / phase · S21 marker" observation="Magnitude는 loss/gain을, phase slope는 delay를 보여 줍니다. Time-domain resolution은 span/window에 의존합니다." table={<DataTable caption="Transmission과 fixture 핵심 수치" rows={[{ metric: 'Measured S21', value: `${format(fixture.measuredS21Db)} dB`, meaning: 'DUT + two fixtures' }, { metric: 'Removed fixture', value: `${format(fixture.fixtureLossDb)} dB`, meaning: 'Modelled inverse network' }, { metric: 'De-embedded S21', value: `${format(fixture.deembeddedS21Db)} dB`, meaning: 'DUT estimate, not new measurement' }, { metric: 'Residual model uncertainty', value: `±${format(fixture.residualUncertaintyDb)} dB`, meaning: 'Cannot be removed mathematically' }]} />}><SweepPlot points={data} markerIndex={markerIndex} /></PlotFrame>
    </div>
  </LabShell>;
}

function ScpiControl({ session, setSession }: { readonly session: EnaSession; readonly setSession: (session: EnaSession) => void }) {
  const report = useLabControlInteraction();
  const [command, setCommand] = useState('*IDN?');
  const normalized = command.trim();
  const run = (mode: 'write' | 'query' | 'read') => {
    if (mode === 'write') setSession(writeE5080bScpi(session, normalized));
    if (mode === 'query') setSession(queryE5080bScpi(session, normalized).session);
    if (mode === 'read') setSession(readE5080bScpi(session).session);
    report('ena-scpi-command');
  };
  const signalExternalEdge = () => {
    setSession(signalE5080bTriggerEvent(session, 'EXT'));
    report('ena-scpi-command');
  };
  return <div className="ena-console-control control-field"><label htmlFor="ena-scpi-command">한 줄 SCPI program message</label><input id="ena-scpi-command" name="ena-scpi-command" value={command} onChange={(event) => setCommand(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); run('write'); } }} spellCheck={false} autoComplete="off" /><div><button type="button" className="lab-button lab-button--primary" onClick={() => run('write')}>WRITE</button><button type="button" className="lab-button lab-button--secondary" disabled={!normalized.endsWith('?')} onClick={() => run('query')}>QUERY + READ</button><button type="button" className="lab-button lab-button--secondary" onClick={() => run('read')}>READ queue</button><button type="button" className="lab-button lab-button--secondary" disabled={session.acquisition.status !== 'armed' || session.acquisition.armedTrigger !== 'EXT'} onClick={signalExternalEdge}>EXT edge simulation</button></div><p><code>INIT1:IMM</code> 뒤 IMM은 바로 sweep, MAN은 <code>*TRG</code>, EXT는 edge simulation이 필요합니다. 그 다음 <code>*OPC?</code>로 완료하고 SDATA를 읽으세요.</p></div>;
}

function ScpiDataLab() {
  const [session, setSession] = useState(() => createE5080bSession());
  const last = session.transcript.at(-1);
  const firstError = session.errorQueue.at(0);
  const ledger: readonly LedgerEntry[] = [
    { label: '변경', value: last ? `${last.direction.toUpperCase()} · ${last.message}` : '아직 command 없음' },
    { label: '직접 효과', value: `State, output queue, error queue와 pending operation을 서로 독립적으로 갱신합니다.`, tone: 'active' },
    { label: '화면 결과', value: `Acquisition ${session.acquisition.status} · data ${session.acquisition.dataFresh ? 'fresh' : 'stale'} · Pending ${session.pendingOperations.length}` },
    { label: '비용·한계', value: '가상 console은 한 줄 한 message만 지원합니다. 실제 binary REAL,32 data는 byte order·point count와 definite block을 함께 검증합니다.' },
  ];
  return <LabShell labId="instrument:vna:ena-scpi-data" title="E5080B SCPI · Complex Data" question="INIT를 보낸 뒤 바로 SDATA를 읽는 것과 *OPC? 뒤 읽는 것은 왜 다를까?" description="Channel·measurement·trigger·queue와 corrected complex data의 생명주기를 작은 SCPI state machine으로 확인합니다." activeStages={['source', 'acquisition', 'dsp', 'display']} stageMap={{ 'ena-scpi-command': ['source', 'acquisition', 'dsp', 'display'] }} controls={<ScpiControl session={session} setSession={setSession} />} ledger={ledger} prediction={{ id: 'ena-scpi-opc-prediction', prompt: 'INIT1:IMM 다음 *OPC?의 역할은?', options: ['S21을 dB로 변환한다', '앞선 overlapped sweep 완료를 동기화한다', 'RF를 강제로 끈다'], correctIndex: 1, explanation: '*OPC?는 앞서 시작한 operation 완료를 기다린 뒤 1을 반환합니다. 측정 의미나 RF safety를 대신하지 않습니다.' }} note="통신 단절 시 software OUTP OFF는 보장되지 않습니다. 실제 PA bench에는 external attenuation, interlock와 DUT-specific bias shutdown이 별도로 필요합니다.">
    <EnaPath active={['STIM', 'RX', 'CAL', 'MATH', 'VIEW']} />
    <Readouts items={[{ label: 'Measurement', value: session.state.measurement, tone: 'active' }, { label: 'Acquisition', value: `${session.acquisition.status} · ${session.acquisition.dataFresh ? 'fresh' : 'stale'}`, tone: session.acquisition.dataFresh ? 'active' : 'warning' }, { label: 'Output / error queue', value: `${session.outputQueue.length} / ${session.errorQueue.length}` }, { label: 'Pending', value: session.pendingOperations.join(', ') || 'none' }]} />
    <PlotFrame title="Command → trigger → completion → fresh data" observation="MAN/EXT는 event 전 armed 상태입니다. Event 없는 *OPC?는 응답하지 않고, complete 전 SDATA/FDATA는 stale-data error로 차단됩니다." table={<DataTable caption="현재 E5080B session state" rows={[{ metric: 'Source', value: `${format(session.state.sweep.sourcePowerDbm, 1)} dBm · RF ${session.state.rfOutputEnabled ? 'ON' : 'OFF'}`, meaning: `Power limit ${session.state.sourcePowerLimitEnabled ? `${session.state.sourcePowerLimitDbm} dBm ON` : 'OFF'}` }, { metric: 'Acquisition', value: `${session.acquisition.status} · ${session.acquisition.dataFresh ? 'fresh' : 'stale'}`, meaning: `Trigger ${session.state.triggerSource} · completed sweeps ${session.acquisition.sweepCount}` }, { metric: 'Queues', value: `OQ ${session.outputQueue.length} · EQ ${session.errorQueue.length}`, meaning: 'FIFO, *CLS clears status/error but does not create fresh data' }, { metric: 'Pending', value: session.pendingOperations.join(', ') || 'none', meaning: 'INIT → event → *OPC? → data 순서를 닫아야 함' }]} />}><div className="ena-session" aria-live="polite" aria-atomic="false"><div><span>STATE</span><strong>{session.state.measurement} · {session.state.triggerSource}</strong><small>{session.acquisition.status} · data {session.acquisition.dataFresh ? 'fresh' : 'stale'}</small></div><div><span>OUTPUT QUEUE</span><code>{session.outputQueue.at(0) ?? 'empty'}</code></div><div><span>ERROR QUEUE</span><code>{firstError ? `${firstError.code}, "${firstError.message}"` : '+0, "No error"'}</code></div><ol aria-label="SCPI transcript">{session.transcript.slice(-6).map((entry, index) => <li key={`${entry.message}-${index}`}><span>{entry.direction === 'write' ? '→' : '←'}</span><code>{entry.message}</code><small>{entry.outcome}</small></li>)}</ol></div></PlotFrame>
  </LabShell>;
}

function PaLab() {
  const [pinDbm, setPinDbm] = useState(-25);
  const [smallSignalGainDb, setSmallSignalGainDb] = useState(24);
  const [externalAttenuationDb, setExternalAttenuationDb] = useState(30);
  const [reverseSweep, setReverseSweep] = useState<'blocked' | 'enabled'>('blocked');
  const compressionDb = estimateEnaPaCompressionDb(pinDbm);
  const poutDbm = pinDbm + smallSignalGainDb - compressionDb;
  const safety = evaluateEnaReceiverSafety(poutDbm, externalAttenuationDb, 0, 3);
  const sourceCompression = pinDbm > -5 ? (pinDbm + 5) * 0.08 : 0;
  const ledger: readonly LedgerEntry[] = [
    { label: '변경', value: `Pin ${format(pinDbm, 1)} dBm · external attenuation ${format(externalAttenuationDb, 1)} dB` },
    { label: '직접 효과', value: `PA output ${format(poutDbm, 1)} dBm이 port 2 path를 통해 ${format(safety.port2ReceiverInputDbm, 1)} dBm으로 도달합니다.`, tone: safety.safe ? 'active' : 'warning' },
    { label: '화면 결과', value: `${format(compressionDb)} dB compression · receiver ${safety.safe ? 'chosen working envelope 안' : '보호 조건 위반'}` },
    { label: '비용·한계', value: `${reverseSweep === 'enabled' ? 'Full 2-port는 PA output을 reverse-drive할 수 있습니다.' : 'S12/S22 reverse stimulus는 차단했습니다.'} EVM·ACLR는 후속 SA/VSA가 필요합니다.` },
  ];
  return <LabShell labId="instrument:vna:ena-pa-characterization" title="E5080B PA Characterization" question="PA gain compression을 볼 때 DUT보다 VNA receiver가 먼저 위험해질 수 있는 이유는?" description="Small-signal S-parameter에서 power sweep로 넘어갈 때 source drive, PA output, external attenuation, receiver working limit와 reverse stimulus를 분리합니다." activeStages={['source', 'dut', 'acquisition', 'dsp', 'display']} stageMap={{ 'ena-pa-pin': ['source', 'dut', 'acquisition', 'display'], 'ena-pa-attenuation': ['dut', 'acquisition', 'display'], 'ena-pa-reverse': ['source', 'dut', 'acquisition'] }} controls={<>
    <RangeControl id="ena-pa-pin" label="Estimated DUT Pin" min={-40} max={0} step={0.5} value={pinDbm} valueText={`${format(pinDbm, 1)} dBm`} onChange={(event) => setPinDbm(Number(event.currentTarget.value))} />
    <RangeControl id="ena-pa-gain" label="Small-signal gain" min={10} max={35} step={0.5} value={smallSignalGainDb} valueText={`${format(smallSignalGainDb, 1)} dB`} onChange={(event) => setSmallSignalGainDb(Number(event.currentTarget.value))} />
    <RangeControl id="ena-pa-attenuation" label="External port 2 attenuation" min={0} max={50} step={1} value={externalAttenuationDb} valueText={`${format(externalAttenuationDb, 0)} dB`} onChange={(event) => setExternalAttenuationDb(Number(event.currentTarget.value))} />
    <SelectControl id="ena-pa-reverse" label="Reverse stimulus permission" value={reverseSweep} onChange={(event) => setReverseSweep(event.currentTarget.value as typeof reverseSweep)}><option value="blocked">Blocked · S21 only</option><option value="enabled">Explicitly enabled · full 2-port</option></SelectControl>
  </>} ledger={ledger} prediction={{ id: 'ena-pa-receiver-prediction', prompt: 'PA Pout이 +25 dBm이고 port 2 앞 attenuator가 10 dB이면 receiver path 예상 입력은?', options: ['+15 dBm', '+35 dBm', '−15 dBm'], correctIndex: 0, explanation: '단순 budget은 +25 − 10 = +15 dBm입니다. 이 값을 장비별 working/damage limit과 guard margin에 비교해야 합니다.' }} note="+27 dBm 또는 ±35 VDC damage 수치는 동작 목표가 아닙니다. Frequency별 receiver compression specification보다 충분히 낮은 자체 working limit와 guard를 정하고 external attenuator/coupler를 사용하세요.">
    <EnaPath active={['STIM', 'SEP', 'RX', 'CAL', 'MATH', 'VIEW']} />
    <Readouts items={[{ label: 'PA Pout model', value: `${format(poutDbm, 1)} dBm`, tone: 'reference' }, { label: 'Port 2 receiver estimate', value: `${format(safety.port2ReceiverInputDbm, 1)} dBm`, tone: safety.safe ? 'active' : 'warning' }, { label: 'Compression', value: `${format(compressionDb)} dB` }, { label: 'Reverse drive', value: reverseSweep === 'blocked' ? 'blocked' : 'enabled', tone: reverseSweep === 'blocked' ? 'active' : 'warning' }]} />
    <PlotFrame title="Source → PA → receiver power budget" observation="Source port와 receiver port는 같은 safe level이 아닙니다. ENA receiver gain-auto는 damage protection이나 external attenuation을 대체하지 않습니다." table={<DataTable caption="PA characterization power budget" rows={[{ metric: 'DUT Pin', value: `${format(pinDbm, 1)} dBm`, meaning: 'DUT input plane estimate' }, { metric: 'DUT Pout', value: `${format(poutDbm, 1)} dBm`, meaning: `Gain ${format(smallSignalGainDb - compressionDb)} dB after compression` }, { metric: 'External attenuation', value: `${format(externalAttenuationDb, 1)} dB`, meaning: 'Physical component before port 2' }, { metric: 'Receiver estimate', value: `${format(safety.port2ReceiverInputDbm, 1)} dBm`, meaning: safety.reason }, { metric: 'Source compression audit', value: `${format(sourceCompression)} dB model`, meaning: 'Through audit separates source/path from DUT compression' }]} />}><div className="ena-power-path"><div><span>PORT 1</span><strong>{format(pinDbm, 1)} dBm</strong><small>calibrated Pin plane</small></div><i aria-hidden="true">→</i><div><span>PA</span><strong>{format(smallSignalGainDb - compressionDb)} dB</strong><small>{format(compressionDb)} dB compressed</small></div><i aria-hidden="true">→</i><div><span>ATTEN</span><strong>−{format(externalAttenuationDb, 1)} dB</strong><small>external protection</small></div><i aria-hidden="true">→</i><div data-safe={safety.safe}><span>PORT 2 RX</span><strong>{format(safety.port2ReceiverInputDbm, 1)} dBm</strong><small>{safety.safe ? 'working envelope 안' : 'reduce power / add loss'}</small></div></div></PlotFrame>
  </LabShell>;
}

export default function EnaInstrumentLab({ scenario }: Props) {
  if (scenario === 'ena-safe-sweep') return <SafeSweepLab />;
  if (scenario === 'ena-calibration') return <CalibrationLab />;
  if (scenario === 'ena-sparameters') return <SParameterLab />;
  if (scenario === 'ena-scpi-data') return <ScpiDataLab />;
  return <PaLab />;
}
