# RF Wiki — Precision Lab

RF Wiki는 RF 엔지니어가 장비 설정, 물리 신호, 계산 모델과 화면 결과를 한 흐름으로 연결해 학습하는 정적 웹 애플리케이션입니다. 각 lesson은 compact 학습 지도와 하나의 main document로 구성되며, intuition layer의 짧은 핵심 설명 직후 inline lab에서 결과를 예측하고 계산 모델을 조작한 뒤 직관의 세부 내용, bench 해석과 수식·규격으로 이어집니다.

처음 사용한다면 [RF Wiki 사용자 가이드](docs/user-guide.md)에서 실행 방법, 첫 실험 순서, 화면 읽는 법, 완료 조건과 진도 저장 방식을 확인하세요.
다른 작업 세션에서 이어갈 때는 [세션 인수인계](docs/SESSION_HANDOFF.md)에서 현재 구조, 안전 계약과 다음 장비 추가 순서를 확인하세요.

## 현재 범위

- RF 주파수·복소수·dB·50 Ω 기초
- Spectrum Analyzer, VSA, IQ capture와 FFT
- OFDM, LTE, NR Release 17 resource structure
- VNA, S-parameter, Smith Chart와 VSWR
- Power flow, coupling, insertion, isolation과 directivity
- PA 비선형성, stability, source/load-pull
- 계측장비 스터디: Keysight N5182B MXG, N9020B MXA, E5080B ENA, U2061XA power sensor, N6705C + N6752A power system의 장비별 5개 챕터, 총 25개 챕터에서 기본 동작·SCPI·PyVISA와 PA bench workflow 제공
- 3GPP·PAMiD: Release 17 기준 Bit→IQ→RF→IQ→Bit 공통 기초, PAMiD anatomy/control, GSM/GPRS/EDGE와 PvT 실습, LTE PUSCH, NR FR1 PUSCH와 증상별 진단을 59개 질문형 페이지로 제공
- PAMiD/TxM Module DVT: LTE FDD Band 3 계열 교육 프로필에서 capability, station qualification, synchronized test point, uncertainty·guardband, CW/two-tone/LTE 비교와 blind conclusion을 6개 lesson으로 제공

현재 학습 계약은 `RF 6 + 장비 25 + Cellular 59 + DVT 6 = 96`개 항목입니다. DVT 사례의 target은 3GPP가 정한 PAMiD 단품 limit가 아니라 명시적인 가상 project allocation입니다.

웹은 내장된 결정론적 RF·SCPI 시나리오만 실행합니다. 서버, 로그인, telemetry, 실측 파일 import, 브라우저 직접 장비 제어와 라이브 AI는 범위가 아닙니다. 실제 장비 제어는 `examples/` 아래 장비별 로컬 Python package로 분리되어 있으며 기본 실행은 모두 dry-run입니다.

## 시작하기

Node.js 22.12.0 이상과 npm이 준비된 환경에서:

~~~bash
npm install
npm run dev
~~~

주요 검증 명령:

~~~bash
npm run check:design
npm run check:content
npm run check:visual-baselines
ASTRO_TELEMETRY_DISABLED=1 npm run typecheck
npm run test:unit
npm run test:python
npm run build
npm run test:e2e
npm run audit:lighthouse
npm run test:all
~~~

`npm run build`는 Astro 정적 사이트를 만든 뒤 Pagefind index를 생성합니다. `npm run test:e2e`는 이 production build를 정적 preview로 열어 검사하므로 dev-server의 cold compilation이나 이전 세션 상태에 의존하지 않습니다. `npm run audit:lighthouse`는 production build의 기존 RF·장비·Cellular 대표 화면과 DVT station·uncertainty·blind conclusion을 합친 19개 경로를 mobile profile로 검사해 Performance 90+, Accessibility 95+, CLS 0.1 이하를 강제하고 로컬 HTML/JSON report를 `output/lighthouse/`에 남깁니다.

### 2026-07-17 DVT 시니어 경로 최종 검증

- 최종 구현 commit: `fa4427d` (`fix: harden DVT evidence workflow`)
- Content contract: RF lesson 6개, Keysight 장비 5개·25개 ready chapter, Cellular 6개 section·59개 ready question, DVT 6개 lesson으로 총 96개
- Astro typecheck: 234 files, 0 errors·warnings·hints
- TypeScript/React unit: 44 files, 336 tests 통과
- Python safety suite: 5개 package, 총 114 tests 통과
- Production build: 118 pages, Pagefind 117 pages·18,844 words index 통과
- Browser E2E: 665/665 통과. 전체 route, 1440/1024/390px overflow·visual, 200% zoom, keyboard, reduced motion, axe와 `dvt:` 진도 포함
- Visual baselines: 107/107 PNG 무결성 검사와 완료된 DVT report의 390/1440px 기준선 포함
- DVT 집중 E2E와 완료 후 axe: 4/4 통과
- Lighthouse: 19개 경로 모두 Performance 98–100, Accessibility 100, CLS 약 0.0020–0.0038
- 전문 리뷰: 코드, 디자인·접근성, RF·계측 콘텐츠의 3축에서 여러 `NO-GO` finding을 반복 수정한 뒤 모두 `GO`; P0–P3 잔여 finding 없음
- Release artifact: `npm test`, 정적 client·Pagefind·Worker·hosting metadata를 만드는 `npm run build:sites`, `git diff --check` 통과

<!-- VERIFY: OpenAI Sites v8의 commit 427bf26 매핑과 현재 공개 version을 배포 플랫폼에서 재확인한다. -->
`fa4427d`용 새 Sites version은 아직 저장하거나 게시하지 않았습니다. 이전 작업에서 개선 전 commit `427bf26`용 Sites v8을 저장했지만 공개 전환은 수행하지 않았으므로, v8이나 현재 공개본을 최신 구현으로 부르지 않습니다. 새 version 저장과 공개 전환은 사용자 승인 대기 상태입니다.

### OpenAI Sites 배포 빌드

~~~bash
npm run test:hosting
npm run build:sites
~~~

`build:sites`는 기존 Astro 구조를 바꾸지 않고 정적 결과와 Pagefind를 `dist/client/`에 만들고, Sites용 Cloudflare Worker를 `dist/server/index.js`에 배치합니다. 동시에 다섯 장비 Python ZIP의 checksum·전체 manifest를 검사하고 압축을 푼 복사본에서 dry-run과 fake-transport tests를 실행합니다. N9020B·E5080B·U2061XA·N6705C는 공용 package registry와 dynamic download route를 사용하고 N5182B도 같은 Sites 검증 단계에 포함됩니다. `.openai/hosting.json`의 `project_id`는 Sites 프로젝트를 처음 생성할 때 받은 값을 그대로 보존해야 하며 임의로 만들거나 다른 프로젝트의 값으로 교체하지 않습니다. `PUBLIC_SITE_URL`을 지정한 빌드에서만 canonical URL을 출력하므로 로컬 주소가 배포 문서에 들어가지 않습니다.

## 구조

- `src/pages/` — Astro 정적 route
- `src/content/lessons/` — MDX lesson과 frontmatter
- `src/content/instruments/` — 장비별 MDX chapter
- `src/content/cellular-lessons.json` — 59개 Cellular 질문형 lesson registry
- `src/content/dvt/` — 6개 LTE FDD PAMiD DVT 합성 lesson
- `src/components/astro/` — 정적 학습·문서 컴포넌트
- `src/components/simulators/` — React simulator island
- `src/components/plots/` — 반응형 SVG view
- `src/lib/rf/` — UI와 분리된 순수 TypeScript RF 계산
- `src/lib/instruments/` — 장비별 계산, command catalog와 결정론적 SCPI state
- `src/lib/cellular/` — GSM timing, PAMiD topology와 diagnostic 모델
- `src/lib/downloads/` — 배포 가능한 장비별 PyVISA ZIP·checksum 생성과 검증
- `examples/*_pyvisa/` — 실제 장비용 dry-run-first Python·PyVISA 예제
- `src/styles/tokens.css` — 디자인 token의 코드 기준
- `scripts/` — design/content 계약 검사와 authoring 도구
- `worker/` — OpenAI Sites에서 정적 결과를 전달하는 Worker entry

Astro가 route와 정적 본문을 소유하고 React는 실제 상호작용이 필요한 simulator에만 사용됩니다.

## 새 질문을 lesson으로 추가하기

새 질문은 site-wide unique slug를 가진 하나의 MDX 파일로 만듭니다.

~~~bash
node scripts/new-lesson.mjs \
  --title "RBW를 줄이면 왜 noise floor가 내려갈까?" \
  --module spectrum-iq \
  --slug rbw-and-noise-floor \
  --lab-id spectrum
~~~

생성 파일은 `src/content/lessons/rbw-and-noise-floor.mdx`이며, TODO를 제거하고 `status: ready`로 승격한 뒤 canonical URL `/learn/rbw-and-noise-floor/`에 공개됩니다. Draft는 route·검색·navigation에서 제외됩니다. 도구는 기존 파일을 덮어쓰지 않으며 `--dry-run`에서는 아무 파일도 만들지 않습니다.

전체 조사·작성·검증 절차와 frontmatter/MDX helper 계약은 [Content authoring guide](docs/content-authoring.md)를 따릅니다.

이전 대화에서 합의한 RF 기초·계측기·Cellular/PAMiD 전체 완성 범위와 단계별 검증 상태는 [RF Wiki 완성 마스터 계획](docs/MASTER_PLAN.md)에서 관리합니다.
학습자 관점의 설명·시각 자료·교차 링크 판정은 [콘텐츠 감사](docs/CONTENT_AUDIT.md), 6축 시각 평가는 [UI Review](docs/UI-REVIEW.md)에 기록합니다.

장비 chapter scaffold는 장비 ID를 명시합니다.

~~~bash
npm run new:instrument-lesson -- \
  --instrument e5080b \
  --chapter safe-sweep \
  --title "VNA source를 켜기 전에 sweep의 어떤 경계를 정해야 할까?" \
  --dry-run
~~~

## 제품·디자인 계약

제품, 콘텐츠, Figma 또는 UI를 변경하기 전에 다음 순서로 읽습니다.

1. `PRODUCT.md`
2. `DESIGN.md`
3. `SKILLS.md`
4. `AGENTS.md`

우선순위는 `DESIGN.md → 승인된 Figma frame → 기존 컴포넌트와 계산 API → 외부 skill 기본값`입니다. RF math는 UI에 복제하지 않고 `src/lib/rf/`에 둡니다.

## 교육 모델의 한계

Simulator 결과는 원리 학습과 설정 변화의 방향을 이해하기 위한 모델입니다. 실제 장비의 정확도, calibration 상태, fixture, mismatch, noise, 규격 compliance 판정을 대신하지 않습니다.
