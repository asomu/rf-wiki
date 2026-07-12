# N6705C + N6752A PyVISA examples

Scope: N6705C mainframe, slot 1 N6752A, Option 761, firmware baseline E_02_09_3271. The examples are educational and conservative; they do not replace the DUT data sheet, fusing, remote inhibit, interlock, discharge verification or calibration.

The default command never opens VISA and prints a deterministic transcript:

```sh
python3 -m examples.n6705c_pyvisa
python3 -m unittest discover -s examples/n6705c_pyvisa/tests -v
```

Real communication requires `--execute`. Actual output additionally requires `--output-on`:

```sh
python3 -m examples.n6705c_pyvisa --resource N6705C --execute
python3 -m examples.n6705c_pyvisa --resource N6705C --execute --output-on
```

Create the `N6705C` alias in Keysight Connection Expert. Do not hard-code a lab IP in source. The sequence identifies the mainframe and module, commands output OFF, configures and queries back state, then enables output only with the second permit. Cleanup starts with output OFF; any failure is reported as an unknown physical output state.
