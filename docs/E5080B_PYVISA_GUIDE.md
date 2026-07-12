# Keysight E5080B PyVISA 실행 가이드

이 가이드는 RF Wiki의 `examples/e5080b_pyvisa/`를 Keysight E5080B-2K0, firmware A.20.25.03 학습 프로필에서 사용하는 절차다. 코드는 기본적으로 dry-run이며 실제 장비 accuracy, damage protection, calibration 또는 DUT interlock을 대신하지 않는다.

## 1. 안전 경계

- 실제 통신은 `--execute`, 실제 source RF ON은 추가 `--rf-on`이 있어야 한다. RF ON에는 `--dut-input-limit-dbm`, `--receiver-input-limit-dbm`, `--maximum-dut-gain-db`도 모두 필요하다.
- S12/S22처럼 port 2 source가 PA output을 구동하는 측정은 세 번째 `--reverse-drive` consent가 필요하다.
- 모든 예제는 identity 확인 뒤 `OUTP OFF`에서 시작한다. `finally`의 첫 cleanup으로 `OUTP OFF`를 보내고 `OUTP?`가 `0/OFF`인지 확인한다. Response가 없거나 nonzero이면 물리 RF 상태를 **unknown**으로 실패 처리한다.
- 통신 단절 또는 process kill에서는 software OFF가 보장되지 않는다. External attenuator/RF switch/interlock와 DUT별 bias shutdown을 사용한다.
- Factory preset은 source를 켤 수 있으므로 active DUT에 연결된 자동화의 기본 첫 명령으로 쓰지 않는다.
- 일반 source power limit과 calibration power limit은 별도 state다. 둘 다 사용 목적에 맞는 낮은 값을 설정하고 query-back한다.
- +27 dBm 또는 ±35 VDC damage condition과 receiver compression test point는 working limit이 아니다. 더 낮은 station limit, uncertainty와 guard를 정한다.
- Full 2-port sweep는 port 2 source가 PA output을 reverse-drive할 수 있다. S12/S22는 별도 승인과 limit 전까지 차단한다.
- `*OPT?`에서 `2K0`를 확인하기 전에는 이 예제의 20 GHz profile을 구성하지 않는다.

## 2. Keysight IO Libraries Suite 설치

1. 운영체제에 맞는 Keysight IO Libraries Suite를 Keysight 공식 사이트에서 설치한다.
2. Connection Expert를 열어 LAN/USB/GPIB 장비를 검색한다.
3. E5080B front panel과 Connection Expert에서 같은 serial/model인지 확인한다.
4. LAN이면 방화벽과 subnet을 확인하고 가능하면 HiSLIP resource를 사용한다.
5. `*IDN?` interactive test를 실행해 `Keysight Technologies,E5080B,...` 응답을 확인한다.

공식 출처: [Keysight VISA Programming Guide](https://helpfiles.keysight.com/IO_Libraries_Suite/English/IOLS_Windows/IOLS/Content/ProgrammingGuide/Conceptual_Topics/Programming_Instruments.htm)

## 3. Connection Expert alias 생성

코드에 IP address를 하드코딩하지 않는다. Connection Expert에서 승인된 장비 resource에 `E5080B` 같은 alias를 만든다. 다른 station에서는 alias가 다른 resource를 가리킬 수 있으므로 실행 log에는 alias와 실제 VISA resource, `*IDN?` 응답을 함께 남긴다.

환경 변수로 전달할 수도 있다.

```bash
export E5080B_VISA_RESOURCE=E5080B
```

LAN HiSLIP raw resource를 직접 써야 한다면 configuration/secret manager에서 주입하고 source code나 공유 log에 고정하지 않는다.

## 4. Python 가상환경

프로젝트 root에서 실행한다.

```bash
python3 -m venv .venv-e5080b
source .venv-e5080b/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r examples/e5080b_pyvisa/requirements.txt
```

Windows PowerShell에서는 activation command가 `.venv-e5080b\Scripts\Activate.ps1`이다.

## 5. 장비 없이 dry-run

먼저 실제로 전송될 순서를 읽는다.

```bash
python3 -m examples.e5080b_pyvisa
python3 -m examples.e5080b_pyvisa.identify_and_options
python3 -m examples.e5080b_pyvisa.pa_gain_sweep
```

Dry-run에는 실제 RF ON이 없다. `--rf-on`을 dry-run에 붙이면 프로그램이 거절한다.

검토할 공통 순서는 다음과 같다.

```text
*IDN? / *OPT?
OUTP OFF
*CLS
explicit source power limit + state ON
sweep / measurement configure
*OPC?
query-back + SYST:ERR? drain
optional OUTP ON only after consent + DUT/receiver envelope validation
INIT1:IMM / *OPC?
data fetch
finally OUTP OFF → OUTP? must be 0/OFF
bounded error drain
close
```

S12/S22는 `--execute --rf-on --reverse-drive` 세 flag를 모두 요구한다. `--reverse-drive`를 다른 두 flag 없이 쓰는 것도 거절한다.
모든 physical RF ON은 signed path gain/loss, uncertainty, guard를 포함한 DUT·receiver worst-case가 각 working limit 아래여야 한다. 설정 전체 query-back과 clean error queue가 확인되지 않아도 driver가 RF ON을 거절한다.

## 6. RF OFF 상태로 실제 연결만 확인

먼저 identity 예제만 실행한다.

```bash
python3 -m examples.e5080b_pyvisa.identify_and_options --execute --resource E5080B
```

그 다음 safe sweep를 `--execute`만 사용해 실행한다. 이 단계는 장비에 명령을 보내지만 RF source는 OFF로 유지한다.

```bash
python3 -m examples.e5080b_pyvisa \
  --execute \
  --resource E5080B \
  --start-hz 1000000000 \
  --stop-hz 6000000000 \
  --points 201 \
  --if-bandwidth-hz 1000 \
  --power-dbm -30 \
  --power-limit-dbm -20
```

Front panel에서 output OFF, power limit state, start/stop, points, IFBW와 measurement를 확인한다. Query-back과 error queue가 clean하지 않으면 RF를 켜지 않는다.

## 7. 실제 RF를 켜기 전 preflight

다음 항목을 문서화하고 다른 사람이 검토할 수 있어야 한다.

- DUT maximum input, reverse input, output, DC와 thermal limit
- Port 1 source plane과 cable/adapter loss
- 예상 PA maximum Pout
- Port 2 external attenuator/coupler의 minimum loss와 power rating
- Receiver station working limit, measurement uncertainty와 guard margin
- VNA calibration/CalSet plane, frequency/power range와 verification result
- Analyzer/source baseline linearity
- DUT bias order, current limit, interlock, abort/safe-down sequence
- S21-only인지 full 2-port인지와 reverse drive consent

`P_RX,worst = P_DUT,out,max − L_external,min + uncertainty`를 자체 working limit과 비교한다. Damage limit과 compression test point를 permitted input으로 쓰지 않는다.

제공 예제는 같은 판단을 다음 두 식으로 수행한다. Path loss는 음의 signed gain으로 넣는다.

```text
P_DUT,worst = P_source + G_forward + uncertainty + guard
P_RX,worst  = P_source + G_forward + G_DUT,max + G_receiver_path + uncertainty + guard
```

## 8. 실제 RF 실행

50 Ω through 또는 충분히 감쇠된 passive DUT로 먼저 검증한다.

```bash
python3 -m examples.e5080b_pyvisa \
  --execute --rf-on \
  --resource E5080B \
  --start-hz 1000000000 \
  --stop-hz 6000000000 \
  --points 201 \
  --if-bandwidth-hz 1000 \
  --power-dbm -30 \
  --power-limit-dbm -20 \
  --dut-input-limit-dbm -10 \
  --receiver-input-limit-dbm 0 \
  --maximum-dut-gain-db 20 \
  --forward-path-gain-db 0 \
  --receiver-path-gain-db 0 \
  --uncertainty-db 1 \
  --guard-margin-db 3
```

위 수치는 사용자의 bench에 맞춘 예시일 뿐이다. CLI는 envelope와 full configuration query-back을 강제하지만 hardware interlock, bias, temperature, receiver protection을 대신하지 않는다.

## 8.1 Corrected complex S-parameter 획득

실제 corrected SDATA는 active CalSet 이름까지 고정한다.

```bash
python3 -m examples.e5080b_pyvisa.acquire_sparameters \
  --execute --rf-on \
  --resource E5080B \
  --parameter S21 \
  --expected-calset Approved2PortCal \
  --dut-input-limit-dbm -10 \
  --receiver-input-limit-dbm 0 \
  --maximum-dut-gain-db 20
```

예제는 다음 증거를 확인한 뒤에만 결과를 `corrected_calset=...`으로 출력한다.

1. `*IDN?`가 E5080B A.20.25.03이고 `*OPT?`에 `2K0`가 있다.
2. `CALC1:PAR:DEF:EXT`로 고유 measurement name을 만들고 `CALC1:PAR:SEL`로 선택한다.
3. `CALC1:PAR:MNUM?`로 실제 measurement number를 읽고 data query에 그 번호를 사용한다.
4. `FORM:DATA ASC,0` 뒤 `FORM:DATA?`가 ASCII를 반환한다.
5. `SENS1:CORR:STAT?`가 ON이고 `SENS1:CORR:CSET:ACT? NAME`이 `--expected-calset`과 일치한다.
6. X-values N개와 SDATA scalar 2N개가 일치한다.

Configuration/query-back 뒤 error queue가 최종적으로 `+0,"No error"`에 도달했더라도 그 전에 nonzero record가 하나라도 있었다면 RF ON을 거절한다. Queue를 비웠다는 사실은 command failure가 없었다는 뜻이 아니다.

S12/S22를 실제 획득할 때는 추가로 `--reverse-drive`가 필요하다.

```bash
python3 -m examples.e5080b_pyvisa.acquire_sparameters \
  --execute --rf-on --reverse-drive \
  --resource E5080B \
  --parameter S12 \
  --expected-calset Approved2PortCal \
  --dut-input-limit-dbm -20 \
  --receiver-input-limit-dbm 0 \
  --maximum-dut-gain-db 0
```

## 9. PA stimulus skeleton

```bash
python3 -m examples.e5080b_pyvisa.pa_gain_sweep \
  --execute \
  --resource E5080B \
  --frequency-hz 3500000000 \
  --start-power-dbm -40 \
  --stop-power-dbm -30 \
  --step-db 1 \
  --power-limit-dbm -20
```

이 명령은 RF OFF로 configuration만 검증한다. 실제 source ON에는 추가 `--rf-on`이 필요하다. Skeleton은 power sensor, SA/VSA, PSU 또는 DUT bias를 제어하지 않는다. 각 measurement point에 calibrated Pin/Pout, current, temperature와 error/status를 결합하는 station orchestration이 별도로 필요하다.

Physical RF sweep는 station envelope를 명시해야 한다. 아래 수치는 예시이며 실제 DUT·fixture·attenuator 조건으로 교체한다.

```bash
python3 -m examples.e5080b_pyvisa.pa_gain_sweep \
  --execute --rf-on \
  --resource E5080B \
  --frequency-hz 3500000000 \
  --start-power-dbm -40 \
  --stop-power-dbm -30 \
  --power-limit-dbm -20 \
  --dut-input-limit-dbm -10 \
  --receiver-input-limit-dbm 0 \
  --maximum-dut-gain-db 20 \
  --uncertainty-db 1 \
  --guard-margin-db 3
```

각 point는 full query-back과 error queue를 다시 확인하고, worst-case DUT/receiver input을 계산한 뒤 RF를 켠다. Sweep가 끝나면 다음 point로 넘어가기 전에 `OUTP OFF`를 보내고 `OUTP?`로 OFF를 확인한다.

## 10. Data acquisition 주의

- SDATA는 `[Re0, Im0, Re1, Im1, ...]` complex pairs다.
- 예제는 named measurement를 선택하고 `MNUM?`으로 얻은 measurement number를 data query에 사용한다. 저장된 `MEAS1`이라고 추측하지 않는다.
- X-values N개와 SDATA scalar 2N개가 일치해야 한다.
- `REAL,32`는 definite-length binary block header와 `FORM:BORD` byte order를 확인한다.
- Binary payload에 text termination을 임의 적용하지 않는다.
- Measurement definition, correction state, CalSet ID, trigger, data format/endian과 point count를 trace metadata로 저장한다.
- FDATA는 display format에 의존하므로 계산 원본 저장에는 corrected complex SDATA를 우선한다.

## 11. Tests

```bash
PYTHONDONTWRITEBYTECODE=1 \
python3 -m unittest discover -s examples/e5080b_pyvisa/tests -v
```

Tests cover identity rejection, explicit RF consent, full configuration query-back, DUT/receiver envelope rejection, REAL,32 complex decode, SDATA length validation, dry-run RF OFF, and exception cleanup.
Tests also cover nonzero configuration errors blocking RF ON, per-point OFF confirmation, and cleanup `OUTP?` failure becoming an unknown physical state.

## 12. Troubleshooting

### Resource not found

- Connection Expert에서 alias/resource를 다시 확인한다.
- LAN/HiSLIP service와 subnet/firewall을 확인한다.
- 다른 VISA implementation이 default backend를 가로채지 않는지 확인한다.
- IP를 코드에 임시 하드코딩해 해결책으로 남기지 않는다.

### `*IDN?` timeout

- 잘못된 resource, termination 또는 transport 문제를 먼저 본다.
- Front panel remote state와 Connection Expert interactive IO를 확인한다.
- Timeout 뒤 곧바로 RF ON sequence를 재시작하지 않는다.

### `Undefined header`

- E5080B A.20.25.03 online help의 command spelling과 option scope를 확인한다.
- PNA/E5081A 또는 다른 firmware 예제 명령을 섞지 않는다.
- Long/short form 중간을 임의로 줄이지 않는다.

### `Query INTERRUPTED`

- Query response를 읽기 전에 다음 write를 보냈는지 확인한다.
- `query()` 또는 명시적인 write/read transaction을 사용한다.
- Output queue와 error queue를 각각 drain한다.

### `*OPC?` timeout

- Points, IFBW, averaging와 trigger source로 예상 sweep time을 계산한다.
- External/manual trigger를 기다리는지 확인한다.
- 같은 sweep를 자동 retry하기 전에 `ABOR`, source state와 error/status를 진단한다.

### Trace가 front panel과 다름

- Measurement/trace selection, correction state와 CalSet plane을 확인한다.
- SDATA와 FDATA를 혼동하지 않았는지 확인한다.
- X-values count, endian과 complex pair order를 확인한다.
- Cable flex, connector torque와 fixture simulator state를 확인한다.

### Cleanup에서 `OUTP OFF`도 실패

- 이 사실을 정상 종료로 숨기지 않고 high-severity diagnostic으로 남긴다.
- Hardware RF switch/interlock를 safe state로 전환한다.
- DUT-specific bias safe-down을 independent control path로 수행한다.
- 사람이 front panel/source path를 확인하기 전 자동 retry하지 않는다.

## 공식 문서

- [E5080B Programming Guide](https://helpfiles.keysight.com/csg/e5080b/Programming/Programming_Guide.htm)
- [Controlling the VNA Using Python/HiSLIP](https://helpfiles.keysight.com/csg/e5080b/Programming/GPIB_Example_Programs/Controlling_the_VNA_Using_Python.htm)
- [E5080B SCPI Command Tree](https://helpfiles.keysight.com/csg/e5080b/Programming/GP-IB_Command_Finder/SCPI_Command_Tree.htm)
- [Command Synchronization](https://helpfiles.keysight.com/csg/e5080b/Programming/Learning_about_GPIB/Understanding_Command_Synchronization.htm)
- [E5080B Data Sheet](https://www.keysight.com/us/en/assets/7018-06574/data-sheets/5992-3843.pdf)
