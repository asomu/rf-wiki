import { mkdir, writeFile } from 'node:fs/promises';

const outDir = new URL('../design/figma-boards/', import.meta.url);
const C = {
  canvas: '#F2F5F5', surface: '#FFFFFF', ink: '#162126', muted: '#5B686E',
  rule: '#C9D3D5', dark: '#10191B', raised: '#172326', darkInk: '#EAF3F3',
  darkMuted: '#9EB0B3', teal: '#08746E', tealBright: '#48C3B8',
  oxide: '#925E00', amber: '#F0B441', red: '#B94339', redBright: '#F06A60', blue: '#3F6F9F', blueBright: '#7EA9D4',
};

const font = "font-family='IBM Plex Sans KR,IBM Plex Sans,Arial,sans-serif'";
const mono = "font-family='IBM Plex Mono,ui-monospace,monospace'";
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const t = (x, y, value, size = 12, fill = C.ink, weight = 400, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${font} ${extra}>${esc(value)}</text>`;
const tm = (x, y, value, size = 11, fill = C.ink, weight = 500, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${mono} ${extra}>${esc(value)}</text>`;
const r = (x, y, w, h, fill = C.surface, stroke = C.rule, radius = 8, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke = C.rule, width = 1, dash = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const header = (title, subtitle, code) => [
  t(28, 32, title, 20, C.ink, 600),
  tm(812, 31, code, 10, C.muted, 500, "text-anchor='end'"),
  t(28, 52, subtitle, 11, C.muted, 400),
  line(28, 66, 812, 66, C.rule),
].join('');
const svg = (title, subtitle, code, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="840" height="560" viewBox="0 0 840 560">
<rect width="840" height="560" fill="${C.canvas}"/>
${header(title, subtitle, code)}${body}
</svg>`;

function typographyBoard() {
  const left = [
    r(28, 82, 370, 450),
    t(46, 108, 'Typography · 두 family만', 12, C.muted, 500),
    t(46, 151, 'RBW를 줄이면 왜', 29, C.ink, 600),
    t(46, 187, 'noise floor가 내려갈까?', 29, C.ink, 600),
    t(46, 222, '한글 본문은 17px / 1.75로 읽는다.', 15, C.ink, 400),
    t(46, 249, '설정값과 단위는 같은 줄에 둔다.', 15, C.ink, 400),
    tm(46, 286, 'CENTER  3.500 000 000 GHz', 13, C.teal, 500),
    tm(46, 310, 'RBW       10.000 kHz', 13, C.oxide, 500),
    tm(46, 334, 'S21       +18.42 dB', 13, C.blue, 500),
    line(46, 359, 380, 359),
    t(46, 386, 'Display 40/48 · Headline 28/37', 11, C.muted, 500),
    t(46, 409, 'Title 20/29 · Body 17/30', 11, C.muted, 500),
    t(46, 432, 'Label 14/20 · Data 13/20', 11, C.muted, 500),
    r(46, 464, 118, 40, C.teal, C.teal, 6), t(105, 489, '예측 고정', 12, C.surface, 600, "text-anchor='middle'"),
    r(176, 464, 118, 40, C.surface, C.rule, 6), t(235, 489, '다시 선택', 12, C.ink, 500, "text-anchor='middle'"),
  ].join('');

  const chart = [
    r(414, 82, 398, 290, C.dark, C.dark, 10),
    t(434, 108, 'Visualization grammar', 12, C.darkMuted, 500),
    line(448, 318, 790, 318, C.darkMuted), line(448, 134, 448, 318, C.darkMuted),
    line(448, 272, 790, 272, C.rule, 0.6, '3 5'), line(448, 226, 790, 226, C.rule, 0.6, '3 5'), line(448, 180, 790, 180, C.rule, 0.6, '3 5'),
    `<path d="M448 288 C510 286 526 250 570 246 S640 232 676 174 S742 146 790 140" fill="none" stroke="${C.tealBright}" stroke-width="2.5"/>`,
    `<path d="M448 304 C515 302 552 294 610 292 S705 280 790 278" fill="none" stroke="${C.blueBright}" stroke-width="2" stroke-dasharray="7 5"/>`,
    line(650, 134, 650, 318, C.amber, 1.5, '4 4'),
    `<circle cx="650" cy="206" r="5" fill="${C.amber}" stroke="${C.dark}" stroke-width="2"/>`,
    tm(660, 198, 'M1 · −31.4 dBm', 10, C.amber),
    tm(780, 133, 'forward trace', 9, C.tealBright, 500, "text-anchor='end'"),
    tm(780, 271, 'reference · dash', 9, C.blueBright, 500, "text-anchor='end'"),
    tm(618, 342, 'frequency offset (kHz)', 9, C.darkMuted, 400, "text-anchor='middle'"),
  ].join('');

  const swatches = [
    r(414, 388, 398, 144),
    t(434, 414, '색은 물리 의미에만 사용', 12, C.muted, 500),
    [
      ['Forward', C.teal, C.tealBright], ['Reference', C.oxide, C.amber],
      ['Reverse', C.red, C.redBright], ['Secondary', C.blue, C.blueBright],
    ].map(([label, light, bright], index) => {
      const x = 434 + (index % 2) * 182;
      const y = 432 + Math.floor(index / 2) * 43;
      return `${r(x, y, 22, 22, light, light, 3)}${r(x + 28, y, 22, 22, bright, bright, 3)}${t(x + 59, y + 15, label, 10, C.ink, 500)}`;
    }).join(''),
  ].join('');
  return svg('Typography & Visualization Grammar', '문서의 읽기 리듬과 계측 화면의 데이터 문법을 한 장에 고정한다.', 'SYSTEM / 03', left + chart + swatches);
}

function componentsBoard() {
  const nav = [r(28, 82, 784, 62), t(46, 109, 'RF Wiki', 16, C.ink, 600), tm(125, 108, 'REL 17', 9, C.muted), r(545, 94, 162, 36, C.surface, C.rule, 6), t(558, 117, '개념·장비 검색', 11, C.muted), r(716, 94, 78, 36, C.teal, C.teal, 6), t(755, 117, '검색', 11, C.surface, 600, "text-anchor='middle'")].join('');
  const fields = [
    r(28, 160, 378, 214), t(46, 187, 'Controls & readouts', 12, C.muted, 500),
    t(46, 218, 'Resolution bandwidth', 11, C.ink, 500), tm(388, 218, '10 kHz', 11, C.teal, 500, "text-anchor='end'"),
    line(48, 244, 388, 244, C.rule, 4), line(48, 244, 152, 244, C.teal, 4), `<circle cx="152" cy="244" r="8" fill="${C.surface}" stroke="${C.teal}" stroke-width="3"/>`,
    t(46, 278, 'Detector', 11, C.ink, 500), r(46, 289, 164, 40, C.surface, C.rule, 6), t(59, 314, 'RMS', 12, C.ink, 400), tm(193, 314, '⌄', 12, C.muted, 500, "text-anchor='end'"),
    r(224, 289, 164, 40, C.surface, C.rule, 6, "opacity='0.52'"), t(238, 314, '예측 전 잠김', 11, C.muted, 400),
    r(46, 341, 104, 21, C.dark, C.dark, 4), tm(98, 356, '−122.0 dBm', 10, C.tealBright, 500, "text-anchor='middle'"),
    r(160, 341, 104, 21, C.dark, C.dark, 4), tm(212, 356, 'VSWR 1.24', 10, C.amber, 500, "text-anchor='middle'"),
  ].join('');
  const states = [
    r(422, 160, 390, 214), t(440, 187, 'Prediction & feedback states', 12, C.muted, 500),
    t(440, 219, 'RBW를 10× 줄이면 noise는?', 14, C.ink, 600),
    r(440, 238, 166, 36, C.surface, C.rule, 6), t(453, 261, 'tone 유지 · noise −10 dB', 10, C.ink, 400),
    r(616, 238, 174, 36, C.surface, C.rule, 6), t(629, 261, '둘 다 −10 dB', 10, C.muted, 400),
    r(440, 289, 350, 34, '#E7F2F0', C.teal, 6), t(454, 311, '정답 · DSP filter bandwidth를 확인하세요', 10, C.teal, 500),
    r(440, 333, 350, 28, '#F7EAE8', C.red, 6), t(454, 352, '주의 · calibration plane을 먼저 확인', 10, C.red, 500),
  ].join('');
  const componentRow = [
    r(28, 390, 784, 142), t(46, 417, 'Component boundaries', 12, C.muted, 500),
    ['Definition', 'Formula', 'Measurement note', 'Completed'].map((label, i) => {
      const x = 46 + i * 188;
      const tone = [C.blue, C.oxide, C.red, C.teal][i];
      return `${line(x, 444, x, 508, tone, 3)}${t(x + 13, 458, label, 11, C.ink, 600)}${t(x + 13, 481, i === 0 ? '용어와 기준점' : i === 1 ? '수식과 convention' : i === 2 ? '오차와 주의' : '로컬 진도 저장', 10, C.muted)}${tm(x + 13, 504, ['Γ = b/a','GT ≠ S21','± uncertainty','6 / 6'][i], 10, tone)}`;
    }).join(''),
  ].join('');
  return svg('Components & States', '조작 가능성, 잠금, 오류, 완료 상태를 같은 계측 문법으로 표현한다.', 'SYSTEM / 04', nav + fields + states + componentRow);
}

function patternsBoard() {
  const spine = [
    r(28, 82, 784, 96), t(46, 108, 'Signal Spine · 현재 control의 영향 경로', 12, C.muted, 500),
    ...['Source','DUT','Acquisition','DSP / Math','Display'].map((label, i) => {
      const x = 48 + i * 150;
      const active = i === 0 || i === 3 || i === 4;
      return `${r(x, 124, 126, 38, active ? '#E7F2F0' : C.surface, active ? C.teal : C.rule, 6)}${t(x + 63, 148, label, 10, active ? C.teal : C.muted, 600, "text-anchor='middle'")}${i < 4 ? line(x + 126, 143, x + 150, 143, active ? C.teal : C.rule, 2, active ? '' : '3 4') : ''}`;
    }),
  ].flat().join('');
  const views = [
    r(28, 194, 784, 242, C.dark, C.dark, 10), t(46, 220, 'Linked Views · 동일 marker M7', 12, C.darkMuted, 500),
    line(62, 390, 397, 390, C.darkMuted), line(62, 246, 62, 390, C.darkMuted),
    `<path d="M62 330 C95 265 125 372 160 292 S222 348 258 276 S326 352 397 290" fill="none" stroke="${C.tealBright}" stroke-width="2.5"/>`,
    line(250, 246, 250, 390, C.amber, 1.5, '4 4'), tm(258, 262, 'M7 · t=14.2 µs', 9, C.amber),
    line(445, 390, 780, 390, C.darkMuted), line(445, 246, 445, 390, C.darkMuted),
    `<path d="M445 375 L500 371 L536 356 L575 280 L610 248 L648 280 L688 354 L724 370 L780 375" fill="none" stroke="${C.tealBright}" stroke-width="2.5"/>`,
    line(611, 246, 611, 390, C.amber, 1.5, '4 4'), tm(620, 262, 'M7 · +86 RB', 9, C.amber),
    tm(226, 416, 'time / IQ', 9, C.darkMuted, 400, "text-anchor='middle'"), tm(612, 416, 'frequency / RB', 9, C.darkMuted, 400, "text-anchor='middle'"),
  ].join('');
  const ledger = [
    r(28, 452, 784, 80),
    ...[
      ['변경','RBW 100 → 10 kHz',C.ink], ['직접 효과','filter 폭 감소',C.teal],
      ['화면 결과','noise 약 −10 dB',C.ink], ['비용·한계','처리 시간 증가',C.red],
    ].map(([label,value,color], i) => {
      const x = 46 + i * 190;
      return `${t(x, 478, label, 10, C.muted, 500)}${t(x, 503, value, 11, color, 600)}${i ? line(x - 15, 468, x - 15, 516, C.rule) : ''}`;
    }).join(''),
  ].join('');
  return svg('Interactive Lab Patterns', '설정 변화가 계산·표시·해석으로 이어지는 공통 학습 구조.', 'PATTERN / 05', spine + views + ledger);
}

function miniScreen(x, y, w, h, title, kind, accent = C.tealBright) {
  const darkY = y + 43;
  return [
    r(x, y, w, h, C.surface, C.rule, 6), t(x + 10, y + 20, title, 9, C.ink, 600), tm(x + w - 10, y + 20, kind, 7, C.muted, 500, "text-anchor='end'"),
    line(x + 10, y + 29, x + w - 10, y + 29), r(x + 10, darkY, w - 20, h - 56, C.dark, C.dark, 4),
    line(x + 20, darkY + h - 76, x + w - 20, darkY + h - 76, C.darkMuted),
    `<path d="M${x + 20} ${darkY + h - 70} C${x + w * .32} ${darkY + 25} ${x + w * .48} ${darkY + h - 70} ${x + w * .63} ${darkY + 38} S${x + w * .82} ${darkY + 50} ${x + w - 20} ${darkY + 28}" fill="none" stroke="${accent}" stroke-width="2"/>`,
    line(x + w * .58, darkY + 8, x + w * .58, darkY + h - 58, C.amber, 1, '3 3'),
  ].join('');
}

function coreScreensBoard() {
  const body = [
    miniScreen(28, 82, 248, 132, 'Home · concept map', '01'),
    miniScreen(296, 82, 248, 132, 'SA / IQ linked record', '02'),
    miniScreen(564, 82, 248, 132, 'NR RB · OFDM bins', '03', C.blueBright),
    miniScreen(28, 232, 248, 132, 'Smith · Γ / VSWR', '04', C.amber),
    miniScreen(296, 232, 248, 132, 'Coupler · 4-port flow', '05', C.redBright),
    miniScreen(564, 232, 248, 132, 'Load-pull · contours', '06', C.tealBright),
    miniScreen(162, 382, 516, 150, 'Search / Glossary · related concepts', '07', C.blueBright),
  ].join('');
  return svg('Core Screens', '7개 대표 화면은 같은 질문–설정–관찰–해석 위계를 유지한다.', 'SCREENS / 06', body);
}

function responsiveBoard() {
  const desktop = [
    r(28, 90, 410, 410, C.surface, C.rule, 5),
    t(40, 112, '1440 · Inline lesson lab', 10, C.muted, 600),
    r(40, 128, 70, 356, C.canvas, C.rule, 3),
    r(120, 128, 306, 356, C.surface, C.rule, 3),
    t(75, 151, 'MAP', 7, C.muted, 500, "text-anchor='middle'"),
    t(208, 151, 'LESSON', 7, C.muted, 500, "text-anchor='middle'"),
    line(132, 171, 282, 171),
    line(132, 186, 269, 186),
    line(132, 216, 284, 216),
    line(132, 232, 276, 232),
    r(132, 258, 282, 204, C.dark, C.dark, 4),
    tm(146, 280, 'INLINE LAB · CONTROL → LINKED VIEWS', 7, C.darkMuted, 600),
    `<path d="M148 392 C188 314 230 438 274 338 S350 420 398 326" fill="none" stroke="${C.tealBright}" stroke-width="2"/>`,
  ].join('');
  const tablet = [
    r(458, 90, 184, 410, C.surface, C.rule, 5),
    t(470, 112, '1024 · Single flow', 10, C.muted, 600),
    r(470, 128, 160, 55, C.canvas, C.rule, 3),
    r(470, 193, 160, 70, C.surface, C.rule, 3),
    r(470, 273, 160, 132, C.dark, C.dark, 3),
    r(470, 415, 160, 69, C.surface, C.rule, 3),
    t(550, 159, 'CONTEXT', 7, C.muted, 500, "text-anchor='middle'"),
    t(550, 232, 'INTUITION PRIMER', 7, C.muted, 500, "text-anchor='middle'"),
    tm(550, 294, 'LAB', 8, C.darkMuted, 600, "text-anchor='middle'"),
    tm(550, 316, 'SETTINGS → RESULT', 7, C.darkMuted, 500, "text-anchor='middle'"),
    line(484, 439, 616, 439),
    line(484, 455, 607, 455),
  ].join('');
  const mobile = [r(662, 90, 150, 410, C.surface, C.rule, 5), t(674, 112, '390 · Vertical lab flow', 10, C.muted, 600), ...[['설정',C.canvas,C.ink],['예측','#E7F2F0',C.teal],['결과',C.dark,C.darkInk],['해석',C.surface,C.ink]].map(([label,fill,color],i)=>{const y=128+i*86;return `${r(674,y,126,72,fill,fill===C.surface?C.rule:fill,3)}${t(737,y+40,label,9,color,600,"text-anchor='middle'")}`;})].join('');
  return svg('Responsive Screens', '학습 문서는 하나의 흐름을 유지하고 실험 내부 순서는 설정 → 예측 → 결과 → 해석으로 고정한다.', 'SCREENS / 07', desktop + tablet + mobile);
}

function reviewBoard() {
  const checks = [
    ['RF calculation snapshots', 'PASS', C.teal], ['WCAG 2.2 AA / axe', 'PASS', C.teal],
    ['7 screens × 3 viewports', '21', C.blue], ['Lighthouse routes', '5', C.blue],
    ['AI-slop detector', '[]', C.teal], ['Figma ↔ CSS tokens', 'SYNC', C.oxide],
  ];
  const table = [r(28, 82, 500, 318), t(46, 109, 'Release gate', 12, C.muted, 500), ...checks.map(([name,status,color],i)=>{const y=139+i*41;return `${line(46,y+12,510,y+12)}${t(46,y,name,11,C.ink,500)}${tm(500,y,status,10,color,600,"text-anchor='end'")}`;})].join('');
  const metrics = [r(548, 82, 264, 318, C.dark, C.dark, 10), t(566, 109, 'Measured evidence', 12, C.darkMuted, 500), tm(566, 151, 'PERF', 9, C.darkMuted), tm(790, 151, '≥ 90', 18, C.tealBright, 600, "text-anchor='end'"), tm(566, 195, 'A11Y', 9, C.darkMuted), tm(790, 195, '≥ 95', 18, C.tealBright, 600, "text-anchor='end'"), tm(566, 239, 'CLS', 9, C.darkMuted), tm(790, 239, '≤ 0.1', 18, C.amber, 600, "text-anchor='end'"), line(566,263,794,263,C.darkMuted), t(566, 290, '교육용 모델', 10, C.darkMuted, 500), t(566, 311, '실제 compliance 판정 아님', 11, C.darkInk, 500), t(566, 340, 'Release 17 · connectorized bench', 9, C.blueBright, 500)].join('');
  const archive = [r(28, 418, 784, 114), t(46, 446, 'Review archive · 결정이 남아야 drift를 막는다', 12, C.muted, 500), line(48, 477, 788, 477, C.rule, 2), ...[['Contract',70,C.teal],['RF audit',238,C.blue],['Visual QA',406,C.oxide],['Figma parity',574,C.red],['Release',742,C.teal]].map(([label,x,color])=>`<circle cx="${x}" cy="477" r="6" fill="${color}"/>${t(x,505,label,9,C.muted,500,"text-anchor='middle'")}`).join('')].join('');
  return svg('Review Archive', '승인·수치·예외를 한곳에 기록해 다음 질문 페이지도 같은 기준으로 확장한다.', 'ARCHIVE / 08', table + metrics + archive);
}

const boards = new Map([
  ['typography-visualization.svg', typographyBoard()],
  ['components-states.svg', componentsBoard()],
  ['interactive-lab-patterns.svg', patternsBoard()],
  ['core-screens.svg', coreScreensBoard()],
  ['responsive-screens.svg', responsiveBoard()],
  ['review-archive.svg', reviewBoard()],
]);

await mkdir(outDir, { recursive: true });
for (const [name, source] of boards) {
  await writeFile(new URL(name, outDir), source, 'utf8');
}
console.log(`Generated ${boards.size} Figma boards in ${outDir.pathname}`);
