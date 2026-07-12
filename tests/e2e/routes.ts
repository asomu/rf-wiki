import { instruments, instrumentChapterHref, instrumentProgressId } from '../../src/data/instruments';

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

export const appRoutes: readonly AppRoute[] = [
  { path: '/', heading: /설정값 하나가 trace를 바꾸는 경로/ },
  { path: '/search/', heading: /장비 화면에서 본 단어/ },
  { path: '/glossary/', heading: /공식보다 먼저, 화면에서 어떤 뜻인지/ },
  { path: '/instruments/', heading: /장비 한 대를 신호 경로와 프로그램 상태/ },
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
