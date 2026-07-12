# E5080B PyVISA examples

Safe-by-default learning code for the Keysight E5080B-2K0 profile and firmware A.20.25.03.

- Dry-run is the default.
- `--execute` opens the configured VISA resource.
- `--rf-on` is a second, explicit consent and requires `--execute`.
- Physical RF enable also requires explicit DUT-input limit, receiver working limit, and maximum DUT gain. The code evaluates path gain/loss, uncertainty, and guard margin before VISA is opened and again before every `OUTP ON`.
- S12/S22 source drive requires a third `--reverse-drive` consent.
- Physical corrected SDATA additionally requires `--expected-calset NAME` and verifies correction state, active CalSet, named measurement selection, and ASCII format query-back.
- Every workflow sends `OUTP OFF` first in `finally`, queries `OUTP?`, and reports the physical state as unknown unless the response is `0/OFF`.
- Any nonzero `SYST:ERR?` record after configuration/query-back blocks RF enable even when the queue eventually reaches `+0,"No error"`.
- A network failure can prevent software RF OFF; use hardware attenuation/interlocks and a DUT-specific bias policy.

See `docs/E5080B_PYVISA_GUIDE.md` for setup, Connection Expert alias creation, commands, and troubleshooting.

```bash
python3 -m examples.e5080b_pyvisa
python3 -m examples.e5080b_pyvisa.identify_and_options
python3 -m examples.e5080b_pyvisa.pa_gain_sweep

# Physical reverse measurement: all three permissions are intentional.
python3 -m examples.e5080b_pyvisa.acquire_sparameters \
  --execute --rf-on --reverse-drive --parameter S12 \
  --expected-calset Approved2PortCal \
  --dut-input-limit-dbm -20 \
  --receiver-input-limit-dbm 0 \
  --maximum-dut-gain-db 0
```

Run the isolated tests:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s examples/e5080b_pyvisa/tests -v
```
