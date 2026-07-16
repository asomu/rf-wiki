# RF Wiki 사용자 관점 콘텐츠 감사

마지막 갱신: 2026-07-17

## 감사 목적과 방법

이 문서는 페이지 수가 맞는지만 확인하지 않는다. RF를 처음 다시 배우는 엔지니어가 각 화면에서 다음 네 질문에 답할 수 있는지 기준으로 현재 범위를 점검했다.

1. 이 개념을 보기 전에 알아야 할 말이 설명되어 있는가?
2. 장비 화면이나 module 동작에서 무엇이 변하는지 볼 수 있는가?
3. 식·규격·기준면이 결론과 어떻게 연결되는가?
4. 결과가 이상할 때 다음에 무엇을 분리 측정해야 하는가?

검사 대상은 RF 핵심 6개 MDX lesson, 5대 계측기의 25개 chapter, Cellular/PAMiD 57개 질문형 페이지다. frontmatter, 본문 구조, 시각 자료, 식, 교차 링크, 확인 문제, 진행 ID와 자동 검사를 함께 대조했다.

## 결론

승인된 현재 범위는 삭제되지 않았고 `6 + 25 + 57 = 88`개 학습 항목으로 모두 존재한다. 사용자가 GSM만 남았다고 느낀 원인은 홈의 대표 학습 지도가 RF 6축만 강조하고 계측기와 Cellular 전체 범위를 한눈에 보여주지 않았기 때문이다. 홈에 세 트랙 색인을 추가해 이 발견성 문제를 바로잡았다.

내용 깊이 측면에서는 RF 6개와 계측기 25개가 원리·벤치·기준면·안전·자동화까지 연결되어 있고, Cellular 57개도 직관·조작/해석·수식/규격·확인 문제 계약을 지킨다. 가장 큰 실제 결손은 GSM module 측정에서 power-versus-time fail을 직접 예측하고 해석하는 시각 실습이었다. 이를 기존 GSM 9번째 페이지에 통합했다.

## RF 핵심 6개

| 학습 축 | 현재 깊이 | 사용자 관점 판정 |
|---|---|---|
| RF·dB·50 Ω | 주파수, 복소 포락선, dB/dBm, 50 Ω, 기준면과 한계 | 선행 개념부터 출발하며 충분함 |
| Spectrum·IQ | SA trace와 IQ magnitude/phase, FFT, RBW와 noise/time 비용 | 장비 화면과 계산 방향이 직접 연결됨 |
| OFDM·LTE·NR | subcarrier·symbol·RB·allocation, LTE/NR grid와 NR 100 MHz 예제 | resource 위치와 전력 해석까지 충분함 |
| VNA·Smith | S-parameter 방향, calibration/reference plane, Γ·VSWR·Smith | 숫자와 Smith 이동을 함께 읽을 수 있음 |
| Power·coupling | incident/accepted/delivered, coupling·insertion·isolation·directivity | 혼동하기 쉬운 전력 용어의 convention이 분리됨 |
| PA·pull | 비선형성, 안정도, source/load-pull, EVM·ACLR·효율 trade-off | 측정 의사결정과 모델 한계가 충분히 연결됨 |

본문 길이는 약 1,688–2,699단어 범위이며 모든 축이 `직관 → 실습 → bench → 이론/규격 → 자기 설명` 흐름, 기준면, convention과 교육 모델 한계를 가진다. 따라서 새 페이지를 늘리기보다 현재 interactive lab을 반복해 조건 변화의 방향을 설명하게 하는 것이 더 효과적이다.

## 계측기 25개

| 장비 | 5개 chapter가 닫는 학습 흐름 | 판정 |
|---|---|---|
| N5182B MXG | safe CW → waveform/IQ → ARB → SCPI/PyVISA → PA program | source 출력 전 안전·query-back 흐름 충분 |
| N9020B MXA | safe input → RBW/detector → IQ trigger → SCPI → PA spectrum | 입력 보호부터 EVM/ACLR 분리까지 충분 |
| E5080B ENA | safe sweep → calibration → S-parameter/Smith/time → SCPI data → PA | 기준면과 calibration 책임이 명확함 |
| U2061XA sensor | safe power → average/peak/burst → correction/uncertainty → trigger → budget | burst 통계와 correction 불확도를 구분함 |
| N6705C/N6752A | safe bias → CV/CC/protection → remote sense → sequence → PA DC power | DUT plane, inrush, interlock와 PAE 흐름 충분 |

모든 트랙은 출력/바이어스가 기본 OFF인 dry-run-first 예제, query-back, error/status 확인과 실제 bench의 interlock 한계를 명시한다. 장비별 5개 chapter를 더 늘리기보다 공통 PA bench에서 `SG → DUT/supply → sensor/SA/VNA` 측정값을 한 기록으로 묶는 후속 실습이 다음 우선순위다.

## Cellular/PAMiD 57개

| Section | 페이지 | 시각 자료 | 식 | 교차 링크 | 사용자 관점 판정 |
|---|---:|---:|---:|---:|---|
| Foundations | 6 | 3 | 5 | 4 | waveform·duplex·multiple access·기준면의 공통 언어가 충분함 |
| PAMiD | 10 | 6 | 6 | 7 | anatomy·control state·reference plane·DVT 책임이 연결됨 |
| GSM | 9 | 7 | 6 | 3 | frame→slot→burst→GMSK/EDGE→multislot→module PvT가 자연스럽게 이어짐 |
| LTE | 11 | 4 | 9 | 6 | grid·RB·DFT-s-OFDM·power와 PAMiD DVT를 연결함 |
| NR FR1 | 11 | 5 | 8 | 5 | numerology·Point A/CRB/BWP/PRB·RB100·TDD 측정 흐름이 충분함 |
| Diagnostics | 10 | 10 | 9 | 10 | 증상→후보 stage→control→분리 측정→false positive 순서를 제공함 |

모든 페이지가 반드시 고유 식과 그림을 가질 필요는 없다. 분류·상태·진단 순서가 핵심인 페이지에 식을 억지로 추가하면 학습 부담만 늘고, 인접 페이지의 공통 atlas나 module path를 반복하면 정보가 중복된다. 이번 감사에서는 “그림/식의 개수”가 아니라 판단에 필요한 관계가 보이는지를 기준으로 삼았다.

### 이번에 보강한 실제 결손

- GSM module 측정에 6개 결정론적 시나리오와 7개 parameter를 가진 PvT Workbench를 통합했다.
- trace 공개 전에 PASS 또는 첫 fail 영역을 예측하게 했다.
- upper/lower corridor, 첫 violation, worst margin과 가능한 control stage를 같은 결과 ledger에 연결했다.
- 색상 외에 선 스타일·직접 라벨·축/단위·표 대안을 제공했다.
- 모바일에서는 가로 스크롤 없이 전체 burst를 보여주고 같은 sample/margin을 표로 제공한다.
- `PvT = Power versus Time`을 glossary에 넣고 환경 `PVT = process·voltage·temperature`와 구분했다.
- 공식 conformance mask가 아닌 교육용 상대 전력 모델임을 페이지·실습·사용자 가이드에 반복해 표시했다.
- switching transient diagnostics로 이어지는 분리 측정 경로를 추가했다.
- 홈에서 RF 6, Cellular/PAMiD 57, 계측기 25 전체 범위를 직접 열 수 있게 했다.

## 유지해야 할 경계

- 교육용 IQ/resource/PvT 모델은 3GPP compliance waveform이나 certification 판정을 대신하지 않는다.
- generic MIPI/APT/ET 상태는 실제 제조사 USID, register 주소와 bit field가 아니다.
- WCDMA, CA/EN-DC, UL MIMO, FR2/OTA, propagation, 환경 PVT corner, reliability/VSWR sweep은 현재 승인 범위 밖이다.
- 실제 장비 제어는 로컬 Python package에서만 수행하며 웹 실습은 결정론적 simulation이다.

## 후속 아이디어

현재 승인 범위를 완료한 뒤 별도 milestone로 검토할 가치가 있는 아이디어다.

1. **APT/ET 동기 overlay** — RF envelope, supply voltage/current와 timing skew를 한 time axis에 겹쳐 efficiency와 distortion 원인을 분리한다.
2. **DPD 전후 비교** — AM/AM·AM/PM, constellation, ACLR/EVM을 before/after linked view로 보여준다.
3. **통합 bench record** — SG 설정, DUT bias, Pin/Pout, current, EVM/ACLR, 기준면과 불확도를 한 JSON/CSV 기록으로 내보낸다.
4. **실패 경로 replay** — Diagnostics에서 고른 증상을 관련 장비 chapter와 PvT/SA/VNA 실습의 preset으로 연다.
5. **범위 확장 milestone** — WCDMA, CA, FR2/OTA는 현 57개를 흐리지 않도록 별도 정보 구조와 규격 계약을 먼저 만든다.

## 최종 판정

현재 승인 범위의 콘텐츠 깊이는 학습 사이트로서 적절하다. 추가 설명을 무작정 늘리는 것보다 예측, 조작, 결과 ledger와 분리 측정을 연결하는 현재 방식이 사용자 이해에 더 직접적이다. 전체 route·검색·접근성·반응형·성능 회귀는 통과했으며, 마지막 완료 조건은 공개 배포본 검증이다.
