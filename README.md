# RF Wiki — Precision Lab

RF Wiki는 RF 엔지니어가 장비 설정, 물리 신호, 계산 모델과 화면 결과를 한 흐름으로 연결해 학습하는 정적 웹 애플리케이션입니다. 각 lesson은 compact 학습 지도와 하나의 main document로 구성되며, intuition layer의 짧은 핵심 설명 직후 inline lab에서 결과를 예측하고 계산 모델을 조작한 뒤 직관의 세부 내용, bench 해석과 수식·규격으로 이어집니다.

처음 사용한다면 [RF Wiki 사용자 가이드](docs/user-guide.md)에서 실행 방법, 첫 실험 순서, 화면 읽는 법, 완료 조건과 진도 저장 방식을 확인하세요.

## 현재 범위

- RF 주파수·복소수·dB·50 Ω 기초
- Spectrum Analyzer, VSA, IQ capture와 FFT
- OFDM, LTE, NR Release 17 resource structure
- VNA, S-parameter, Smith Chart와 VSWR
- Power flow, coupling, insertion, isolation과 directivity
- PA 비선형성, stability, source/load-pull

내장된 결정론적 교육 시나리오만 사용합니다. 서버, 로그인, telemetry, 실측 파일 import, SCPI와 라이브 AI는 v1 범위가 아닙니다.

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
npm run build
npm run test:e2e
npm run audit:lighthouse
npm run test:all
~~~

`npm run build`는 Astro 정적 사이트를 만든 뒤 Pagefind index를 생성합니다. `npm run audit:lighthouse`는 production build의 홈, Spectrum/IQ, NR, VNA, PA pull 다섯 경로를 mobile profile로 검사해 Performance 90+, Accessibility 95+, CLS 0.1 이하를 강제하고 로컬 HTML/JSON report를 `output/lighthouse/`에 남깁니다.

## 구조

- `src/pages/` — Astro 정적 route
- `src/content/lessons/` — MDX lesson과 frontmatter
- `src/components/astro/` — 정적 학습·문서 컴포넌트
- `src/components/simulators/` — React simulator island
- `src/components/plots/` — 반응형 SVG view
- `src/lib/rf/` — UI와 분리된 순수 TypeScript RF 계산
- `src/styles/tokens.css` — 디자인 token의 코드 기준
- `scripts/` — design/content 계약 검사와 authoring 도구

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

## 제품·디자인 계약

제품, 콘텐츠, Figma 또는 UI를 변경하기 전에 다음 순서로 읽습니다.

1. `PRODUCT.md`
2. `DESIGN.md`
3. `SKILLS.md`
4. `AGENTS.md`

우선순위는 `DESIGN.md → 승인된 Figma frame → 기존 컴포넌트와 계산 API → 외부 skill 기본값`입니다. RF math는 UI에 복제하지 않고 `src/lib/rf/`에 둡니다.

## 교육 모델의 한계

Simulator 결과는 원리 학습과 설정 변화의 방향을 이해하기 위한 모델입니다. 실제 장비의 정확도, calibration 상태, fixture, mismatch, noise, 규격 compliance 판정을 대신하지 않습니다.
