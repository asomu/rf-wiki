# RF Wiki 완성 마스터 계획

마지막 갱신: 2026-07-17

## 목표

이전 대화에서 합의한 RF 기초, 계측기, Cellular/PAMiD 학습 자료를 하나의 RF Wiki에 완성한다. 단순히 페이지 수를 채우는 것이 아니라 학습자가 **직관 → 벤치 절차 → 이론/규격 → 실습 → 확인 문제**의 흐름으로 이해하고, 실제 장비 측정에서 다음 행동을 결정할 수 있어야 한다.

- 기준 저장소: `/Users/mark/Documents/rf-wiki`
- 공개 사이트: `https://rf-wiki-precision-lab.mark-jang.chatgpt.site/cellular/`
- 별도 GSM PvT 프로토타입: `/Users/mark/Documents/New project`
- 통합 원칙: 기존 RF 6개, 장비 25개와 Cellular 59개는 유지하고, 실제 판단을 합성하는 DVT 6개만 독립 `/dvt/` 트랙과 `dvt:*` 진도로 추가한다.

## 완료 판정 규칙

체크박스는 다음 증거가 있을 때만 완료한다.

1. 콘텐츠가 승인된 정보 구조와 URL에 존재한다.
2. 핵심 수치·공식·규격 범위가 출처와 연결된다.
3. 시각화는 색상에만 의존하지 않고 축·단위·설명·데이터 표 대안을 제공한다.
4. 실습은 `Control → RF model → Linked views → Ledger → Prediction/Explanation` 흐름을 따른다.
5. 데스크톱·태블릿·모바일과 키보드 사용에서 정상 동작한다.
6. 관련 단위 테스트, 타입 검사, 빌드, 브라우저 검증이 통과한다.
7. 공개 배포본에서 직접 재확인한다.

어느 단계든 검증이 실패하면 해당 체크를 열어 두고 다음 단계로 넘어가지 않는다.

## 현재 전체 콘텐츠 지도

| 영역 | 승인 범위 | 현재 상태 | 남은 핵심 작업 |
|---|---:|---|---|
| RF 기초 | 6 lessons | 구현·사용자 관점 감사 완료 | 없음 |
| 계측기 | 5대 × 5 chapters = 25 | 구현·사용자 관점 감사 완료 | 없음 |
| Cellular foundations | 8 pages | Bit→IQ→RF→IQ→Bit 확장·감사 완료 | 없음 |
| PAMiD | 10 pages | 구현·DVT/diagnostics 연결 감사 완료 | 없음 |
| GSM/GPRS/EDGE | 9 pages | 구현·PvT 심화 실습 통합 완료 | 없음 |
| LTE | 11 pages | 구현·grid/PAMiD 흐름 감사 완료 | 없음 |
| NR FR1 | 11 pages | 구현·numerology/BWP/RB100/TDD 감사 완료 | 없음 |
| Diagnostics | 10 pages | 구현·PvT violation 연결 완료 | 없음 |
| PAMiD/TxM DVT | 6 lessons | 구현·3축 전문 리뷰·전체 회귀 완료 | Sites version 저장·공개 승인 |
| 검색·용어·진도·문서 | 공통 | 전체 연결·회귀 완료 | 공개본 검증 |

현재 학습 계약은 RF 기초 6개, 계측기 25개, Cellular/PAMiD 59개와 DVT 6개, 총 96개다. DVT는 기존 설명을 복제하지 않고 `capability → station validity → synchronized point → uncertainty/guardband → stimulus comparison → blind conclusion`으로 연결한다.

## 단계별 실행 체크리스트

### Phase 0 — 이전 합의와 원본 복구

- [x] 이전 Codex 대화에서 전체 RF Wiki 요구 범위를 복구했다.
- [x] 실제 기준 저장소와 별도 GSM 프로토타입을 구분했다.
- [x] 공개 GPT Sites 프로젝트와 현재 배포 URL을 확인했다.
- [x] `PRODUCT.md`, `DESIGN.md`, `SKILLS.md`, `AGENTS.md` 우선순위를 다시 확인했다.

### Phase 1 — 구조·수량·기술 기준선 감사

- [x] RF 기초 6개 lesson이 모두 `ready`이고 고유 route/progress ID를 가진다.
- [x] 5개 계측기 트랙의 25개 chapter가 모두 `ready`이다.
- [x] Cellular/PAMiD 59개 페이지가 승인된 분량 `8+10+9+11+11+10`과 일치한다.
- [x] 59개 페이지에 최소 1개 규격/근거, 3단계 설명, 확인 문제가 존재한다.
- [x] 기존 대표 시각 회귀 기준선 66개가 유효하다.
- [x] 기준선 전체 테스트를 통과했다.

이 수치는 DVT 확장 이전 기준선이다. DVT 6개가 포함된 최종 route·test·Pagefind 수치는 Phase 7 전체 검증 뒤 갱신한다.

### Phase 2 — 사용자 관점 콘텐츠 깊이 감사

#### RF 기초 6개

- [x] RF·주파수·복소수·dB·50 Ω의 선행 개념 누락을 점검했다.
- [x] SA spectrum과 IQ magnitude/phase의 차이를 장비 화면 관점에서 점검했다.
- [x] LTE/NR OFDM·RB·resource location 설명과 NR 100 MHz/RB100/location 0 예제를 점검했다.
- [x] VNA·S-parameter·Smith·VSWR 연결 설명을 점검했다.
- [x] Forward/delivered/coupled/insertion/isolation/directivity 용어 연결을 점검했다.
- [x] PA nonlinear/stability/load-pull/source-pull의 측정 의사결정 흐름을 점검했다.

#### 계측기 25개

- [x] N5182B SG 5개 chapter의 안전한 source bring-up과 PyVISA 흐름을 점검했다.
- [x] N9020B SA 5개 chapter의 sweep/IQ/PA spectrum 흐름을 점검했다.
- [x] E5080B VNA 5개 chapter의 calibration/reference plane/PA 측정을 점검했다.
- [x] U2061XA power sensor 5개 chapter의 average/peak/burst/correction 흐름을 점검했다.
- [x] N6705C/N6752A supply 5개 chapter의 bias/CV-CC/remote sense/DC power 흐름을 점검했다.
- [x] 각 장비 트랙의 SCPI/PyVISA 예제가 dry-run 우선 안전 계약을 지키는지 점검했다.

#### Cellular/PAMiD 59개

- [x] Foundations 8개가 Bit→IQ→RF→IQ→Bit, coding·receiver와 metric 기준면을 충분히 설명하는지 점검했다.
- [x] PAMiD 10개가 module anatomy·state control·reference plane·DVT 책임 분리를 충분히 설명하는지 점검했다.
- [x] GSM 9개가 frame/timeslot/burst/GMSK/EDGE/multislot/module DVT까지 자연스럽게 연결되는지 점검했다.
- [x] LTE 11개가 time/grid/RB/modulation/SC-FDMA/power/PAMiD DVT까지 자연스럽게 연결되는지 점검했다.
- [x] NR FR1 11개가 numerology/BWP/RB100/location 0/CP-OFDM/DFT-s-OFDM/TDD/PAMiD DVT까지 연결되는지 점검했다.
- [x] Diagnostics 10개가 증상→후보 stage→control check→분리 측정→false positive 순서를 제공하는지 점검했다.
- [x] 공식이 필요한 페이지, 고유 시각 자료가 필요한 페이지, 교차 링크가 부족한 페이지를 보강했다.

감사 근거: [`CONTENT_AUDIT.md`](CONTENT_AUDIT.md). 그림·식·링크의 단순 개수가 아니라 사용자가 다음 측정 행동을 선택할 수 있는지를 기준으로 판정했다.

### Phase 3 — 심화 실습 통합

- [x] GSM module 측정 페이지에 교육용 PvT 실습을 통합했다.
- [x] 6개 결정론적 시나리오와 7개 RF/control 파라미터를 제공한다.
- [x] 실행 전에 PASS/첫 fail 영역을 예측하도록 한다.
- [x] Trace와 상·하한 corridor, 첫 violation, worst margin, 가능한 원인을 연결한다.
- [x] 차트 축·단위·선 스타일·직접 라벨·데이터 표 대안을 제공한다.
- [x] 교육용 corridor가 공식 conformance mask가 아님을 명확히 표시한다.
- [x] Diagnostics의 switching transient 페이지로 분리 측정 흐름을 연결한다.
- [x] 모델 경계값·결정성·6개 golden scenario 단위 테스트를 추가한다.

### Phase 4 — 정보 구조와 학습 연속성

- [x] 홈·학습 지도·section hub에서 기존 6+25+59 범위가 보이는지 확인했다.
- [x] 검색이 RF/장비/Cellular/PAMiD 핵심 용어와 새 PvT 실습을 찾는지 확인했다.
- [x] Glossary 용어가 페이지 설명과 모순되지 않는지 확인했다.
- [x] 진도 저장과 lesson 완료가 중복 ID 없이 유지되는지 확인했다.
- [x] 이전/다음 chapter, cross-link, diagnostics 진입 경로에 막힌 링크가 없는지 확인했다.
- [x] README와 사용자/작성자 문서에 전체 범위와 마스터 계획을 연결했다.

### Phase 5 — 품질 게이트

- [x] design/content/schema 계약 검사를 통과했다.
- [x] Astro typecheck와 전체 Vitest/Python test를 통과했다.
- [x] production build와 Pagefind index 생성을 통과했다.
- [x] 전체 route smoke test를 통과했다.
- [x] 1440/1024/390 px 시각 회귀를 통과했다.
- [x] 키보드·focus·reduced-motion·색상 비의존·데이터 표 대안을 확인했다.
- [x] Lighthouse 성능·접근성·CLS 기준을 확인했다.
- [x] 변경 diff를 요구사항별로 최종 자체 감사했다.

최종 품질 증거(2026-07-17): Astro 198 files/0 diagnostics, Vitest 39 files/279 tests, Python 5 packages/114 tests, hosting 3 tests, 109 static pages, Pagefind 108 pages/16,950 words, Playwright 510 tests, 72 visual baselines, Lighthouse 16 routes Performance 98–100/Accessibility 100/CLS ≤ 0.0038.

### Phase 6 — 커밋·GPT Sites 배포·공개본 확인

- [x] 전체 변경과 검증 증거를 커밋한다.
- [x] Sites production build를 패키징하고 기존 프로젝트에 새 version으로 배포한다.
- [x] 공개 URL에서 홈, RF lesson, 계측기, GSM PvT, LTE, NR, diagnostics, 검색을 확인한다.
- [x] 이 문서의 모든 체크가 완료되었는지 최종 대조한다.
- [x] 사용자에게 완료 범위, 검증 결과, 공개 URL을 인계한다.

## 변경 기록

| 날짜 | 단계 | 결과 |
|---|---|---|
| 2026-07-17 | Phase 0 | 이전 대화·저장소·공개 사이트 범위 복구 완료 |
| 2026-07-17 | Phase 1 | 6+25+59 구조 및 전체 자동 기준선 통과 |
| 2026-07-17 | Phase 2 | 기존 90개 학습 항목 사용자 관점 콘텐츠 감사 완료 |
| 2026-07-17 | Phase 3 | 기존 GSM 9번째 페이지에 PvT Workbench 통합 완료 |
| 2026-07-17 | Phase 4 | 기존 3트랙, PvT 검색·glossary, 독립 진도·문서 연결 완료 |
| 2026-07-17 | Phase 5 | 510 E2E·72 visual·16 Lighthouse 포함 전체 품질 게이트 완료 |
| 2026-07-17 | Phase 6 | 커밋 `4b7e00b`, Sites version 4 배포, 공개 8개 대표 경로와 PvT 예측→FAIL 진단 흐름 검증 완료 |

### Phase 7 — PAMiD/TxM Module DVT 시니어 경로

- [x] LTE FDD Band 3 계열 교육 프로필과 가상 project allocation 경계를 고정한다.
- [x] `/dvt/`와 6개 연속 route, `dvt:*` progress ID를 추가한다.
- [x] Capability, station qualification, synchronized point, uncertainty, stimulus 비교와 blind conclusion 콘텐츠를 작성한다.
- [x] READY/CONDITIONAL/BLOCKED, VALID/INVALID/INCONCLUSIVE와 upper/lower/range decision 계약을 순수 모델로 구현한다.
- [x] CW·two-tone·LTE static linked views에 축·단위·marker·직접 label·요약·표 대안을 제공한다.
- [x] Four React lab의 prediction lock, keyboard completion, evidence 공개와 report completion을 검증한다.
- [x] Content/design, typecheck, unit/Python, build/Pagefind와 Playwright 회귀를 통과한다.
- [x] 1440/1024/390px, 200% zoom, reduced motion와 axe를 확인한다.
- [x] 코드, 디자인·접근성, RF·계측 콘텐츠 3축 전문 리뷰의 `NO-GO` finding을 반복 수정하고 최종 `GO`를 받는다.
- [x] 최종 구현 commit을 `fa4427d` (`fix: harden DVT evidence workflow`)로 고정하고 전체 gate를 재실행한다.
- [ ] 검증된 exact commit `fa4427d`로 Sites version을 저장한다.
- [ ] 사용자 승인 후 공개 version을 전환하고 공개본을 재검증한다.

최종 구현·품질 증거(2026-07-17): content contract `6 + 25 + 59 + 6 = 96`, Astro typecheck 234 files/0 diagnostics, Vitest 44 files/336 tests, Python 5 packages/114 tests, hosting 3 tests, production build 118 pages, Pagefind 117 pages/18,844 words, Playwright 665/665, visual baselines 107/107, DVT 집중 E2E와 완료 후 axe 4/4, Lighthouse 19 routes Performance 98–100/Accessibility 100/CLS 약 0.0020–0.0038을 통과했다. `npm test`, 정적 client·Pagefind·Worker·hosting metadata를 만드는 Sites build와 `git diff --check`도 통과했다. 3축 reviewer는 모두 최종 `GO`이며 P0–P3 잔여 finding은 없다.

#### `fa4427d` evidence hardening 요약

- Expected evidence와 observed payload가 다르면 진행을 막고, ACLR·EVM·Pout·Tx-noise/desense 및 PAE를 원본 measurement·external evidence에 연결한다.
- Analyzer evidence는 `connector → input attenuation → mixer → station-verified operating boundary`와 reference-level display·IF/ADC residual을 분리한다. Headroom, operating limit와 residual provenance는 typed record와 registry의 값·단위·상태·timestamp로 검증한다.
- Independent isolation은 calibration certificate와 VNA excitation query-back을 포함한 canonical payload로 검증한다. `canonical-v1` checksum은 결정론적 교육용 non-security checksum이며 tamper-proof digest가 아니다.
- Historical PAE false-fail 원인과 현재 requalified PAE `PASS`를 분리하고, prediction-first·focus/process state·session draft를 유지한다. Nested draft와 `sessionStorage` `SecurityError`, 실제 44×44px choice carrier, 완료 report의 390/1440px 기준선을 검증했다.
- TS 36.521-1은 V17.6.1의 실질 clause 4, 6.2.2, 6.6.2.3을 사용한다. N9020B `−145 dBm/Hz`는 source-terminated 교육용 station baseline일 뿐 vendor specification으로 확대하지 않는다.

<!-- VERIFY: OpenAI Sites v8의 commit 427bf26 매핑과 현재 공개 version을 배포 플랫폼에서 재확인한다. -->
배포는 아직 Phase 7 완료가 아니다. `fa4427d`의 Sites version은 저장·게시되지 않았다. 이전 작업에서 개선 전 commit `427bf26`용 Sites v8을 저장했지만 공개 전환은 수행하지 않았으므로, v8이나 현재 공개본을 최신 구현으로 취급하지 않는다. 새 version 저장과 공개 전환은 사용자 승인을 기다린다.

#### DVT 범위 경계

- 현재 pinned 5종과 내장 결정론적 case만 사용하며 파일 import/export, backend와 live instrument bridge를 추가하지 않는다.
- LTE/NR EVM·SEM과 E5080B GCA는 실제 application/option/license와 residual 확인 전 CONDITIONAL이다.
- Tx RX-band noise와 duplexer/isolation evidence는 `desense risk budget`만 제공한다. 실제 receiver sensitivity·BLER 또는 Rx desense를 측정했다고 표현하지 않는다.
- Temperature·ET·VSWR는 필요한 sensor/scope/tuner가 확보된 후 별도 milestone로 확장한다.
