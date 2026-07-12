# Keysight U2061XA PyVISA examples

These examples target a Keysight U2061XA USB wide-dynamic-range average and peak power sensor with firmware scope A.03.16.

The default command is a deterministic dry-run. It does not import PyVISA or open a USB resource.

```bash
python3 -m examples.u2061xa_pyvisa
python3 -m examples.u2061xa_pyvisa --mode identify
python3 -m examples.u2061xa_pyvisa --mode pa
```

For a real sensor, install Keysight IO Libraries, create the Connection Expert alias `U2061XA`, install `requirements.txt`, and explicitly keep the external source RF OFF through zero/cal. The program then asks for a separate low-level stimulus permit at the phase boundary:

```bash
python3 -m pip install -r examples/u2061xa_pyvisa/requirements.txt
python3 -m examples.u2061xa_pyvisa \
  --execute \
  --resource U2061XA \
  --sg-rf-off-confirmed \
  --confirm-stimulus-at-boundary
```

The sensor has no RF output to disable. The test-station orchestration layer remains responsible for SG RF OFF, guarded low-level enable/query-back, PA bias shutdown, attenuator/coupler protection and hardware interlocks. Production automation should pass `run_average_measurement(..., stimulus_ready_gate=...)` a callback that controls and verifies the SG after zero/cal and returns a `StimulusLease` with an RF-OFF release callback; a pre-set boolean is not equivalent.

See `docs/U2061XA_PYVISA_GUIDE.md` for the complete workflow and troubleshooting guide.
