# Product

## Register

product

## Platform

web

## Users

개인 학습을 위해 사용하는 RF 엔지니어가 주 사용자다. 사용자는 용어를 외우는 것보다 장비 설정값, 신호 경로, 수학적 모델, 화면의 변화, 실무 해석을 한 장면 안에서 연결하고 싶어 한다. 대표 사용 상황은 connectorized fixture와 동축 케이블을 사용한 bench 환경에서 Tx/PA 파형을 만들고 DUT를 거쳐 SA·VSA·VNA로 분석하는 과정이다.

## Product Purpose

RF Wiki는 계측 장비와 RF 신호를 `직관 → 실무 조작·해석 → 수식·규격` 순서로 학습하는 개인용 인터랙티브 지식 도구다. 설정을 바꾸기 전에 결과를 예측하고, 실제 계산 모델을 조작한 뒤, 원인을 자기 말로 설명해야 한 단원이 완료된다.

RF 개념 트랙의 완성 범위는 다음 여섯 학습 축이다.

- RF 신호, 주파수, 복소수, dB, 전력, 50 Ω
- Spectrum Analyzer, VSA, IQ capture와 FFT
- OFDM, LTE, NR resource structure와 RB 배치
- VNA, S-parameter, Smith Chart, VSWR와 mismatch
- incident/reflected/delivered power, coupling, insertion, isolation, directivity와 다중 포트 소자
- PA 비선형성, stability, source-pull과 load-pull

별도의 계측장비 스터디 트랙은 `SG → SA → NA(VNA) → Power Sensor → Power Supply` 순서를 따른다. 현재 활성 기준 장비는 Keysight `N5182B-506 + 656`, `N9020B-526 + B1X + MPB + P26`, `E5080B-2K0`, `U2061XA`, `N6705C + N6752A-761`이다. 각 장비는 기본 동작과 내부 신호·전력 경로, SCPI·PyVISA, PA bench capstone을 독립된 namespaced 진도로 다룬다.

`3GPP·PAMiD` 트랙은 GSM/GPRS/EDGE, LTE single-carrier와 NR FR1 single-carrier의 UE uplink를 완성 module nominal DVT 관점에서 연결한다. 공통 기초 6개, PAMiD 구조·제어 10개, GSM 9개, LTE 11개, NR 11개, 증상별 진단 10개의 짧은 질문형 페이지로 구성한다. 사용자는 time/frequency 구조와 modulation을 외우는 데서 끝나지 않고, 해당 waveform이 GSM PA+ASM, FDD PAMiD 또는 TDD TxM의 어느 경로와 상태를 통과하며 측정 fail을 어느 stage에서 분리해야 하는지 설명한다.

Cellular 본문 기준은 3GPP Release 17이다. 표준 숫자는 exact minor version과 clause/table, RAT·direction·band·bandwidth·modulation 조건, UE minimum/conformance/계산값 구분을 함께 기록한다. Generic MIPI RFFE, APT/ET, DPD와 CFR은 공개된 역할과 실무 원리를 설명하되 제조사 register map이나 compliance transmitter를 흉내 내지 않는다. WCDMA, CA/EN-DC 상세, UL MIMO, FR2/OTA, propagation·fading, production test와 실제 DVT report는 현재 범위 밖이다.

웹에서는 내장 검증 시나리오와 결정론적 SCPI state model만 실행한다. Cellular IQ와 resource grid도 구조 학습용 결정론적 시각화이며 coding·scrambling·reference sequence를 포함한 compliance waveform이 아니다. 실제 장비 제어는 사용자의 로컬 Python·PyVISA 예제로 분리하고 source/output enable은 장비별 별도 실행 권한을 요구한다. 브라우저 직접 장비 연결, 실측 파일 import, 로그인, 서버, telemetry와 라이브 AI 채팅은 포함하지 않는다. 모든 시뮬레이터는 교육용 모델이며 실제 장비 정확도나 compliance 판정을 대신하지 않는다.

성공 기준은 사용자가 낯선 trace를 볼 때 “어느 stage의 어떤 설정이 왜 이 모양을 만들었는가”를 역으로 설명할 수 있고, 다음 설정 변화의 방향을 먼저 예측할 수 있는 것이다.

## Positioning

설정값 하나를 바꾸면 물리 신호, 계측기 내부 처리, 화면 결과, 해석 비용이 동시에 연결되어 보이는 RF 학습 Wiki.

## Brand Personality

정확하고, 차분하며, 탐구적이다. 강의 슬라이드나 마케팅 페이지처럼 말하지 않고, 숙련된 동료가 bench 옆에서 marker를 함께 움직이며 설명하는 어조를 쓴다. 화면은 차가운 실험실 종이와 정밀 계측 패널의 대비를 갖되, 장식보다 관찰과 비교가 먼저 보인다.

## Anti-references

- beige/cream 노트형 학습 페이지와 따뜻한 종이 질감
- 보라색 gradient, gradient text, glassmorphism, neumorphism
- 중앙 정렬 marketing hero와 “Master RF”, “Built for engineers” 같은 문구
- 원형 아이콘이 붙은 3열 feature card, bento grid, dashboard-card mosaic
- 모든 요소에 같은 큰 radius와 넓은 soft shadow를 적용한 AI 템플릿
- stock image, 무관한 3D illustration, decorative grid, 의미 없는 animation
- 범례와 설명이 관찰 지점에서 멀리 떨어진 계측 그래프
- 신호의 불확실성이나 측정 한계를 숨기는 단정적인 설명

## Design Principles

1. **원인과 결과를 같은 시야에 둔다.** Control, RF model, linked view, 해석 문장을 떨어뜨리지 않는다.
2. **한 화면에는 하나의 학습 행동만 둔다.** 읽기, 예측, 조작, 설명 중 현재 단계가 분명해야 한다.
3. **색은 물리 의미를 가진다.** forward, reference, reverse, secondary 역할 외에는 색을 절제하고 dash·marker·직접 라벨을 함께 쓴다.
4. **깊이는 점진적으로 연다.** 직관을 먼저 이해할 수 있어야 하며 수식과 Release 17 세부 규격은 같은 주제 안에서 필요할 때 펼친다.
5. **측정은 항상 조건부다.** reference plane, calibration, bandwidth, noise, uncertainty, convention을 결과와 함께 보여준다.

## Accessibility & Inclusion

WCAG 2.2 AA를 기준으로 한다. 모든 조작은 키보드로 가능해야 하고 focus가 분명해야 한다. 그래프는 색을 제거해도 dash, marker, shape, 직접 라벨로 구분되어야 하며 동등한 텍스트 요약과 데이터 표를 제공한다. 200% 확대와 390px 폭에서도 핵심 순서가 유지되어야 한다. `prefers-reduced-motion`에서는 위치 이동을 제거하고 상태 변화만 남긴다. 최소 터치 목표는 44×44px이다.
