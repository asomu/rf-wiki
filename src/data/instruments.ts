import type {
  InstrumentFamily,
  InstrumentKind,
  InstrumentModel,
  InstrumentProfileId,
} from '../types/instruments';

export type InstrumentId = InstrumentProfileId;

export type InstrumentChapterId =
  | 'safe-cw'
  | 'waveform-iq'
  | 'arb-playback'
  | 'scpi-pyvisa'
  | 'pa-test-program'
  | 'safe-input'
  | 'sweep-rbw-detector'
  | 'iq-capture-trigger'
  | 'sa-scpi-measurements'
  | 'pa-spectrum-analysis'
  | 'safe-sweep'
  | 'calibration-reference-plane'
  | 'sparameters-smith-time'
  | 'vna-scpi-data'
  | 'pa-characterization'
  | 'safe-power'
  | 'average-peak-burst'
  | 'correction-uncertainty'
  | 'sensor-scpi-trigger'
  | 'pa-power-budget'
  | 'safe-bias'
  | 'cv-cc-protection'
  | 'remote-sense-wiring'
  | 'psu-scpi-sequence'
  | 'pa-dc-power';

export type InstrumentLabId =
  | 'mxg-safe-cw'
  | 'mxg-waveform-iq'
  | 'mxg-arb-playback'
  | 'mxg-scpi-pyvisa'
  | 'mxg-pa-test-program'
  | 'mxa-safe-input'
  | 'mxa-sweep-rbw'
  | 'mxa-iq-trigger'
  | 'mxa-scpi-measurements'
  | 'mxa-pa-analysis'
  | 'ena-safe-sweep'
  | 'ena-calibration'
  | 'ena-sparameters'
  | 'ena-scpi-data'
  | 'ena-pa-characterization'
  | 'sensor-safe-power'
  | 'sensor-average-peak'
  | 'sensor-correction'
  | 'sensor-scpi-trigger'
  | 'sensor-pa-power-budget'
  | 'psu-safe-bias'
  | 'psu-cv-cc'
  | 'psu-remote-sense'
  | 'psu-scpi-sequence'
  | 'psu-pa-dc-power';

export interface InstrumentChapterDefinition {
  readonly id: InstrumentChapterId;
  readonly order: number;
  readonly shortTitle: string;
  readonly title: string;
  readonly question: string;
  readonly estimatedMinutes: number;
  readonly labId: InstrumentLabId;
}

export interface InstrumentProfileRow {
  readonly label: string;
  readonly value: string;
}

export interface InstrumentStage {
  readonly label: string;
  readonly detail: string;
}

export interface InstrumentDefinition {
  readonly id: InstrumentId;
  readonly kind: InstrumentKind;
  readonly route: string;
  readonly progressNamespace: 'sg' | 'sa' | 'vna' | 'sensor' | 'psu';
  readonly order: number;
  readonly code: 'SG' | 'SA' | 'NA' | 'PWR' | 'PSU';
  readonly manufacturer: 'Keysight Technologies';
  readonly family: InstrumentFamily;
  readonly model: InstrumentModel;
  readonly supportedOptions: readonly string[];
  readonly displayName: string;
  readonly category: string;
  readonly roadmapTitle: string;
  readonly roadmapQuestion: string;
  readonly rangeLabel: string;
  readonly firmwareScope: string;
  readonly documentationBaseline: string;
  readonly optionNotes: readonly string[];
  readonly remoteInterfaces: readonly string[];
  readonly profileRows: readonly InstrumentProfileRow[];
  readonly stages: readonly InstrumentStage[];
  readonly hubHeadline: string;
  readonly hubDescription: string;
  readonly pathTitle: string;
  readonly chapterLead: string;
  readonly completionTitle: string;
  readonly completionDescription: string;
  readonly pythonSummary: string;
  readonly chapters: readonly InstrumentChapterDefinition[];
}

export const n5182b: InstrumentDefinition = {
  id: 'keysight-n5182b',
  kind: 'signal-generator',
  route: 'sg-mxg',
  progressNamespace: 'sg',
  order: 1,
  code: 'SG',
  manufacturer: 'Keysight Technologies',
  family: 'MXG X-Series',
  model: 'N5182B',
  supportedOptions: ['506', '656'],
  displayName: 'N5182B MXG',
  category: 'RF vector signal generator',
  roadmapTitle: 'Signal Generator',
  roadmapQuestion: '원하는 CW와 IQ waveform을 안전하고 반복 가능하게 어떻게 만들까?',
  rangeLabel: '9 kHz to 6 GHz · Option 506',
  firmwareScope: 'B.01.96',
  documentationBaseline: 'X-Series Signal Generators SCPI Command Reference N5180-90057, 2024-05-31',
  optionNotes: [
    'Option 656은 내부 baseband/ARB generator를 제공하며 최대 100 MSa/s와 nominal 80 MHz RF bandwidth를 지원한다.',
    'Option 657이 함께 있으면 최대 200 MSa/s와 nominal 160 MHz RF bandwidth로 확장된다.',
    'Waveform memory 크기와 일부 기능은 Option 022/023 및 설치 firmware에 따라 달라지므로 장비의 option·firmware를 먼저 조회한다.'
  ],
  remoteInterfaces: ['LAN', 'USB remote interface', 'GPIB'],
  profileRows: [
    { label: 'Profile', value: 'Option 506 + 656' },
    { label: 'Frequency', value: '9 kHz–6 GHz' },
    { label: 'ARB', value: '100 MSa/s · nominal 80 MHz' },
    { label: 'Firmware', value: 'B.01.96' },
  ],
  stages: [
    { label: 'State', detail: 'Front panel · SCPI' },
    { label: 'Memory', detail: 'I/Q segment · marker' },
    { label: 'Clock', detail: 'Interpolation · DAC' },
    { label: 'RF', detail: 'IQ modulator · LO' },
    { label: 'Level', detail: 'ALC · attenuator' },
    { label: 'Plane', detail: 'Cable · DUT input' },
  ],
  hubHeadline: 'MXG가 만든 IQ가 DUT의 RF 입력이 되는 경로를 따라갑니다.',
  hubDescription: '설정값, waveform memory, DAC·IQ modulator, RF level과 SCPI session을 하나의 source state로 연결합니다.',
  pathTitle: '한 command가 어떤 source stage까지 도달하는지 먼저 봅니다.',
  chapterLead: 'RF OFF에서 PA 자동 시험까지 한 상태씩 엽니다.',
  completionTitle: '다섯 개 source state를 모두 닫았습니다.',
  completionDescription: '필요한 챕터를 다시 열어 조건을 바꿔보세요.',
  pythonSummary: 'Dry-run, N5182B model·option 확인, signed-16 IQ upload와 finally RF OFF가 포함됩니다.',
  chapters: [
    { id: 'safe-cw', order: 1, shortTitle: '안전한 CW', title: 'RF를 켜기 전에 어떤 상태를 먼저 고정해야 할까?', question: 'Frequency와 power를 설정했어도 왜 RF Off에서 시작해야 할까?', estimatedMinutes: 45, labId: 'mxg-safe-cw' },
    { id: 'waveform-iq', order: 2, shortTitle: 'Waveform·IQ', title: 'Waveform 파일은 실제 RF의 무엇을 저장할까?', question: 'I/Q sample, sample rate와 scaling은 RF 출력의 어느 성질을 정할까?', estimatedMinutes: 55, labId: 'mxg-waveform-iq' },
    { id: 'arb-playback', order: 3, shortTitle: 'ARB 재생', title: '메모리에 넣은 IQ가 언제 연속 RF 파형이 될까?', question: 'Load, select, clock, trigger, ARB, Mod와 RF On은 왜 서로 다른 단계일까?', estimatedMinutes: 60, labId: 'mxg-arb-playback' },
    { id: 'scpi-pyvisa', order: 4, shortTitle: 'SCPI·PyVISA', title: '명령을 보냈다는 사실과 장비가 준비됐다는 사실은 왜 다를까?', question: 'Query-back, *OPC?와 error queue로 재현 가능한 장비 상태를 어떻게 증명할까?', estimatedMinutes: 75, labId: 'mxg-scpi-pyvisa' },
    { id: 'pa-test-program', order: 5, shortTitle: 'PA 시험 프로그램', title: 'PA 자동 시험은 어떤 상태기계로 만들어야 안전할까?', question: 'Bias, RF drive, waveform, acquisition과 실패 복구를 어떤 순서로 묶어야 할까?', estimatedMinutes: 80, labId: 'mxg-pa-test-program' }
  ]
} as const;

export const n9020b: InstrumentDefinition = {
  id: 'keysight-n9020b',
  kind: 'signal-analyzer',
  route: 'sa-mxa',
  progressNamespace: 'sa',
  order: 2,
  code: 'SA',
  manufacturer: 'Keysight Technologies',
  family: 'MXA X-Series',
  model: 'N9020B',
  supportedOptions: ['526', 'B1X', 'MPB', 'P26'],
  displayName: 'N9020B MXA',
  category: 'X-Series signal and spectrum analyzer',
  roadmapTitle: 'Signal / Spectrum Analyzer',
  roadmapQuestion: '입력 신호를 안전하게 받아 spectrum, IQ와 PA 측정 결과로 어떻게 바꿀까?',
  rangeLabel: '10 Hz to 26.5 GHz · 160 MHz analysis bandwidth',
  firmwareScope: 'A.43.49',
  documentationBaseline: 'N9020B Specifications 9018-04846, X-Series Programming Help, firmware A.43.49',
  optionNotes: [
    '교육 프로필은 N9020B Option 526(26.5 GHz), B1X(160 MHz analysis bandwidth), MPB microwave preselector bypass, P26 preamplifier와 Spectrum Analyzer application을 기준으로 한다.',
    'B1X의 160 MHz는 한 번에 digitize할 수 있는 최대 analysis bandwidth다. Frequency span, RBW와 IQ sample rate는 서로 같은 설정이 아니다.',
    'P26 preamp는 낮은 level의 noise·spur 관찰에 유용하지만 PA 출력 측정에서는 기본 OFF다. Mixer level은 input − attenuation + preamp gain으로 따로 확인한다.',
    '+30 dBm average와 조건부 +50 dBm pulse는 damage level이지 운용 목표가 아니다. Coupler·attenuator와 guard를 connector 앞에서 계산한다.',
  ],
  remoteInterfaces: ['LAN / HiSLIP', 'USB', 'GPIB'],
  profileRows: [
    { label: 'Profile', value: 'Option 526 + B1X + MPB + P26' },
    { label: 'Frequency', value: '10 Hz–26.5 GHz' },
    { label: 'Analysis BW', value: '160 MHz max · B1X' },
    { label: 'Firmware', value: 'A.43.49' },
  ],
  stages: [
    { label: 'Plane', detail: 'Coupler · attenuation' },
    { label: 'Front end', detail: 'Attenuator · preamp' },
    { label: 'Convert', detail: 'Preselector · mixer · LO' },
    { label: 'Resolve', detail: 'IF · RBW · VBW' },
    { label: 'Digitize', detail: 'ADC · IQ · trigger' },
    { label: 'Measure', detail: 'Trace · power · demod' },
  ],
  hubHeadline: 'SA의 trace를 입력 신호와 내부 filter·detector가 함께 만든 결과로 읽습니다.',
  hubDescription: 'Connector power, front-end level plan, swept/FFT spectrum, IQ acquisition, trigger와 one-button power measurements를 하나의 analyzer state로 연결합니다.',
  pathTitle: 'RF input이 trace·IQ·channel power가 되는 수신 경로를 봅니다.',
  chapterLead: '안전한 연결에서 PA ACLR·harmonic 자동화까지 analyzer 상태를 닫습니다.',
  completionTitle: '다섯 개 signal-analysis state를 모두 닫았습니다.',
  completionDescription: 'RBW, attenuation과 trigger를 바꿔 같은 입력이 다른 결과가 되는 이유를 다시 확인하세요.',
  pythonSummary: 'Dry-run, N9020B model·option·firmware 확인, safe front-end state, spectrum/IQ configuration, trace·marker·power measurement와 abort cleanup이 포함됩니다.',
  chapters: [
    { id: 'safe-input', order: 1, shortTitle: '안전한 입력', title: 'SA에 PA 출력을 연결하기 전에 어떤 level을 먼저 계산해야 할까?', question: 'Connector power, mixer level, ADC overload와 reference level은 왜 서로 다른 한계일까?', estimatedMinutes: 55, labId: 'mxa-safe-input' },
    { id: 'sweep-rbw-detector', order: 2, shortTitle: 'Sweep·RBW·Detector', title: 'SA는 입력 RF를 어떻게 한 줄의 spectrum trace로 바꿀까?', question: 'Center/span, RBW/VBW, detector와 sweep time을 바꾸면 trace의 어느 부분이 달라질까?', estimatedMinutes: 75, labId: 'mxa-sweep-rbw' },
    { id: 'iq-capture-trigger', order: 3, shortTitle: 'IQ·Trigger', title: 'Spectrum sweep와 IQ capture는 같은 ADC 데이터를 어떻게 다르게 사용할까?', question: 'Analysis bandwidth, sample rate, record length와 trigger가 time·frequency view를 어떻게 묶을까?', estimatedMinutes: 75, labId: 'mxa-iq-trigger' },
    { id: 'sa-scpi-measurements', order: 4, shortTitle: 'SCPI·자주 쓰는 측정', title: '자주 쓰는 SA 동작을 어떤 SCPI 상태기계로 묶어야 할까?', question: 'Preset 없이 sweep, marker, trace, channel power, ACP와 OBW를 어떻게 설정·검증·가져올까?', estimatedMinutes: 90, labId: 'mxa-scpi-measurements' },
    { id: 'pa-spectrum-analysis', order: 5, shortTitle: 'PA Spectrum 분석', title: 'PA의 compression과 analyzer overload를 어떻게 구분할까?', question: 'Harmonic, spur, occupied bandwidth, ACLR·SEM·EVM을 어떤 기준면과 장비 조합으로 검증할까?', estimatedMinutes: 90, labId: 'mxa-pa-analysis' },
  ],
} as const;

export const e5080b: InstrumentDefinition = {
  id: 'keysight-e5080b',
  kind: 'network-analyzer',
  route: 'vna-ena',
  progressNamespace: 'vna',
  order: 3,
  code: 'NA',
  manufacturer: 'Keysight Technologies',
  family: 'ENA Series',
  model: 'E5080B',
  supportedOptions: ['2K0'],
  displayName: 'E5080B ENA',
  category: 'Vector network analyzer',
  roadmapTitle: 'Vector Network Analyzer',
  roadmapQuestion: '기준면과 S-parameter를 어떻게 보정하고 fixture 영향에서 분리할까?',
  rangeLabel: '9 kHz to 20 GHz profile · 2-port',
  firmwareScope: 'A.20.25.03',
  documentationBaseline: 'E5080B/ENA online help Rev A.20.25.xx, 2026-05-14',
  optionNotes: [
    '교육 프로필은 9 kHz–20 GHz, 2-port test set을 기준으로 한다. 실제 모델은 option에 따라 최대 53 GHz와 4-port까지 확장된다.',
    'Calibration kit definition, connector 성별·토크, test cable 안정성이 수학적 보정만큼 중요하다.',
    'Amplifier 측정에서는 source power와 receiver 입력 한계를 별도로 확인하고 reverse drive 경로를 차단한다.'
  ],
  remoteInterfaces: ['LAN / HiSLIP', 'USB', 'GPIB option'],
  profileRows: [
    { label: 'Profile', value: '2-port · 9 kHz–20 GHz' },
    { label: 'Measurement', value: 'S11 · S21 · S12 · S22' },
    { label: 'Calibration', value: 'SOLT · ECal · response' },
    { label: 'Firmware', value: 'A.20.25.03' },
  ],
  stages: [
    { label: 'Stimulus', detail: 'Source · power · sweep' },
    { label: 'Separation', detail: 'Incident · reflected' },
    { label: 'Receivers', detail: 'R1/R2 · A/B' },
    { label: 'Calibration', detail: 'Error terms · plane' },
    { label: 'Math', detail: 'S-parameter · transform' },
    { label: 'Display', detail: 'LogMag · phase · Smith' },
  ],
  hubHeadline: 'VNA의 trace를 DUT가 아니라 ratio와 기준면의 결과로 읽습니다.',
  hubDescription: 'Stimulus, directional separation, complex receiver ratio, calibration error terms와 display format을 한 measurement state로 연결합니다.',
  pathTitle: '한 점의 S-parameter가 만들어지는 수신·보정 경로를 봅니다.',
  chapterLead: '낮은 source power에서 calibrated PA workflow까지 기준면을 이동합니다.',
  completionTitle: '다섯 개 network measurement state를 모두 닫았습니다.',
  completionDescription: 'Calibration과 DUT 연결을 바꿔 기준면이 어떻게 움직이는지 다시 확인하세요.',
  pythonSummary: 'Dry-run, E5080B identity 확인, RF source OFF, channel/trace 구성, trigger·SDATA query와 cleanup이 포함됩니다.',
  chapters: [
    { id: 'safe-sweep', order: 1, shortTitle: '안전한 Sweep', title: 'VNA source를 켜기 전에 sweep의 어떤 경계를 정해야 할까?', question: 'Start/stop, points, IFBW와 source power가 측정 시간과 DUT stress를 어떻게 바꿀까?', estimatedMinutes: 55, labId: 'ena-safe-sweep' },
    { id: 'calibration-reference-plane', order: 2, shortTitle: 'Calibration·기준면', title: 'Calibration을 하면 왜 cable 끝이 새로운 측정 기준면이 될까?', question: 'Directivity, source/load match와 tracking error를 표준물로 어떻게 분리할까?', estimatedMinutes: 70, labId: 'ena-calibration' },
    { id: 'sparameters-smith-time', order: 3, shortTitle: 'S-parameter·Smith', title: '같은 DUT를 LogMag, phase, Smith와 time domain으로 보면 무엇이 달라질까?', question: '복소 S-parameter와 impedance, delay·distance를 한 상태로 어떻게 연결할까?', estimatedMinutes: 75, labId: 'ena-sparameters' },
    { id: 'vna-scpi-data', order: 4, shortTitle: 'SCPI·Data', title: 'VNA automation에서 channel, trace, trigger와 data format은 왜 따로 관리할까?', question: 'Measurement definition과 SDATA를 어떤 순서로 검증해야 재현 가능한 trace가 될까?', estimatedMinutes: 80, labId: 'ena-scpi-data' },
    { id: 'pa-characterization', order: 5, shortTitle: 'PA Characterization', title: 'VNA로 PA를 볼 때 small-signal 가정을 언제 멈춰야 할까?', question: 'Input drive, compression, receiver protection, stability와 bias를 어떤 장비 경계로 나눌까?', estimatedMinutes: 85, labId: 'ena-pa-characterization' },
  ]
} as const;

export const u2061xa: InstrumentDefinition = {
  id: 'keysight-u2061xa',
  kind: 'power-sensor',
  route: 'power-sensor',
  progressNamespace: 'sensor',
  order: 4,
  code: 'PWR',
  manufacturer: 'Keysight Technologies',
  family: 'U/L2050/60 X-Series',
  model: 'U2061XA',
  supportedOptions: [],
  displayName: 'U2061XA Power Sensor',
  category: 'USB wide-dynamic-range average and peak power sensor',
  roadmapTitle: 'Peak / Average Power Sensor',
  roadmapQuestion: '평균·peak·burst power를 DUT 기준면에서 어떻게 확인할까?',
  rangeLabel: '10 MHz to 6 GHz · −70 to +26 dBm average',
  firmwareScope: 'A.03.16',
  documentationBaseline: '2050/60 SCPI Programming Guide 9018-04755 and firmware A.03.16',
  optionNotes: [
    '교육 프로필은 U2061XA USB peak/average sensor를 기준으로 하며 N5182B-506의 10 MHz–6 GHz 범위를 정확히 덮는다.',
    'Average path와 peak path는 bandwidth가 다르다. 5 MHz peak VBW로 광대역 OFDM의 true PAPR/CCDF를 완전히 포착한다고 가정하지 않는다.',
    'Sensor frequency setting은 입력을 tune하는 값이 아니라 frequency-response correction을 고르는 metadata다.',
    '+26 dBm average와 10 µs 미만 +29 dBm peak는 운용 목표가 아니라 damage level이므로 attenuator와 guard margin을 계산한다.'
  ],
  remoteInterfaces: ['USB-TMC / VISA'],
  profileRows: [
    { label: 'Profile', value: 'USB peak + average' },
    { label: 'Frequency', value: '10 MHz–6 GHz' },
    { label: 'Peak path', value: '20 MSa/s · VBW ≤5 MHz' },
    { label: 'Firmware', value: 'A.03.16' },
  ],
  stages: [
    { label: 'Plane', detail: 'Cable · attenuator' },
    { label: 'Detector', detail: 'Wideband RF sampling' },
    { label: 'Correction', detail: 'Frequency · zero' },
    { label: 'Acquisition', detail: 'Trigger · gate' },
    { label: 'Statistics', detail: 'Average · peak · CCDF' },
    { label: 'Readout', detail: 'Power · uncertainty' },
  ],
  hubHeadline: 'Power sensor의 한 숫자를 시간 조건과 기준면이 있는 측정값으로 바꿉니다.',
  hubDescription: 'Peak/average detector, frequency correction, trigger·gate, averaging과 path uncertainty를 DUT plane power로 연결합니다.',
  pathTitle: 'RF가 sensor readout이 되기까지 correction과 acquisition 경계를 봅니다.',
  chapterLead: 'Overpower 방지에서 PA gain·power budget까지 측정 조건을 닫습니다.',
  completionTitle: '다섯 개 power measurement state를 모두 닫았습니다.',
  completionDescription: 'Average, peak와 gate 조건을 바꿔 같은 RF가 다른 숫자가 되는 이유를 다시 확인하세요.',
  pythonSummary: 'Dry-run, U2061XA identity 확인, frequency correction·detector·aperture·trigger 설정, fetch와 bounded error drain이 포함됩니다.',
  chapters: [
    { id: 'safe-power', order: 1, shortTitle: '안전한 연결', title: 'Sensor에 RF를 연결하기 전에 어떤 power를 계산해야 할까?', question: 'Average, peak, pulse energy와 connector rating 중 무엇이 sensor를 손상시킬 수 있을까?', estimatedMinutes: 50, labId: 'sensor-safe-power' },
    { id: 'average-peak-burst', order: 2, shortTitle: 'Average·Peak·Burst', title: '같은 burst가 average와 peak에서 왜 다른 dBm으로 보일까?', question: 'Duty cycle, aperture와 gate가 어떤 sample을 통계에 포함할까?', estimatedMinutes: 65, labId: 'sensor-average-peak' },
    { id: 'correction-uncertainty', order: 3, shortTitle: 'Correction·Uncertainty', title: 'Frequency를 sensor에 입력하면 실제로 무엇이 보정될까?', question: 'Calibration factor, mismatch, cable loss와 uncertainty를 DUT 기준면에 어떻게 합칠까?', estimatedMinutes: 70, labId: 'sensor-correction' },
    { id: 'sensor-scpi-trigger', order: 4, shortTitle: 'SCPI·Trigger', title: 'INIT, trigger, FETCh와 READ는 왜 같은 측정 명령이 아닐까?', question: 'Configuration, arm, completion, fetch와 error queue를 어떤 순서로 검증할까?', estimatedMinutes: 75, labId: 'sensor-scpi-trigger' },
    { id: 'pa-power-budget', order: 5, shortTitle: 'PA Power Budget', title: 'PA Pin과 Pout을 sensor로 잴 때 두 기준면을 어떻게 연결할까?', question: 'Coupler factor, path loss, mismatch와 동시성 오차를 gain·PAE 계산에 어떻게 전달할까?', estimatedMinutes: 80, labId: 'sensor-pa-power-budget' },
  ]
} as const;

export const n6705c: InstrumentDefinition = {
  id: 'keysight-n6705c',
  kind: 'power-supply',
  route: 'power-supply',
  progressNamespace: 'psu',
  order: 5,
  code: 'PSU',
  manufacturer: 'Keysight Technologies',
  family: 'N6700 Modular Power System',
  model: 'N6705C + N6752A',
  supportedOptions: ['N6752A', '761'],
  displayName: 'N6705C Power Analyzer',
  category: 'Modular DC power analyzer with high-performance autoranging source module',
  roadmapTitle: 'Modular DC Power Supply',
  roadmapQuestion: 'Bias sequence, CV/CC, transient와 DC power를 어떻게 안전하게 묶을까?',
  rangeLabel: 'N6752A · 0–50 V / 0–10 A / 100 W autoranging',
  firmwareScope: 'E_02_09_3271',
  documentationBaseline: 'N6700 Programmer’s Reference 9018-03617 and Specifications Guide 9018-04533',
  optionNotes: [
    '교육 프로필은 N6705C mainframe slot 1의 N6752A 50 V/10 A/100 W autoranging module과 Option 761 output/sense disconnect relay를 기준으로 한다.',
    'N6752A의 50 V와 10 A는 동시에 낼 수 있는 정격이 아니다. 모든 operating point는 100 W autoranging power envelope 안에 있어야 한다.',
    'Option 054 기능은 N6705C에 내장된 것으로 취급하고, data logger를 제거하는 Option 055 구성은 기준에서 제외한다.',
    'Software output OFF와 Option 761 relay는 통신 단절이나 wiring fault를 대신하지 않으므로 fuse, remote inhibit/interlock와 DUT bias sequence가 필요하다.'
  ],
  remoteInterfaces: ['LAN / HiSLIP', 'USB', 'GPIB'],
  profileRows: [
    { label: 'Mainframe', value: 'N6705C · 4 slots · 600 W' },
    { label: 'Slot 1', value: 'N6752A · 50 V · 10 A · 100 W' },
    { label: 'Option', value: '761 output/sense disconnect relay' },
    { label: 'Firmware', value: 'E_02_09_3271' },
  ],
  stages: [
    { label: 'Setpoint', detail: 'Voltage · current limit · slew' },
    { label: 'Protection', detail: 'OVP · OCP' },
    { label: 'Output', detail: 'Relay · LIST · sequence' },
    { label: 'Wiring', detail: 'Force · remote sense' },
    { label: 'DUT', detail: 'CV/CC · transient' },
    { label: 'Measure', detail: 'V · I · DC power' },
  ],
  hubHeadline: 'Power supply의 setpoint를 PA 단자 전압과 bias 상태로 연결합니다.',
  hubDescription: 'Voltage/current limit, CV/CC, protection, remote sense, output sequence와 readback을 하나의 안전한 bias state로 묶습니다.',
  pathTitle: 'Setpoint가 배선과 DUT load를 지나 실제 DC operating point가 되는 경로를 봅니다.',
  chapterLead: 'Output OFF에서 PA PAE·thermal droop 자동화까지 bias 상태를 엽니다.',
  completionTitle: '다섯 개 DC bias state를 모두 닫았습니다.',
  completionDescription: 'Load와 lead resistance를 바꿔 CV/CC와 remote sense 조건을 다시 확인하세요.',
  pythonSummary: 'Dry-run, N6705C mainframe·N6752A-761 module 확인, protection·slew·setpoint query-back, 이중 output permit와 finally output OFF가 포함됩니다.',
  chapters: [
    { id: 'safe-bias', order: 1, shortTitle: '안전한 Bias', title: 'PA bias를 켜기 전에 voltage보다 먼저 무엇을 제한해야 할까?', question: 'Output OFF, 100 W envelope, current limit, OVP와 gate/drain 순서가 DUT를 어떻게 보호할까?', estimatedMinutes: 55, labId: 'psu-safe-bias' },
    { id: 'cv-cc-protection', order: 2, shortTitle: 'CV·CC·Protection', title: '설정한 voltage가 그대로 나오지 않을 때 supply는 무엇을 지키고 있을까?', question: 'Load line과 100 W autoranging envelope가 CV·CC 경계를 넘을 때 상태는 어떻게 달라질까?', estimatedMinutes: 65, labId: 'psu-cv-cc' },
    { id: 'remote-sense-wiring', order: 3, shortTitle: 'Sense·Slew·Transient', title: 'PA 단자 voltage와 pulse current를 같은 시간축에서 어떻게 읽을까?', question: 'Force lead drop, remote sense, slew·inrush와 digitized acquisition을 어떻게 분리할까?', estimatedMinutes: 70, labId: 'psu-remote-sense' },
    { id: 'psu-scpi-sequence', order: 4, shortTitle: 'SCPI·LIST·Sequence', title: '여러 rail의 bias와 transient를 SCPI 상태기계로 어떻게 증명할까?', question: 'Channel/module 확인, LIST, trigger, query-back, protection clear와 cleanup을 어떤 순서로 묶을까?', estimatedMinutes: 85, labId: 'psu-scpi-sequence' },
    { id: 'pa-dc-power', order: 5, shortTitle: 'PA DC Power·PAE', title: 'Supply readback으로 PA의 어떤 성능까지 계산할 수 있을까?', question: 'VDD·IDD, RF Pin/Pout, pulse droop와 동시성으로 DC power·PAE를 어떻게 닫을까?', estimatedMinutes: 85, labId: 'psu-pa-dc-power' },
  ]
} as const;

export const instruments: readonly InstrumentDefinition[] = [n5182b, n9020b, e5080b, u2061xa, n6705c] as const;

export interface InstrumentRoadmapReadyItem {
  readonly status: 'ready';
  readonly instrumentId: InstrumentId;
  readonly order: number;
  readonly code: InstrumentDefinition['code'];
  readonly title: string;
  readonly model: string;
  readonly href: string;
  readonly question: string;
}

export interface InstrumentRoadmapPlannedItem {
  readonly status: 'planned';
  readonly order: number;
  readonly code: string;
  readonly title: string;
  readonly model: string;
  readonly question: string;
}

export type InstrumentRoadmapItem = InstrumentRoadmapReadyItem | InstrumentRoadmapPlannedItem;

const plannedInstrumentRoadmap: readonly InstrumentRoadmapPlannedItem[] = Object.freeze([]);

/** Ready entries are projected from the active manifest; only future tracks are authored separately. */
export const instrumentRoadmap: readonly InstrumentRoadmapItem[] = Object.freeze([
  ...instruments.map((instrument): InstrumentRoadmapReadyItem => ({
    status: 'ready',
    instrumentId: instrument.id,
    order: instrument.order,
    code: instrument.code,
    title: instrument.roadmapTitle,
    model: `Keysight ${instrument.displayName}`,
    href: `/instruments/${instrument.route}/`,
    question: instrument.roadmapQuestion,
  })),
  ...plannedInstrumentRoadmap,
].sort((left, right) => left.order - right.order));

export function getInstrument(id: string | undefined): InstrumentDefinition | undefined {
  return instruments.find((instrument) => instrument.id === id);
}

export function getInstrumentByRoute(route: string | undefined): InstrumentDefinition | undefined {
  return instruments.find((instrument) => instrument.route === route);
}

export function getInstrumentChapter(
  instrumentId: string | undefined,
  chapterId: string | undefined,
): InstrumentChapterDefinition | undefined {
  return getInstrument(instrumentId)?.chapters.find((chapter) => chapter.id === chapterId);
}

export function instrumentChapterHref(instrument: InstrumentDefinition, chapter: InstrumentChapterDefinition): string {
  return `/instruments/${instrument.route}/${chapter.id}/`;
}

export function instrumentProgressId(instrument: InstrumentDefinition, chapter: InstrumentChapterDefinition): string {
  return `instrument:${instrument.progressNamespace}:${chapter.labId}`;
}
