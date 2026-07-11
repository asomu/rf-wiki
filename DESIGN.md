---
name: "RF Wiki — Precision Lab"
description: "신호의 원인, 계측 처리, 화면 결과를 한 시야에 연결하는 RF 학습 도구"
colors:
  canvas: "#F2F5F5"
  surface: "#FFFFFF"
  surface-subtle: "#E8EEEE"
  ink: "#162126"
  muted: "#5B686E"
  rule: "#C9D3D5"
  rule-strong: "#91A0A4"
  instrument: "#10191B"
  instrument-raised: "#172326"
  instrument-ink: "#EAF3F3"
  instrument-muted: "#9EB0B3"
  active: "#08746E"
  reference: "#925E00"
  reverse: "#B94339"
  secondary-data: "#3F6F9F"
  success: "#2F7658"
  forward-bright: "#48C3B8"
  reference-bright: "#F0B441"
  reverse-bright: "#F06A60"
  secondary-bright: "#7EA9D4"
typography:
  display:
    fontFamily: "IBM Plex Sans KR, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans KR, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.32
    letterSpacing: "-0.015em"
  title:
    fontFamily: "IBM Plex Sans KR, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "IBM Plex Sans KR, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "IBM Plex Sans KR, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  none: "0px"
  control: "6px"
  panel: "10px"
  overlay: "14px"
  pill: "999px"
spacing:
  0-5: "2px"
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
  12: "48px"
  16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.active}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  instrument-panel:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: RF Wiki — Precision Lab

## Overview

**Creative North Star: “The Calibrated Bench”**

밝은 실험실에서 엔지니어가 흰 측정 기록지와 짙은 계측 화면을 번갈아 보는 장면이 물리적 기준이다. 문서 surface는 설명과 사고를 위한 차가운 중립 배경이고, instrument surface는 실제로 신호를 조작하고 관찰하는 작업대다. 장식은 제거하고, 정렬·직접 라벨·수치의 정확성으로 신뢰를 만든다.

1440px에서는 12-column grid 안에 240–256px의 compact 학습 지도와 하나의 main document를 둔다. 최대 폭은 1480px이며 본문 prose는 65–72ch를 넘지 않는다. 학습 지도는 module 번호와 짧은 제목으로 위치만 안내하고, 현재 row에서만 필요할 때 dominant question을 보인다. main document는 `핵심 직관 → inline lab → 직관 확장 → 실무 조작·해석 → 수식·규격`의 한 흐름으로 읽힌다. lab은 intuition layer 안에서 짧은 핵심 개념 설명 직후에 main document 폭을 사용하며 permanent sticky rail로 분리하지 않는다.

페이지에는 document scroll 하나만 둔다. desktop의 inline lab은 control column과 넓은 Linked Views 영역을 나란히 사용한다. 1024px 이하에서는 학습 지도가 현재 위치를 보존하는 drawer가 되고 lab은 같은 문서 위치에서 세로로 재배치된다. 390px에서는 `설정 → 예측 → 결과 → Ledger → 설명` 순서를 고정하고 Signal Spine을 세로로 표시한다. 학습 지도와 lab 어느 쪽도 내용을 보기 위해 가로 스크롤을 요구하지 않는다.

Signal Spine, Linked Views, Cause/Effect Ledger가 모든 실험의 공통 문법이다. Control을 바꾸면 Source → DUT → Acquisition → DSP/Math → Display 중 영향을 받는 stage만 활성화되고, 동일 상태가 time/frequency/IQ/grid/Smith/power view에 함께 반영된다. 변화의 직접 효과, 화면 결과, 비용을 하나의 ledger로 설명한다.

Motion은 상태와 신호 전달을 설명할 때만 사용한다. press 100–140ms, control/trace state 160ms, panel transition 220ms를 상한으로 하고 `cubic-bezier(0.23, 1, 0.32, 1)`을 사용한다. slider 조작은 누적 animation 없이 현재 값으로 즉시 retarget한다.

**Key Characteristics:**

- 차가운 문서 surface와 짙은 계측 surface의 기능적 대비
- IBM Plex Sans KR와 IBM Plex Mono 두 family만 사용하는 단단한 위계
- 그래프 옆 직접 라벨과 축·단위·reference 조건의 상시 노출
- 색, dash, marker, 텍스트가 함께 전달하는 물리 역할
- 직관과 실험, bench 해석이 한 document scroll 안에서 이어지는 단일 학습 흐름

## Colors

색은 장식이 아니라 신호의 방향과 비교 역할을 고정하는 표기법이다. frontmatter의 hex 값이 코드와 Figma의 기준이며, CSS에서만 동일 sRGB를 OKLCH로 병기할 수 있다.

### Primary

- **Forward Teal**: primary action, incident/forward path, 활성 stage, 현재 trace에만 사용한다.

### Secondary

- **Reference Oxide**: 기준값, selected marker, nominal trace를 나타낸다.
- **Reverse Red**: reflected/reverse path, error, 위험한 mismatch를 나타낸다.
- **Secondary Blue**: 비교 trace와 보조 데이터에 사용한다.

### Neutral

- **Lab Canvas**: 전체 문서 배경이다.
- **White Surface**: 읽기 영역과 실제로 독립된 control group에만 사용한다.
- **Graphite Ink**: 제목과 본문이다.
- **Cool Muted**: 보조 설명에 사용하되 본문 대비 4.5:1을 유지한다.
- **Instrument Carbon**: plot과 가상 계측기의 작업 표면이다.

어두운 계측 surface에서는 forward/reference/reverse/secondary의 bright 변형만 사용한다. 동일 의미를 가진 밝은/어두운 색은 서로 다른 범주로 재사용하지 않는다.

**The Physical Meaning Rule.** 색을 넣은 이유를 forward, reference, reverse, secondary, success 중 하나로 설명할 수 없으면 제거한다.

**The Three-Cue Rule.** 중요한 trace는 색에 더해 line style 또는 marker와 직접 라벨을 반드시 가진다.

## Typography

**Display Font:** IBM Plex Sans KR
**Body Font:** IBM Plex Sans KR
**Data/Mono Font:** IBM Plex Mono

**Character:** 한글 학습 문장을 편안하게 읽되 숫자, 단위, 수식 변수, SCPI, marker readout은 계측기처럼 안정적으로 정렬된다. serif, italic 장식, 과도한 letter spacing은 사용하지 않는다.

### Hierarchy

- **Display** (600, 40px, 1.2): 홈의 현재 학습 질문과 모듈 제목에만 사용한다.
- **Headline** (600, 28px, 1.32): 한 화면의 dominant learning question이다.
- **Title** (600, 20px, 1.45): simulator 내부 view와 설명 절의 제목이다.
- **Body** (400, 17px, 1.75): 한글 설명이며 38–42자 정도의 시각적 읽기 폭을 목표로 한다.
- **Label** (500, 14px, 1.45): control, 상태, navigation이다. 의미 없는 대문자 eyebrow를 만들지 않는다.
- **Data** (500, 13px, 1.5): 수치, 단위, 수식 변수, RB index, S-parameter와 SCPI다. tabular numeral을 켠다.

**The Question Heading Rule.** 제목은 “RBW를 줄이면 왜 noise floor가 내려갈까?”처럼 사용자가 풀어야 할 실제 질문으로 쓴다.

**The Unit-Stays-With-Value Rule.** 값과 단위는 줄바꿈으로 분리하지 않고, 모든 그래프 축과 readout에 단위를 반복한다.

## Elevation

기본 surface는 shadow 없이 배경 tone과 1px rule로 나뉜다. elevation은 떠 있는 도움말, mobile drawer, keyboard focus처럼 실제 stacking이나 interaction 상태가 있을 때만 사용한다. 정적 카드에 border와 넓은 soft shadow를 동시에 적용하지 않는다.

### Shadow Vocabulary

- **Overlay** (`0 6px 12px rgba(16, 25, 27, 0.14)`): tooltip, popover, mobile navigation에만 사용한다.
- **Focus** (`0 0 0 3px rgba(10, 129, 122, 0.28)`): 모든 keyboard focus 상태에 사용한다.

**The Flat Bench Rule.** 정지한 학습 화면은 평평하다. shadow가 보이면 사용자는 그 요소가 떠 있거나 즉시 조작 가능하다고 해석할 수 있어야 한다.

## Components

### Signal Spine

Source → DUT → Acquisition → DSP/Math → Display를 desktop에서는 한 줄, 좁은 화면에서는 위에서 아래로 표시한다. 현재 control 변화가 영향을 주는 stage만 teal outline과 짧은 상태 문장으로 활성화한다. stage 이름을 읽기 위해 가로 스크롤을 만들지 않는다. flow animation은 사용자가 pause할 수 있고 reduced motion에서는 색과 marker 이동만 남긴다.

### Linked Views

동일한 계산 state를 둘 이상의 view로 표시한다. marker를 움직이면 관련 sample, FFT bin, subcarrier, RB, Smith point가 함께 선택된다. legend를 멀리 두지 않고 trace 끝이나 marker 옆에 직접 라벨링한다. 모든 view는 title, axes, units, reference setting, text summary, data-table alternative를 가진다.

### Cause/Effect Ledger

항상 `변경 → 직접 효과 → 화면 결과 → 비용/한계` 네 행을 같은 순서로 표시한다. 별도 callout card로 반복하지 않고 simulator 하단의 단일 ledger만 사용한다.

### Lesson Lab

각 lesson의 interactive lab은 intuition layer 안에서 짧은 핵심 개념 설명 직후, 나머지 직관 세부 설명 전에 한 번만 둔다. lab은 별도의 두 번째 lesson이 아니라, 방금 만든 mental model을 계산 state로 즉시 검증한 뒤 같은 intuition 흐름과 bench 해석으로 넘기는 interactive figure다. user-facing title은 generic 영문 이름보다 관찰 대상을 직접 말한다. 예를 들어 foundation lesson은 `주파수·케이블 위상 실험`으로 표시한다.

Desktop lab 내부는 controls와 Linked Views를 나란히 두되, lab 전체는 main document의 사용 가능한 폭을 쓴다. simulator가 prediction, control unlock, results, Cause/Effect Ledger와 explanation completion을 소유한다. 같은 질문이나 정답을 prose의 정적 challenge로 다시 만들지 않는다. mobile에서는 `controls → prediction → results → Ledger → explanation` 순서를 유지한다.

### Buttons

- **Shape:** 정밀한 control radius (6px), 최소 높이 44px.
- **Primary:** teal fill은 현재 화면의 dominant learning action 하나에만 사용한다.
- **Hover / Focus:** hover는 미세한 tone 변화, focus는 3px ring, active는 100–140ms 동안 `scale(0.98)`이다.
- **Secondary / Ghost:** neutral surface와 rule을 사용하며 primary와 같은 무게로 경쟁하지 않는다.

### Cards / Containers

- **Corner Style:** 독립 상태가 있는 panel은 10px, overlay는 14px, 표·정의·본문 구획은 radius 없이 흐름으로 연결한다.
- **Background:** 문서 surface 또는 instrument surface 둘 중 하나다.
- **Shadow Strategy:** 기본 shadow 없음.
- **Border:** 독립된 interaction boundary가 있을 때만 1px rule을 사용한다.
- **Internal Padding:** 16–24px이며 그래프는 plotting area를 우선한다.

### Inputs / Fields

- **Style:** visible label, 6px radius, 44px 이상, 명시적인 단위 suffix.
- **Focus:** teal focus ring과 label tone 변화.
- **Error / Disabled:** 색 외에 icon 또는 텍스트 원인을 함께 제공하고 disabled control은 왜 잠겼는지 설명한다.

### Navigation

Desktop은 compact 학습 지도, breadcrumb, search를 지속적으로 보여준다. 학습 지도는 wayfinding만 담당하며 각 row에는 module 번호와 짧은 제목을 표시한다. 현재 row만 lesson의 질문을 보조 정보로 펼칠 수 있다. 모든 module의 긴 질문을 동시에 노출하거나 학습 지도 안에 가로 스크롤을 만들지 않는다. 현재 모듈과 현재 lesson을 서로 다른 위계로 표시한다. mobile drawer가 닫혀도 현재 위치와 다음 단계가 상단에 남는다. visited와 unvisited reference link는 서로 다른 색/밑줄 상태를 가진다.

### Prediction Challenge

Interactive lab 안에서 조작 전에 방향 또는 형태를 예측하게 한다. 정답을 즉시 공개하지 않고 control 조작 후 관찰 근거를 선택하거나 짧게 설명하도록 한다. 실패 상태는 “틀림”이 아니라 놓친 stage와 다시 움직일 marker를 가리킨다. lab과 별개인 prose challenge로 같은 예측을 반복하지 않는다.

## Do's and Don'ts

### Do:

- **Do** Signal Spine에서 control 변화가 실제로 통과하는 stage만 강조한다.
- **Do** 모든 그래프에 축, 단위, 현재 setting, marker, 직접 라벨, 텍스트 요약을 제공한다.
- **Do** passive S21 insertion loss와 active forward gain처럼 같은 기호의 문맥 차이를 바로 옆에서 명시한다.
- **Do** reference plane, impedance, bandwidth, calibration, uncertainty를 결과와 함께 표시한다.
- **Do** 1440px, 1024px, 390px과 200% zoom에서 `설정 → 예측 → 결과 → 해석` 순서를 검증한다.
- **Do** 사용자 질문이 새 lesson으로 추가될 때 기존 Signal Spine, Linked Views, Ledger 문법을 재사용한다.
- **Do** intuition layer의 짧은 핵심 설명 직후에 inline lab을 배치하고, 남은 직관 세부 설명과 bench layer에서 관찰 결과를 확장·해석한다.

### Don't:

- **Don't** beige/cream 노트형 배경, 따뜻한 종이 질감, serif hero를 사용한다.
- **Don't** 보라색 gradient, gradient text, glassmorphism, neumorphism을 사용한다.
- **Don't** 중앙 정렬 marketing hero, 원형 아이콘 3열 feature card, bento grid, dashboard-card mosaic을 만든다.
- **Don't** 모든 요소에 같은 큰 radius, border와 16px 이상의 넓은 soft shadow를 함께 적용한다.
- **Don't** 장식용 큰 번호, 의미 없는 all-caps eyebrow, decorative badge, stock image, 무관한 3D illustration을 사용한다.
- **Don't** Lucide 아이콘을 반복해 빈 공간을 채우거나 decorative grid를 실제 plot 밖에 그린다.
- **Don't** “Master RF”, “Built for engineers” 같은 marketing 문구를 쓴다.
- **Don't** 같은 설명을 card, callout, tooltip에 반복한다.
- **Don't** permanent lab rail과 본문을 서로 다른 lesson처럼 경쟁시키거나 같은 예측을 두 번 묻는다.
- **Don't** navigation이나 Signal Spine을 읽기 위해 가로 스크롤을 요구한다.
- **Don't** 설명과 범례를 관찰 지점에서 떼어 놓거나 색만으로 trace를 구분한다.
- **Don't** 움직임 자체를 목적으로 animation을 추가하거나 keyboard 반복 동작에 animation을 넣는다.
