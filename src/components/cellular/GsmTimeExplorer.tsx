import { useMemo, useState } from 'react';
import {
  GSM_NORMAL_BURST,
  GSM_TIMESLOT_SECONDS,
  GSM_TDMA_FRAME_SECONDS,
  gsmMultislotDutyCycle,
  gsmTimeslotStartSeconds,
} from '@/lib/cellular';

const BURST_FIELDS = GSM_NORMAL_BURST.fields;

export default function GsmTimeExplorer({ preset = 'timeslot' }: { preset?: string }) {
  const [timeslot, setTimeslot] = useState(preset === 'normal-burst' ? 3 : 0);
  const [activeSlots, setActiveSlots] = useState(preset === 'multislot' ? 4 : 1);
  const [modulation, setModulation] = useState<'GMSK' | '8PSK'>(preset === 'edge-8psk' ? '8PSK' : 'GMSK');
  const activeSet = useMemo(
    () => new Set(Array.from({ length: activeSlots }, (_, index) => (timeslot + index) % 8)),
    [activeSlots, timeslot],
  );
  const startUs = gsmTimeslotStartSeconds(timeslot) * 1e6;
  const duty = gsmMultislotDutyCycle(activeSlots) * 100;

  return (
    <section className="cellular-visual gsm-explorer" aria-labelledby="gsm-explorer-title">
      <header className="cellular-visual__header">
        <div><p>GSM Time Structure Explorer</p><h3 id="gsm-explorer-title">Timeslot → normal burst → PA current pulse</h3></div>
        <p className="cellular-model-note">정확한 nominal timing · coded bit sequence는 생략</p>
      </header>

      <div className="cellular-controls cellular-controls--three">
        <label>Start timeslot <output>{timeslot}</output><input type="range" min="0" max="7" step="1" value={timeslot} onChange={(event) => setTimeslot(Number(event.currentTarget.value))} /></label>
        <label>Active slots <output>{activeSlots}</output><input type="range" min="1" max="4" step="1" value={activeSlots} onChange={(event) => setActiveSlots(Number(event.currentTarget.value))} /></label>
        <label>Modulation<select value={modulation} onChange={(event) => setModulation(event.currentTarget.value as 'GMSK' | '8PSK')}><option>GMSK</option><option>8PSK</option></select></label>
      </div>

      <div className="gsm-frame" role="group" aria-label={`8개 timeslot 중 ${[...activeSet].join(', ')} 활성`}>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} data-active={activeSet.has(index)} data-selected={index === timeslot}>
            <span>TS {index}</span><strong>{activeSet.has(index) ? 'TX' : 'idle'}</strong>
          </div>
        ))}
      </div>

      <div className="gsm-burst-fields" role="group" aria-label="GMSK normal burst fields">
        {BURST_FIELDS.map((field) => (
          <div key={field.id} data-field={field.id} style={{ flexGrow: field.symbolPeriods }} title={field.role}>
            <strong>{field.label}</strong><span>{field.symbolPeriods}</span>
          </div>
        ))}
      </div>

      <div className="gsm-linked-views">
        <svg viewBox="0 0 720 150" role="img" aria-label={`${modulation} burst envelope와 PA current의 시간 관계`}>
          <title>{modulation} burst envelope and PA current</title>
          <line className="plot-grid" x1="40" y1="42" x2="700" y2="42" />
          <line className="plot-grid" x1="40" y1="112" x2="700" y2="112" />
          <text className="plot-label" x="40" y="22">RF magnitude · {modulation}</text>
          <text className="plot-label" x="40" y="142">PA current</text>
          <path className="plot-forward" d="M40 68 L78 68 Q96 68 112 42 L628 42 Q646 42 664 68 L700 68" />
          <path className="plot-reference" d="M40 126 L72 126 Q92 126 104 106 L642 106 Q658 106 672 126 L700 126" />
          <line className="plot-marker" x1="112" y1="28" x2="112" y2="130" />
          <text className="plot-marker-label" x="118" y="36">useful burst</text>
        </svg>
        <div className="gsm-readouts">
          <p><span>Slot start</span><strong>{startUs.toFixed(3)} µs</strong></p>
          <p><span>Slot duration</span><strong>{(GSM_TIMESLOT_SECONDS * 1e6).toFixed(3)} µs</strong></p>
          <p><span>Frame duration</span><strong>{(GSM_TDMA_FRAME_SECONDS * 1e3).toFixed(3)} ms</strong></p>
          <p><span>Nominal occupancy</span><strong>{duty.toFixed(1)}%</strong></p>
        </div>
      </div>

      <details className="cellular-data-alternative">
        <summary>Normal burst field 값을 표로 보기</summary>
        <table><thead><tr><th>Field</th><th>Symbol periods</th><th>역할</th></tr></thead><tbody>{BURST_FIELDS.map((field) => <tr key={field.id}><td>{field.label}</td><td>{field.symbolPeriods}</td><td>{field.role}</td></tr>)}</tbody></table>
      </details>

      <dl className="cellular-ledger">
        <div><dt>변경</dt><dd>TS {timeslot}부터 {activeSlots} slot · {modulation}</dd></div>
        <div><dt>직접 효과</dt><dd>Frame occupancy {duty.toFixed(1)}%, burst 시작 {startUs.toFixed(1)} µs</dd></div>
        <div><dt>화면 결과</dt><dd>RF envelope와 PA current pulse가 같은 slot으로 이동</dd></div>
        <div><dt>한계</dt><dd>실제 ramp mask, coded sequence와 multislot class는 적용 test condition에서 확인</dd></div>
      </dl>
    </section>
  );
}
