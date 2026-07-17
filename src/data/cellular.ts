import type { CellularSectionId } from '../types';

export interface CellularSectionDefinition {
  readonly id: CellularSectionId;
  readonly index: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly question: string;
  readonly description: string;
  readonly count: number;
  readonly context: string;
}

export const cellularSections: readonly CellularSectionDefinition[] = Object.freeze([
  {
    id: 'foundations', index: '01', title: '공통 기초', shortTitle: '신호를 같은 좌표로 읽기',
    question: 'bit, IQ, 시간·주파수 자원과 RF 기준면은 어떻게 이어질까?',
    description: 'GSM·LTE·NR을 비교하기 전에 서로 다른 분류와 기준면을 하나의 신호 흐름으로 묶습니다.', count: 8,
    context: 'Cross-RAT · UE uplink · reference plane',
  },
  {
    id: 'pamid', index: '02', title: 'PAMiD 구조와 제어', shortTitle: '모듈 안에서 경로 추적',
    question: '같은 RF 입력이 gain mode, supply, filter와 switch 상태를 지나며 어떻게 달라질까?',
    description: '세 DUT topology와 generic RFFE state를 사용해 active TX/RX path와 impairment 책임을 구분합니다.', count: 10,
    context: 'GSM PA+ASM · FDD PAMiD · TDD TxM',
  },
  {
    id: 'gsm', index: '03', title: 'GSM·GPRS·EDGE', shortTitle: 'Timeslot과 burst 읽기',
    question: '선택한 timeslot과 modulation이 PA ramp, duty와 ORFS를 어떻게 바꿀까?',
    description: '200 kHz carrier, 8 timeslot TDMA, burst field, multiframe, GMSK와 EDGE 8PSK를 module DVT에 연결합니다.', count: 9,
    context: 'TS 45 series · UE TX · burst PA',
  },
  {
    id: 'lte', index: '04', title: 'LTE single-carrier', shortTitle: 'PUSCH와 RB 해석',
    question: 'RB count·location·modulation·power normalization이 PAMiD 자극을 어떻게 바꿀까?',
    description: '15 kHz grid, uplink DFT-s-OFDM, PUSCH mapping, MPR과 FDD PAMiD 측정을 한 흐름으로 봅니다.', count: 11,
    context: 'Release 17 · single CC · FDD PAMiD',
  },
  {
    id: 'nr', index: '05', title: 'NR FR1 single-carrier', shortTitle: 'BWP·numerology·TDD',
    question: 'SCS, BWP, RB allocation과 D/U/F symbol이 TxM waveform과 state를 어떻게 바꿀까?',
    description: 'Point A부터 PRB까지의 좌표, PUSCH waveform, MPR과 n78 TDD switching을 중심으로 다룹니다.', count: 11,
    context: 'Release 17 · FR1 · n78 TDD 중심',
  },
  {
    id: 'diagnostics', index: '06', title: 'PAMiD 증상별 진단', shortTitle: '실패에서 stage 역추적',
    question: '측정 fail을 source, transceiver, PAMiD, load, fixture, analyzer로 어떻게 분리할까?',
    description: '관찰 증상마다 첫 설정 확인, 우선 원인, 가장 빠른 분리 측정과 흔한 오진을 정적 evidence matrix로 제공합니다.', count: 10,
    context: 'Nominal RF DVT · evidence matrix',
  },
]);

export function getCellularSection(id: CellularSectionId): CellularSectionDefinition {
  const section = cellularSections.find((candidate) => candidate.id === id);
  if (!section) throw new RangeError(`Unknown cellular section: ${id}`);
  return section;
}

export function cellularLessonHref(section: CellularSectionId, slug: string): string {
  return `/cellular/${section}/${slug}/`;
}

export const cellularLessonCount = cellularSections.reduce((sum, section) => sum + section.count, 0);
