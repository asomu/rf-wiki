import type { CurriculumModuleId } from './curriculum';

export type GlossaryCategory =
  | 'signal'
  | 'spectrum-iq'
  | 'waveform'
  | 'network'
  | 'power'
  | 'pa'
  | 'instrument-control';

export interface GlossaryTerm {
  term: string;
  label: string;
  symbol?: string;
  category: GlossaryCategory;
  moduleId: CurriculumModuleId
    | 'keysight-n5182b'
    | 'keysight-n9020b'
    | 'keysight-e5080b'
    | 'keysight-u2061xa'
    | 'keysight-n6705c';
  definition: string;
  caution?: string;
  href: string;
  aliases?: readonly string[];
}

export const glossaryCategoryLabels: Record<GlossaryCategory, string> = {
  signal: '신호와 단위',
  'spectrum-iq': 'Spectrum·IQ',
  waveform: 'OFDM·LTE·NR',
  network: 'VNA·network',
  power: 'Power flow·coupling',
  pa: 'PA·pull',
  'instrument-control': '계측장비·SCPI 제어'
};

export const glossary: readonly GlossaryTerm[] = [
  {
    term: '50 Ω reference',
    label: '50 Ω 기준 임피던스',
    symbol: 'Z₀',
    category: 'signal',
    moduleId: 'foundations',
    definition: '대부분의 RF 계측기, 동축 cable과 S-parameter가 voltage와 power wave를 정의할 때 사용하는 nominal system impedance입니다.',
    caution: '장비 표시가 50 Ω 기준이라는 사실과 DUT의 실제 impedance가 50 Ω이라는 말은 같지 않습니다.',
    href: '/learn/foundations/',
    aliases: ['50 ohm', 'reference impedance']
  },
  {
    term: 'ACLR',
    label: 'Adjacent Channel Leakage Ratio',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: '할당 채널의 평균 전력과 인접 채널에 누설된 평균 전력의 비입니다.',
    caution: '측정 필터, 채널 대역폭과 적분 범위를 결과와 함께 확인해야 합니다.',
    href: '/learn/pa-pull/'
  },
  {
    term: 'Accepted power',
    label: '수락 전력',
    symbol: 'Pacc',
    category: 'power',
    moduleId: 'power-coupling',
    definition: 'DUT 입력에서 incident power 중 반사되지 않고 실제로 받아들여진 전력입니다.',
    caution: 'delivered power라는 말은 문헌과 장비에 따라 다른 기준면을 가리킬 수 있습니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'Available gain',
    label: '가용 이득',
    symbol: 'GA',
    category: 'power',
    moduleId: 'power-coupling',
    definition: 'source에서 DUT에 들어갈 수 있는 가용 전력을 기준으로, DUT 출력에서 얻을 수 있는 최대 가용 전력을 비교한 이득입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'BWP',
    label: 'Bandwidth Part',
    category: 'waveform',
    moduleId: 'ofdm-lte-nr',
    definition: 'NR carrier 대역 안에서 단말이 실제로 사용하도록 설정된 연속된 common resource block 범위입니다.',
    caution: 'carrier bandwidth, Point A, CRB와 PRB의 기준을 섞지 않습니다.',
    href: '/learn/ofdm-lte-nr/'
  },
  {
    term: 'Complex envelope',
    label: '복소 포락선',
    symbol: 'I + jQ',
    category: 'signal',
    moduleId: 'foundations',
    definition: 'RF carrier 주변의 amplitude와 phase 변화를 I와 Q 두 실수 성분으로 보존한 저역통과 표현입니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'dB',
    label: 'Decibel',
    category: 'signal',
    moduleId: 'foundations',
    definition: '두 power의 비를 10 log₁₀(P₂/P₁)로 나타내는 무차원 로그 비율입니다.',
    caution: 'voltage 비에 20 log를 쓸 때는 두 전압이 같은 impedance 조건에 있어야 합니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'dBm',
    label: '1 mW 기준 절대 전력',
    category: 'signal',
    moduleId: 'foundations',
    definition: '1 mW를 기준으로 한 절대 power level이며 0 dBm은 1 mW입니다.',
    caution: 'dB는 비율이고 dBm은 기준이 있는 절대 전력입니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'Compression',
    label: '이득 압축',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: '입력 전력을 올릴 때 PA의 출력이 선형 이득으로 예상한 값보다 작아지는 비선형 상태입니다.',
    href: '/learn/pa-pull/',
    aliases: ['P1dB', '1 dB compression']
  },
  {
    term: 'Coupling',
    label: '결합도',
    symbol: 'C',
    category: 'power',
    moduleId: 'power-coupling',
    definition: 'directional coupler 입력 포트의 전력과 의도한 coupled 포트 전력 사이의 dB 차이입니다.',
    caution: '양의 loss 값으로 쓰는지 음의 S-parameter dB로 쓰는지 convention을 확인합니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'Directivity',
    label: '방향성',
    symbol: 'D',
    category: 'power',
    moduleId: 'power-coupling',
    definition: 'coupler가 원하는 진행 방향과 반대 방향을 얼마나 잘 구분하는지 나타내며, 보통 isolation과 coupling의 차이입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'EVM',
    label: 'Error Vector Magnitude',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: '측정된 constellation symbol과 이상적인 reference symbol 사이 error vector의 정규화 크기입니다.',
    caution: 'reference, equalization, averaging과 normalization 조건을 함께 봅니다.',
    href: '/learn/pa-pull/'
  },
  {
    term: 'Excess loss',
    label: 'Coupler 초과 손실',
    symbol: 'Lexcess',
    category: 'power',
    moduleId: 'power-coupling',
    definition: '입력 power에서 through와 coupled port로 나간 power의 합을 제외하고 실제 소자 내부에서 사라진 power를 나타냅니다.',
    caution: 'main-line insertion loss에는 coupled port로 의도적으로 빠진 power도 포함되므로 둘을 같은 값으로 보지 않습니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'FFT bin',
    label: 'FFT 주파수 칸',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: '유한 길이 sample record를 FFT했을 때 일정한 간격으로 계산되는 개별 주파수 지점입니다.',
    caution: 'bin spacing은 sample rate와 record length로 결정되며 RBW와 항상 같은 뜻은 아닙니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'Frequency',
    label: '주파수',
    symbol: 'f',
    category: 'signal',
    moduleId: 'foundations',
    definition: '반복되는 현상이 1초에 몇 cycle을 완성하는지 나타내며 단위는 hertz(Hz)입니다.',
    caution: 'analyzer의 center frequency와 신호의 instantaneous frequency는 문맥이 다릅니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'Incident power',
    label: '입사 전력',
    symbol: '|a|²',
    category: 'power',
    moduleId: 'power-coupling',
    definition: '선택한 기준면에서 DUT 쪽으로 진행하는 power wave의 전력입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'Insertion loss',
    label: '삽입 손실',
    symbol: 'IL',
    category: 'power',
    moduleId: 'power-coupling',
    definition: '소자를 경로에 삽입했을 때 전달 전력이 줄어든 정도를 양의 dB 손실로 표현한 값입니다.',
    caution: '수동 소자의 −S21(dB)와 자주 대응하지만 mismatch와 기준 조건을 명시해야 합니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'Impedance',
    label: '복소 임피던스',
    symbol: 'Z = R + jX',
    category: 'signal',
    moduleId: 'foundations',
    definition: 'sinusoidal voltage와 current의 복소 비로 resistance와 reactance를 함께 표현합니다.',
    caution: 'impedance는 주파수와 reference plane에 따라 달라질 수 있습니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'Isolation',
    label: '격리도',
    symbol: 'I',
    category: 'power',
    moduleId: 'power-coupling',
    definition: '입력 포트의 전력이 의도하지 않은 isolated 포트에 새는 정도를 dB 차이로 표현한 값입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'Load-pull',
    label: '부하 임피던스 탐색',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: 'DUT 출력에서 보이는 load reflection coefficient를 바꾸며 power, efficiency, linearity 같은 성능을 측정하는 방법입니다.',
    href: '/learn/pa-pull/'
  },
  {
    term: 'Magnitude',
    label: '복소 신호의 크기',
    symbol: '|I+jQ|',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: 'I와 Q로 만든 복소 벡터의 길이이며 sqrt(I²+Q²)로 계산합니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'Mismatch loss',
    label: '부정합 손실',
    symbol: 'ML',
    category: 'network',
    moduleId: 'vna-smith',
    definition: '반사 때문에 incident power 중 load에 받아들여지지 못한 비율을 dB 손실로 나타낸 값입니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'Noise floor',
    label: '잡음 바닥',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: '계측기의 자체 잡음과 입력 잡음이 합쳐져 trace 아래쪽에 형성하는 측정 가능한 최소 수준입니다.',
    caution: 'RBW, attenuation, preamp, detector와 averaging을 함께 확인합니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'OFDM',
    label: 'Orthogonal Frequency Division Multiplexing',
    category: 'waveform',
    moduleId: 'ofdm-lte-nr',
    definition: '서로 직교하는 촘촘한 subcarrier에 데이터를 나누어 싣는 다중 반송파 변조 방식입니다.',
    href: '/learn/ofdm-lte-nr/'
  },
  {
    term: 'Operating gain',
    label: '동작 전력 이득',
    symbol: 'GP',
    category: 'power',
    moduleId: 'power-coupling',
    definition: 'DUT 입력에 실제로 받아들여진 전력을 기준으로 load에 전달된 전력을 비교한 이득입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'PAE',
    label: 'Power Added Efficiency',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: 'RF 출력 증가분(Pout−Pin)을 DC 공급 전력으로 나눈 PA 효율입니다.',
    href: '/learn/pa-pull/'
  },
  {
    term: 'Phase',
    label: '복소 신호의 위상',
    symbol: '∠(I+jQ)',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: 'I축을 기준으로 복소 벡터가 이루는 각도이며 atan2(Q,I)로 계산합니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'RB',
    label: 'Resource Block',
    category: 'waveform',
    moduleId: 'ofdm-lte-nr',
    definition: 'LTE와 NR에서 주파수축 12개 연속 subcarrier를 기본 폭으로 삼는 resource 묶음입니다.',
    caution: '시간축 범위와 PRB·CRB 의미는 LTE/NR 문맥과 mapping 기준에 따라 구분합니다.',
    href: '/learn/ofdm-lte-nr/',
    aliases: ['PRB', 'CRB', 'resource block']
  },
  {
    term: 'RBW',
    label: 'Resolution Bandwidth',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: 'spectrum analyzer가 인접 주파수 성분을 분리하는 IF 또는 digital resolution filter의 유효 폭입니다.',
    caution: 'RBW를 줄이면 분해능과 표시 noise floor는 개선되지만 sweep·processing 시간이 늘 수 있습니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'Reflected power',
    label: '반사 전력',
    symbol: '|b|²',
    category: 'power',
    moduleId: 'power-coupling',
    definition: '선택한 기준면에서 DUT로부터 source 쪽으로 되돌아오는 power wave의 전력입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'Reference plane',
    label: '측정 기준면',
    category: 'network',
    moduleId: 'vna-smith',
    definition: 'phase, impedance, incident/reflected wave를 정의하고 calibration이 유효하다고 간주하는 물리적 위치입니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'Return loss',
    label: '반사 손실',
    symbol: 'RL',
    category: 'network',
    moduleId: 'vna-smith',
    definition: 'incident wave와 reflected wave의 크기 비를 양의 dB 값으로 나타내며 값이 클수록 match가 좋습니다.',
    caution: 'S11(dB)는 보통 음수이고 return loss는 양수라는 부호 convention을 구분합니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'S11',
    label: '입력 반사 계수',
    category: 'network',
    moduleId: 'vna-smith',
    definition: '다른 포트를 기준 임피던스로 종단했을 때 port 1 입사파에 대한 port 1 반사파의 복소 비입니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'S12',
    label: '역방향 전달 계수',
    category: 'network',
    moduleId: 'vna-smith',
    definition: 'port 2 입사파가 port 1로 전달되는 복소 비이며 active 2-port의 reverse isolation 해석에 사용합니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'S21',
    label: '순방향 전달 계수',
    category: 'network',
    moduleId: 'vna-smith',
    definition: 'port 1 입사파가 port 2로 전달되는 복소 비입니다.',
    caution: '수동 소자에서는 insertion loss, active 소자에서는 forward gain 문맥으로 읽되 sign과 mismatch 조건을 확인합니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'S22',
    label: '출력 반사 계수',
    category: 'network',
    moduleId: 'vna-smith',
    definition: '다른 포트를 기준 임피던스로 종단했을 때 port 2 입사파에 대한 port 2 반사파의 복소 비입니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'Smith Chart',
    label: 'Smith 도표',
    category: 'network',
    moduleId: 'vna-smith',
    definition: '복소 reflection coefficient 평면 위에 normalized resistance와 reactance 좌표를 겹쳐 그린 도표입니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'Source-pull',
    label: '소스 임피던스 탐색',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: 'DUT 입력에서 보이는 source reflection coefficient를 바꾸며 gain, noise, linearity와 안정성의 변화를 측정하는 방법입니다.',
    href: '/learn/pa-pull/'
  },
  {
    term: 'Stability factor',
    label: 'Rollet K와 μ 안정도 지표',
    symbol: 'K, μ',
    category: 'pa',
    moduleId: 'pa-pull',
    definition: 'small-signal 2-port S-parameter로 passive source와 load termination에 대한 unconditional stability 가능성을 점검하는 지표입니다.',
    caution: '측정 주파수·bias·drive 범위 밖의 발진이나 large-signal 안정성을 자동으로 보장하지 않습니다.',
    href: '/learn/pa-pull/',
    aliases: ['Rollet K', 'mu stability']
  },
  {
    term: 'Sweep time',
    label: '주파수 sweep 시간',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: '설정한 span을 따라 analyzer가 trace 한 번을 완성하는 데 필요한 시간입니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'Period',
    label: '주기',
    symbol: 'T',
    category: 'signal',
    moduleId: 'foundations',
    definition: '반복 파형이 한 cycle을 완성하는 시간이며 일정한 tone에서는 T=1/f 관계를 가집니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'Transducer gain',
    label: '변환 전력 이득',
    symbol: 'GT',
    category: 'power',
    moduleId: 'power-coupling',
    definition: 'source의 available power와 load에 실제 전달된 power를 비교해 source·load mismatch를 모두 포함한 이득입니다.',
    href: '/learn/power-coupling/'
  },
  {
    term: 'VBW',
    label: 'Video Bandwidth',
    category: 'spectrum-iq',
    moduleId: 'spectrum-iq',
    definition: '검파된 trace의 빠른 변동을 평활하는 post-detection low-pass bandwidth입니다.',
    caution: '신호를 주파수축에서 분리하는 RBW와 역할이 다릅니다.',
    href: '/learn/spectrum-iq/'
  },
  {
    term: 'VSWR',
    label: 'Voltage Standing Wave Ratio',
    category: 'network',
    moduleId: 'vna-smith',
    definition: '진행파와 반사파가 만든 전압 standing wave의 최대값과 최소값 비로 match 상태를 나타냅니다.',
    caution: '1:1에 가까울수록 match가 좋고, Γ의 magnitude만 표현하므로 phase 정보는 사라집니다.',
    href: '/learn/vna-smith/'
  },
  {
    term: 'Wavelength',
    label: '파장',
    symbol: 'λ',
    category: 'signal',
    moduleId: 'foundations',
    definition: 'wave의 같은 phase 지점 사이 거리이며 매질의 phase velocity를 주파수로 나눈 값입니다.',
    caution: 'cable의 velocity factor 때문에 물리적 파장은 자유공간 c/f보다 짧습니다.',
    href: '/learn/foundations/'
  },
  {
    term: 'Γ',
    label: 'Reflection coefficient',
    category: 'network',
    moduleId: 'vna-smith',
    definition: '선택한 기준면에서 incident wave에 대한 reflected wave의 복소 비입니다.',
    href: '/learn/vna-smith/',
    aliases: ['gamma', 'reflection coefficient']
  },
  {
    term: 'Calibration reference plane',
    label: 'VNA 교정 기준면',
    category: 'instrument-control',
    moduleId: 'keysight-e5080b',
    definition: 'VNA가 systematic error를 제거한 뒤 incident·reflected·transmitted wave를 정의하는 물리적 connector 위치입니다.',
    caution: '교정 뒤 cable이나 adapter를 바꾸면 기준면과 error model이 함께 바뀌므로 confidence check 또는 재교정이 필요합니다.',
    href: '/instruments/vna-ena/calibration-reference-plane/',
    aliases: ['cal plane', 'SOLT', 'ECal']
  },
  {
    term: 'IFBW',
    label: 'VNA IF bandwidth',
    category: 'instrument-control',
    moduleId: 'keysight-e5080b',
    definition: 'VNA receiver가 각 frequency point에서 통과시키는 intermediate-frequency filter 폭입니다.',
    caution: 'IFBW를 줄이면 보통 trace noise가 감소하지만 sweep 시간이 늘며, DUT drift가 있으면 무조건 더 정확해지는 것은 아닙니다.',
    href: '/instruments/vna-ena/safe-sweep/',
    aliases: ['intermediate frequency bandwidth', 'SENS:BWID']
  },
  {
    term: 'SDATA',
    label: 'Corrected complex VNA data',
    category: 'instrument-control',
    moduleId: 'keysight-e5080b',
    definition: 'VNA가 선택한 measurement의 corrected complex 값을 real·imaginary pair로 반환하는 SCPI data form입니다.',
    caution: 'FDATA는 display format에 의존하고 RDATA는 raw/uncorrected이므로 automation에서 서로 바꾸어 쓰지 않습니다.',
    href: '/instruments/vna-ena/vna-scpi-data/',
    aliases: ['CALC:DATA:SDAT?', 'complex S-parameter']
  },
  {
    term: 'De-embedding',
    label: 'Fixture 제거',
    category: 'network',
    moduleId: 'keysight-e5080b',
    definition: '측정된 fixture–DUT–fixture network에서 알려진 fixture의 complex loss와 mismatch를 수학적으로 제거해 DUT plane을 복원하는 과정입니다.',
    caution: 'Port extension은 delay만 이동하며 full de-embedding과 같지 않고, fixture loss가 큰 band에서는 역연산이 noise를 증폭할 수 있습니다.',
    href: '/instruments/vna-ena/sparameters-smith-time/',
    aliases: ['fixture simulator', 'AFR', 'port extension']
  },
  {
    term: 'Analysis bandwidth',
    label: '순간 분석 대역폭',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'Signal analyzer가 한 번의 digitized acquisition에서 동시에 보존해 IQ·vector measurement에 사용할 수 있는 주파수 폭입니다.',
    caution: '화면에 표시하는 frequency span, 인접 tone을 분리하는 RBW와 같은 설정이 아닙니다. N9020B B1X 교육 프로필의 최대값은 160 MHz입니다.',
    href: '/instruments/sa-mxa/iq-capture-trigger/',
    aliases: ['instantaneous bandwidth', 'IF bandwidth', 'B1X']
  },
  {
    term: 'Input attenuation',
    label: 'SA 입력 감쇠',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'RF connector와 mixer 사이의 step attenuator가 입력 신호를 줄여 front-end와 ADC에 headroom을 만드는 설정입니다.',
    caution: 'Attenuation을 늘리면 overload 여유는 커지지만 analyzer의 표시 noise floor와 작은 신호 감도는 불리해집니다.',
    href: '/instruments/sa-mxa/safe-input/',
    aliases: ['input attenuator', 'mechanical attenuation', 'POW:ATT']
  },
  {
    term: 'Mixer level',
    label: 'SA mixer 입력 레벨',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'Analyzer RF front-end의 frequency-conversion mixer에 실제로 도달하는 신호 레벨로, 교육 모델에서는 connector input − attenuation + preamp gain으로 추적합니다.',
    caution: 'Connector damage limit보다 훨씬 낮은 입력에서도 attenuation이 작거나 preamp가 켜져 있으면 내부 overload가 먼저 발생할 수 있습니다.',
    href: '/instruments/sa-mxa/safe-input/',
    aliases: ['mixer drive', 'front-end level']
  },
  {
    term: 'Reference level',
    label: 'SA 기준 레벨',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'Spectrum display의 위쪽 기준값이며 auto-coupled attenuation·gain과 ADC range를 정하는 데 사용되는 analyzer 상태입니다.',
    caution: 'Reference level을 높였다는 사실만으로 물리적인 입력 power가 줄거나 connector가 보호되지는 않습니다.',
    href: '/instruments/sa-mxa/safe-input/',
    aliases: ['RLEV', 'display reference', 'DISP:WIND:TRAC:Y:RLEV']
  },
  {
    term: 'Trace detector',
    label: 'SA trace 검파 방식',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: '한 display bucket 안에 들어온 여러 measurement sample을 positive peak, negative peak, sample, average 또는 RMS 같은 한 trace 값으로 줄이는 규칙입니다.',
    caution: 'Detector는 DUT 신호를 바꾸지 않지만 좁은 spur, noise와 burst가 화면에 보이는 방식과 측정 편향을 바꿉니다.',
    href: '/instruments/sa-mxa/sweep-rbw-detector/',
    aliases: ['positive peak detector', 'RMS average detector', 'DET:TRAC1']
  },
  {
    term: 'Zero span',
    label: 'SA zero-span 시간 관측',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'Analyzer를 한 center frequency에 고정하고 RBW filter와 detector를 통과한 amplitude를 시간축 trace로 표시하는 방식입니다.',
    caution: '광대역 complex IQ를 그대로 저장하는 capture가 아니며 RBW, VBW, detector와 sweep time이 시간 응답을 제한합니다.',
    href: '/instruments/sa-mxa/iq-capture-trigger/',
    aliases: ['time domain sweep', 'SPAN 0']
  },
  {
    term: 'Spectrum marker',
    label: 'Spectrum trace marker',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: '현재 trace의 선택한 frequency point에서 amplitude를 읽거나 peak search 결과를 가리키는 display cursor입니다.',
    caution: 'Marker readout은 마지막으로 완료된 trace를 읽으므로 configuration 변경 뒤에는 새 acquisition 완료와 trace freshness를 확인합니다.',
    href: '/instruments/sa-mxa/sa-scpi-measurements/',
    aliases: ['peak search', 'CALC:MARK:MAX', 'CALC:MARK:X?']
  },
  {
    term: 'Channel power',
    label: '채널 적분 전력',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: '지정한 channel bandwidth 안의 spectral power를 적분해 한 개의 평균 RF power 결과로 만드는 analyzer measurement입니다.',
    caution: 'Channel center, integration bandwidth, detector·averaging, input correction과 기준면을 결과와 함께 저장해야 합니다.',
    href: '/instruments/sa-mxa/sa-scpi-measurements/',
    aliases: ['CHP', 'integrated channel power']
  },
  {
    term: 'Occupied bandwidth',
    label: '점유 대역폭',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: '측정 span 안의 전체 적분 전력 중 지정한 비율, 보통 99%를 포함하는 연속 주파수 구간의 폭입니다.',
    caution: 'Span edge에 신호가 잘리거나 noise·spur가 포함되면 결과가 달라지므로 percentage, span과 integration 조건을 함께 기록합니다.',
    href: '/instruments/sa-mxa/sa-scpi-measurements/',
    aliases: ['OBW', '99% bandwidth']
  },
  {
    term: 'Adjacent channel power',
    label: '인접 채널 전력 측정',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'Main channel과 offset된 adjacent channel의 전력을 각각 적분하고 dBm 또는 main 대비 dBc로 보고하는 analyzer measurement입니다.',
    caution: 'ACLR 해석 전 main·adjacent integration bandwidth, offset, filter와 기준면이 시험 규격에 맞는지 먼저 확인합니다.',
    href: '/instruments/sa-mxa/pa-spectrum-analysis/',
    aliases: ['ACP', 'ACPR', 'adjacent channel leakage']
  },
  {
    term: 'Analyzer overload',
    label: 'SA 내부 overrange',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: 'Mixer, IF 또는 ADC에 허용 headroom보다 큰 신호가 들어와 trace와 IQ가 clipping·compression되거나 거짓 spur를 만드는 상태입니다.',
    caution: 'DUT compression으로 결론 내리기 전에 preamp OFF, input attenuation 증가, reference level 조정 뒤 같은 결과가 유지되는지 재측정합니다.',
    href: '/instruments/sa-mxa/pa-spectrum-analysis/',
    aliases: ['ADC overload', 'IF overload', 'overrange']
  },
  {
    term: 'Trace data',
    label: 'SA 표시 trace 배열',
    category: 'instrument-control',
    moduleId: 'keysight-n9020b',
    definition: '현재 sweep·RBW·detector·averaging과 display processing을 거쳐 각 frequency point에 저장된 amplitude 값 배열입니다.',
    caution: 'Trace query 결과는 raw time-domain IQ sample이 아니며 start/stop, point count, unit와 acquisition freshness를 함께 저장합니다.',
    href: '/instruments/sa-mxa/sa-scpi-measurements/',
    aliases: ['TRAC? TRACE1', 'spectrum trace array']
  },
  {
    term: 'Measurement aperture',
    label: 'Power sensor 적분 창',
    category: 'instrument-control',
    moduleId: 'keysight-u2061xa',
    definition: 'Power sensor가 average readout 하나를 만들 때 포함하는 시간 구간입니다.',
    caution: '짧은 aperture는 burst를 더 잘 분리하지만 포함 sample이 줄어 noise와 trigger 민감도가 불리해질 수 있습니다.',
    href: '/instruments/power-sensor/sensor-scpi-trigger/',
    aliases: ['SENS:SWE:APER', 'gate time', 'integration time']
  },
  {
    term: 'Peak VBW',
    label: 'Peak detector video bandwidth',
    category: 'instrument-control',
    moduleId: 'keysight-u2061xa',
    definition: 'Power sensor의 빠른 detector path가 envelope 변화를 따라갈 수 있는 baseband bandwidth입니다.',
    caution: 'U2061XA의 최대 5 MHz peak VBW는 광대역 OFDM average-power capability와 별개이며 true PAPR를 낮게 읽을 수 있습니다.',
    href: '/instruments/power-sensor/average-peak-burst/',
    aliases: ['video bandwidth', 'SENS:BAND:VID']
  },
  {
    term: 'Sensor frequency correction',
    label: 'Power sensor 주파수 보정',
    category: 'instrument-control',
    moduleId: 'keysight-u2061xa',
    definition: '입력한 RF frequency에 대응하는 sensor calibration factor를 적용해 주파수 응답 오차를 보정하는 과정입니다.',
    caution: '이 설정은 RF를 선택하는 tuner가 아니며 외부 cable·attenuator loss는 별도 FDO 또는 path correction으로 관리합니다.',
    href: '/instruments/power-sensor/correction-uncertainty/',
    aliases: ['calibration factor', 'FDO', 'SENS:FREQ']
  },
  {
    term: 'CV mode',
    label: 'Constant-voltage mode',
    category: 'instrument-control',
    moduleId: 'keysight-n6705c',
    definition: 'Load가 요구하는 current가 limit와 power envelope 안에 있을 때 supply가 voltage setpoint를 유지하는 조절 상태입니다.',
    caution: 'CV 표시는 DUT 단자의 voltage가 setpoint와 같다는 보장이 아니며 force lead drop과 remote-sense plane을 확인해야 합니다.',
    href: '/instruments/power-supply/cv-cc-protection/',
    aliases: ['constant voltage', 'STAT:OPER CV']
  },
  {
    term: 'CC mode',
    label: 'Constant-current mode',
    category: 'instrument-control',
    moduleId: 'keysight-n6705c',
    definition: 'Load demand가 current setting에 도달해 supply가 current를 제한하고 output voltage를 낮추는 조절 상태입니다.',
    caution: '예상 밖 CC 진입은 PA의 과전류, short, inrush 또는 잘못된 limit를 뜻할 수 있으므로 정상 measurement point로 그대로 저장하지 않습니다.',
    href: '/instruments/power-supply/cv-cc-protection/',
    aliases: ['constant current', 'current limit']
  },
  {
    term: 'Remote sense',
    label: '4-wire 전압 감지',
    category: 'instrument-control',
    moduleId: 'keysight-n6705c',
    definition: '전류가 거의 흐르지 않는 sense pair로 DUT 단자 전압을 읽고 force lead의 I·R drop을 supply가 보상하는 방식입니다.',
    caution: 'Sense open, polarity 오류와 보상 headroom 초과를 막아야 하며 N6752A specification은 load lead당 최대 1 V drop 조건입니다.',
    href: '/instruments/power-supply/remote-sense-wiring/',
    aliases: ['four wire', '4-wire', 'Kelvin sense']
  },
  {
    term: 'OVP',
    label: 'Over-voltage protection',
    category: 'instrument-control',
    moduleId: 'keysight-n6705c',
    definition: '감시된 output voltage가 설정 threshold를 넘으면 supply output을 차단하는 보호 기능입니다.',
    caution: 'Voltage setpoint와 OVP threshold는 다른 상태이며, trip 원인을 제거하기 전에 protection clear를 자동 반복하지 않습니다.',
    href: '/instruments/power-supply/safe-bias/',
    aliases: ['overvoltage protection', 'VOLT:PROT']
  },
  {
    term: 'Autoranging power envelope',
    label: 'Autoranging 출력 한계',
    category: 'instrument-control',
    moduleId: 'keysight-n6705c',
    definition: 'Voltage와 current 최대값을 직사각형으로 동시에 제공하지 않고 정격 power 안에서 가능한 operating point를 결정하는 V–I 경계입니다.',
    caution: 'N6752A의 50 V, 10 A 표기를 500 W로 해석하면 안 되며 실제 output은 100 W envelope 안에 있어야 합니다.',
    href: '/instruments/power-supply/safe-bias/',
    aliases: ['100 W envelope', 'autoranging source']
  },
  {
    term: 'ALC',
    label: 'Automatic Level Control',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: 'Signal generator가 검출한 출력 레벨을 기준으로 내부 gain을 되먹임 제어해 설정한 평균 RF power를 유지하는 loop입니다.',
    caution: 'burst, 깊은 amplitude modulation, pulse 조건에서는 ALC mode와 marker 기반 hold 조건을 함께 확인합니다.',
    href: '/instruments/sg-mxg/safe-cw/',
    aliases: ['automatic level control', 'unlevel']
  },
  {
    term: 'ARB',
    label: 'Arbitrary Waveform Generator',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: '메모리에 저장한 I/Q sample과 sample clock을 순서대로 재생해 vector RF 변조를 만드는 baseband generator입니다.',
    caution: 'RF carrier frequency와 ARB sample rate는 서로 다른 설정입니다.',
    href: '/instruments/sg-mxg/arb-playback/',
    aliases: ['arbitrary waveform', 'baseband generator']
  },
  {
    term: 'Error queue',
    label: 'SCPI 오류 큐',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: '장비가 받은 잘못된 명령, 범위 위반 또는 실행 실패를 순서대로 보관하는 FIFO queue입니다.',
    caution: '통신 timeout과 장비 error queue는 다른 실패 경로이므로 둘을 각각 처리합니다.',
    href: '/instruments/sg-mxg/scpi-pyvisa/',
    aliases: ['SYST:ERR?', 'system error']
  },
  {
    term: 'Marker',
    label: 'Waveform marker',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: 'waveform의 특정 sample 구간에 붙여 event output, trigger 동기, RF blanking 또는 ALC hold 같은 하드웨어 동작을 정렬하는 digital 표시입니다.',
    href: '/instruments/sg-mxg/arb-playback/'
  },
  {
    term: 'PAPR',
    label: 'Peak-to-Average Power Ratio',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: '파형의 peak power와 평균 power 사이의 비이며 modulated signal의 필요한 source·PA headroom을 결정합니다.',
    caution: 'SG에 표시된 평균 power에 PAPR을 더한 PEP가 source와 DUT의 허용 peak를 넘지 않는지 확인합니다.',
    href: '/instruments/sg-mxg/waveform-iq/',
    aliases: ['crest factor', 'CCDF']
  },
  {
    term: 'SCPI',
    label: 'Standard Commands for Programmable Instruments',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: '계측기 설정과 상태 query를 계층적인 ASCII command로 표현하는 원격 제어 명령 체계입니다.',
    caution: '같은 MXG 이름이라도 N5182B와 N5186A의 native command tree를 섞지 않습니다.',
    href: '/instruments/sg-mxg/scpi-pyvisa/'
  },
  {
    term: 'Trigger',
    label: 'Waveform 재생 트리거',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: 'continuous 또는 single playback이 시작·재시작되는 시점을 BUS, external input 또는 내부 조건으로 정하는 사건입니다.',
    href: '/instruments/sg-mxg/arb-playback/',
    aliases: ['*TRG', 'external trigger']
  },
  {
    term: 'VISA',
    label: 'Virtual Instrument Software Architecture',
    category: 'instrument-control',
    moduleId: 'keysight-n5182b',
    definition: 'LAN, USB, GPIB 같은 transport 차이를 공통 resource와 read/write/query API로 감싸는 계측기 I/O 표준 계층입니다.',
    caution: 'VISA alias는 주소를 편하게 부르는 이름이며 실제 통신 interface와 timeout 설정을 대체하지 않습니다.',
    href: '/instruments/sg-mxg/scpi-pyvisa/',
    aliases: ['PyVISA', 'Connection Expert', 'HiSLIP']
  }
] as const;

export function normalizeGlossaryText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
}

export function glossarySearchText(entry: GlossaryTerm): string {
  return normalizeGlossaryText(
    [entry.term, entry.label, entry.symbol, entry.definition, entry.caution, ...(entry.aliases ?? [])]
      .filter(Boolean)
      .join(' ')
  );
}
