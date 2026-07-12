# N5182B MXG PyVISA example

이 디렉터리는 RF Wiki의 학습용 로컬 예제다. 웹사이트가 장비에 연결하는
코드가 아니며, Python 3.8 이상을 사용한다. `--execute`를 주기 전에는 VISA
session도 만들지 않는다.

저장소 루트에서 먼저 dry-run을 실행한다.

```bash
python3 -m examples.mxg_pyvisa
python3 -m examples.mxg_pyvisa --mode waveform
python3 -m examples.mxg_pyvisa.identify_and_options
python3 -m examples.mxg_pyvisa.safe_cw_output
python3 -m examples.mxg_pyvisa.upload_iq_waveform
python3 -m examples.mxg_pyvisa.pa_stimulus_sweep
```

정상 종료는 cleanup 후 `OUTP?`가 Off임을 확인한 경우에만 가능하다. 확인에
실패하면 exit code 1과 `RF STATE UNKNOWN`을 표시하므로 MXG front panel과 물리
interlock을 직접 확인한다. N5182B waveform은 최소 60 complex sample이며 8의
배수 조건은 없다.

재사용 가능한 장비 adapter의 public 이름은 `MxgN5182B`다. 네 개의 focused
example은 모두 `managed_mxg_session`을 사용해 identity/option 확인, 기존 error
기록, query-back, RF OFF 확인과 VISA close를 같은 정책으로 처리한다. PA sweep은
path gain/loss, uncertainty, guard와 waveform PAPR를 DUT plane budget에 포함하고,
선언한 RF gate duty cycle이 허용값을 넘으면 연결 전에 거부한다.

실장비 연결과 안전 절차는
[`docs/MXG_PYVISA_GUIDE.md`](../../docs/MXG_PYVISA_GUIDE.md)를 따른다.

테스트에는 PyVISA나 장비가 필요하지 않다.

```bash
python3 -m unittest discover -s examples/mxg_pyvisa/tests -v
```
