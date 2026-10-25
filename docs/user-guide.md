# RF Wiki 사용자 가이드

RF Wiki를 로컬에서 실행하고, 학습 화면을 읽고, 인터랙티브 실험을 완료하는 방법을 설명합니다. 개발 구조나 새 lesson 작성법이 필요하다면 [README](../README.md)와 [Content authoring guide](content-authoring.md)를 참고하세요.

> **교육용 모델**
> 이 사이트의 계산 결과는 설정 변화의 원리와 방향을 학습하기 위한 것입니다. 실제 장비 정확도나 compliance 판정을 대신하지 않습니다. 실제 측정에서는 입력 레벨, calibration, reference plane, cable·fixture, mismatch, noise와 uncertainty를 다시 확인하세요.

## 1. 처음 실행하기

### 준비물

- Node.js 22.12.0 이상
- npm
- Chrome, Edge, Safari 같은 최신 브라우저

이 프로젝트에는 서버 계정, 환경 변수, 로그인 설정이 필요하지 않습니다.

### 개발 서버 실행

터미널에서 다음 명령을 실행합니다.

```bash
cd /Users/mark/Developer/rf/rf-wiki
npm ci
npm run dev -- --host 127.0.0.1 --port 4326
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:4326/
```

터미널에 표시된 `Local` 주소가 다르면 터미널의 주소를 우선합니다. 서버를 종료할 때는 실행 중인 터미널에서 `Ctrl+C`를 누릅니다.

### 실제 배포 결과와 같은 검색까지 확인

개발 서버에서는 Pagefind 전체 본문 검색 대신 내장 목차·용어 검색이 보일 수 있습니다. 전체 검색 인덱스까지 확인하려면 다음 순서로 실행합니다.

먼저 개발 서버를 `Ctrl+C`로 종료합니다. 같은 port에서 개발 서버와 preview를 동시에 실행할 수 없습니다.

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4326
```

`npm run build:site`만 실행하면 Pagefind 인덱스가 만들어지지 않습니다. 전체 확인에는 반드시 `npm run build`를 사용하세요.

## 2. 5분 안에 첫 실험 완료하기

아래 절차는 첫 번째 RF 기초 lesson의 주파수 실험을 예로 듭니다.

1. 홈에서 `첫 실험 시작`을 누릅니다.
2. intuition layer의 짧은 핵심 설명 바로 다음에 놓인 `주파수·케이블 위상 실험`에서 기본 주파수 1 GHz, 케이블 길이와 velocity factor를 먼저 읽습니다.
3. 첫 확인에서는 `주기 절반 · 위상 회전 2배`를 선택하고 `예측 고정`을 누릅니다.
4. 정답이면 설정 control이 열립니다. `기본 주파수`를 1 GHz에서 2 GHz로 바꿉니다.
5. 다음 네 곳을 같은 상태로 비교합니다.
   - Signal Spine에서 활성화된 stage
   - 시간 파형의 cycle과 period marker
   - phasor의 cable phase
   - Cause/Effect Ledger의 `변경 → 직접 효과 → 화면 결과 → 비용·한계`
6. `내 원인 설명`에 다음 구조로 적습니다.

   ```text
   주파수를 높였기 때문에 source의 주기가 줄고 같은 cable의 위상 회전은 커졌지만 velocity factor 오차 한계가 있다.
   ```

7. `설명으로 완료하기`를 누릅니다.
8. 홈으로 돌아가면 진행 위치와 `이어서 학습` 대상이 갱신됩니다.

예측이 틀리면 `놓친 stage가 있습니다.`라는 안내를 읽고 `다시 선택`을 누르세요. 설정값은 정답 예측을 고정하기 전까지 잠겨 있습니다.

## 3. 학습 화면 읽는 순서

### 전체 페이지 구조

큰 화면에서는 왼쪽의 compact 학습 지도와 오른쪽의 main document가 나란히 보입니다. 학습 지도는 `모듈 번호 + 짧은 제목`으로 현재 위치만 안내하며, 현재 항목에서만 질문을 덧붙입니다. 실험은 별도의 오른쪽 rail이 아니라 intuition layer 안의 짧은 핵심 설명 바로 다음에 main document 폭으로 나타납니다.

main document는 다음 한 흐름으로 읽습니다.

1. 현재 질문과 핵심 직관 설명
2. 인터랙티브 실험
3. 나머지 직관 세부 설명
4. 실무 조작·해석
5. 수식·규격과 참고자료

1024px 이하에서는 학습 지도가 접혀 있습니다. `학습 지도` 또는 `장비 스터디`를 누르면 현재 트랙의 경로를 펼칠 수 있습니다. 페이지와 학습 지도에는 별도의 가로 스크롤이 없으며, 위에서 아래로 한 번만 스크롤하면 됩니다.

### 세 가지 학습 깊이

각 lesson에는 다음 앵커가 있습니다.

| 단계 | 화면 문구 | 읽을 내용 |
|---|---|---|
| 1 | `직관 · 무엇이 보이나?` | 먼저 머릿속에 그릴 신호 그림 |
| 2 | `조작·해석 · 무엇을 바꿀까?` | 장비 설정과 실무 확인 순서 |
| 3 | `수식·규격 · 어떻게 검증할까?` | 식, convention, Release 17 근거와 한계 |

인터랙티브 실험은 1단계 intuition layer 안에 있습니다. 짧은 핵심 개념으로 예상한 움직임을 곧바로 실험하고, 같은 layer의 나머지 설명으로 mental model을 넓힌 뒤 bench layer에서 장비 설정과 측정 조건으로 해석합니다. 수식은 `수식 열기`, 그래프의 수치 데이터는 `그래프 값을 표로 보기`로 펼칠 수 있습니다.

## 4. 실험 하나를 완료하는 정확한 조건

모든 simulator는 다음 순서를 사용합니다.

```text
초기값 읽기 → 결과 예측 → 설정 하나 변경 → 연결된 결과 비교 → 원인 설명
```

### 1단계: 초기값 읽기

`초기 설정`에서 한 번에 하나의 control만 관찰합니다. 예측 전에는 control이 잠겨 있으므로 먼저 현재 값과 단위를 읽으세요.

### 2단계: 예측 고정

선택지를 고른 뒤 `예측 고정`을 누릅니다.

- 정답: `예측이 맞습니다.`가 표시되고 control이 열립니다.
- 오답: `놓친 stage가 있습니다.`가 표시됩니다. 해설을 읽고 `다시 선택`합니다.

예측과 정답 확인은 inline simulator 안에서 한 번만 진행됩니다. 같은 intuition layer에서 바로 앞의 짧은 핵심 설명을 읽고 simulator의 `먼저 결과를 예측해보세요`에 답하세요.

### 3단계: 설정값을 실제로 변경

정답 예측 후 control을 한 번 실제로 바꿔야 합니다. 슬라이더를 다른 값으로 움직이거나 select 항목을 바꾸세요. 별도 Apply 버튼은 없으며 결과는 즉시 갱신됩니다.

### 4단계: Linked Views와 Ledger 비교

- **Signal Spine:** 마지막 control 변경이 영향을 준 Source, DUT, Acquisition, DSP/Math, Display stage를 표시합니다.
- **Linked Views:** time, frequency, IQ, resource grid, Smith chart와 power flow가 같은 계산 상태를 보여줍니다.
- **Cause/Effect Ledger:** 무엇을 바꿨고, 내부에서 무엇이 달라졌으며, 화면과 측정 비용에 어떤 결과가 생겼는지 설명합니다.

`신호 흐름 일시정지`는 애니메이션만 멈춥니다. 계산과 control 갱신은 계속 동작합니다.

### 5단계: 자기 말로 설명

`내 원인 설명`에는 다음 네 요소가 필요합니다.

1. 공백을 제외하고 24자 이상
2. `때문에`, `따라서`, `→` 같은 원인 연결
3. 영향을 받은 stage 또는 처리 과정
4. 화면에서 본 결과와 비용·한계

설명이 부족하면 화면이 빠진 요소를 알려줍니다. 이 검사는 문장의 구조를 확인하는 것이며 AI가 RF 정답을 판정하는 기능은 아닙니다.

완료 후 설정을 다시 바꾸거나 `다시 선택`을 누르면 해당 실험의 완료 상태가 취소됩니다. 새 계산 상태를 다시 설명해야 합니다.

## 5. 여섯 학습 축에서 무엇을 조작하나요?

| 학습 축 | 경로 | 먼저 바꿔볼 control | 관찰할 핵심 |
|---|---|---|---|
| RF 기초 | `/learn/foundations/` | 기본 주파수, 케이블 길이, velocity factor | cycle 수, period, phasor와 cable phase |
| Spectrum·IQ | `/learn/spectrum-iq/` | RBW, frequency offset, common phase, detector | SA trace와 IQ가 보존하는 정보의 차이 |
| OFDM·LTE·NR | `/learn/ofdm-lte-nr/` | RAT, SCS, BWP, RB count/location, power mode | grid 위치, 실제 IFFT waveform과 QAM scaling |
| VNA·Smith | `/learn/vna-smith/` | R, X, line length, ΓS, ΓL | Γ↔Z, VSWR, reference plane, gain과 stability |
| Power flow·Coupling | `/learn/power-coupling/` | coupling, directivity, excess loss, return loss | input/through/coupled/isolated와 delivered power |
| PA·Pull | `/learn/pa-pull/` | source/load sweep, drive, Γ, contour metric | Pout, gain, PAE, EVM, ACLR 최적점의 차이 |

### 두 화면을 모두 완료해야 하는 학습 축

- `Spectrum·IQ`는 `SA trace`와 `IQ capture`를 각각 완료해야 한 축으로 집계됩니다.
- `VNA·Smith`는 `1-port · Γ / VSWR`와 `2-port · gain / stability`를 각각 완료해야 합니다.

탭을 전환해도 이미 변경한 설정값은 유지됩니다. 탭에는 마우스뿐 아니라 왼쪽·오른쪽 방향키와 `Home`, `End`를 사용할 수 있습니다.

## 6. 계측장비 스터디와 PyVISA 예제 사용하기

상단 `장비 스터디`에서 장비를 엽니다. 장비 진도는 RF 개념 6개 축과 별도로, 장비마다 독립적으로 계산됩니다.

| 순서 | 기준 장비 | 먼저 닫을 질문 | 실행 가이드 |
|---|---|---|---|
| SG | Keysight N5182B-506 + 656 | IQ와 source level이 DUT 입력이 되는 과정 | [MXG 가이드](MXG_PYVISA_GUIDE.md) |
| SA | Keysight N9020B-526 + B1X + MPB + P26 | RF input이 safe front-end를 지나 spectrum·IQ·power result가 되는 과정 | [N9020B 가이드](N9020B_PYVISA_GUIDE.md) |
| NA(VNA) | Keysight E5080B-2K0 | ratio, calibration과 reference plane이 S-parameter가 되는 과정 | [E5080B 가이드](E5080B_PYVISA_GUIDE.md) |
| Power Sensor | Keysight U2061XA | average·peak·aperture와 correction이 DUT plane power가 되는 과정 | [U2061XA 가이드](U2061XA_PYVISA_GUIDE.md) |
| Power Supply | Keysight N6705C + N6752A-761 | setpoint·CV/CC·sense·transient가 PA bias가 되는 과정 | [N6705C 가이드](N6705C_PYVISA_GUIDE.md) |

### N5182B MXG

1. `안전한 CW`에서 RF OFF, frequency, average power, ALC와 DUT 기준면을 확인합니다.
2. `Waveform·IQ`에서 carrier, sample rate와 runtime scaling을 각각 바꿉니다.
3. `ARB 재생`에서 segment, marker, trigger와 loop boundary를 연결합니다.
4. `SCPI·PyVISA`에서 한 줄 command, query response, error queue와 `*OPC?`를 실행합니다.
5. `PA 시험 프로그램`에서 PAPR·path loss·uncertainty·guard margin을 합쳐 RF enable 가능 여부를 판단합니다.

실제 장비용 파일은 `/instruments/sg-mxg/python-examples/`에서 받을 수 있습니다. 웹사이트는 장비에 연결하지 않습니다. 로컬 예제도 기본은 dry-run이며 실제 통신에는 `--execute`, RF 출력에는 `--rf-on`이 추가로 필요합니다.

SCPI console에서는 세 동작을 구분합니다.

- `WRITE만`: command를 보내고 query response가 있으면 output queue에 남깁니다.
- `QUERY + READ`: query를 보내고 response를 즉시 한 번 읽습니다.
- `READ queue`: 새 command 없이 대기 중인 response를 읽습니다.

`*IDN?`을 `WRITE만`으로 보낸 뒤 다른 write를 보내면 unread response가 중단되어 `-410 Query INTERRUPTED`가 error queue에 남는 과정을 직접 확인할 수 있습니다. `SYST:ERR?`는 그 error queue를 FIFO로 한 항목씩 소비합니다.

Python 예제 페이지에서는 개별 파일보다 `rf-wiki-mxg-pyvisa.zip`을 우선 사용하세요. ZIP에는 package 전체, fake-transport tests와 운영 가이드가 같은 디렉터리 구조로 들어 있으며 별도의 SHA-256 파일을 제공합니다.

### N9020B MXA

1. `안전한 입력`에서 connector average·peak·DC limit, 외부 attenuation, preamp와 mixer/ADC headroom을 따로 확인합니다.
2. `Sweep·RBW·Detector`에서 center/span, RBW/VBW, detector, point 수와 sweep time이 한 trace를 만드는 과정을 봅니다.
3. `IQ·Trigger`에서 analysis bandwidth, sample rate, record length와 trigger가 time·frequency linked view를 어떻게 묶는지 확인합니다.
4. `SCPI·자주 쓰는 측정`에서 single sweep, marker peak, trace fetch, channel power, ACP와 OBW를 configure → acquire → verify → fetch 순서로 실행합니다.
5. `PA Spectrum 분석`에서 DUT compression과 analyzer overload를 분리하고 harmonic·spur·ACLR 결과의 기준면과 적분 조건을 저장합니다.

실제 장비용 파일은 `/instruments/sa-mxa/python-examples/`에서 받습니다. 기본은 dry-run이며 실제 VISA I/O에는 `--execute`가 필요합니다. Analyzer는 RF를 출력하지 않지만 이미 connector에 도달한 과전력을 software abort로 막을 수 없으므로 coupler·attenuator·DC block과 입력 envelope를 연결 전에 준비해야 합니다. Configuration을 바꾼 뒤에는 single acquisition 완료와 fresh trace를 확인하고 marker·trace·power result를 읽습니다.

### E5080B ENA

1. 낮은 source power와 RF source OFF에서 sweep 범위를 정합니다.
2. SOLT/ECal이 directivity·match·tracking error를 제거하고 cable 끝으로 reference plane을 이동하는 과정을 봅니다.
3. 같은 complex S-parameter를 LogMag, phase, Smith와 time-domain/fixture view로 연결합니다.
4. SCPI에서는 channel·measurement·trace·trigger를 분리하고 corrected complex `SDATA`를 읽습니다.
5. PA output이 receiver linearity/damage limit 또는 reverse-drive 한계를 넘으면 sweep를 차단합니다.

실제 통신은 `--execute`, source enable은 추가 `--rf-on`이 필요합니다. Physical RF ON에는 DUT input limit, receiver working limit, 최대 DUT gain도 명시해야 하며 signed path gain/loss·uncertainty·guard를 포함한 envelope와 full configuration query-back을 통과해야 합니다. 일반 power limit의 초기값을 보호 장치로 믿지 마세요.

### U2061XA Power Sensor

1. Sensor connector의 average·short-pulse damage level보다 충분히 낮아지도록 coupler/attenuator를 계산합니다.
2. Average, peak, PAPR, gate와 duty cycle을 같은 burst timeline에서 비교합니다.
3. Frequency 설정은 tuner가 아니라 sensor correction을 선택한다는 점을 확인합니다.
4. `READ?`와 `INIT → trigger → FETCh?`의 상태 차이를 실습합니다.
5. Peak path의 5 MHz VBW가 광대역 OFDM의 true peak를 완전히 포착하지 못하는 한계를 남깁니다.

실제 USB session은 `--execute`를 요구합니다. Sensor가 RF를 만들지는 않지만, 연결과 zero/cal 전에 upstream SG가 RF OFF인지 별도 확인해야 합니다.

### N6705C + N6752A Power System

1. 50 V와 10 A를 동시에 낼 수 있다고 해석하지 않고 100 W autoranging envelope를 확인합니다.
2. Voltage setpoint와 current limit, CV/CC, OVP/OCP를 서로 다른 state로 읽습니다.
3. Force lead drop, remote sense, slew와 capacitive inrush를 DUT plane에 연결합니다.
4. LIST, trigger와 multi-rail bias sequence를 query-back과 status bit로 검증합니다.
5. Supply의 DC power와 sensor의 RF Pin/Pout을 합쳐 PAE를 계산합니다.

실제 통신은 `--execute`, output enable은 추가 `--output-on`이 필요합니다. 통신 단절 시 software OFF가 보장되지 않으므로 remote inhibit/interlock와 fuse는 별도입니다.

## 6.5 3GPP·PAMiD 트랙 사용하기

상단 `3GPP·PAMiD`에서 `/cellular/` 학습 지도를 엽니다. 이 트랙은 완성 module nominal DVT 관점의 별도 진도로, RF 개념 6축이나 계측장비 완료율과 합산하지 않습니다.

권장 순서는 다음과 같습니다.

1. `공통 기초`에서 modulation, waveform, multiple access와 duplex를 분류하고 UE uplink 기준면을 확인합니다.
2. `PAMiD 구조·제어`에서 GSM PA+ASM, FDD PAMiD, TDD TxM의 활성 경로와 generic MIPI·APT/ET 상태를 비교합니다.
3. `GSM`에서 200 kHz carrier, 8 timeslot, normal burst, GMSK/8PSK와 PA ramp를 연결합니다.
4. `LTE`에서 PUSCH의 DFT-s-OFDM, RB location, modulation, total/RB power와 PAMiD 측정을 연결합니다.
5. `NR`에서 numerology, Point A·CRB·BWP·PRB, PUSCH와 TDD TxM switching을 연결합니다.
6. `증상별 진단`에서 Pout, current, EVM, ACLR, harmonic, Tx noise 같은 fail을 source부터 analyzer까지 분리합니다.

각 페이지는 질문 하나만 다룹니다. `직관 → 조작·해석 → 수식·규격`을 읽고, 마지막에 결과를 예측한 뒤 원인을 자기 말로 설명해야 완료됩니다. 표준 근거 표에서는 문서와 Release/version, clause, 적용 조건, normative/conformance/계산값 구분을 함께 확인하세요.

Cross-RAT Atlas, GSM Time Structure Explorer, GSM Module PvT Workbench, LTE/NR Resource Explorer와 Module Path Diagram은 교육용 구조 시각화입니다. 특히 표시되는 IQ는 coding·scrambling·reference sequence 전체를 구현한 compliance waveform이 아니며 certification 판정에 사용할 수 없습니다. MIPI 상태도 generic 역할 예시이며 실제 제조사 USID, register 주소나 bit field가 아닙니다.

`GSM module 측정` 페이지의 PvT Workbench에서는 6개 증상 시나리오와 7개 parameter를 사용합니다. 먼저 PASS 또는 첫 fail 영역을 예측한 뒤 trace를 공개하고, upper/lower corridor, 첫 violation, worst margin과 가능한 control stage를 연결합니다. 여기서 PvT는 Power versus Time이며 process·voltage·temperature corner를 뜻하는 환경 PVT와 다릅니다. 표시 corridor는 진단 순서를 학습하기 위한 상대 전력 모델이므로 공식 conformance mask나 시험 report로 사용하지 않습니다.

## 6.6 PAMiD/TxM Module DVT 시니어 경로 사용하기

상단 `DVT 시니어 경로` 또는 `/dvt/`에서 LTE FDD PAMiD 합성 학습을 엽니다. 기존 RF·장비·Cellular 내용을 반복하지 않고 다음 여섯 판단을 순서대로 닫습니다.

1. 현재 pinned 5종과 accessory·application 조건을 `READY / CONDITIONAL / BLOCKED`로 판정합니다.
2. DUT 대신 through와 known attenuator로 station residual·drift·재연결 반복성을 검증합니다.
3. Pin, Pout, V/I, spectrum과 장비 상태를 한 transaction으로 묶어 `VALID / INVALID / INCONCLUSIVE`를 판정합니다.
4. Upper/lower/range limit 방향과 uncertainty interval로 `PASS / FAIL / INCONCLUSIVE`를 결정합니다.
5. CW, two-tone과 LTE가 보여주는 compression·IM3·memory·ACLR/EVM 차이를 비교합니다.
6. 세 blind case에서 예상 signature를 먼저 고정하고 한 페이지 교육용 DVT conclusion을 완성합니다.

대표 사례는 Band 3 계열 1.7 GHz LTE UE uplink 교육 프로필이며 표시 target은 가상 project allocation입니다. EVM·SEM·GCA는 실제 option/application/license와 residual을 확인할 때만 사용합니다. 세 번째 case는 Tx RX-band noise와 isolation을 이용한 `desense risk budget`이며 실제 receiver sensitivity·BLER 또는 Rx desense 측정이 아닙니다.

Report는 브라우저 안의 HTML preview와 복사 가능한 교육용 conclusion만 제공합니다. 고객 데이터, 파일 import/export와 live instrument 연결은 없습니다.

## 7. 검색과 용어 사전 사용하기

### 전체 검색

상단 검색창에 장비 화면에서 본 표현을 그대로 입력합니다.

```text
RBW
S21
100 MHz RB
load-pull
SCPI
ARB
Reference level
Mixer level
Channel power
SYST:ERR?
```

`Enter` 또는 `찾기`를 누르면 `/search/?q=...`로 이동합니다.

- `전체 본문 결과`가 표시되면 Pagefind 인덱스를 사용한 검색입니다.
- `내장 목차·용어에서`가 표시되면 개발 서버의 fallback 검색입니다.

### 용어 사전

상단의 `용어 사전`을 열고 `Γ`, `isolation`, `기준면` 같은 용어나 기호를 입력합니다. 입력 즉시 결과가 좁혀지며, 각 용어의 `이 개념을 그림으로 보기 →`를 누르면 관련 lesson으로 이동합니다.

용어를 읽을 때는 다음 순서를 확인하세요.

1. 어느 port와 기준면인가
2. magnitude인가 complex 값인가
3. 양의 loss magnitude인가 signed dB 값인가
4. 어떤 bandwidth와 calibration 조건인가

## 8. 진도 저장과 초기화

> **진도와 개인정보**
> 완료 여부는 현재 브라우저에만 저장되며 로그인이나 기기 간 동기화는 없습니다. 사이트 데이터를 지우면 진도도 삭제됩니다. 작성한 원인 설명 문장은 저장되지 않습니다.

진도는 현재 브라우저의 `localStorage`에 `rf-wiki:v1:progress`라는 키로 저장됩니다.

- 같은 브라우저와 같은 주소에서 다시 열면 완료 상태가 복원됩니다.
- `localhost`와 `127.0.0.1`은 서로 다른 저장 공간입니다.
- 포트가 달라도 서로 다른 origin이므로 진도가 공유되지 않습니다.
- 홈의 진행 숫자는 완료한 simulator 수가 아니라 완료한 학습 축 `0 / 6`입니다.
- 다섯 장비 허브는 각각 `instrument:sg:*`, `instrument:sa:*`, `instrument:vna:*`, `instrument:sensor:*`, `instrument:psu:*` namespaced lab ID로 5개 chapter 진도를 별도로 표시합니다.
- Cellular 허브는 `cellular:foundations:*`, `cellular:pamid:*`, `cellular:gsm:*`, `cellular:lte:*`, `cellular:nr:*`, `cellular:diagnostics:*`로 59개 질문의 진도를 별도로 표시합니다.
- DVT 허브는 `dvt:<slug>`로 6개 판단 lesson의 진도를 별도로 표시합니다. Static lesson 2개는 자기 설명, interactive lesson 4개는 prediction·evidence·설명 완료 뒤 저장됩니다.
- 순서를 건너뛸 수 있지만 `이어서 학습`은 가장 앞의 미완료 축을 가리킵니다.

전체 진도를 지우는 별도 화면 버튼은 없습니다. 브라우저 개발자 도구의 Console에서 다음 명령을 실행하면 현재 주소의 진도를 초기화할 수 있습니다.

```js
localStorage.removeItem('rf-wiki:v1:progress');
location.reload();
```

## 9. 키보드와 작은 화면에서 사용하기

- `Tab`과 `Shift+Tab`: 다음·이전 control로 이동
- `Enter` 또는 `Space`: button, 선택 가능한 marker 실행
- 방향키: slider 미세 조정
- `Home`과 `End`: slider 최솟값·최댓값, 실험 tab 처음·마지막으로 이동
- 왼쪽·오른쪽 방향키: SA/IQ 또는 VNA tab 전환
- 첫 번째 `Tab`: `본문으로 건너뛰기` 링크 표시

좁은 화면에서는 Signal Spine이 `Source → DUT → Acquisition → DSP/Math → Display` 순서로 위에서 아래로 표시됩니다. 대부분의 실험도 `설정 → 예측 → 결과 → Cause/Effect Ledger → 설명` 순서로 세로 배치됩니다. GSM PvT 차트는 가로 스크롤 없이 전체 burst를 축소해 보여주고, 같은 대표 sample과 margin을 바로 아래 표로도 확인할 수 있습니다. 움직임을 줄이는 OS 설정을 사용하면 신호 이동 애니메이션을 제거하고 상태 변화만 표시합니다.

## 10. 실행 문제 해결

### 주소가 열리지 않습니다

터미널에 `astro ... ready`와 `Local` 주소가 표시됐는지 확인합니다. 포트가 사용 중이면 다른 포트로 실행하세요.

```bash
npm run dev -- --host 127.0.0.1 --port 4327
```

Codex의 제한된 sandbox에서 `listen EPERM`이 나타날 수 있습니다. 이는 RF Wiki 오류가 아니라 로컬 port bind 권한 문제입니다. 일반 터미널에서 실행하거나 승인된 권한으로 서버를 시작하세요.

### `504 Outdated Optimize Dep`가 표시됩니다

오래 실행된 Astro/Vite 서버가 변경 전 dependency cache를 제공할 때 발생할 수 있습니다.

1. 해당 RF Wiki 터미널에서 `Ctrl+C`로 서버를 종료합니다.
2. 서버를 다시 실행합니다.
3. 계속되면 다음 명령으로 dependency를 재설치합니다.

   ```bash
   npm ci
   npm run dev -- --host 127.0.0.1 --port 4326
   ```

다른 프로젝트의 process를 PID만 보고 종료하지 마세요. 먼저 실행 경로가 `/Users/mark/Developer/rf/rf-wiki`인지 확인합니다.

### 설정이 계속 잠겨 있습니다

simulator 안에서 답을 선택하고 `예측 고정`을 눌렀는지 확인합니다. 오답이면 `다시 선택` 후 올바른 방향을 예측해야 합니다.

### `설명으로 완료하기`가 비활성 상태입니다

다음 세 조건을 모두 확인하세요.

1. 정답 예측을 고정했는가
2. control 값을 실제로 한 번 변경했는가
3. 원인, stage, 화면 결과와 비용·한계를 포함해 설명했는가

버튼 위의 안내 문구가 현재 빠진 조건을 표시합니다.

### 검색 결과가 적습니다

개발 서버에서는 fallback 검색이 정상입니다. 전체 lesson 본문까지 검색하려면 `npm run build` 후 `npm run preview`를 사용하세요.

### 진도가 보이지 않습니다

이전에 사용한 브라우저 profile, hostname과 port가 같은지 확인하세요. 시크릿 창, 다른 브라우저, `localhost`와 `127.0.0.1`, 다른 port 사이에는 진도가 공유되지 않습니다.

## 11. 개발·검증 명령 참고표

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` |
| production build + 검색 index | `npm run build` |
| production preview | `npm run preview` |
| 기본 계약·typecheck·unit·build | `npm test` |
| 브라우저·접근성·시각 회귀 | `PLAYWRIGHT_PORT=4327 npm run test:e2e` |
| Lighthouse | `npm run audit:lighthouse` |
| 전체 검증 | `PLAYWRIGHT_PORT=4327 npm run test:all` |

브라우저 검증 도구가 설치되지 않았다면 한 번 실행합니다.

```bash
npx playwright install chromium
```

더 자세한 개발 명령과 프로젝트 구조는 [README](../README.md)를, 새 질문을 lesson으로 추가하는 방법은 [Content authoring guide](content-authoring.md)를 참고하세요.
