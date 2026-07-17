import { instruments, instrumentChapterHref, instrumentProgressId } from '../../src/data/instruments';
import cellularLessons from '../../src/content/cellular-lessons.json' with { type: 'json' };
import { cellularSections } from '../../src/data/cellular';

export interface AppRoute {
  readonly path: string;
  readonly heading: RegExp;
  readonly labId?: string;
}

function exactHeading(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

const instrumentRoutes: readonly AppRoute[] = instruments.flatMap((instrument) => [
  {
    path: `/instruments/${instrument.route}/`,
    heading: exactHeading(instrument.hubHeadline),
  },
  ...instrument.chapters.map((chapter) => ({
    path: instrumentChapterHref(instrument, chapter),
    heading: exactHeading(chapter.title),
    labId: instrumentProgressId(instrument, chapter),
  })),
]);

export const cellularRoutes: readonly AppRoute[] = cellularLessons.map((lesson) => ({
  path: `/cellular/${lesson.section}/${lesson.slug}/`,
  heading: exactHeading(lesson.title),
}));

export const dvtRoutes: readonly AppRoute[] = [
  { path: '/dvt/bench-capability/', heading: /이 bench로 무엇을 측정할 수 있을까/ },
  {
    path: '/dvt/station-qualification/',
    heading: /DUT를 연결하기 전에 station을 어떻게 검증할까/,
    labId: 'dvt:station-qualification',
  },
  {
    path: '/dvt/synchronized-test-point/',
    heading: /한 test point를 다섯 장비가 어떻게 공동으로 만들까/,
    labId: 'dvt:synchronized-test-point',
  },
  {
    path: '/dvt/uncertainty-guardband/',
    heading: /불확도와 guardband로 어떻게 판정할까/,
    labId: 'dvt:uncertainty-guardband',
  },
  { path: '/dvt/cw-two-tone-lte/', heading: /CW.*Two-tone.*LTE 변조 신호는 무엇을 다르게 보여줄까/ },
  {
    path: '/dvt/fdd-dvt-conclusion/',
    heading: /FDD PAMiD DVT 결과를 어떻게 방어할까/,
    labId: 'dvt:fdd-dvt-conclusion',
  },
] as const;

const representativeCellularRoutes: readonly AppRoute[] = [
  { path: '/cellular/', heading: /파형 구조에서 PAMiD fail stage/ },
  {
    path: '/cellular/gsm/gsm-module-measurement/',
    heading: /GSM PA.*module/,
    labId: 'cellular:gsm:pvt-lab',
  },
  ...cellularSections.map((section) => ({ path: `/cellular/${section.id}/`, heading: exactHeading(section.question) })),
  ...[
    'foundations-modulation-waveform-multiple-access-duplex',
    'foundations-bits-to-iq-rf',
    'foundations-coding-rate-matching-scrambling',
    'foundations-time-frequency-reading',
    'foundations-iq-magnitude-phase-psd-papr',
    'foundations-receiver-iq-to-bits',
    'foundations-ue-reference-planes-power',
    'foundations-reading-3gpp-requirements',
    'pamid-three-dut-topologies',
    'pamid-dpd-cfr',
    'gsm-tdma-frame-timeslots',
    'lte-bandwidth-rb-location',
    'lte-qam-modulations',
    'nr-100mhz-rb100-location0',
    'nr-pi2-bpsk-qam',
    'diagnostics-evm-fail',
  ].map((id) => {
    const lesson = cellularLessons.find((candidate) => candidate.id === id)!;
    return {
      path: `/cellular/${lesson.section}/${lesson.slug}/`,
      heading: exactHeading(lesson.title),
      ...(id === 'foundations-receiver-iq-to-bits'
        ? { labId: 'cellular:foundations:receiver-iq-to-bits' }
        : {}),
    };
  }),
];

export const appRoutes: readonly AppRoute[] = [
  { path: '/', heading: /설정값 하나가 trace를 바꾸는 경로/ },
  { path: '/search/', heading: /장비 화면에서 본 단어/ },
  { path: '/glossary/', heading: /공식보다 먼저, 화면에서 어떤 뜻인지/ },
  { path: '/instruments/', heading: /장비 한 대를 신호 경로와 프로그램 상태/ },
  { path: '/dvt/', heading: /방어 가능한 DVT 결론/ },
  ...dvtRoutes,
  ...representativeCellularRoutes,
  ...instrumentRoutes,
  { path: '/instruments/sg-mxg/python-examples/', heading: /먼저 명령을 출력하고, 두 번 허용/ },
  { path: '/instruments/sa-mxa/python-examples/', heading: /먼저 dry-run transcript를 확인/ },
  { path: '/instruments/vna-ena/python-examples/', heading: /먼저 dry-run transcript를 확인/ },
  { path: '/instruments/power-sensor/python-examples/', heading: /먼저 dry-run transcript를 확인/ },
  { path: '/instruments/power-supply/python-examples/', heading: /먼저 dry-run transcript를 확인/ },
  { path: '/learn/foundations/', heading: /주파수는 무엇을 세는가/, labId: 'frequency' },
  { path: '/learn/spectrum-iq/', heading: /SA의 한 줄 trace와 IQ capture/, labId: 'spectrum' },
  { path: '/learn/ofdm-lte-nr/', heading: /RB 수와 location/, labId: 'resource-grid' },
  { path: '/learn/vna-smith/', heading: /Smith Chart의 점 하나/, labId: 'smith' },
  { path: '/learn/power-coupling/', heading: /Forward, delivered, coupled/, labId: 'coupler' },
  { path: '/learn/pa-pull/', heading: /Load-pull contour의 가장 좋은 점/, labId: 'load-pull' },
] as const;

export const smokeViewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'desktop-200pct', width: 720, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;
