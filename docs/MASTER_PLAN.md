# RF Wiki 완성 마스터 계획

마지막 갱신: 2026-07-17

## 목표

이전 대화에서 합의한 RF 기초, 계측기, Cellular/PAMiD 학습 자료를 하나의 RF Wiki에 완성한다. 단순히 페이지 수를 채우는 것이 아니라 학습자가 **직관 → 벤치 절차 → 이론/규격 → 실습 → 확인 문제**의 흐름으로 이해하고, 실제 장비 측정에서 다음 행동을 결정할 수 있어야 한다.

- 기준 저장소: `/Users/mark/Documents/rf-wiki`
- 공개 사이트: `https://rf-wiki-precision-lab.mark-jang.chatgpt.site/cellular/`
- 별도 GSM PvT 프로토타입: `/Users/mark/Documents/New project`
- 통합 원칙: 별도 프로토타입의 검증된 모델은 RF Wiki의 기존 57개 Cellular 구조 안으로 흡수하고, 중복 사이트나 중복 진도를 만들지 않는다.

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
| Cellular foundations | 6 pages | 구현·시각 밀도 감사 완료 | 없음 |
| PAMiD | 10 pages | 구현·DVT/diagnostics 연결 감사 완료 | 없음 |
| GSM/GPRS/EDGE | 9 pages | 구현·PvT 심화 실습 통합 완료 | 없음 |
| LTE | 11 pages | 구현·grid/PAMiD 흐름 감사 완료 | 없음 |
| NR FR1 | 11 pages | 구현·numerology/BWP/RB100/TDD 감사 완료 | 없음 |
| Diagnostics | 10 pages | 구현·PvT violation 연결 완료 | 없음 |
| 검색·용어·진도·문서 | 공통 | 전체 연결·회귀 완료 | 공개본 검증 |

즉, 현재 사이트에는 GSM만 있는 것이 아니다. RF 기초 6개, 계측기 25개, Cellular/PAMiD 57개가 기준 저장소에 모두 남아 있다. GSM PvT는 별도 프로토타입에 있던 심화 경험을 기존 GSM 9번째 페이지로 통합하는 보강 작업이다.

## 단계별 실행 체크리스트

### Phase 0 — 이전 합의와 원본 복구

- [x] 이전 Codex 대화에서 전체 RF Wiki 요구 범위를 복구했다.
- [x] 실제 기준 저장소와 별도 GSM 프로토타입을 구분했다.
- [x] 공개 GPT Sites 프로젝트와 현재 배포 URL을 확인했다.
- [x] `PRODUCT.md`, `DESIGN.md`, `SKILLS.md`, `AGENTS.md` 우선순위를 다시 확인했다.

### Phase 1 — 구조·수량·기술 기준선 감사

- [x] RF 기초 6개 lesson이 모두 `ready`이고 고유 route/progress ID를 가진다.
- [x] 5개 계측기 트랙의 25개 chapter가 모두 `ready`이다.
- [x] Cellular/PAMiD 57개 페이지가 승인된 분량 `6+10+9+11+11+10`과 일치한다.
- [x] 57개 페이지에 최소 1개 규격/근거, 3단계 설명, 확인 문제가 존재한다.
- [x] 기존 대표 시각 회귀 기준선 66개가 유효하다.
- [x] 기준선 전체 테스트를 통과했다.

기준선 증거(2026-07-17): Astro 194 files/0 errors, Vitest 37 files/268 tests, Python 계측기 5 packages 통과, 109 static pages, Pagefind 108 pages/16,792 words.

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

#### Cellular/PAMiD 57개

- [x] Foundations 6개가 waveform·duplex·multiple access·metric 기준면을 충분히 설명하는지 점검했다.
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

- [x] 홈·학습 지도·section hub에서 전체 6+25+57 범위가 보이는지 확인했다.
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

- [ ] 전체 변경과 검증 증거를 커밋한다.
- [ ] Sites production build를 패키징하고 기존 프로젝트에 새 version으로 배포한다.
- [ ] 공개 URL에서 홈, RF lesson, 계측기, GSM PvT, LTE, NR, diagnostics, 검색을 확인한다.
- [ ] 이 문서의 모든 체크가 완료되었는지 최종 대조한다.
- [ ] 사용자에게 완료 범위, 검증 결과, 공개 URL을 인계한다.

## 변경 기록

| 날짜 | 단계 | 결과 |
|---|---|---|
| 2026-07-17 | Phase 0 | 이전 대화·저장소·공개 사이트 범위 복구 완료 |
| 2026-07-17 | Phase 1 | 6+25+57 구조 및 전체 자동 기준선 통과 |
| 2026-07-17 | Phase 2 | 88개 학습 항목 사용자 관점 콘텐츠 감사 완료 |
| 2026-07-17 | Phase 3 | 기존 GSM 9번째 페이지에 PvT Workbench 통합 완료 |
| 2026-07-17 | Phase 4 | 홈 3트랙, PvT 검색·glossary, 독립 진도·문서 연결 완료 |
| 2026-07-17 | Phase 5 | 510 E2E·72 visual·16 Lighthouse 포함 전체 품질 게이트 완료 |
