# Keysight N9020B MXA PyVISA examples

Pinned learning profile: `N9020B-526 + B1X + MPB + P26`, firmware `A.43.49`, Spectrum Analyzer mode / Swept SA only.

The package is dry-run first. Running a command without `--execute` opens no VISA resource and prints a deterministic transcript.

```bash
python3 -m examples.n9020b_pyvisa
python3 -m examples.n9020b_pyvisa.identify_and_options
python3 -m examples.n9020b_pyvisa.safe_spectrum
python3 -m examples.n9020b_pyvisa.pa_spectrum_measurements --measurement ACP
python3 -m examples.n9020b_pyvisa.iq_capture --if-bandwidth-hz 100e6 --samples 1000000
```

Real access requires `--execute`, a Connection Expert alias, and an explicit connector safety envelope. A real acquisition additionally requires `--acquire`.

```bash
python3 -m examples.n9020b_pyvisa.safe_spectrum \
  --execute --acquire --resource N9020B \
  --source-max-average-dbm 0 \
  --path-gain-db -40 \
  --waveform-papr-db 8 \
  --connector-average-limit-dbm -20 \
  --connector-peak-limit-dbm -10 \
  --dc-volts 0
```

The first real measurement sequence is deliberately fixed:

`*IDN?/*OPT? → ABOR → *CLS → CONF:SAN:NDEF → INIT:CONT OFF → POW:ATT:AUTO OFF → POW:ATT 40DB → POW:GAIN OFF → query-back → configure → query-back/error check → INIT:IMM/*OPC? → TRAC? TRACE1`

Cleanup starts with `ABOR`, then restores single acquisition, 40 dB attenuation and preamp OFF before bounded error drain and close. `ABOR` cannot remove RF or DC from the physical connector. External attenuation/coupling, DC blocking, source shutdown and the DUT bias sequence remain bench responsibilities.

`iq_capture.py` is sizing-only and intentionally refuses `--execute`. Native IQ Analyzer SCPI is not mixed into this Swept-SA package.

See [`docs/N9020B_PYVISA_GUIDE.md`](../../docs/N9020B_PYVISA_GUIDE.md) for setup, safety reasoning, command recipes and troubleshooting.
