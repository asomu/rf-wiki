import type { CurriculumModuleId } from './curriculum';

export type GlossaryCategory =
  | 'signal'
  | 'spectrum-iq'
  | 'waveform'
  | 'network'
  | 'power'
  | 'pa';

export interface GlossaryTerm {
  term: string;
  label: string;
  symbol?: string;
  category: GlossaryCategory;
  moduleId: CurriculumModuleId;
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
  pa: 'PA·pull'
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
