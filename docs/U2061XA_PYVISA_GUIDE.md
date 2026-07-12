# Keysight U2061XA PyVISA 실행 가이드

이 가이드는 RF Wiki의 `examples/u2061xa_pyvisa/`를 Keysight U2061XA, firmware scope `A.03.16`에서 사용하는 절차다. U2061XA는 10 MHz–6 GHz USB wide-dynamic-range average/peak power sensor다. 예제는 기본적으로 dry-run이며 실제 장비 accuracy, connector 보호, calibration 또는 bench interlock을 대신하지 않는다.

## 1. 먼저 구분할 안전 경계

- U2061XA에는 끌 RF output이 없다. `ABOR`는 acquisition을 중단할 뿐 외부 SG나 PA bias를 끄지 않는다.
- 실제 USB session은 `--execute`가 있어야 열린다. Average acquisition에는 zero/cal 동안의 `--sg-rf-off-confirmed`와, 그 뒤 별도 시점의 `--confirm-stimulus-at-boundary`가 모두 필요하다.
- Production station은 interactive 확인 대신 `stimulus_ready_gate` callback 안에서 SG의 guarded low-level 설정, RF enable, query-back과 path permit을 수행하고, evidence와 RF-OFF `release()`를 묶은 `StimulusLease`를 반환한다.
- 통신 단절, process kill 또는 USB 제거 시 SG RF OFF와 PA bias safe-down은 보장되지 않는다. Hardware RF switch/interlock, fixed attenuator, DC block, fuse와 DUT별 bias sequence를 독립적으로 둔다.
- Data sheet의 +26 dBm average, +29 dBm peak(`pulse duration <10 µs` 조건), 10 V DC는 **damage level**이지 권장 working limit이 아니다. Station uncertainty와 guard를 포함해 더 낮은 한계를 정한다.
- Sensor connector에서의 correction 전 average·peak·DC로 sensor 안전을 판단한다. `+40 dB` channel/path correction은 sensor가 견딜 power를 40 dB 높여 주지 않는다.

## 2. Detector의 역할과 한계

U2061XA의 Average mode는 -70 dBm에서 +26 dBm 범위의 average power 측정에 사용한다. Normal mode는 peak·time-domain 측정과 video bandwidth 선택에 사용한다. 두 mode를 섞어 해석하지 않는다.

- Average aperture는 300 MHz 이상에서 20 µs–200 ms, 300 MHz 미만에서는 최소 50 µs다.
- Peak path video bandwidth는 최대 5 MHz이며 carrier가 300 MHz 이상일 때의 조건이다.
- 20 MSa/s capture와 5 MHz peak bandwidth는 100 MHz OFDM의 true wideband envelope, PAPR 또는 CCDF를 그대로 보장하지 않는다.
- Peak sample 하나, pulse average, period average와 long-term average는 서로 다른 quantity다. Trigger, aperture, gate와 averaging 상태를 결과 metadata에 저장한다.
- Internal trigger command가 받아들이는 `-48…+20 dBm` 범위와 guaranteed trigger sensitivity는 같은 뜻이 아니다. Normal mode guaranteed minimum은 -25 dBm, Average mode는 -40 dBm이다.

## 3. Keysight IO Libraries Suite와 VISA alias

1. 운영체제에 맞는 Keysight IO Libraries Suite를 Keysight 공식 사이트에서 설치한다.
2. Connection Expert에서 U2061XA USB-TMC resource를 찾는다.
3. Sensor label의 model/serial과 Connection Expert 표시가 같은지 확인한다.
4. Interactive IO에서 `*IDN?`를 보내 `Keysight Technologies,U2061XA,...` 응답을 확인한다.
5. Resource에 `U2061XA` alias를 만든다. USB address나 serial을 Python source에 하드코딩하지 않는다.

공식 VISA 개념은 [Keysight VISA Programming Guide](https://helpfiles.keysight.com/IO_Libraries_Suite/English/IOLS_Windows/IOLS/Content/ProgrammingGuide/Conceptual_Topics/Programming_Instruments.htm)를 따른다.

## 4. Python 가상환경

Repository root에서 실행한다.

```bash
python3 -m venv .venv-u2061xa
source .venv-u2061xa/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r examples/u2061xa_pyvisa/requirements.txt
```

Windows PowerShell에서는 activation command가 `.venv-u2061xa\Scripts\Activate.ps1`이다. Dry-run과 unit test에는 PyVISA나 VISA backend가 필요 없다.

## 5. 장비 없이 dry-run

먼저 fake transport에서 실제 command 순서와 계산을 읽는다.

```bash
python3 -m examples.u2061xa_pyvisa
python3 -m examples.u2061xa_pyvisa.identify_sensor
python3 -m examples.u2061xa_pyvisa.safe_average_measurement \
  --frequency-hz 3500000000 \
  --aperture-seconds 0.001
python3 -m examples.u2061xa_pyvisa.safe_average_measurement \
  --trigger-source BUS
python3 -m examples.u2061xa_pyvisa.pa_power_budget
```

BUS transcript는 반드시 `INIT:CONT OFF → INIT → *TRG → FETC?` 순서다. `FETC?`는 완료된 acquisition을 가져올 뿐 trigger를 만들지 않는다. Fake transport도 event 전 `FETC?`와 arm 전 `*TRG`를 거절하므로 숨은 deadlock을 정상 데이터처럼 만들지 않는다.

## 6. 실제 identity만 확인

Identity mode는 acquisition을 시작하지 않으므로 stimulus permit을 요구하지 않는다.

```bash
python3 -m examples.u2061xa_pyvisa.identify_sensor \
  --execute \
  --resource U2061XA
```

Connected model이 U2061XA가 아니면 adapter는 중단한다. 다른 2050/2060 model이나 다른 firmware의 명령을 무조건 호환된다고 가정하지 않는다.

## 7. 실제 average 측정은 두 phase다

한 번의 안전한 measurement transaction에는 서로 반대인 두 물리 상태가 필요하다.

### Phase A — source RF OFF에서 zero/cal

1. Upstream SG RF OFF와 PA output 부재를 물리적으로 확인한다.
2. Sensor connector의 DC와 예상 residual RF가 zero 조건을 만족하는지 확인한다.
3. `*IDN?`, bounded `SYST:ERR?`, `*CLS`를 수행한다.
4. Detector, frequency, aperture를 설정하고 query-back한다.
5. `CAL:ZERO:TYPE INT`와 `CAL:ALL?`를 수행한다.

### Phase B — guarded low-level stimulus를 별도로 허가

Zero/cal 완료 후에만 station이 SG를 낮은 설정으로 구성하고, DUT-plane budget과 sensor connector input을 검사하고, RF enable 상태를 query-back한다. 이 결과를 `stimulus_ready_gate`가 증거로 반환한 뒤 acquisition을 시작한다. Zero/cal 전에 미리 세운 boolean이나 RF-OFF noise를 실제 stimulus reading으로 저장하지 않는다.

Interactive example은 phase boundary에서 정확히 `STIMULUS READY`를 입력해야 계속된다.

```bash
python3 -m examples.u2061xa_pyvisa.safe_average_measurement \
  --execute \
  --resource U2061XA \
  --frequency-hz 3500000000 \
  --aperture-seconds 0.001 \
  --sg-rf-off-confirmed \
  --confirm-stimulus-at-boundary
```

이 prompt는 학습용 human gate다. 측정 뒤에는 SG RF OFF query-back을 확인하는 두 번째 prompt가 cleanup의 첫 동작으로 실행된다. Production automation에서는 같은 Python process의 callback이 SG adapter를 호출하고 다음 evidence와 cleanup을 함께 제공해야 한다.

```python
from examples.u2061xa_pyvisa import StimulusLease

def establish_guarded_stimulus() -> StimulusLease:
    # Pseudocode: station-owned SG adapter and interlock.
    sg.set_rf_off()
    sg.configure_low_level(frequency_hz=3.5e9, power_dbm=-30.0)
    station.assert_sensor_budget_passes()
    sg.set_rf_on()
    sg.assert_query_back(frequency_hz=3.5e9, power_dbm=-30.0, rf_on=True)
    def release() -> str:
        sg.set_rf_off()
        sg.assert_query_back(rf_on=False)
        return "SG RF OFF query-back; interlock SAFE"

    return StimulusLease(
        evidence="SG query-back -30 dBm; path budget PASS; interlock READY",
        release=release,
    )
```

Sensor package 자체는 SG를 제어하지 않는다. Callback은 permit 생성 중 예외가 나면 SG를 내부적으로 safe-down해야 한다. Lease가 만들어진 뒤에는 acquisition의 성공·실패와 관계없이 `release()`를 `ABOR`보다 먼저 호출한다. 빈 enable 또는 RF-OFF evidence는 `CleanupError`로 처리한다.

## 8. Trigger별 acquisition sequence

| Source | 권장 transaction | 완료 event |
|---|---|---|
| `IMM` | `READ?` | Immediate trigger와 fetch를 한 transaction으로 수행 |
| `BUS` | `INIT:CONT OFF` → `INIT` → `*TRG` → `FETC?` | Host가 명시적으로 `*TRG` 전송 |
| `INT` | `INIT` → RF envelope crossing → `FETC?` | Internal detector가 threshold/slope 조건 만족 |
| `EXT` | `INIT` → external edge → `FETC?` | External trigger input의 valid edge |
| `HOLD` | 자동 one-shot workflow에서 거절 | 의도적으로 arm한 manual session은 `TRIG:IMM`로 한 번 release 가능 |

예제 workflow는 `HOLD`를 명시적으로 거절하고 cleanup의 `ABOR`로 armed state를 취소한다. `TRIG:IMM`는 의도적으로 armed HOLD session을 완료시키는 manual event이며, BUS용 `*TRG`와 같은 명령으로 취급하지 않는다. `INIT:CONT OFF`도 repeat policy일 뿐 arm state가 아니다. `INT`/`EXT`에서는 timeout을 예상 trigger period보다 길게 정하되 무한 대기는 사용하지 않는다. Trigger가 없으면 source·cable·threshold·slope를 진단하고 기존 `FETC?` 값을 재사용하지 않는다.

## 9. SCPI evidence와 queue 규칙

각 단계의 증거 강도는 다르다.

1. `write()` 반환 — host가 transport에 byte를 전달했다.
2. Query-back — 장비가 현재 state를 응답했다.
3. `*OPC? → 1` — 앞선 overlapped operation이 완료됐다.
4. `SYST:ERR? → +0,"No error"` — 해당 시점 error queue가 비었다.
5. `READ?` 또는 완료 event 뒤 `FETC?` — 새 acquisition result다.
6. Known source, sensor check와 다른 장비 cross-check — physical validity evidence다.

Output queue와 error queue는 별도 FIFO다. Query response를 읽기 전에 다음 write를 보내면 `Query INTERRUPTED`가 생길 수 있다. `*CLS`는 status/error state를 지우지만 이미 잘못 저장한 measurement 의미를 복구하지 않는다. Error drain은 U2061XA queue capacity에 맞춰 최대 31회로 제한해 통신 이상에서 무한 loop가 되지 않게 한다.

## 10. Correction, mismatch와 uncertainty

Measurement frequency를 설정해야 sensor의 frequency-dependent correction을 올바르게 적용할 수 있다. Cable, attenuator와 coupler correction을 장비 channel과 host code 양쪽에서 중복 적용하지 않는다.

- Directional forward coupled port 하나는 incident/forward wave를 측정한다.
- `P1,accepted = P1,fwd − P1,refl`과 `Pload,delivered = P2,fwd − P2,refl`은 같은 reference impedance의 **watt**로 계산한다.
- Reverse path가 없으면 DUT-plane forward power로만 기록하고 accepted/delivered라고 이름을 바꾸지 않는다.
- Sensor SWR, DUT/coupler SWR, directivity, path calibration, connector repeatability, linearity와 zero drift를 uncertainty budget에 넣는다.
- U2061XA SWR specification은 input level에 따라 달라진다. U2061XA의 대표 한계는 -70…+15 dBm에서 1.15, +15…+26 dBm에서 1.24다.

## 11. PA KPI에 결합할 때

Input/output forward sensor 두 대와 PSU를 같은 test-point ID, waveform, trigger, temperature와 aperture에 묶는다. RF Wiki 예제의 계산은 다음 convention이다.

```text
P1,fwd = input sensor reading + signed input-path correction
P2,fwd = output sensor reading + signed output-path correction
Gfwd   = P2,fwd - P1,fwd
PAEfwd = (P2,fwd[W] - P1,fwd[W]) / (VDD * IDD)
```

`Gfwd`는 forward-wave ratio이며 transducer gain이나 operating power gain으로 자동 승격하지 않는다. `PAEfwd`도 reverse wave가 없으면 estimate다. Accepted/delivered PAE에는 input/output reverse reading 또는 동등하게 검증된 power definition이 필요하다.

U2061XA는 EVM, ACLR, SEM, AM-PM 또는 harmonic spectrum을 제공하지 않는다. SA/VSA가 그 결과를 담당하고 PSU가 V/I와 protection state를 담당한다. Abort 시 상위 orchestrator는 **SG RF OFF를 먼저**, 이후 DUT bias safe-down을 실행한다.

## 12. Tests

```bash
PYTHONDONTWRITEBYTECODE=1 \
python3 -m unittest discover -s examples/u2061xa_pyvisa/tests -v
```

Tests는 model rejection, bounded error drain, aperture minimum, query-back, two-phase stimulus gate ordering, RF-OFF lease cleanup 순서, BUS `INIT/*TRG/FETC?`, HOLD rejection/release, stale fetch rejection, physical permit failure cleanup, abort failure surfacing과 linear-watt PAE 계산을 포함한다.

## 13. 문제 해결

### Resource not found

- Connection Expert에서 `U2061XA` alias와 USB-TMC resource를 다시 확인한다.
- USB cable/power 상태와 다른 process가 resource를 lock했는지 확인한다.
- 다른 VISA implementation이 default backend를 가로채지 않는지 확인한다.
- USB address를 코드에 임시 하드코딩해 영구 해결책으로 남기지 않는다.

### `*IDN?` timeout 또는 model mismatch

- Connection Expert Interactive IO에서 같은 resource를 검사한다.
- Sensor serial과 alias가 가리키는 장비를 교차 확인한다.
- U2061XA adapter의 model check를 우회해 다른 model에 명령을 보내지 않는다.

### Zero/calibration failure

- Upstream SG RF가 실제로 OFF인지, PA leakage나 DC가 sensor connector에 들어오지 않는지 확인한다.
- Zero/cal 직후 source를 켜는 phase boundary를 지켰는지 확인한다.
- Error queue와 calibration response를 기록하고 반복 zero로 문제를 숨기지 않는다.

### `FETC?` timeout 또는 stale-data error

- `INIT` 이후 matching event가 실제로 발생했는지 확인한다.
- BUS면 `*TRG`가 `INIT` 뒤에 있는지, INT/EXT면 threshold·slope·cable·pulse width를 확인한다.
- `HOLD` 상태인지 확인한다. 이전 reading을 새 test point에 복사하지 않는다.

### Peak가 예상보다 낮거나 pulse가 뭉개짐

- Normal detector와 VBW가 선택됐는지 확인한다.
- Envelope bandwidth가 peak path의 5 MHz 한계를 넘는지 확인한다.
- Trigger delay, aperture/gate, sample rate와 capture length를 확인한다.
- Average reading, peak sample와 PAPR/CCDF를 같은 값으로 비교하지 않는다.

### Cleanup에서 `ABOR` 또는 close 실패

- 예제는 이를 정상 종료로 숨기지 않고 `CleanupError`로 올린다.
- Sensor acquisition state와 외부 source state를 모두 unknown으로 취급한다.
- Hardware RF switch/interlock로 source path를 안전하게 하고 DUT bias를 별도 경로로 종료한다.
- 사람이 SG, PA와 sensor path를 확인하기 전 자동 retry하지 않는다.

## 공식 기준 자료

- [Keysight U2061XA product and specifications](https://www.keysight.com/us/en/product/U2061XA/10mhz-6ghz-usb-wide-dynamic-range-average-peak-power-sensor.html)
- [U2061XA support and firmware](https://www.keysight.com/us/en/support/U2061XA/10mhz-6ghz-usb-wide-dynamic-range-average-peak-power-sensor.html)
- [X-Series USB/LAN Wide Dynamic Range Peak and Average Power Sensors Data Sheet](https://www.keysight.com/zz/en/assets/3120-1424/data-sheets/U2049XA-Option-TVA-UL205060-X-Series-USBLAN-Wide-Dynamic-Range-Peak-Average-Power.pdf)
- [Keysight 2050/2060 X-Series User's Guide](https://www.keysight.com/us/en/assets/9018-04734/user-manuals/9018-04734.pdf)
- [Keysight 2050/2060 X-Series Programming Guide](https://www.keysight.com/us/en/assets/9018-04755/programming-guides/9018-04755.pdf)
- [Characterizing the Key Performance Indicators of Power Amplifiers](https://www.keysight.com/zz/en/assets/3122-1770/application-notes/Characterizing-the-Key-Performance-Indicators-of-Power-Amplifiers.pdf)
