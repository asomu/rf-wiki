# RF Wiki 완성 작업 — Post-fix UI Review

**재감사일:** 2026-07-17
**기준:** `PRODUCT.md`, `DESIGN.md`의 Precision Lab 계약과 6-pillar 기준 (`UI-SPEC.md` 없음)
**스크린샷:** 갱신된 `home-track-index` 1024/390px, `cellular-gsm-pvt` 390px Playwright 기준선을 직접 판독
**판정:** 이전 WARNING 4/4 및 잔여 typography WARNING 해결 · BLOCKER 0개 · WARNING 0개

---

## Pillar Scores

| Pillar | Score | Post-fix finding |
|---|---:|---|
| 1. Copywriting | 4/4 | 복구 대화에 종속된 제목을 영속적인 사이트 범위 문구로 교체했고 CTA와 교육 모델 경계가 구체적이다. |
| 2. Visuals | 4/4 | 390px 첫 시야에 leading edge, plateau, trailing edge, 두 burst marker와 전체 corridor가 모두 보인다. |
| 3. Color | 4/4 | 물리 역할 토큰과 색·선 스타일·marker·텍스트의 중복 부호화가 유지됐다. |
| 4. Typography | 4/4 | 축 값과 SVG 직접 라벨을 모두 28px user-unit로 보정해 390px 축소 후 약 10px의 최종 크기를 유지한다. |
| 5. Spacing | 4/4 | 1024px의 2+1 track layout과 390px의 1열 구조가 전체 범위 발견성과 리듬을 모두 유지한다. |
| 6. Experience Design | 4/4 | 진도 namespace가 명확하고 PvT는 가로 스크롤 없이 전체 burst를 보여주며 새 Playwright 계약으로 고정됐다. |

**Overall: 24/24**

---

## Post-fix Automated Evidence

- 시각 기준선 무결성: **72개 PASS**
- Playwright: **510개 PASS**
- axe 접근성 검사: **전체 PASS**
- Lighthouse 16개 route: **Performance 98–100 / Accessibility 100**
- Layout stability: **CLS 최대 0.0038**
- 모바일 PvT 계약: `scrollWidth <= clientWidth`, trace visible, burst marker 2개를 Playwright로 검증 (`tests/e2e/interactions.spec.ts:469-482`)
- 갱신된 390px PvT 기준선에서 −20 µs 이전부터 563 µs 이후까지 전체 envelope, upper/lower corridor와 양쪽 edge가 한 화면에 존재한다.
- 모바일 축 값과 `TRACE / UPPER / LOWER` 직접 라벨이 모두 `--font-size-headline` 28px user-unit를 사용해 920→약 324px 축소 후 약 9.9px로 렌더링된다 (`src/styles/cellular.css:1572-1578`, `src/styles/tokens.css:67`).
- 갱신된 1024px 홈 기준선에서 RF/Cellular 두 카드와 full-span Instrument 카드가 다음 section 전에 모두 노출된다.

---

## Resolved Warning Verification

| Previous warning | Implemented resolution | Evidence | Result |
|---|---|---|---|
| `전체 학습 진도 · 0/6`가 88개 전체 진도로 오해됨 | 초기·동적 aria-label을 모두 `RF 개념 트랙 진도`로 변경 | `src/pages/index.astro:67`, `src/pages/index.astro:237` | **RESOLVED** |
| 홈 제목이 복구 당시 대화 맥락에 종속됨 | `전체 학습 자료를 세 트랙에서 이어갑니다.`로 변경 | `src/pages/index.astro:102-108`, 1024/390 기준선 | **RESOLVED** |
| 1024px에서 세 카드가 1열로 쌓여 Instrument 발견이 늦음 | 2열 + 마지막 Instrument full-span, 640px 이하만 1열 | `src/styles/global.css:1952-1958`, `src/styles/global.css:2108-2118` | **RESOLVED** |
| 390px PvT가 내부 가로 스크롤을 요구하고 trailing edge가 첫 시야에 없음 | chart width 100%/min-width 0, overflow hidden, mobile label 보정, full-burst 회귀 계약 추가 | `src/styles/cellular.css:1563-1578`, `tests/e2e/interactions.spec.ts:469-482`, 갱신된 390px 기준선 | **RESOLVED** |
| 모바일 SVG 직접 라벨이 약 7px로 축소됨 | `.gsm-pvt__direct-label`도 `--font-size-headline` 28px user-unit로 보정 | `src/styles/cellular.css:1576-1578`, `src/styles/tokens.css:67`, 갱신된 390px 기준선 | **RESOLVED** |

---

## Final Typography Verification

- **[RESOLVED]** 모바일 `.plot-label`과 `.gsm-pvt__direct-label`이 모두 `--font-size-headline` 28px user-unit를 사용한다 (`src/styles/cellular.css:1572-1578`).
- 920 viewBox가 약 324px로 렌더링될 때 최종 글자 크기는 `28 × 324 / 920 ≈ 9.9px`다. 이는 `DESIGN.md:197`의 “약 10px 미만으로 작아지지 않게”라는 보정 목표를 충족한다.
- 갱신된 390px 기준선에서 axis, `TRACE — SOLID`, `UPPER`, `LOWER`를 판독할 수 있고, HTML 범례와 semantic table 대안도 그대로 유지된다.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **[PASS]** `전체 학습 자료를 세 트랙에서 이어갑니다.`는 신규·재방문자 모두에게 지속 가능한 IA 문구이며 무엇이 “이전”인지 알아야 했던 기존 문제를 제거했다 (`src/pages/index.astro:106`).
- **[PASS]** `RF 6축 전체 보기`, `Cellular 57개 전체 보기`, `장비 25개 전체 보기`는 대상과 분량이 명시된 CTA라 사용자가 이동 결과를 예측할 수 있다 (`src/pages/index.astro:116-133`).
- **[PASS]** PvT의 prediction, diagnosis와 교육 모델 disclaimer는 행동·결과·판정 한계를 구체적으로 전달한다. Copywriting에 남은 actionable defect는 없다.

### Pillar 2: Visuals (4/4)

- **[PASS]** 갱신된 390px 기준선은 full-burst trace, 양쪽 ramp, plateau와 두 burst marker를 한 instrument surface에 보여준다. 이전처럼 trailing edge가 스크롤 밖에 숨지 않는다.
- **[PASS]** 축·단위, upper 파선, lower 점선, solid trace, worst marker, violation band, HTML 범례와 표 대안이 유지되어 `DESIGN.md:153`의 Three-Cue Rule을 충족한다 (`src/components/cellular/GsmPvtLab.tsx:308-415`).
- **[PASS]** 차트의 가로 overflow를 제거해 `DESIGN.md:113`의 단일 document flow와 모바일 비가로스크롤 계약을 만족한다 (`src/styles/cellular.css:1563-1570`).

### Pillar 3: Color (4/4)

- **[PASS]** teal trace, oxide upper, blue lower, red worst/violation은 forward/reference/secondary/reverse 물리 역할과 일치한다 (`src/styles/cellular.css:917-948`).
- **[PASS]** 선 패턴, 원 marker, 직접 라벨, HTML 범례, verdict와 표가 색을 보강하므로 색각에만 의존하지 않는다.
- **[PASS]** 전체 axe 통과와 Lighthouse Accessibility 100이 contrast 및 semantics 회귀가 없음을 뒷받침한다. Color에 남은 actionable defect는 없다.

### Pillar 4: Typography (4/4)

- **[PASS]** home track은 title/label/data token, PvT의 설명/control/readout은 Sans/Mono token을 계속 일관되게 사용한다 (`src/styles/global.css:1327-1383`, `src/styles/cellular.css:702-770`).
- **[PASS]** 모바일 `.plot-label`과 `.gsm-pvt__direct-label`을 모두 `--font-size-headline` 28px user-unit로 보정해 324px 렌더 폭에서 약 9.9px가 된다 (`src/styles/cellular.css:1572-1578`, `src/styles/tokens.css:67`).
- **[PASS]** 갱신된 390px 기준선에서 axis와 세 직접 라벨을 판독할 수 있고 HTML 범례와 표 대안도 유지된다. `DESIGN.md:197`의 SVG label 보정 계약을 충족하며 Typography에 남은 actionable defect는 없다.

### Pillar 5: Spacing (4/4)

- **[PASS]** 1024px에서 두 개의 동일 우선순위 트랙을 2열에 두고 세 번째를 full-span으로 배치해 한 viewport 안에 전체 6+25+57 구조가 닫힌다 (`src/styles/global.css:1952-1958`).
- **[PASS]** 390px은 1열과 `--space-4` card padding으로 전환해 제목, 설명, topic line과 CTA가 겹치지 않는다 (`src/styles/global.css:2108-2118`).
- **[PASS]** 모든 padding/gap/radius와 44px target이 token을 사용하고, 갱신 기준선에 clipping이나 과도한 빈 영역이 없다. Spacing에 남은 actionable defect는 없다.

### Pillar 6: Experience Design (4/4)

- **[PASS]** 홈은 88개 전체 범위를 제시하면서 현재 meter를 `RF 개념 트랙 진도`라고 정확히 한정한다. 초기 aria-label과 storage 반영 후 동적 label이 일치한다 (`src/pages/index.astro:31`, `src/pages/index.astro:67`, `src/pages/index.astro:234-237`).
- **[PASS]** PvT는 scenario → parameter → prediction → trace → ledger → diagnosis 순서를 유지하고 prediction 전 trace 잠금, disabled, undo/reset와 `role="status"`를 제공한다.
- **[PASS]** 모바일에서 chart 자체의 `scrollWidth <= clientWidth`, trace와 두 marker 존재를 자동 검사하므로 비가로스크롤 경험이 향후 회귀로부터 보호된다 (`tests/e2e/interactions.spec.ts:469-482`). Experience Design에 남은 actionable defect는 없다.

---

## Files Audited

- `PRODUCT.md`
- `DESIGN.md`
- `docs/MASTER_PLAN.md`
- `docs/CONTENT_AUDIT.md`
- `src/pages/index.astro`
- `src/components/cellular/GsmPvtLab.tsx`
- `src/styles/global.css`
- `src/styles/cellular.css`
- `src/styles/tokens.css`
- `tests/e2e/interactions.spec.ts`
- `tests/e2e/visual.spec.ts`
- `tests/e2e/visual.spec.ts-snapshots/home-track-index-{1024,390}-chromium-darwin.png`
- `tests/e2e/visual.spec.ts-snapshots/cellular-gsm-pvt-390-chromium-darwin.png`

## UI REVIEW COMPLETE

**Overall 24/24 — Copy 4 · Visuals 4 · Color 4 · Typography 4 · Spacing 4 · Experience Design 4.** 기존 WARNING 4개와 잔여 typography WARNING을 모두 해결했으며 BLOCKER 0개, WARNING 0개다.
