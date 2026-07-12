# N5182B MXG를 PyVISA로 안전하게 제어하기

이 문서는 RF Wiki의 SG 학습 내용을 실제 로컬 프로그램으로 옮기는 최소
예제다. 웹페이지가 장비에 연결하지는 않는다. Python 3.8 이상 프로그램은 사용자의 PC에서
Keysight VISA를 통해 장비에 연결한다.

예제는 **Keysight N5182B MXG 전용**이다. N5186A는 RF channel과
`GROup/SIGNal` 중심의 다른 SCPI tree를 사용하므로, 연결된 모델이 N5186A이면
명령을 보내기 전에 중단한다.

## 먼저 지켜야 할 안전 경계

- 기본 실행은 dry-run이며 VISA session을 만들지 않는다.
- 실제 통신은 `--execute`가 있어야 한다.
- 실제 RF 출력은 `--execute --rf-on`을 함께 지정해야 한다.
- 기본 power는 -30 dBm, 프로그램의 기본 상한은 -10 dBm이다.
- session 시작과 종료에 `OUTP OFF`를 보내며 예외가 발생해도 `finally`에서
  RF OFF, modulation OFF, ARB OFF를 시도한다.
- 정상 종료는 cleanup command가 모두 성공하고 마지막 `OUTP?`가 Off를 반환했을
  때만 가능하다. 통신이 끊겨 확인할 수 없으면 exit code 1과 `RF STATE UNKNOWN`을
  출력한다. 이때 front panel과 물리 interlock으로 직접 확인한다.
- 실제 PA의 최대 입력, cable loss, attenuator, DC bias 순서, SA·power sensor의
  최대 입력은 이 예제가 알 수 없다. DUT 데이터시트와 bench power budget을 먼저
  확인해야 한다.
- 자동화 software interlock은 물리 attenuator, limiter, coupler, DC current limit를
  대신하지 않는다.

## 1. VISA 연결과 LAN alias

1. PC에 최신 Keysight IO Libraries Suite를 설치한다.
2. Keysight Connection Expert에서 MXG의 LAN resource를 확인한다.
3. 예를 들어 `TCPIP0::192.0.2.10::hislip0::INSTR`에 `MXG`라는 VISA alias를
   지정한다.
4. Interactive IO에서 `*IDN?`를 보내 모델이 `N5182B`인지 먼저 확인한다.
5. Python 의존성을 설치한다.

```bash
python3 -m pip install -r examples/mxg_pyvisa/requirements.txt
```

PyVISA는 설치된 Keysight VISA implementation을 사용한다. alias를 쓰지 않으려면
`--resource 'TCPIP0::192.0.2.10::hislip0::INSTR'`처럼 전체 VISA resource를
전달한다.

## 2. 명령을 장비 없이 먼저 읽기

저장소 루트에서 실행한다.

```bash
python3 -m examples.mxg_pyvisa
python3 -m examples.mxg_pyvisa --mode waveform --sample-count 4000
```

출력되는 `WRITE`, `QUERY`, `WRITE_RAW` 순서는 실제 code path와 같다. binary I/Q
payload는 화면에 쏟지 않고 byte 수만 표시한다.

학습 목적별 실행 파일도 모두 같은 안전 adapter를 사용한다.

```bash
python3 -m examples.mxg_pyvisa.identify_and_options
python3 -m examples.mxg_pyvisa.safe_cw_output --frequency-hz 2000000000
python3 -m examples.mxg_pyvisa.upload_iq_waveform --sample-count 4000
python3 -m examples.mxg_pyvisa.pa_stimulus_sweep --start-dbm -30 --stop-dbm -20
```

네 명령 모두 기본은 dry-run이다. CW·waveform·PA sweep에서 실제 connector output을
열려면 `--execute --rf-on`을 함께 지정해야 한다. Identification 예제는 RF를 켜는
option 자체를 제공하지 않는다.

## 3. 실장비를 연결하되 RF는 켜지 않기

```bash
python3 -m examples.mxg_pyvisa \
  --execute \
  --resource MXG \
  --frequency-hz 3500000000 \
  --power-dbm -30
```

이 단계는 실제 장비에 연결해 `*IDN?`와 `*OPT?`를 확인하고 주파수·power를
설정하지만 RF를 켜지 않는다. 설정 직후 `SOUR:FREQ:CW?`,
`SOUR:POW:LEV:IMM:AMPL?`, `OUTP?`를 읽어 각각 1 Hz, 0.01 dB 이내와 RF Off를
확인한다. 이 허용값은 장비의 RF 정확도가 아니라 command coercion과 state 반영을
검사하는 software tolerance다. query가 아닌 write도 실제 상태를 바꿀 수 있으므로
연결 대상과 설정값을 dry-run에서 먼저 검토한다.

3.5 GHz 예시는 frequency Option 506이 필요하다. Option 503 장비의 상한은 3 GHz,
Option 501 장비의 상한은 1 GHz이며 프로그램은 `*OPT?`로 이를 확인한 뒤 범위를
벗어난 설정을 거부한다. 옵션을 모를 때 사용하는 기본 frequency는 1 GHz다.

## 4. 제한된 시간 동안만 RF 켜기

bench 연결, DUT bias, 감쇠기와 수신 장비의 입력 한계를 확인한 뒤 실행한다.

```bash
python3 -m examples.mxg_pyvisa \
  --execute \
  --rf-on \
  --resource MXG \
  --frequency-hz 3500000000 \
  --power-dbm -30 \
  --power-limit-dbm -20 \
  --hold-seconds 2
```

`--power-limit-dbm`은 사용자가 정한 이번 실행의 software ceiling이다. 요청 power가
이를 넘으면 RF ON 전에 실패한다. `--hold-seconds`는 0–60초만 허용하며 시간이
끝나거나 오류·Ctrl-C가 발생하면 cleanup path에서 RF OFF를 보내고 `OUTP?`로
확인한다. Cleanup 또는 VISA close가 실패하면 원래 작업 예외를 exception cause로
보존하면서 cleanup command별 실패를 함께 표시하고 성공으로 반환하지 않는다.

## 5. I/Q waveform 재생

다음 예제는 100 MSa/s, 4000 sample 안에 정확히 40주기가 들어가는 +1 MHz
complex tone을 만든다. 따라서 continuous playback의 반복 경계에서 첫 sample과
마지막 주기가 자연스럽게 이어진다.

```bash
python3 -m examples.mxg_pyvisa \
  --mode waveform \
  --sample-rate-hz 100000000 \
  --sample-count 4000 \
  --tone-offset-hz 1000000 \
  --iq-amplitude 0.5 \
  --runtime-scale-percent 70
```

처리 순서는 다음과 같다.

1. `I + jQ` sample을 normalized range -1…+1에서 만든다.
2. 각 sample을 big-endian signed 16-bit `I0,Q0,I1,Q1,…`로 quantize한다.
3. payload 앞에 IEEE 488.2 definite-length block header를 붙인다.
4. `MMEM:DATA "WFM1:name",#...`로 volatile waveform memory에 보낸다.
5. ARB sample clock, waveform RMS, runtime scaling과 waveform을 선택한다.
6. ARB와 modulation을 준비하되, `--rf-on`이 없으면 RF output은 계속 꺼 둔다.

설정 후에는 waveform 이름, sample clock, runtime scaling, ARB On, modulation On,
RF Off를 모두 query-back한다. Sample clock 허용 오차는 1 Hz, runtime scaling은
0.01%이며 선택 waveform 이름과 switch state는 정확히 일치해야 한다.

N5182B waveform의 최소 길이는 **60 complex sample**이다. 8의 배수 조건은 없다.
따라서 60, 61 sample 모두 유효하며 이 예제의 기본 4000 sample은 반복 경계가
명확한 학습 시나리오일 뿐 장비의 고정 길이 requirement가 아니다.

N5182B에는 Option 656 ARB가 필요하다. Option 656의 sample-clock 상한은
100 MHz이고 Option 657을 함께 설치하면 200 MHz이다. Configuration 규칙상
657은 656을 필요로 하므로 `*OPT?`에 657만 보이면 프로그램은 불가능한 profile로
거부한다. RF modulation bandwidth 80/160 MHz와
sample clock 100/200 MHz를 같은 숫자로 혼동하지 않는다. 예제는 `*OPT?` 결과에
따라 상한을 검사한다.

Runtime scaling은 waveform file을 다시 쓰지 않고 DAC headroom을 확보하는
설정이다. SG의 RF power setting과 같은 노브가 아니다. 같은 average power에서도
PAPR가 큰 LTE/NR waveform은 peak가 먼저 PA compression에 들어갈 수 있다.

실제 waveform을 잠깐 출력하려면 모든 안전 조건을 확인한 뒤에만 두 permission을
함께 추가한다.

```bash
python3 -m examples.mxg_pyvisa \
  --mode waveform \
  --execute --rf-on \
  --resource MXG \
  --power-dbm -30 --power-limit-dbm -20 \
  --hold-seconds 2
```

## 6. PA stimulus sweep은 SG setpoint가 아니라 DUT plane에서 제한하기

`pa_stimulus_sweep.py`는 SG 화면의 power를 곧바로 PA 입력 `Pin`으로 취급하지
않는다. Fixture·cable gain과 loss를 합친 net path gain을

```text
G_path = path_gain - path_loss
```

로 두고 다음 두 ceiling 중 더 낮은 값을 SG average setpoint 상한으로 사용한다.

```text
P_SG,max(avg)  = P_DUT,max(avg)  - G_path - uncertainty - guard
P_SG,max(peak) = P_DUT,max(peak) - G_path - uncertainty - guard - PAPR
P_SG,max       = min(P_SG,max(avg), P_SG,max(peak))
```

CW에서는 PAPR를 0 dB로, waveform mode에서는 `--waveform-papr-db`를 적용한다.
예제 기본값은 path loss 2 dB, uncertainty 0.5 dB, guard 3 dB, waveform PAPR
10 dB다. 이 숫자는 DUT 데이터시트를 대신하지 않으며 실제 fixture characterization,
connector repeatability와 waveform CCDF에 맞춰 더 보수적으로 바꾼다.

```bash
python3 -m examples.mxg_pyvisa.pa_stimulus_sweep \
  --mode waveform \
  --start-dbm -30 --stop-dbm -20 --step-db 2 \
  --max-dut-average-dbm -10 --max-dut-peak-dbm 0 \
  --path-loss-db 2 --path-gain-db 0 \
  --uncertainty-db 0.5 --guard-db 3 --waveform-papr-db 10 \
  --stimulus-duty-cycle-percent 10 --max-duty-cycle-percent 10
```

요청한 sweep의 가장 높은 point가 계산 ceiling을 넘으면 VISA connection 전에
거부한다. 선언한 stimulus duty cycle이 허용 maximum을 넘는 경우도 connection 전에
거부한다. 실제 실행에서는 각 point마다 configure/query-back 후 RF를 열고,
`--hold-seconds` 동안 출력한 뒤 RF Off를 확인하고, 선언한 duty cycle이 되도록
off dwell을 둔 다음 다음 point로 이동한다. 예를 들어 On 0.25 s, duty 10%이면
Off 2.25 s다. 이 RF gate duty는 waveform 내부 burst duty와 별개이므로 PA thermal
limit에는 둘의 조합을 더 보수적으로 평가한다.

## 7. 프로그램 구조와 reusable adapter

- `waveform.py`: complex sample, signed-16 I/Q, binary block
- `transport.py`: dry-run과 PyVISA를 같은 interface로 분리
- `driver.py`: public adapter `MxgN5182B`, model/option 검사, query-back
- `workflow.py`: `managed_mxg_session`, error queue 기록, RF OFF와 close lifecycle
- `cli.py`: `--execute`와 `--rf-on`의 별도 permission
- `identify_and_options.py`: identity와 option만 읽는 첫 연결 예제
- `safe_cw_output.py`: CW configure/query-back/output 예제
- `upload_iq_waveform.py`: I/Q 생성, upload와 ARB state 검증 예제
- `pa_stimulus_sweep.py`: DUT-plane budget을 적용한 PA stimulus sweep
- `tests/`: 실제 장비 없이 model mismatch, option 부족, SCPI error와 cleanup 검증

재사용할 때 public class 이름은 `MxgN5182B`다. 기존 `MxgController` 이름은
호환성을 위해 남지만 새 프로그램은 다음처럼 관리형 session을 통해 adapter를 받는다.

```python
from examples.mxg_pyvisa import MxgN5182B, managed_mxg_session
from examples.mxg_pyvisa.transport import VisaTransport

transport = VisaTransport.open("MXG", timeout_ms=10_000)
with managed_mxg_session(transport) as session:
    mxg: MxgN5182B = session.controller
    mxg.configure_cw(2.0e9, -30.0, power_limit_dbm=-20.0)
    # RF ON은 DUT-plane precondition을 통과한 별도 단계에서만 호출한다.
```

장비 automation을 확장할 때에도 상위 test workflow에서 raw SCPI string을 직접
조합하지 않는다. `set CW`, `upload waveform`, `arm`, `RF off`처럼 의도가 드러나는
driver API 뒤에 모델별 command tree를 둔다.

## 8. 확인과 문제 해결

```bash
python3 -m unittest discover -s examples/mxg_pyvisa/tests -v
python3 -m compileall -q examples/mxg_pyvisa
```

- `This example supports N5182B only`: alias가 다른 장비를 가리킨다.
- `Option 656 is required`: 장비에 internal ARB baseband generator가 없다.
- `sample rate exceeds`: Option 656/657에 맞게 sample rate를 줄인다.
- `SYST:ERR?` 오류: 프로그램은 queue가 0이 될 때까지 읽고 실패 원인을 모두
  표시한다. 앞선 첫 오류부터 해결한다.
- `Pre-existing error before *CLS`: 연결 전에 남아 있던 error queue의 최대 30개
  record를 읽어 기록하고, 31번째 이내 query에서 `+0` 종결을 확인한 것이다.
  종결을 확인한 뒤에만 `*CLS`를 보내 새 sequence의 오류와 분리한다.
- `query-back mismatch`: 장비가 요청값을 coercion했거나 state가 반영되지 않았다.
  RF를 켜지 말고 표시된 expected/actual 값과 error queue를 확인한다.
- `RF STATE UNKNOWN`: cleanup의 `OUTP OFF` 또는 `OUTP?` 확인이 실패했다. 프로그램
  재실행만 믿지 말고 front panel, RF indicator와 외부 interlock을 직접 확인한다.
- timeout: LAN 주소, HiSLIP/VXI-11 service, VISA alias와 firewall을 확인한다.

## 공식 참고 자료

- [N5182B X-Series SCPI Command Reference](https://www.keysight.com/ml/en/assets/9018-03690/programming-guides/9018-03690.pdf)
- [N5182B MXG Configuration Guide](https://www.keysight.com/us/en/assets/7018-03359/configuration-guides/5990-9959.pdf)
- [How to Create Baseband Waveforms and Download Them](https://www.keysight.com/in/en/assets/7119-1232/application-notes/How-to-Create-Baseband-Waveforms-and-Download-Them-to-RF-Vector-Signal-Generators.pdf)
- [Keysight Instrument Control and Connectivity Software](https://www.keysight.com/us/en/products/software/libraries-plug-ins.html)
