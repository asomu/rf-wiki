# N9020B MXA PyVISA 사용 가이드

이 문서는 RF Wiki의 로컬 Python 예제로 Keysight N9020B MXA를 안전하게 식별하고, Swept SA를 설정하고, trace 또는 PowerSuite 결과를 읽는 방법을 설명한다.

고정 검토 범위는 다음과 같다.

- 모델: `N9020B-526`
- 필수 option token: `526`, `B1X`, `MPB`, `P26`
- firmware: `A.43.49`
- mode/application: Spectrum Analyzer mode의 Swept SA와 `CHP`·`ACP`·`OBW`
- 제외: IQ Analyzer native SCPI, 89600 VSA remote API, LTE/NR measurement application command tree

다른 모델, firmware 또는 option 조합에 그대로 적용하지 않는다. 프로그램은 `*IDN?`와 `*OPT?`가 고정 profile과 다르면 설정 전에 중단한다.

## 가장 중요한 물리적 제한

SA는 입력 장비다. `ABOR`는 sweep/acquisition을 멈출 뿐 RF INPUT 커넥터의 RF나 DC를 제거하지 못한다. LAN 연결이 끊겨도 DUT/SG가 계속 출력할 수 있다.

실제 연결 전에 bench에서 별도로 확인한다.

1. SG RF OFF와 PA bias 상태를 확인한다.
2. coupler, fixed attenuator, limiter와 cable loss를 포함해 analyzer connector의 worst-case average/peak를 계산한다.
3. DC가 존재할 수 있으면 주파수와 power rating이 맞는 DC block을 사용한다.
4. source 최대 average, waveform PAPR, path loss, uncertainty, guard margin을 기록한다.
5. analyzer 내부 attenuation은 mixer/ADC operating level을 낮추지만 RF INPUT 커넥터 앞단의 보호 소자를 대체하지 않는다고 가정한다.

N9020B 자료의 `+30 dBm average`와 조건부 `+50 dBm pulse`는 손상 한계다. 이 예제는 이를 working target으로 허용하지 않는다. connector average/peak working limit을 `+20 dBm` 이하로 제한하고, 조건부 +50 dBm pulse 예외는 자동화하지 않는다. 실제 PA bench에서는 보통 coupler와 외부 attenuation을 사용해 훨씬 낮은 입력을 설계한다.

## 설치

### 1. Keysight IO Libraries Suite

Keysight IO Libraries Suite를 설치하고 Connection Expert에서 장비가 보이는지 확인한다. LAN에서는 raw IP를 코드에 쓰지 말고 `N9020B` 같은 VISA alias를 만든다.

예시 transport 문자열은 환경에 따라 다르다.

- LAN/HiSLIP: Connection Expert가 만든 alias 권장
- USB: USBTMC resource 또는 alias
- GPIB: controller와 address를 포함한 resource 또는 alias

이 프로젝트의 기본값은 alias `N9020B`다. 환경 변수로 바꿀 수도 있다.

```bash
export N9020B_VISA_RESOURCE=LAB_MXA_01
```

### 2. Python 가상환경

프로젝트 root에서 실행한다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r examples/n9020b_pyvisa/requirements.txt
```

PyVISA는 `--execute`를 사용할 때만 import된다. dry-run에는 PyVISA나 실제 장비가 필요 없다.

## 먼저 dry-run

다음 명령은 VISA resource를 열지 않는다.

```bash
python3 -m examples.n9020b_pyvisa
python3 -m examples.n9020b_pyvisa.identify_and_options
python3 -m examples.n9020b_pyvisa.safe_spectrum
python3 -m examples.n9020b_pyvisa.pa_spectrum_measurements --measurement ACP
python3 -m examples.n9020b_pyvisa.iq_capture --if-bandwidth-hz 100e6 --samples 1000000
```

dry-run transcript에서 다음 순서를 먼저 검토한다.

```text
QUERY  *IDN?
QUERY  *OPT?
WRITE  ABOR
WRITE  *CLS
WRITE  CONF:SAN:NDEF
WRITE  INIT:CONT OFF
WRITE  POW:ATT:AUTO OFF
WRITE  POW:ATT 40DB
WRITE  POW:GAIN OFF
...
WRITE  INIT:IMM
QUERY  *OPC?
QUERY  TRAC? TRACE1
WRITE  CALC:MARK1:STAT ON
WRITE  CALC:MARK1:MAX
```

종료 구간은 항상 `ABOR`부터 시작하고 `INIT:CONT OFF`, `POW:ATT:AUTO OFF`, `POW:ATT 40DB`, `POW:GAIN OFF`, query-back, bounded `SYST:ERR?`, close 순서로 진행한다.

## 실제 장비 식별

식별만 할 때는 input 설정을 바꾸지 않는다.

```bash
python3 -m examples.n9020b_pyvisa.identify_and_options \
  --execute --resource N9020B
```

다음 중 하나라도 다르면 profile mismatch로 중단한다.

- vendor/model이 Keysight N9020B가 아님
- firmware가 `A.43.49`가 아님
- `*OPT?`에 `526,B1X,MPB,P26` 중 하나가 없음

firmware가 달라졌다고 문자열만 수정하지 않는다. 사용한 command와 반환 형식을 해당 firmware의 공식 programmer reference에서 다시 확인하고 테스트 baseline을 갱신한다.

## 실제 Swept SA 설정과 acquisition

`--execute`는 VISA resource를 열고 safe configuration을 query-back하지만, `--acquire`가 없으면 `INIT:IMM`을 보내지 않는다. 실제 trace까지 얻으려면 둘 다 명시한다.

```bash
python3 -m examples.n9020b_pyvisa.safe_spectrum \
  --execute --acquire --resource N9020B \
  --center-hz 3.5e9 \
  --span-hz 100e6 \
  --reference-level-dbm 0 \
  --rbw-hz 100e3 \
  --vbw-hz 300e3 \
  --points 1001 \
  --detector NORM \
  --attenuation-db 40 \
  --source-max-average-dbm 0 \
  --path-gain-db -40 \
  --waveform-papr-db 8 \
  --connector-average-limit-dbm -20 \
  --connector-peak-limit-dbm -10 \
  --dc-volts 0
```

`--path-gain-db`는 signed 값이다. source에서 analyzer connector까지 40 dB loss면 `-40`이다.

예제의 worst-case 계산은 다음과 같다.

```text
connector average = source max average + path gain + uncertainty + guard margin
connector peak    = connector average + waveform PAPR
mixer peak        = connector peak - analyzer input attenuation
```

기본 uncertainty는 1 dB, guard margin은 3 dB다. 실제 station uncertainty budget에 맞게 더 보수적으로 설정한다.

프로그램은 다음을 acquisition 전 차단 조건으로 사용한다.

- connector average/peak가 사용자가 선언한 working limit 초과
- connector working limit 자체가 +20 dBm 초과
- `|DC| > 0.2 V`
- preamp ON
- worst-case mixer peak가 -12 dBm 초과
- reference level이 worst-case connector peak보다 낮음
- model/firmware/option 또는 query-back 불일치
- error queue에 nonzero record 존재

이 host-side 검사는 실제 RF power를 측정하지 않는다. 잘못 입력한 숫자를 발견할 수 없으므로 물리 attenuator, DC block, limiter와 독립적인 power 확인을 생략하면 안 된다.

## 자주 쓰는 Swept SA 명령

아래 short form은 이 package에서 실제로 사용하는 범위다.

| 목적 | SCPI | 확인 |
|---|---|---|
| 장비/option 확인 | `*IDN?`, `*OPT?` | model, firmware, option token 비교 |
| 진행 중 acquisition 중단 | `ABOR` | RF/DC input은 그대로임 |
| status/error queue clear | `*CLS` | 이후 `SYST:ERR?`로 새 오류만 확인 |
| Swept SA default measurement | `CONF:SAN:NDEF` | 기존 measurement state가 바뀔 수 있음 |
| single acquisition | `INIT:CONT OFF` | `INIT:CONT?` |
| center/span | `FREQ:CENT`, `FREQ:SPAN` | 각각 `?` query-back |
| PowerSuite center | `CHP:FREQ:CENT`, `ACP:FREQ:CENT`, `OBW:FREQ:CENT` | 선택한 measurement-qualified query-back |
| reference level | `DISP:WIND:TRAC:Y:RLEV` | `...?` |
| input attenuation | `POW:ATT:AUTO OFF`, `POW:ATT` | 두 설정을 각각 query-back |
| preamp | `POW:GAIN OFF` | `POW:GAIN?` |
| RBW/VBW | 각 `AUTO OFF` 뒤 `BAND:RES`, `BAND:VID` | auto state와 값을 각각 query-back |
| sweep points | `SWE:POIN` | `SWE:POIN?` |
| trace 1 detector | `DET:TRAC1 NORM` | `DET:TRAC1?`; RMS averaging detector는 `AVER` |
| Swept-SA trigger | `TRIG:SAN:SOUR IMM` | `TRIG:SAN:SOUR?` |
| initiate/synchronize | `INIT:IMM`, `*OPC?` | `*OPC?`가 `1`인지 확인 |
| trace 1 읽기 | `TRAC? TRACE1` | 반환 point 수가 `SWE:POIN?`와 같은지 확인 |
| peak marker | `CALC:MARK1:STAT ON`, `CALC:MARK1:MAX` | `CALC:MARK1:X?`, `CALC:MARK1:Y?` |
| 오류 FIFO drain | `SYST:ERR?` | code 0까지 bounded 반복 |

`*RST`는 자동화의 무조건적인 첫 명령으로 사용하지 않는다. 어떤 state와 correction/application 설정을 바꾸는지 모른 채 reset하면 bench 조건을 숨길 수 있다. 이 예제는 필요한 measurement와 safe input state를 명시적으로 설정하고 query-back한다.

## `READ?`와 `FETC?`를 구분한다

PowerSuite의 `CHP`, `ACP`, `OBW`는 두 패턴 중 하나를 사용한다.

### 명시적 동기화

```text
CONF:ACP
ACP:FREQ:CENT 3.5GHZ
INIT:CONT OFF
... safe-state/query-back ...
INIT:IMM
*OPC?
FETC:ACP?
```

`FETC?`는 완료된 acquisition의 결과를 읽는다. 먼저 유효한 `INIT`가 필요하다.

### blocking `READ?`

```text
CONF:ACP
ACP:FREQ:CENT 3.5GHZ
... safe-state/query-back ...
READ:ACP?
```

`READ?`는 새 measurement를 시작하고 완료까지 기다린 뒤 결과를 반환한다. 이미 `INIT`한 데이터를 재사용한다고 생각하면 안 된다.

```bash
python3 -m examples.n9020b_pyvisa.pa_spectrum_measurements \
  --measurement ACP --read-semantics
```

dry-run은 `ACP`에 세 개의 예시 숫자를 반환하지만, package는 각 field에 의미를 임의 지정하지 않고 raw tuple로 보존한다. 실제 field 순서와 단위는 활성 N9060 application/firmware의 공식 result contract와 현재 설정을 확인한 뒤 해석해야 한다.

또한 `CONF:CHP/ACP/OBW`만으로 PA compliance 조건이 완성되지 않는다. carrier integration bandwidth, adjacent offset/bandwidth, averaging, detector, limit, correction/reference plane을 test plan에서 별도로 고정해야 한다.

## PA bench에서의 역할 분리

N9020B는 PA의 output spectrum을 관찰한다. 혼자서 다음 값을 모두 만들 수는 없다.

- `Pout`, channel power, OBW, ACLR/ACP, harmonics/spurs: SA가 담당 가능하나 path correction과 overload 검증 필요
- `Pin`: input coupler + power sensor 또는 calibrated receiver 필요
- DC power: power supply readback 또는 별도 meter 필요
- PAE: `Pin`, `Pout`, DC power를 같은 reference plane/time 조건으로 결합
- EVM/SEM: 적절한 licensed measurement application 또는 검증된 IQ/VSA workflow 필요

큰 PA output을 analyzer에 직접 연결하지 않는다. coupler coupled port와 fixed attenuation을 사용하고, through/coupled 방향, coupling factor, cable loss, attenuator uncertainty를 기록한다. trace가 평평해지거나 ACLR이 갑자기 좋아지는 것처럼 보일 때 DUT 개선으로 단정하지 말고 analyzer overload/compression도 의심한다.

## IQ capture 경계

`iq_capture.py`는 B1X analysis bandwidth를 이용한 record sizing만 계산한다.

```text
sample rate = 1.25 × IF bandwidth
duration    = complex sample count / sample rate
FFT Δf      = sample rate / complex sample count
```

예를 들어 IFBW 100 MHz와 1,000,000 complex samples면 nominal sample rate 125 MSa/s, duration 8 ms, FFT bin spacing 125 Hz다.

이 관계는 memory depth, trigger behavior, data format 또는 native IQ capture command를 보장하지 않는다. `iq_capture.py --execute`는 의도적으로 실패하며 VISA resource를 열지 않는다. IQ Analyzer command는 해당 application/license의 공식 programmer reference를 별도로 검토한 뒤 독립 package로 추가해야 한다.

## 오류 처리와 timeout

- 모든 설정은 write 뒤 query-back한다.
- `*OPC?`로 acquisition 완료를 동기화한다.
- trace point 수를 `SWE:POIN?`과 비교한다.
- `SYST:ERR?`는 code 0까지 읽되 최대 횟수를 제한한다.
- timeout/예외가 발생해도 cleanup은 `ABOR`부터 시작한다.
- cleanup 자체가 실패하면 성공처럼 보고하지 않고 `CleanupError`를 올린다.

외부 trigger를 선택하면 event가 없을 때 `*OPC?`가 timeout될 수 있다. timeout을 길게 늘리기 전에 trigger source/cable/level/arming 순서를 확인한다.

## 테스트

패키지 단독 테스트:

```bash
python3 -m unittest discover -s examples/n9020b_pyvisa/tests -v
python3 -m compileall -q examples/n9020b_pyvisa
```

테스트는 실제 장비를 열지 않는다. fake transport로 model/firmware/option, query-back, stale trace, point count, error queue, timeout cleanup, connector/DC/mixer guard와 PowerSuite acquisition semantics를 검증한다.

## 문제 해결

### `ProfileMismatchError`

Connection Expert alias가 다른 analyzer를 가리키지 않는지 확인한다. `*IDN?`, `*OPT?`, firmware를 직접 기록하고, 고정 profile과 다른 장비 명령을 섞지 않는다.

### `query-back failed`

장비가 값을 coercion했거나 command가 현재 mode에서 적용되지 않았을 수 있다. error queue를 확인하고 option/application 상태를 다시 확인한다. 코드에서 expected 값을 실제 반환값에 맞춰 무조건 완화하지 않는다.

### `TRACE1 returned ... points`

`SWE:POIN?`과 trace transfer format을 확인한다. 다른 프로그램이 동시에 장비 state를 바꾸지 않는지 확인한다.

### `mixer peak ... exceeds -12 dBm`

내부 attenuation만 높이기 전에 connector 입력 자체가 안전한지 확인한다. 외부 coupler/attenuator path를 늘리고 source worst-case와 PAPR를 다시 계산한다.

### `SYST:ERR?`가 0으로 끝나지 않음

오류 FIFO를 무한히 읽지 않는다. transcript와 최초 nonzero error를 보존하고 local/front-panel state를 점검한다.

## 공식 기준 자료

- [N9020B 제품 및 지원 페이지](https://www.keysight.com/us/en/product/N9020B/n9020b-mxa-signal-analyzer-multi-touch-10-hz-50-ghz.html)
- [N9020B Configuration Guide](https://www.keysight.com/us/en/assets/7018-05047/configuration-guides/5992-1254.pdf)
- [X-Series Signal Analyzer Spectrum Analyzer Mode User's & Programmer's Reference](https://www.keysight.com/us/en/assets/9018-04666/user-manuals/9018-04666.pdf)
- [Keysight IO Libraries Programming Instruments Guide](https://helpfiles.keysight.com/IO_Libraries_Suite/English/IOLS_Windows/IOLS/Content/ProgrammingGuide/Conceptual_Topics/Programming_Instruments.htm)

이 예제는 교육용 안전 skeleton이다. 실제 장비 정확도, DUT 보호, calibration 또는 compliance 판정을 대신하지 않는다.
