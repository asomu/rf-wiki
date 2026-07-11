export type CurriculumModuleId =
  | 'foundations'
  | 'spectrum-iq'
  | 'ofdm-lte-nr'
  | 'vna-smith'
  | 'power-coupling'
  | 'pa-pull';

export interface CurriculumModule {
  id: CurriculumModuleId;
  order: number;
  shortTitle: string;
  title: string;
  question: string;
  summary: string;
  topics: readonly string[];
  lessonCount: number;
  estimatedMinutes: number;
  representativeLessonHref: string;
  representativeLessonTitle: string;
  /** Every listed lab must be complete before this module counts as complete. */
  completionLabIds: readonly string[];
  completionNote?: string;
}

export const curriculum: readonly CurriculumModule[] = [
  {
    id: 'foundations',
    order: 1,
    shortTitle: 'RF 기초',
    title: 'RF 신호의 기준 세우기',
    question: '주파수·전력·50 Ω은 장비 화면에서 어떻게 연결될까?',
    summary: '시간에 따라 변하는 신호를 주파수, 복소수, dB, 전력과 임피던스라는 공통 언어로 읽습니다.',
    topics: ['주파수와 파장', '복소수와 phasor', 'dB·dBm', '50 Ω와 기준면'],
    lessonCount: 1,
    estimatedMinutes: 55,
    representativeLessonHref: '/learn/foundations/',
    representativeLessonTitle: '주파수는 어떻게 화면의 봉우리가 될까?',
    completionLabIds: ['frequency']
  },
  {
    id: 'spectrum-iq',
    order: 2,
    shortTitle: 'Spectrum·IQ',
    title: '신호가 trace와 IQ capture가 되는 과정',
    question: '같은 RF 입력을 SA와 IQ capture는 왜 다르게 보여줄까?',
    summary: '입력 감쇠기와 mixer부터 RBW, detector, ADC, FFT까지 신호가 화면으로 바뀌는 경로를 따라갑니다.',
    topics: ['SA signal path', 'RBW·VBW·sweep', 'IQ sampling', 'magnitude·phase·FFT'],
    lessonCount: 1,
    estimatedMinutes: 75,
    representativeLessonHref: '/learn/spectrum-iq/',
    representativeLessonTitle: 'SA의 trace와 IQ capture는 무엇을 보존할까?',
    completionLabIds: ['spectrum', 'iq'],
    completionNote: 'Spectrum·IQ는 SA trace와 IQ capture 두 실험을 모두 완료해야 1개 축으로 집계합니다.'
  },
  {
    id: 'ofdm-lte-nr',
    order: 3,
    shortTitle: 'OFDM·LTE·NR',
    title: 'Resource grid에 신호를 배치하기',
    question: '대역폭·RB 수·location을 바꾸면 실제 파형은 어디가 달라질까?',
    summary: 'subcarrier와 symbol이 resource element, RB, 채널 대역폭을 만드는 과정을 LTE와 NR Release 17 기준으로 비교합니다.',
    topics: ['OFDM과 CP', 'resource element·RB', 'LTE 100 RB', 'NR 100 MHz와 BWP'],
    lessonCount: 1,
    estimatedMinutes: 95,
    representativeLessonHref: '/learn/ofdm-lte-nr/',
    representativeLessonTitle: 'RB range와 location은 파형의 어느 부분을 움직일까?',
    completionLabIds: ['resource-grid']
  },
  {
    id: 'vna-smith',
    order: 4,
    shortTitle: 'VNA·Smith Chart',
    title: '반사와 전달을 복소 평면에서 읽기',
    question: 'Smith Chart의 점 하나는 DUT의 어떤 상태를 말해줄까?',
    summary: 'S11·S21·S12·S22의 방향, Γ와 Z 변환, VSWR, return loss, calibration 기준면을 한 상태로 연결합니다.',
    topics: ['S-parameter 방향', 'Γ↔Z', 'Smith Chart', 'VSWR·return loss'],
    lessonCount: 1,
    estimatedMinutes: 85,
    representativeLessonHref: '/learn/vna-smith/',
    representativeLessonTitle: 'S-parameter와 Smith Chart를 같은 측정으로 읽으려면?',
    completionLabIds: ['smith', 'network'],
    completionNote: 'VNA·Smith는 one-port Γ/VSWR와 two-port gain/stability 두 실험을 모두 완료해야 1개 축으로 집계합니다.'
  },
  {
    id: 'power-coupling',
    order: 5,
    shortTitle: 'Power flow·Coupling',
    title: '포트 사이의 전력 흐름 구분하기',
    question: 'Coupling·insertion·isolation·directivity는 어느 포트 사이 값일까?',
    summary: 'incident, reflected, accepted, delivered power를 기준으로 coupler와 다중 포트 소자의 경로와 오차를 해석합니다.',
    topics: ['power wave a·b', 'coupler 4-port', 'insertion·isolation', 'directivity·mismatch'],
    lessonCount: 1,
    estimatedMinutes: 90,
    representativeLessonHref: '/learn/power-coupling/',
    representativeLessonTitle: 'Coupler의 네 포트에서 전력은 어디로 흐를까?',
    completionLabIds: ['coupler']
  },
  {
    id: 'pa-pull',
    order: 6,
    shortTitle: 'PA·Load/Source-pull',
    title: 'PA가 원하는 임피던스를 찾아가기',
    question: 'Source·load impedance를 움직이면 power·efficiency·linearity는 어떻게 교환될까?',
    summary: 'stability와 gain circle에서 시작해 compression, AM-AM·AM-PM, PAE, EVM, ACLR contour를 함께 읽습니다.',
    topics: ['K·μ stability', 'source/load-pull', 'P1dB·PAE', 'EVM·ACLR'],
    lessonCount: 1,
    estimatedMinutes: 100,
    representativeLessonHref: '/learn/pa-pull/',
    representativeLessonTitle: 'Load-pull contour에서 최적점은 하나뿐일까?',
    completionLabIds: ['load-pull']
  }
] as const;

export const totalLessonCount = curriculum.reduce((sum, module) => sum + module.lessonCount, 0);
export const totalEstimatedMinutes = curriculum.reduce((sum, module) => sum + module.estimatedMinutes, 0);

export function getCurriculumModule(id: string | undefined): CurriculumModule | undefined {
  return curriculum.find((module) => module.id === id);
}
