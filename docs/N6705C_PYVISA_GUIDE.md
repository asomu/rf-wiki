# N6705C + N6752A PyVISA 사용 가이드

이 가이드는 RF Wiki의 `examples/n6705c_pyvisa/` 예제를 실제 Keysight N6705C에 연결하기 전 검토하는 운영 절차다. 기준은 N6705C mainframe, slot 1 N6752A 50 V/10 A/100 W autoranging module, Option 761, firmware `E_02_09_3271`이다.

## 1. 안전 범위

- 기본 실행은 VISA를 열지 않는 dry-run이다.
- 실제 통신은 `--execute`, 실제 slot 1 output ON은 `--execute --output-on` 두 허가가 모두 필요하다.
- 예제는 50 V, 10 A, 100 W와 OVP 55 V 범위를 검사하지만 DUT absolute maximum을 알지 못한다.
- Option 761 output/sense disconnect relay는 safety interlock, fuse, contactor 또는 discharge 회로가 아니다.
- 통신이 끊기면 software RF/DC OFF가 전달되었다고 보장할 수 없다. Remote inhibit, E-stop, fuse와 DUT bias sequence를 독립적으로 준비한다.
- PA 시험에서는 RF OFF를 먼저, DC output OFF를 다음으로 실행한다. 본 패키지는 SG를 제어하지 않으므로 상위 orchestrator가 이 순서를 보장해야 한다.

## 2. Keysight IO Libraries와 VISA alias

1. Keysight IO Libraries Suite를 설치한다.
2. Connection Expert에서 N6705C를 LAN/HiSLIP, USB 또는 GPIB로 발견한다.
3. `*IDN?` 응답이 N6705C인지 확인한다.
4. resource에 `N6705C`라는 VISA alias를 부여한다. 소스 코드에 IP를 하드코딩하지 않는다.
5. Slot 1 module이 N6752A이고 installed option에 761이 있는지 front panel과 query로 교차 확인한다.

LAN은 원격 bench에 편리하지만 network loss를 hardware-safe state로 오해하면 안 된다. USB/GPIB도 cable disconnect 후 output 상태를 자동으로 안전하게 만든다고 가정하지 않는다.

## 3. Python 환경

Repository root에서 다음을 실행한다.

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r examples/n6705c_pyvisa/requirements.txt
python3 -m unittest discover -s examples/n6705c_pyvisa/tests -v
```

Dry-run과 unit test에는 PyVISA backend나 장비가 필요 없다. 실제 통신에는 Keysight VISA 또는 환경에 맞는 backend가 필요하다.

## 4. Dry-run 검토

```sh
python3 -m examples.n6705c_pyvisa
python3 -m examples.n6705c_pyvisa.pa_dc_sweep
```

Transcript에서 다음 불변조건을 확인한다.

1. IDN/module/option을 확인한다.
2. 첫 configuration write가 `OUTP OFF,(@1)`이다.
3. Voltage, current limit, OVP, slew와 OCP state를 설정한다.
4. `SYST:ERR?`를 `+0`까지 bounded drain하고, 앞선 nonzero record가 하나라도 있으면 중단한다.
5. Setpoint와 `CURR:PROT:STAT?`를 장비에서 query-back한다.
6. 고정 firmware `E_02_09_3271`, N6752A와 Option 761 검증이 끝나야 configuration을 유효하게 본다.
7. 기본 실행에는 `OUTP ON`이 없다.
8. Cleanup의 첫 command가 다시 `OUTP OFF,(@1)`이다.

## 5. 실제 통신과 output 허가

먼저 output OFF 상태로 연결만 검증한다.

```sh
python3 -m examples.n6705c_pyvisa --resource N6705C --execute
```

다음 조건을 사람이 별도로 확인한 후에만 output을 허가한다.

- DUT polarity, force/sense wiring, cable ampacity와 fuse
- PA gate/drain 또는 enable/VDD 순서
- Voltage/current/OVP가 DUT normal/absolute maximum 사이에 있는지
- N6752A `V × I ≤ 100 W` autoranging envelope
- RF source OFF, analyzer/sensor 보호, interlock ready
- Discharge/bleed path와 emergency OFF

그 뒤에만 다음과 같이 실행한다.

```sh
python3 -m examples.n6705c_pyvisa \
  --resource N6705C \
  --execute \
  --output-on \
  --voltage 28 \
  --current-limit 0.25 \
  --ovp 30 \
  --slew 1000
```

예제가 정상 종료되어도 physical output indicator와 DUT discharge를 확인한다. Cleanup 실패 메시지가 나오면 output state를 **unknown**으로 취급하고 software retry보다 hardware E-stop/remote inhibit 절차를 따른다.

## 6. PA 프로그램으로 확장할 때

상위 프로그램은 point마다 다음 record를 하나로 저장한다.

- Point ID와 monotonic timestamp
- SG frequency/power/waveform, RF output state
- PSU setpoint/readback, CV/CC/protection/status, bias temperature
- DUT-plane RF Pin/Pout와 correction plane
- SA/VSA EVM, ACLR, compression/overload indicator
- Trigger, aperture, averaging, duty cycle
- Error queues와 cleanup outcome

PAE는 `mean(v(t)·i(t))`, DUT-plane RF Pin/Pout과 같은 time condition을 필요로 한다. N6752A의 10.24 µs minimum interval(약 97.656 kSa/s)을 RF IQ sample rate로 사용하지 않는다.

## 7. 문제 해결

### `refusing unsupported mainframe`

Connection Expert alias가 다른 장비를 가리킨다. Alias와 `*IDN?`를 다시 확인한다. 모델 check를 우회하지 않는다.

### `Option 761 not reported`

Slot 번호와 module option query를 확인한다. Option이 없으면 relay 동작을 가정하지 말고 프로그램과 wiring을 installed hardware에 맞게 검토한다.

### Query-back mismatch

Channel suffix, module range, protection latch, local front-panel 변경과 command error를 확인한다. 마지막 write가 성공했다고 값을 강제로 덮어쓰지 않는다.

### Timeout 또는 error queue가 끝나지 않음

Output state를 알 수 없는 것으로 취급한다. Hardware inhibit로 안전하게 만든 뒤 VISA timeout, LAN loss, pending LIST/acquisition과 queue parsing을 점검한다.

### 예상 밖 CC/OCP

RF를 끄고 bias를 safe state로 내린다. Load short, inrush, remote-sense polarity/open, cable drop, PA oscillation과 100 W envelope를 확인한다. 원인 없이 protection clear를 반복하지 않는다.

## 공식 기준

- [N6700 Programmer's Reference](https://www.keysight.com/zz/en/assets/9018-03617/programming-guides/9018-03617.pdf)
- [N6700 Specifications Guide](https://www.keysight.com/us/en/assets/9018-04533/technical-specifications/9018-04533.pdf)
- [Keysight VISA Programming Guide](https://helpfiles.keysight.com/IO_Libraries_Suite/English/IOLS_Windows/IOLS/Content/ProgrammingGuide/Conceptual_Topics/Programming_Instruments.htm)
