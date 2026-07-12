"""Transport boundary: dry-run is dependency-free; VISA is imported lazily."""

from __future__ import annotations

import re
from typing import Protocol


class Transport(Protocol):
    def write(self, message: str) -> None: ...
    def query(self, message: str) -> str: ...
    def close(self) -> None: ...


class DryRunTransport:
    """Deterministic fake N6705C used for review and unit tests."""

    def __init__(self) -> None:
        self.transcript: list[tuple[str, str]] = []
        self.closed = False
        self._values = {
            "VOLT": "0.000000",
            "CURR": "0.100000",
            "VOLT:PROT": "5.000000",
            "VOLT:SLEW": "1000.000000",
            "CURR:PROT:STAT": "0",
            "OUTP": "0",
        }
        self._voltage_mode = "FIX"
        self._transient_trigger_source = "IMM"
        self._list_voltages: list[float] = []
        self._list_dwells: list[float] = []
        self._transient_armed = False

    def write(self, message: str) -> None:
        self.transcript.append(("write", message))
        normalized = re.sub(r",?\s*\(@1\)\s*$", "", message.strip(), flags=re.IGNORECASE)
        match = re.match(r"^(VOLT(?::PROT)?|CURR|VOLT:SLEW)\s+([^,]+)", normalized, re.IGNORECASE)
        if match:
            self._values[match.group(1).upper()] = f"{float(match.group(2)):.6f}"
        output = re.match(r"^OUTP\s+(ON|OFF|1|0)", normalized, re.IGNORECASE)
        if output:
            self._values["OUTP"] = "1" if output.group(1).upper() in {"ON", "1"} else "0"
        ocp = re.match(r"^CURR:PROT:STAT\s+(ON|OFF|1|0)", normalized, re.IGNORECASE)
        if ocp:
            self._values["CURR:PROT:STAT"] = "1" if ocp.group(1).upper() in {"ON", "1"} else "0"
        mode = re.match(r"^VOLT:MODE\s+(FIX|FIXED|STEP|LIST)$", normalized, re.IGNORECASE)
        if mode:
            self._voltage_mode = "FIX" if mode.group(1).upper() in {"FIX", "FIXED"} else mode.group(1).upper()
        trigger_source = re.match(
            r"^TRIG:TRAN:SOUR\s+(BUS|EXT|EXTERNAL|IMM|IMMEDIATE)$",
            normalized,
            re.IGNORECASE,
        )
        if trigger_source:
            source = trigger_source.group(1).upper()
            self._transient_trigger_source = {"EXTERNAL": "EXT", "IMMEDIATE": "IMM"}.get(source, source)
        list_voltage = re.match(r"^LIST:VOLT\s+(.+)$", normalized, re.IGNORECASE)
        if list_voltage:
            self._list_voltages = [float(value) for value in list_voltage.group(1).split(",")]
        list_dwell = re.match(r"^LIST:DWEL\s+(.+)$", normalized, re.IGNORECASE)
        if list_dwell:
            self._list_dwells = [float(value) for value in list_dwell.group(1).split(",")]
        if re.match(r"^INIT:TRAN$", normalized, re.IGNORECASE):
            self._transient_armed = True
        if normalized.upper() == "*TRG" and self._transient_armed:
            self._transient_armed = False
            if self._list_voltages:
                self._values["VOLT"] = f"{self._list_voltages[0]:.6f}"
        if re.match(r"^ABOR:(?:TRAN|ACQ)$", normalized, re.IGNORECASE):
            self._transient_armed = False

    def query(self, message: str) -> str:
        self.transcript.append(("query", message))
        normalized = message.strip().upper()
        fixed = {
            "*IDN?": "KEYSIGHT TECHNOLOGIES,N6705C,MY00000000,E.02.09.3271",
            "SYST:CHAN:MOD? (@1)": "N6752A",
            "SYST:CHAN:OPT? (@1)": "761",
            "*OPC?": "1",
            "SYST:ERR?": '+0,"No error"',
            "STAT:OPER:COND? (@1)": "1",
        }
        if normalized in fixed:
            return fixed[normalized]
        if normalized == "VOLT:MODE? (@1)":
            return self._voltage_mode
        if normalized == "TRIG:TRAN:SOUR? (@1)":
            return self._transient_trigger_source
        if normalized == "LIST:VOLT? (@1)":
            return ",".join(f"{value:.9g}" for value in self._list_voltages)
        if normalized == "LIST:DWEL? (@1)":
            return ",".join(f"{value:.9g}" for value in self._list_dwells)
        if normalized == "MEAS:VOLT? (@1)":
            return self._values["VOLT"]
        if normalized == "MEAS:CURR? (@1)":
            return "0.050000"
        for header, value in self._values.items():
            if normalized == f"{header}? (@1)" or normalized == f"{header}?":
                return value
        return "0"

    def close(self) -> None:
        self.closed = True
        self.transcript.append(("close", "session"))


class VisaTransport:
    """Thin PyVISA adapter; instantiate only after explicit --execute."""

    def __init__(self, resource_name: str, timeout_ms: int = 10_000) -> None:
        import pyvisa  # type: ignore[import-not-found]

        self._manager = pyvisa.ResourceManager()
        self._resource = self._manager.open_resource(resource_name)
        self._resource.timeout = timeout_ms
        self._resource.read_termination = "\n"
        self._resource.write_termination = "\n"

    def write(self, message: str) -> None:
        self._resource.write(message)

    def query(self, message: str) -> str:
        return str(self._resource.query(message)).strip()

    def close(self) -> None:
        try:
            self._resource.close()
        finally:
            self._manager.close()
