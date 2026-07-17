# RF Wiki 세션 인수인계

이 문서는 새 Codex 세션이 대화 기록 없이도 현재 제품 상태와 다음 작업을 안전하게 이어가기 위한 작업 지도다. 코드나 UI를 바꾸기 전에 `PRODUCT.md → DESIGN.md → SKILLS.md → AGENTS.md`를 먼저 읽는다.

## 현재 완성 범위

- 기존 RF 개념 6축과 진도 key `rf-wiki:v1:progress`는 유지된다.
- 별도 `계측장비 스터디` 트랙이 `/instruments/`에 있다.
- 다섯 Keysight 기준 장비의 허브와 장비별 5개 챕터, 총 25개 챕터가 학습 가능 상태다.
- 별도 `3GPP·PAMiD` 트랙이 `/cellular/`에 있으며 Release 17 기준 질문형 페이지 59개가 모두 `ready` 상태다.
- GSM 9번째 `GSM module 측정` 페이지에는 prediction-first Power-versus-Time Workbench가 통합되어 있다.
- Cellular 진도는 `cellular:*` namespace로 저장되어 RF 6축과 장비 25개 chapter 진도와 합산되지 않는다.
- 네 번째 `PAMiD/TxM Module DVT` 트랙이 `/dvt/`에 있으며 LTE FDD Band 3 계열 교육 profile의 6개 lesson이 `ready`다. 진도는 `dvt:<slug>` namespace다.
- 현재 content contract는 `RF 6 + 장비 25 + Cellular 59 + DVT 6 = 96`개다.

| 트랙 | 고정 기준 | Firmware context | 허브 | 진도 namespace |
|---|---|---|---|---|
| SG | `N5182B-506 + Option 656` | `B.01.96` | `/instruments/sg-mxg/` | `instrument:sg:*` |
| SA | `N9020B-526 + B1X + MPB + P26` | `A.43.49` | `/instruments/sa-mxa/` | `instrument:sa:*` |
| NA(VNA) | `E5080B-2K0`, 2-port, 9 kHz–20 GHz | `A.20.25.03` | `/instruments/vna-ena/` | `instrument:vna:*` |
| Power Sensor | `U2061XA`, 10 MHz–6 GHz | `A.03.16` | `/instruments/power-sensor/` | `instrument:sensor:*` |
| Power Supply | `N6705C + N6752A Option 761` | `E_02_09_3271` | `/instruments/power-supply/` | `instrument:psu:*` |

- 각 허브에서 `기본 안전 동작 → 핵심 물리·측정 상태 → 보정·배선 → SCPI·PyVISA → PA bench capstone`의 다섯 챕터를 연다.
- RF 개념 진도와 다섯 장비 진도는 서로 합산하지 않는다.

## 핵심 구현 위치

| 역할 | 위치 |
|---|---|
| 장비 manifest·챕터 순서 | `src/data/instruments.ts` |
| 장비 MDX schema | `src/content.config.ts`의 `instrumentLesson` |
| 25개 장비 챕터 | `src/content/instruments/{n5182b,n9020b,e5080b,u2061xa,n6705c}/` |
| 공용 허브·lesson layout·학습 지도 | `src/components/astro/InstrumentHub.astro`, `src/layouts/InstrumentLessonLayout.astro`, `src/components/astro/InstrumentLearningMap.astro` |
| Lab scenario router | `src/components/astro/InstrumentLab.astro` |
| 장비별 React lab | `src/components/simulators/{Mxg,Mxa,Ena,PowerSensor,Psu}InstrumentLab.tsx`와 대응 CSS |
| SCPI catalog·reducer·장비 계산 | `src/lib/instruments/` |
| 공용 장비 타입 | `src/types/instruments.ts` |
| 실제 장비용 Python | `examples/{mxg,n9020b,e5080b,u2061xa,n6705c}_pyvisa/` |
| PyVISA 운영 가이드 | `docs/{MXG,N9020B,E5080B,U2061XA,N6705C}_PYVISA_GUIDE.md` |
| 공용 Python 다운로드 route | `src/pages/instruments/[instrument]/python-examples/` |
| 결정론적 ZIP 생성 | `src/lib/downloads/mxg-pyvisa-package.mjs`, `src/lib/downloads/instrument-pyvisa-package.mjs` |
| OpenAI Sites build | `scripts/build-sites.mjs`, `worker/index.js`, `.openai/hosting.json` |
| Cellular schema·59개 질문 | `src/content.config.ts`의 `cellularLesson`, `src/content/cellular-lessons.json` |
| Cellular section·source registry | `src/data/cellular.ts`, `src/data/cellular-specs.ts` |
| GSM timing·PvT·PAMiD·진단 모델 | `src/lib/cellular/` |
| Cellular route·layout | `src/pages/cellular/`, `src/layouts/CellularLessonLayout.astro` |
| Cellular 시각화 | `src/components/cellular/`, `src/components/astro/CellularVisual.astro` |
| Cellular public types | `src/types/cellular.ts` |
| DVT schema·6개 MDX | `src/content.config.ts`의 `dvtLesson`, `src/content/dvt/` |
| DVT route·layout·static view | `src/pages/dvt/`, `src/layouts/DvtLessonLayout.astro`, `src/components/astro/Dvt*.astro` |
| DVT React labs | `src/components/dvt/` |
| DVT pure model·types | `src/lib/rf/dvt.ts`, `src/types/dvt.ts` |

N9020B·E5080B·U2061XA·N6705C는 `INSTRUMENT_PYVISA_PACKAGES` registry와 공용 dynamic route를 사용한다. N5182B는 먼저 만들어진 전용 builder·route를 유지하지만, `build:sites`에서는 다섯 package를 같은 checksum·manifest·추출 후 dry-run·fake-transport 절차로 검증한다.

## 변경하면 안 되는 안전 계약

1. 웹은 실제 장비에 연결하지 않는다. 임의 Python과 사용자 waveform도 실행하지 않는다.
2. 모든 로컬 Python package는 기본 dry-run이다. SG·VNA의 실제 source enable은 `--execute`와 `--rf-on`, PSU output enable은 `--execute`와 `--output-on`을 각각 요구한다. VNA는 DUT input limit·receiver working limit·최대 DUT gain도 명시하고 signed path gain/loss·uncertainty·guard envelope를 통과해야 한다. Sensor의 `--execute`도 upstream source RF OFF 확인과 측정 전 별도 stimulus-release evidence를 요구한다.
3. 장비·module·option·firmware 확인, safe OFF/abort, configure, query-back, bounded error drain이 출력 enable보다 먼저다. Cleanup은 가장 안전한 OFF/abort부터 시작하며 OFF query-back 실패를 성공으로 숨기지 않는다.
4. SG RF ON 판단은 average setpoint만 쓰지 않는다. PAPR/crest factor, signed path gain, uncertainty, guard margin, DUT limit과 duty cycle을 함께 본다.
5. SA는 connector damage limit과 mixer/IF/ADC working headroom을 구분한다. 실제 input은 software abort로 제거할 수 없으므로 coupler·attenuator·DC block을 연결 전에 준비하고, preamp OFF·충분한 attenuation·fresh acquisition을 확인한 뒤 trace와 marker를 읽는다.
6. VNA는 full configuration query-back, clean error queue와 DUT/receiver power envelope가 확인되지 않으면 RF ON을 거절한다. Reverse S-parameter에는 별도 reverse-drive 동의를 요구한다. Correction·CalSet·acquisition freshness가 확인되지 않은 SDATA를 물리적으로 보정된 trace라고 부르지 않는다.
7. Power sensor는 average와 5 MHz peak path의 한계를 구분하고, zero/cal 중 upstream RF OFF와 damage-level guard를 강제한다. 한 방향 power만으로 accepted/delivered power라고 단정하지 않는다.
8. PSU는 N6752A 50 V/10 A/100 W envelope, OCP, setpoint query-back과 명시적 output permit을 모두 통과해야 한다. Remote inhibit, fuse와 DUT bias sequencing은 software cleanup과 별도다.
9. 통신 단절 시 software OFF는 보장되지 않는다. Hardware attenuation/interlock·remote inhibit와 DUT별 bias policy를 항상 별도 조건으로 남긴다.
10. SG·SA·VNA·sensor·PSU의 역할을 섞지 않는다. SA가 spectrum power·IQ·ACLR을 취득할 수 있어도 RF Pin/Pout·DC power·PAE를 혼자 만든다고 표현하지 않고 실제 측정 장비와 계산의 주인을 명시한다.
11. Cellular IQ/resource view는 교육용이며 compliance waveform이 아니다. GSM/LTE/NR의 전체 coding·scrambling·reference sequence transmitter와 certification 판정을 구현했다고 표현하지 않는다.
12. Generic MIPI 상태에 실제 제조사 register 의미를 부여하지 않는다. GSM PA+ASM, FDD PAMiD와 TDD TxM의 path·duplex 조건을 서로 섞지 않는다.
13. DVT target은 가상 project allocation이다. EVM·SEM·GCA는 option/application/license와 residual 확인 전 CONDITIONAL이며, Tx noise/isolation 결과를 actual Rx desense·sensitivity·BLER로 확대하지 않는다.
14. DVT 웹 사례는 내장 결정론적 데이터만 사용한다. Report는 HTML preview와 복사 가능한 교육용 conclusion이며 파일 import/export, backend와 live instrument bridge를 추가하지 않는다.

## 디자인·학습 계약

- 영구 split rail이나 Feature Lab을 다시 만들지 않는다. 왼쪽은 compact 학습 지도, 오른쪽은 하나의 main document다.
- lab은 본문 안에서 `설정 → 예측 → 결과 → Cause/Effect Ledger → 설명` 순서다.
- lab 내부 재배치는 viewport가 아니라 `.lab-shell`의 실제 폭을 따른다. 1024px 이하 container에서는 workbench를 쌓는다.
- 390/1024/1440px과 200% 확대에서 document 가로 스크롤이 없어야 한다.
- 모든 수치 plot은 직접 라벨·text summary와 접을 수 있는 semantic data table 대안을 함께 제공한다.
- Option 656 화면에서는 sample rate를 100 MSa/s로 제한한다. 200 MSa/s는 656+657 비교 설명으로만 제공한다.
- N9020B B1X 화면에서는 analysis bandwidth를 최대 160 MHz로 제한하고 span, RBW와 IQ sample rate를 같은 설정처럼 표현하지 않는다.
- 긴 챕터 끝에는 이전/다음 챕터 navigation을 유지한다.
- 색은 forward/reference/reverse/secondary의 물리 의미에만 쓰고 dash·marker·직접 라벨을 함께 쓴다.

## 검증 명령

~~~bash
npm test
npm run test:e2e
npm run audit:lighthouse
npm run build:sites
~~~

`npm test`에는 design/content contract, visual-baseline integrity, Astro typecheck, TypeScript unit, 다섯 Python fake-transport suite, hosting tests와 production build가 포함된다. `npm run test:e2e`는 production build를 만든 뒤 정적 preview에서 실행하므로 오래된 Astro dev server를 재사용하지 않는다. `build:sites`는 배포 산출물뿐 아니라 다섯 장비 ZIP의 checksum·manifest를 검사하고 추출된 package의 dry-run과 tests도 실행한다.

### 2026-07-17 DVT 확장 검증 체크포인트

- Content contract: RF 6개, Keysight 장비 25개, Cellular 59개, DVT 6개로 총 96개 통과
- Astro typecheck: 234 files, 0 errors, 0 warnings, 0 hints 통과
- Vitest: 44 files, 324 tests; Python safety: 5 packages, 114 tests; hosting: 3 tests 통과
- Production build: 118 pages, Pagefind 117 pages·18,765 words index 통과
- Browser E2E: 663 tests, 105 visual baselines, 1440/1024/390px, 200% zoom, keyboard, reduced motion와 axe 통과
- Lighthouse: 19 routes, Performance 97–100, Accessibility 100, CLS 0.0038 이하 통과
- RF/PA와 계측·불확도 전문 reviewer 모두 `GO`; BLOCKER/HIGH/MEDIUM finding 없음
- Sites는 검증된 exact commit으로 새 version을 저장하되 공개 version 전환은 사용자 승인 전까지 보류한다.

### 다음 변경에서 다시 열어야 하는 QA

Cellular/DVT lesson, 시각화, global navigation 또는 token을 바꾸면 해당 화면만 확인하고 끝내지 않는다. `npm test → npm run test:e2e → npm run audit:lighthouse → npm run build:sites` 순서로 전체 회귀를 다시 닫고, 의도된 시각 변경일 때만 visual baseline을 갱신한다. 신규 표준 수치는 exact version·clause·applicability와 source kind를 먼저 고정한다.

## 다음 장비를 추가하는 순서

새 장비는 기존 다섯 장비 route에 콘텐츠를 넣지 말고 새 instrument ID, manifest, collection schema와 전용 SCPI state model로 추가한다.

1. 기준 model/option/firmware와 공식 문서를 고정한다.
2. 장비 manifest와 5개 안팎의 학습 질문을 정의한다.
3. `instrumentLesson` schema를 새 instrument ID와 chapter 집합으로 확장한다.
4. 공용 hub·layout·dynamic Python download route를 재사용하되 반드시 `instrumentId`로 collection을 필터링한다.
5. command catalog/reducer, simulator, local adapter와 fake transport를 함께 만든다.
6. 검색·glossary·Sites route·responsive/axe/visual/Lighthouse 검증에 새 대표 화면을 넣는다.

## 배포 메모

`npm run build:sites` 성공 후 `dist/client`, `dist/server`, `dist/.openai`가 OpenAI Sites 배포 단위다. `.openai/hosting.json`의 기존 `project_id`를 임의로 교체하지 않는다. 배포 자체는 외부 상태 변경이므로 사용자가 요청한 세션에서 수행한다.
