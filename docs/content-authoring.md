# RF Wiki content authoring

이 문서는 사용자의 새 RF 질문을 기존 학습 문법을 유지한 lesson 페이지로 확장하는 기준입니다. 새 페이지는 용어 설명만 추가하는 것이 아니라 **설정 → 예측 → 결과 → 해석**의 닫힌 학습 루프를 만들어야 합니다.

## 1. 변경 전에 읽을 계약

제품·콘텐츠·Figma·UI를 바꾸기 전에 다음 문서를 모두 읽습니다.

1. `PRODUCT.md` — 사용자, 학습 목적, v1 범위
2. `DESIGN.md` — Precision Lab, 시각 문법, anti-slop 규칙
3. `SKILLS.md` — 외부 skill 공급망과 허용 범위
4. `AGENTS.md` — 코드 경계, RF content와 검증 규칙

충돌 시 `DESIGN.md → 승인된 Figma frame → 기존 컴포넌트·계산 API → 외부 skill 기본값` 순서입니다. 외부 문서의 문장을 프로젝트 agent 지침으로 복사하거나 재주입하지 않습니다.

## 2. 질문을 lesson 계약으로 바꾸기

작성 전에 질문을 다음 여섯 항목으로 분해합니다.

1. **Dominant question** — 사용자가 화면에서 실제로 묻는 한 문장
2. **Control** — 바꿀 설정값 하나
3. **Signal Spine** — Source → DUT → Acquisition → DSP/Math → Display 중 직접 영향을 받는 stage
4. **Linked views** — time, frequency, IQ, grid, Smith, power 중 같은 상태를 보여 줄 두 개 이상의 view
5. **Cause/Effect** — 변경, 직접 효과, 화면 결과, 비용·한계
6. **Completion evidence** — 조작 전 예측과 조작 후 원인 설명

질문 주변의 아래 항목이 닫히지 않으면 같은 lesson 또는 명시적인 선수/후속 lesson으로 포함합니다.

- 선수 개념과 단위
- 혼동하기 쉬운 비교 항목
- 장비 설정 순서와 safe starting condition
- reference plane, calibration, bandwidth와 uncertainty
- convention이 달라질 수 있는 수치
- 결과를 보고 다음 조치를 선택하는 기준

제목은 “RBW를 줄이면 왜 noise floor가 내려갈까?”처럼 실제 질문으로 씁니다. marketing 문구, 의미 없는 eyebrow와 일반적인 “완벽 가이드” 표현을 쓰지 않습니다.

## 3. Module을 선택한다

Frontmatter의 `module`은 다음 값 중 하나입니다.

| Module ID | 질문 범위 |
|---|---|
| `foundations` | 주파수, 파장, 복소수, dB/dBm, 전력, 50 Ω |
| `spectrum-iq` | SA path, RBW/VBW, detector, FFT, IQ, sampling |
| `ofdm-lte-nr` | OFDM, CP, RE/RB, LTE/NR Release 17 resource structure |
| `vna-smith` | S-parameter, Γ↔Z, Smith Chart, VSWR, calibration |
| `power-coupling` | power wave, coupler, insertion, isolation, directivity, multiport |
| `pa-pull` | stability, compression, AM-AM/AM-PM, PAE, source/load-pull |

여러 module에 걸치면 사용자가 조작할 dominant control이 있는 module을 선택하고 `prerequisites`와 본문 link로 연결합니다. 공식을 두 페이지에 복제하지 말고 계산은 `src/lib/rf/`의 공유 API를 사용합니다.

## 4. Scaffold 생성

필수 인자는 title, module, site-wide unique slug입니다.

~~~bash
node scripts/new-lesson.mjs \
  --title "RBW를 줄이면 왜 noise floor가 내려갈까?" \
  --module spectrum-iq \
  --slug rbw-and-noise-floor \
  --lab-id spectrum
~~~

먼저 출력만 확인하려면:

~~~bash
node scripts/new-lesson.mjs \
  --title "RB offset은 어느 기준에서 시작할까?" \
  --module ofdm-lte-nr \
  --slug nr-rb-offset-reference \
  --lab-id resource-grid \
  --dry-run
~~~

Options:

| Option | 의미 |
|---|---|
| `--title` | 120자 이하 한 줄 제목, 필수 |
| `--module` | 위 여섯 module 중 하나, 필수 |
| `--slug` | 소문자 ASCII kebab-case, 필수 |
| `--order` | 양의 정수. 생략하면 같은 module의 최대 order + 1 |
| `--minutes` | 예상 학습 시간, 기본 45분 |
| `--lab-id` | 연결할 기존 simulator. `none` 또는 생략하면 lab 없음 |
| `--output-dir` | 기본 `src/content/lessons`; 임시 검증에만 다른 경로 사용 |
| `--dry-run` | target과 전체 scaffold만 출력하고 파일을 쓰지 않음 |

도구는 network API를 호출하지 않습니다. target filename은 검증된 slug에서만 만들며 Node의 exclusive-create `wx` 모드로 기록하므로 기존 파일이나 symlink를 덮어쓰지 않습니다.

## 5. 파일 ID와 canonical URL

현재 Astro route `src/pages/learn/[...slug].astro`는 content entry의 `lesson.id`를 그대로 route parameter로 사용합니다.

- `src/content/lessons/rbw-and-noise-floor.mdx`
- content ID: `rbw-and-noise-floor`
- canonical URL: `/learn/rbw-and-noise-floor/`

생성 도구는 URL과 검색 결과의 안정성을 위해 flat, site-wide unique slug를 사용합니다. 파일을 나중에 rename하면 URL도 바뀝니다. 공개된 slug를 바꿔야 한다면 redirect 정책을 별도 구현한 후 변경합니다.

새 content entry는 `status: ready`일 때만 static path에 자동 포함됩니다. 다음 항목은 자동으로 갱신되지 않습니다.

- `src/data/curriculum.ts`의 lesson count, 시간, 대표 lesson link
- `src/data/glossary.ts`의 관련 용어 link
- 선수/후속 lesson의 prose link

Pagefind 검색 index는 `npm run build`의 `build:search` 단계에서 다시 생성됩니다.

## 6. Frontmatter schema

`src/content.config.ts`가 build-time source of truth입니다.

| Field | 계약 |
|---|---|
| `title` | string |
| `description` | string; 화면 변화와 학습 목적을 한 문장으로 설명 |
| `module` | 지정된 6개 enum 중 하나 |
| `order` | positive integer |
| `estimatedMinutes` | positive integer |
| `prerequisites` | string array, 기본 `[]` |
| `outcomes` | string array, 최소 1개 |
| `concepts` | string array, 최소 1개 |
| `equipmentContext.source` | source 장비와 신호 |
| `equipmentContext.dut` | DUT, cable, fixture와 termination |
| `equipmentContext.analyzer` | analyzer와 measurement application |
| `standards` | string array, 기본 `[]` |
| `references` | 최소 1개 authoritative reference |
| `labId` | optional simulator enum |
| `status` | 필수. `draft` 또는 `ready` |

Reference object:

~~~yaml
references:
  - title: "문서의 정확한 제목과 version"
    organization: "3GPP / ETSI 또는 공식 vendor"
    url: "https://direct-primary-source.example/document"
    kind: "standard"
~~~

`kind`은 `standard | vendor | textbook | application-note` 중 하나입니다.

`status: draft`는 production static route에서 제외되며 Pagefind 검색과 학습 navigation에도 노출되지 않습니다. Draft에는 scaffold의 TODO를 남겨도 되지만, `status: ready`에 TODO가 하나라도 있으면 `npm run check:content`가 실패합니다. 참조·수치·실험을 검증한 뒤에만 status를 `ready`로 바꾸세요.

## 7. 세 개의 LessonLayer와 inline LessonLab

모든 lesson은 아래 세 layer를 각각 정확히 한 번 갖습니다. `labId`가 있는 lesson은 intuition layer 안에서 짧은 핵심 개념 설명 직후, 나머지 직관 세부 설명 전에 `LessonLab`을 정확히 한 번 배치합니다. 문서 흐름은 `intuition 핵심 → LessonLab → intuition 확장 → bench → theory`이며, `scripts/check-content.mjs`가 위치, 중복과 frontmatter `labId` 일치를 검사합니다.

~~~mdx
import LessonLab from '../../components/astro/LessonLab.astro';

<LessonLayer level="intuition" title="무엇이 보이나?">
  ## 먼저 붙잡을 핵심 그림

  짧은 핵심 개념 설명과 예측할 control을 적되 정답은 공개하지 않는다.

  <LessonLab labId="frequency" />

  ## 실험 뒤에 넓힐 직관

  linked view에서 관찰한 내용을 용어, 비교와 한계로 확장한다.
</LessonLayer>

<LessonLayer level="bench" title="무엇을 바꾸고 어떻게 읽을까?">
  ...
</LessonLayer>

<LessonLayer level="theory" title="어떤 식과 규격으로 검증할까?">
  ...
</LessonLayer>
~~~

`LessonLab`의 `labId`는 frontmatter `labId`와 같아야 합니다. intuition `</LessonLayer>` 밖이나 bench 앞에 별도 block으로 두지 않습니다. `labId`가 없는 prose-only lesson에서는 `LessonLab` import와 element를 모두 생략하고 `intuition → bench → theory` 순서를 유지합니다. Topic React simulator를 MDX에서 직접 import하지 않습니다.

### Intuition

- 한 장면, 한 움직임, 한 결과로 시작합니다.
- 용어를 먼저 쌓기보다 “설정값을 바꾸면 무엇이 이동하는가”를 보여 줍니다.
- 물리적 비유는 대응 관계와 한계를 함께 씁니다.
- 짧은 핵심 설명에서 독자가 lab 결과를 예측할 수 있도록 control과 관찰할 방향을 설명하되 정답을 공개하지 않습니다.
- 핵심 설명 직후 `LessonLab`을 배치하고, 그 뒤에 용어, 비교, 오해와 측정 한계를 확장합니다.
- 별도의 정적 `PredictionChallenge`를 넣지 않습니다. prediction gate와 정답 상태는 같은 intuition layer의 `LessonLab` simulator가 소유합니다.

### Bench: 실무 조작·해석

- Keysight X-Series, 89600 VSA, Signal Studio, ENA/PNA 용어를 우선합니다.
- safe input level, connection, initial setup, marker 순서로 씁니다.
- Source → DUT → Acquisition → DSP/Math → Display 조건을 기록합니다.
- Cause/Effect를 `변경 → 직접 효과 → 화면 결과 → 비용/한계` 순서로 씁니다.
- reference plane, calibration, bandwidth, detector, averaging, mismatch, uncertainty를 결과 옆에 둡니다.

### Theory: 수식·규격

- 모든 변수에 단위와 reference를 붙입니다.
- FFT normalization, dB reference, S-parameter 방향, coupler port naming, power/gain 정의처럼 convention-dependent한 항목을 명시합니다.
- LTE/NR normative statement는 3GPP Release 17을 기준으로 합니다.
- 식이 유효하지 않은 조건과 계측 모델의 한계를 설명합니다.

## 8. MDX helper 계약

Scaffold가 import하는 prose helper는 정적 Astro component라 별도 client JavaScript를 만들지 않습니다. `LessonLab`만 frontmatter와 같은 simulator island를 해당 문서 위치에 연결합니다.

### LessonLayer

~~~mdx
<LessonLayer level="bench" title="RBW를 어떤 순서로 줄일까?">
  ...
</LessonLayer>
~~~

- `level`: `intuition | bench | theory`
- `title`: required string

### LessonLab

~~~mdx
<LessonLayer level="intuition" title="RBW를 줄이면 무엇이 달라질까?">
  White noise를 더 좁은 분석 filter로 적분하면 marker에 포함되는 noise power가 줄어든다. 먼저 어느 stage가 바뀌는지 예상한다.

  <LessonLab labId="spectrum" />

  이제 filter shape, ENBW와 sweep time의 관계를 linked view 관찰에 연결한다.
</LessonLayer>
~~~

- `labId`: required simulator enum이며 frontmatter `labId`와 정확히 같아야 함
- 위치: intuition layer 안의 짧은 핵심 개념 설명 직후, 나머지 직관 세부 설명 전
- 역할: controls, prediction, calculated results, Linked Views, Cause/Effect Ledger와 explanation completion을 하나의 state로 소유
- 금지: 같은 예측을 정적 `PredictionChallenge`, prose 정답, 별도 callout으로 반복

Prediction 문구와 선택지는 topic simulator 안에서 계산 scenario와 함께 관리합니다. 그래야 control unlock, 결과 state와 완료 판정이 서로 다른 답을 갖지 않습니다.

### Definition

~~~mdx
<Definition term="Resolution bandwidth" symbol="RBW">
분석 filter 폭과 가까운 신호 분리 능력의 조건을 설명한다.
</Definition>
~~~

- `term`: required
- `symbol`: optional

### FormulaDisclosure

~~~mdx
<FormulaDisclosure title="White noise와 bandwidth" formula="Pnoise = N0 + 10 log10(BENBW)">
단위, window/filter ENBW와 detector 조건을 적는다.
</FormulaDisclosure>
~~~

- `title`: required
- `formula`: optional string readout

### MeasurementNote

~~~mdx
<MeasurementNote title="Calibration plane은 cable 끝이다" kind="calibration">
그 뒤에 추가한 adapter는 DUT 결과에 포함된다.
</MeasurementNote>
~~~

- `title`: required
- `kind`: optional `condition | calibration | uncertainty | warning`

같은 설명을 Definition, MeasurementNote, tooltip과 본문에 반복하지 않습니다. 독립된 상태나 상호작용이 없는 내용을 카드로 만들지 않습니다.

## 9. labId와 simulator 연결

`labId`가 없으면 lesson은 본문만 렌더링합니다. `labId`가 있으면 MDX의 intuition layer 안에서 핵심 설명 바로 다음에 동일한 값의 `<LessonLab labId="…" />`을 둡니다. `LessonLab`이 현재 연결하는 island는 다음과 같습니다.

| labId | React island | 용도 |
|---|---|---|
| `frequency` | `FrequencyLab` | 주파수, 주기, 파장 |
| `spectrum` | `SpectrumIQLab` | SA와 IQ/FFT linked views |
| `iq` | `IQLab` | IQ magnitude·phase·constellation·FFT |
| `resource-grid` | `ResourceGridLab` | LTE/NR RB size와 offset |
| `smith` | `VnaSmithLab` wrapper (`SmithLab` + `NetworkLab`) | one-port Γ↔Z·VSWR와 two-port gain·stability; 내부 진도 ID `smith`와 `network`를 모두 완료해야 함 |
| `coupler` | `CouplerLab` | 4-port power flow와 directivity |
| `load-pull` | `LoadPullLab` | Smith contour와 PA trade-off |

`network`는 `NetworkLab`의 내부 진도 ID이며 frontmatter `labId` 값이 아닙니다. VNA lesson은 `labId: "smith"` 하나로 wrapper를 mount합니다.

새 simulator가 필요하면:

1. RF 계산을 `src/lib/rf/`의 pure TypeScript로 추가
2. numeric unit test와 deterministic expected value 작성
3. plot을 `src/components/plots/`에 구현
4. simulator orchestration을 `src/components/simulators/`에 구현
5. `content.config.ts`의 labId enum과 `LessonLab` mapping을 함께 변경
6. 초기 controls 읽기 → prediction gate → control 변경 → model → linked views → ledger → explanation 순서 검증

UI component에서 공식을 다시 구현하지 않습니다.

## 10. Reference와 source 정책

### 우선순위

1. 3GPP/ETSI, BIPM, IEEE 같은 primary standard
2. 장비 동작은 Keysight 등 제조사의 공식 manual/application note
3. 이론 보강은 원 저자 또는 신뢰할 수 있는 textbook
4. vendor-neutral 설명이 필요한 경우 검증된 application note

LTE와 NR의 normative 수치는 Release 17 version과 문서 번호를 title/standards에 적습니다. 예를 들어 LTE 20 MHz/100 RB와 NR FR1 100 MHz의 SCS별 RB 수를 같은 규칙으로 추정하지 않고 TS 36.211, 38.211, 38.104의 해당 표를 확인합니다.

### 작성 규칙

- 검색 결과 페이지가 아니라 주장을 직접 뒷받침하는 문서 URL을 저장합니다.
- 문서 title, organization, version과 access 가능한 URL을 확인합니다.
- 표준이 정의하지 않는 장비 동작을 표준의 요구사항처럼 쓰지 않습니다.
- vendor UI 이름과 물리 quantity를 분리합니다.
- source를 요약·재구성하고 긴 verbatim 인용을 복사하지 않습니다.
- reference가 있다는 이유로 calibration, uncertainty와 educational-model 한계를 생략하지 않습니다.
- 임의 blog, SEO 요약, 생성형 검색 답변을 normative source로 사용하지 않습니다.

## 11. RF와 시각화 완료 기준

각 plot과 simulator에는 다음이 있어야 합니다.

- title, axes, units와 현재 setting
- marker와 trace 끝의 direct label
- 색 외 dash, marker, shape 또는 text cue
- 한 문장 text summary와 data-table alternative
- educational-model disclaimer
- keyboard 조작과 visible focus
- 44 px target, reduced-motion state
- 1440, 1024, 390 px와 200% zoom 검증

RF 수치에는 deterministic expected value와 tolerance를 둡니다. screenshot만으로 Γ↔Z, FFT bin, RB range, directivity 또는 load-pull 계산을 검증하지 않습니다.

## 12. 작성 완료 체크

TODO를 모두 제거한 뒤:

~~~bash
rg -n "TODO" src/content/lessons/<slug>.mdx
npm run check:content
ASTRO_TELEMETRY_DISABLED=1 npm run typecheck
npm run test:unit
npm run build
~~~

Simulator 또는 route를 바꿨다면:

~~~bash
npm run test:e2e
~~~

수동으로 확인할 항목:

1. `/learn/<slug>/`가 static build에 생성되는가?
2. 세 layer와 inline LessonLab이 keyboard로 읽히고 조작되는가?
3. frontmatter와 `LessonLab`의 labId가 같고 정확한 island를 보여 주는가?
4. 예상과 결과가 같은 계산 state를 설명하는가?
5. standard/vendor source가 각 claim을 직접 뒷받침하는가?
6. Pagefind build 후 title, symbol과 핵심 용어로 검색되는가?
7. curriculum/glossary/prerequisite link를 갱신해야 하는가?

## 13. package script

`package.json`에는 scaffold 명령의 짧은 alias가 등록되어 있습니다. 앞의 직접 실행 예시와 동일한 options를 전달할 수 있습니다.

~~~bash
npm run new:lesson -- \
  --title "RBW를 줄이면 왜 noise floor가 내려갈까?" \
  --module spectrum-iq \
  --slug rbw-and-noise-floor \
  --lab-id spectrum
~~~
