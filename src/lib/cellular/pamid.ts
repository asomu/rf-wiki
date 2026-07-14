import type { DiagnosticSignature, PamidTopology } from '../../types';

export const PAMID_TOPOLOGIES: readonly PamidTopology[] = Object.freeze([
  {
    id: 'gsm-pa-asm',
    label: 'GSM PA + harmonic filter + ASM',
    duplex: 'TDMA',
    blocks: [
      { id: 'trx', label: 'Transceiver IQ/RF', kind: 'transceiver', role: 'burst와 ramp가 포함된 RF drive 생성' },
      { id: 'pa', label: 'Multimode PA', kind: 'pa', role: 'timeslot 동안 목표 burst power로 증폭', controlledBy: 'gain mode + bias' },
      { id: 'filter', label: 'Harmonic filter', kind: 'filter', role: 'PA harmonic과 wideband emission 감쇠' },
      { id: 'asm', label: 'Antenna switch module', kind: 'switch', role: '선택 band TX path를 antenna에 연결', controlledBy: 'generic RFFE state' },
      { id: 'ant', label: 'Antenna port', kind: 'antenna', role: 'module DVT 출력 기준면' },
    ],
    txPath: ['trx', 'pa', 'filter', 'asm', 'ant'],
    rxPath: ['ant', 'asm'],
  },
  {
    id: 'fdd-pamid',
    label: 'LTE/NR FDD PAMiD',
    duplex: 'FDD',
    blocks: [
      { id: 'trx', label: 'Transceiver RF', kind: 'transceiver', role: 'PUSCH waveform과 power trajectory 생성' },
      { id: 'match', label: 'Input match / balun', kind: 'input-match', role: 'single-ended/differential 변환과 PA 입력 정합' },
      { id: 'pa', label: 'Driver + final PA', kind: 'pa', role: 'gain mode별 RF 전력 증폭', controlledBy: 'bias + gain mode' },
      { id: 'supply', label: 'APT / ET supply', kind: 'supply', role: '평균 또는 envelope 추종 supply 제공', controlledBy: 'supply mode + timing' },
      { id: 'duplexer', label: 'Duplexer', kind: 'duplexer', role: '동시 TX/RX를 주파수로 분리' },
      { id: 'coupler', label: 'Directional coupler', kind: 'coupler', role: 'forward/reverse sample 제공' },
      { id: 'asm', label: 'ASM', kind: 'switch', role: '활성 band duplexer를 antenna에 연결', controlledBy: 'generic RFFE state' },
      { id: 'ant', label: 'Antenna port', kind: 'antenna', role: 'module 출력과 duplexer RX 입력 기준면' },
      { id: 'rx', label: 'Rx branch', kind: 'receiver', role: 'duplexer RX port에서 LNA/transceiver로 연결' },
    ],
    txPath: ['trx', 'match', 'pa', 'duplexer', 'coupler', 'asm', 'ant'],
    rxPath: ['ant', 'asm', 'duplexer', 'rx'],
  },
  {
    id: 'tdd-txm',
    label: 'NR FR1 TDD TxM',
    duplex: 'TDD',
    blocks: [
      { id: 'trx', label: 'Transceiver RF', kind: 'transceiver', role: 'TDD slot과 PUSCH waveform 생성' },
      { id: 'pa', label: 'Driver + final PA', kind: 'pa', role: 'TX symbol 동안만 활성화되는 RF 증폭', controlledBy: 'bias + gain mode + TX enable' },
      { id: 'supply', label: 'APT / ET supply', kind: 'supply', role: 'PA supply trajectory 제공', controlledBy: 'supply mode + envelope timing' },
      { id: 'filter', label: 'Band-pass filter', kind: 'filter', role: 'band 밖 emission과 harmonic 억제' },
      { id: 'switch', label: 'T/R switch', kind: 'switch', role: 'D/U/F symbol 경계에서 antenna path 전환', controlledBy: 'generic RFFE trigger' },
      { id: 'coupler', label: 'Directional coupler', kind: 'coupler', role: 'TX forward/reverse feedback sample' },
      { id: 'ant', label: 'Antenna port', kind: 'antenna', role: 'TX/RX 공용 기준면' },
      { id: 'rx', label: 'Rx branch', kind: 'receiver', role: 'RX symbol 동안 antenna를 LNA 경로에 연결' },
    ],
    txPath: ['trx', 'pa', 'filter', 'switch', 'coupler', 'ant'],
    rxPath: ['ant', 'coupler', 'switch', 'rx'],
  },
]);

export function getPamidTopology(id: PamidTopology['id']): PamidTopology {
  const topology = PAMID_TOPOLOGIES.find((candidate) => candidate.id === id);
  if (!topology) throw new RangeError(`Unknown PAMiD topology: ${id}`);
  return topology;
}

export const DIAGNOSTIC_SIGNATURES: readonly DiagnosticSignature[] = Object.freeze([
  {
    id: 'power-gain',
    symptom: 'Pout 또는 gain이 목표보다 낮거나 높다',
    observedViews: ['Pout vs Pin', 'gain vs frequency', 'forward/reverse power'],
    likelyStages: [
      { stage: 'source', priority: 1, hypothesis: 'SG reference-plane correction 또는 source compression 오류' },
      { stage: 'pamid', priority: 1, hypothesis: 'gain mode, bias, supply 또는 output path 상태 오류' },
      { stage: 'fixture', priority: 2, hypothesis: 'cable/connector/fixture loss 변화' },
    ],
    controlChecks: ['RF input 기준면 power', 'band/path/gain mode read-back', 'APT/ET supply state'],
    discriminatingMeasurements: [
      { action: 'PAMiD 입력·출력을 같은 sensor로 번갈아 측정', separates: 'source/fixture와 module', expectedEvidence: '입력 정상·출력 이상이면 module 쪽으로 좁혀짐' },
    ],
    falsePositives: ['analyzer external gain/loss correction 중복', '평균 power와 burst/slot power 혼동'],
    relatedHrefs: ['/cellular/pamid/reference-planes/', '/instruments/power-sensor/pa-power-budget/'],
  },
  {
    id: 'current-pae',
    symptom: 'DC current가 높거나 PAE가 낮다',
    observedViews: ['current vs time', 'Pout vs Pin', 'supply voltage droop'],
    likelyStages: [
      { stage: 'pamid', priority: 1, hypothesis: 'bias/gain mode 또는 ET/APT timing 오류' },
      { stage: 'load', priority: 2, hypothesis: 'mismatch가 load line과 효율을 이동' },
      { stage: 'analyzer', priority: 3, hypothesis: 'Pout 측정 기준면 오차로 PAE 계산 왜곡' },
    ],
    controlChecks: ['bias state', 'supply mode와 voltage', 'duty cycle/trigger alignment'],
    discriminatingMeasurements: [
      { action: '동일 Pout에서 fixed supply와 APT/ET 상태 비교', separates: 'RF path와 supply/control', expectedEvidence: 'RF 품질은 비슷하고 current만 변하면 supply/control 가능성이 큼' },
    ],
    falsePositives: ['평균 current와 active-slot current 혼동', 'PAE에 driver power 또는 quiescent power 누락'],
    relatedHrefs: ['/cellular/pamid/apt-et/', '/instruments/power-supply/pa-dc-power/'],
  },
  {
    id: 'evm',
    symptom: 'EVM이 fail한다',
    observedViews: ['constellation', 'EVM vs symbol', 'EVM vs subcarrier', 'AM-AM/AM-PM'],
    likelyStages: [
      { stage: 'source', priority: 1, hypothesis: 'source IQ 또는 reference waveform 자체 EVM' },
      { stage: 'pamid', priority: 1, hypothesis: 'compression, AM-PM, ET timing 또는 memory effect' },
      { stage: 'analyzer', priority: 2, hypothesis: 'reference, equalizer, trigger, overload 설정 오류' },
    ],
    controlChecks: ['source EVM bypass', 'Pout backoff', 'analyzer reference와 equalizer'],
    discriminatingMeasurements: [
      { action: 'DUT bypass와 3 dB backoff 비교', separates: 'source/analyzer와 PAMiD 비선형', expectedEvidence: 'backoff로 빠르게 개선되면 PA compression 가능성이 큼' },
    ],
    falsePositives: ['잘못된 waveform demodulation preset', 'fixture group delay를 DUT memory effect로 오진'],
    relatedHrefs: ['/cellular/foundations/iq-magnitude-phase-psd-papr/', '/instruments/sa-mxa/iq-capture-trigger/'],
  },
  {
    id: 'aclr-sem',
    symptom: 'ACLR 또는 SEM이 fail한다',
    observedViews: ['channel power', 'adjacent-channel spectrum', 'SEM mask', 'CCDF'],
    likelyStages: [
      { stage: 'source', priority: 1, hypothesis: 'source ACLR 또는 waveform filtering 문제' },
      { stage: 'pamid', priority: 1, hypothesis: 'PA spectral regrowth, DPD/CFR 또는 gain mode 문제' },
      { stage: 'analyzer', priority: 2, hypothesis: 'RBW/filter/integration range 또는 overload' },
    ],
    controlChecks: ['source bypass ACLR', 'allocated RB와 measurement bandwidth', 'Pout/DPD/CFR state'],
    discriminatingMeasurements: [
      { action: 'source bypass와 output backoff sweep', separates: 'source floor와 PA regrowth', expectedEvidence: 'backoff에 따라 인접 누설이 빠르게 줄면 PA 비선형 기여' },
    ],
    falsePositives: ['total power normalization 변경', 'analyzer 내부 attenuation 부족'],
    relatedHrefs: ['/cellular/lte/papr-ccdf-mpr/', '/instruments/sa-mxa/pa-spectrum-analysis/'],
  },
  {
    id: 'harmonic',
    symptom: 'Harmonic이 높다',
    observedViews: ['2f/3f marker', 'harmonic filter S21', 'Pout sweep'],
    likelyStages: [
      { stage: 'pamid', priority: 1, hypothesis: 'PA harmonic generation 또는 filter/switch path 오류' },
      { stage: 'analyzer', priority: 2, hypothesis: 'mixer harmonic 또는 input overload' },
      { stage: 'fixture', priority: 3, hypothesis: '케이블/adapter의 주파수별 loss correction 누락' },
    ],
    controlChecks: ['selected filter path', 'fundamental input level', 'analyzer preselector/attenuation'],
    discriminatingMeasurements: [
      { action: '외부 notch/low-pass와 attenuation을 추가해 재측정', separates: '실제 DUT harmonic과 analyzer-generated response', expectedEvidence: 'fundamental attenuation에 비정상적으로 민감하면 analyzer artifact 가능성' },
    ],
    falsePositives: ['analyzer 자체 harmonic distortion', 'harmonic 주파수 path-loss 보정 누락'],
    relatedHrefs: ['/cellular/pamid/filter-duplexer-switch/', '/instruments/sa-mxa/safe-input/'],
  },
  {
    id: 'spurious',
    symptom: 'Non-harmonic spurious가 발생한다',
    observedViews: ['wide span spectrum', 'spur vs time', 'supply spectrum'],
    likelyStages: [
      { stage: 'source', priority: 1, hypothesis: 'LO/image/clock spur가 이미 입력에 존재' },
      { stage: 'pamid', priority: 1, hypothesis: 'DC-DC/RFFE clock mixing 또는 oscillation' },
      { stage: 'fixture', priority: 2, hypothesis: '외부 digital/supply coupling' },
    ],
    controlChecks: ['spur offset와 clock/DC-DC frequency 관계', 'mode/gain/band state', 'source output-off floor'],
    discriminatingMeasurements: [
      { action: 'RF input off, PA bias on/off, DC-DC frequency 변경을 순차 비교', separates: 'RF mixing, self-oscillation, supply coupling', expectedEvidence: 'spur가 따라 움직이는 자극이 원인 stage를 지목' },
    ],
    falsePositives: ['ambient RF pickup', 'zero-span sweep timing alias'],
    relatedHrefs: ['/cellular/pamid/impairment-responsibility/', '/instruments/sa-mxa/sweep-rbw-detector/'],
  },
  {
    id: 'tx-noise-desense',
    symptom: 'Tx noise 또는 Rx desense가 나쁘다',
    observedViews: ['Rx-band noise PSD', 'duplexer isolation', 'sensitivity delta'],
    likelyStages: [
      { stage: 'pamid', priority: 1, hypothesis: 'PA wideband noise와 duplexer/switch isolation의 합성' },
      { stage: 'fixture', priority: 2, hypothesis: 'TX-RX bench leakage가 DUT isolation을 우회' },
      { stage: 'analyzer', priority: 3, hypothesis: 'noise floor 또는 preamp compression 한계' },
    ],
    controlChecks: ['TX power와 gain mode', 'RX band/filter path', 'duplexer/ASM state'],
    discriminatingMeasurements: [
      { action: 'TX port noise와 antenna-to-RX leakage를 분리 측정', separates: 'PA noise와 passive isolation', expectedEvidence: '각 항을 power-domain budget으로 합쳐 desense와 비교' },
    ],
    falsePositives: ['bench cable radiation', 'SA DANL을 DUT noise로 해석'],
    relatedHrefs: ['/cellular/pamid/tx-noise-rx-desense/', '/learn/power-coupling/'],
  },
  {
    id: 'ripple-edge',
    symptom: 'Gain ripple 또는 band-edge 성능이 나쁘다',
    observedViews: ['gain vs frequency', 'S11/S22', 'filter S21/group delay'],
    likelyStages: [
      { stage: 'pamid', priority: 1, hypothesis: 'matching/filter/duplexer path의 frequency response' },
      { stage: 'fixture', priority: 1, hypothesis: 'fixture mismatch ripple 또는 de-embedding 오류' },
      { stage: 'load', priority: 2, hypothesis: 'load reflection이 PA gain과 filter response를 변화' },
    ],
    controlChecks: ['calibration plane', 'band path', 'source leveling'],
    discriminatingMeasurements: [
      { action: 'passive path VNA 측정과 active gain sweep를 같은 기준면에서 비교', separates: 'passive ripple와 PA gain variation', expectedEvidence: '주파수 패턴이 겹치면 filter/fixture 가능성이 큼' },
    ],
    falsePositives: ['VNA/SG source power flatness', 'connector repeatability'],
    relatedHrefs: ['/cellular/pamid/filter-duplexer-switch/', '/instruments/vna-ena/calibration-reference-plane/'],
  },
  {
    id: 'switching-transient',
    symptom: 'Burst 또는 TDD switching transient가 fail한다',
    observedViews: ['power vs time', 'EVM vs symbol', 'current vs time', 'trigger timing'],
    likelyStages: [
      { stage: 'transceiver', priority: 1, hypothesis: 'RF ramp/slot timing 또는 envelope alignment 오류' },
      { stage: 'pamid', priority: 1, hypothesis: 'PA enable, RFFE trigger, T/R switch 또는 supply settling' },
      { stage: 'analyzer', priority: 2, hypothesis: 'trigger delay와 acquisition gate 오류' },
    ],
    controlChecks: ['trigger armed/state applied', 'PA enable와 switch edge', 'APT/ET settling'],
    discriminatingMeasurements: [
      { action: 'RF envelope·PA enable·supply current를 공통 trigger로 겹쳐 측정', separates: 'source, control, supply settling', expectedEvidence: '가장 먼저 잘못된 edge가 책임 stage의 후보' },
    ],
    falsePositives: ['analyzer gate가 transient를 잘라냄', 'cable delay 미보정'],
    relatedHrefs: ['/cellular/nr/tdd-du-flex-symbol/', '/instruments/sa-mxa/iq-capture-trigger/'],
  },
  {
    id: 'mode-state-calibration',
    symptom: 'Mode, MIPI state 또는 calibration이 잘못됐다',
    observedViews: ['state read-back', 'band-path gain signature', 'current signature'],
    likelyStages: [
      { stage: 'transceiver', priority: 1, hypothesis: 'band/mode command sequence 또는 trigger 시점 오류' },
      { stage: 'pamid', priority: 1, hypothesis: 'shadow register가 apply되지 않았거나 잘못된 USID 대상' },
      { stage: 'analyzer', priority: 3, hypothesis: '이전 correction/preset 상태가 남음' },
    ],
    controlChecks: ['USID와 write target', 'shadow vs active state', 'band/gain/path read-back'],
    discriminatingMeasurements: [
      { action: 'known-safe state로 전환 후 각 write/trigger 뒤 signature 확인', separates: 'command transport와 RF state application', expectedEvidence: 'read-back와 RF signature가 갈라지는 지점이 오류 경계' },
    ],
    falsePositives: ['실제 vendor map과 교육용 generic state 혼동', '기존 calibration correction 잔류'],
    relatedHrefs: ['/cellular/pamid/generic-mipi-rffe/', '/cellular/pamid/gain-mode-bias/'],
  },
]);

export function getDiagnosticSignature(id: string): DiagnosticSignature {
  const signature = DIAGNOSTIC_SIGNATURES.find((candidate) => candidate.id === id);
  if (!signature) throw new RangeError(`Unknown diagnostic signature: ${id}`);
  return signature;
}
