"""Transport boundary and deterministic N9020B dry-run state model."""

from __future__ import annotations

from dataclasses import dataclass
import math
import re
from typing import Dict, List, Protocol


class ScpiTransport(Protocol):
    def write(self, command: str) -> None: ...
    def query(self, command: str) -> str: ...
    def close(self) -> None: ...


@dataclass(frozen=True)
class Operation:
    kind: str
    command: str


class DryRunTransport:
    """A deterministic Swept-SA fake. It never opens VISA or touches hardware."""

    def __init__(
        self,
        idn: str = "Keysight Technologies,N9020B,RF-WIKI-DEMO,A.43.49",
        options: str = "526,B1X,MPB,P26",
    ) -> None:
        self.history: List[Operation] = []
        self.closed = False
        self._errors: List[str] = ['+0,"No error"']
        self._measurement = "SAN"
        self._continuous = True
        self._acquisition_complete = False
        self._center_hz = 3.5e9
        self._span_hz = 100e6
        self._reference_level_dbm = 0.0
        self._attenuation_db = 40.0
        self._attenuation_auto = True
        self._preamp = False
        self._rbw_hz = 100e3
        self._rbw_auto = True
        self._vbw_hz = 300e3
        self._vbw_auto = True
        self._points = 1001
        self._detector = "NORM"
        self._trigger = "IMM"
        self._marker_enabled = False
        self._marker_frequency_hz = self._center_hz
        self._marker_level_dbm = -18.5
        self._responses: Dict[str, str] = {
            "*IDN?": idn,
            "*OPT?": options,
            "*OPC?": "1",
            "FORM:DATA?": "ASC,0",
        }

    def write(self, command: str) -> None:
        normalized = command.strip()
        upper = normalized.upper()
        self.history.append(Operation("WRITE", normalized))

        if upper == "*CLS":
            self._errors = ['+0,"No error"']
        elif upper == "ABOR":
            self._acquisition_complete = False
        elif upper == "CONF:SAN:NDEF":
            self._measurement = "SAN"
            self._acquisition_complete = False
        elif upper in {"CONF:CHP", "CONF:ACP", "CONF:OBW"}:
            self._measurement = upper.split(":", 1)[1]
            self._acquisition_complete = False
        elif upper.startswith("INIT:CONT "):
            self._continuous = _parse_bool(upper.split(None, 1)[1])
        elif upper in {"INIT:IMM", "INITIATE:IMMEDIATE"}:
            if self._trigger != "IMM":
                self._push_error('-211,"Trigger ignored in deterministic dry-run"')
            else:
                self._acquisition_complete = True
        elif upper.startswith("POW:ATT:AUTO "):
            self._attenuation_auto = _parse_bool(upper.split(None, 1)[1])
        elif upper.startswith("POW:ATT "):
            self._attenuation_db = _parse_number(upper.split(None, 1)[1])
        elif upper.startswith("POW:GAIN "):
            self._preamp = _parse_bool(upper.split(None, 1)[1])
        elif upper.startswith("FREQ:CENT ") or any(upper.startswith("{}:FREQ:CENT ".format(mode)) for mode in ("CHP", "ACP", "OBW")):
            self._center_hz = _parse_frequency_hz(upper.split(None, 1)[1])
        elif upper.startswith("FREQ:SPAN "):
            self._span_hz = _parse_frequency_hz(upper.split(None, 1)[1])
        elif upper.startswith("DISP:WIND:TRAC:Y:RLEV "):
            self._reference_level_dbm = _parse_number(upper.split(None, 1)[1])
        elif upper.startswith("BAND:RES:AUTO "):
            self._rbw_auto = _parse_bool(upper.split(None, 1)[1])
        elif upper.startswith("BAND:RES "):
            self._rbw_hz = _parse_frequency_hz(upper.split(None, 1)[1])
        elif upper.startswith("BAND:VID:AUTO "):
            self._vbw_auto = _parse_bool(upper.split(None, 1)[1])
        elif upper.startswith("BAND:VID "):
            self._vbw_hz = _parse_frequency_hz(upper.split(None, 1)[1])
        elif upper.startswith("SWE:POIN "):
            self._points = int(_parse_number(upper.split(None, 1)[1]))
        elif upper.startswith("DET:TRAC1 "):
            self._detector = upper.split(None, 1)[1]
        elif upper.startswith("TRIG:SAN:SOUR "):
            self._trigger = upper.split(None, 1)[1]
        elif upper.startswith("FORM:DATA "):
            self._responses["FORM:DATA?"] = upper.split(None, 1)[1]
        elif upper.startswith("CALC:MARK1:STAT "):
            self._marker_enabled = _parse_bool(upper.split(None, 1)[1])
        elif upper == "CALC:MARK1:MAX":
            if not self._marker_enabled:
                self._push_error('-221,"Marker 1 is off"')
                return
            if not self._acquisition_complete:
                self._push_error('-230,"Data corrupt or stale"')
            else:
                trace = self._trace_values()
                index = max(range(len(trace)), key=trace.__getitem__)
                self._marker_frequency_hz = self._frequency_at(index)
                self._marker_level_dbm = trace[index]

    def query(self, command: str) -> str:
        normalized = command.strip()
        upper = normalized.upper()
        self.history.append(Operation("QUERY", normalized))

        if upper == "SYST:ERR?":
            if len(self._errors) > 1:
                return self._errors.pop(0)
            return self._errors[0]
        if upper == "INIT:CONT?":
            return "1" if self._continuous else "0"
        if upper == "POW:ATT?":
            return _format_number(self._attenuation_db)
        if upper == "POW:ATT:AUTO?":
            return "1" if self._attenuation_auto else "0"
        if upper == "POW:GAIN?":
            return "1" if self._preamp else "0"
        if upper == "FREQ:CENT?" or upper in {"CHP:FREQ:CENT?", "ACP:FREQ:CENT?", "OBW:FREQ:CENT?"}:
            return _format_number(self._center_hz)
        if upper == "FREQ:SPAN?":
            return _format_number(self._span_hz)
        if upper == "DISP:WIND:TRAC:Y:RLEV?":
            return _format_number(self._reference_level_dbm)
        if upper == "BAND:RES?":
            return _format_number(self._rbw_hz)
        if upper == "BAND:RES:AUTO?":
            return "1" if self._rbw_auto else "0"
        if upper == "BAND:VID?":
            return _format_number(self._vbw_hz)
        if upper == "BAND:VID:AUTO?":
            return "1" if self._vbw_auto else "0"
        if upper == "SWE:POIN?":
            return str(self._points)
        if upper == "DET:TRAC1?":
            return self._detector
        if upper == "TRIG:SAN:SOUR?":
            return self._trigger
        if upper == "TRAC? TRACE1":
            self._require_completed_acquisition("TRAC? TRACE1")
            return ",".join(_format_number(value) for value in self._trace_values())
        if upper == "CALC:MARK1:X?":
            self._require_completed_acquisition("CALC:MARK1:X?")
            return _format_number(self._marker_frequency_hz)
        if upper == "CALC:MARK1:Y?":
            self._require_completed_acquisition("CALC:MARK1:Y?")
            return _format_number(self._marker_level_dbm)
        if upper in {"READ:CHP?", "READ:ACP?", "READ:OBW?"}:
            requested = upper[5:-1]
            self._measurement = requested
            self._acquisition_complete = True
            return self._powersuite_payload(requested)
        if upper in {"FETC:CHP?", "FETC:ACP?", "FETC:OBW?"}:
            requested = upper[5:-1]
            if self._measurement != requested:
                raise RuntimeError(
                    "FETC requested {} while {} is selected".format(requested, self._measurement)
                )
            self._require_completed_acquisition(upper)
            return self._powersuite_payload(requested)
        try:
            return self._responses[upper]
        except KeyError as error:
            raise RuntimeError("No N9020B dry-run response for {!r}".format(normalized)) from error

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.history.append(Operation("CLOSE", "transport closed"))

    def _trace_values(self) -> List[float]:
        values: List[float] = []
        rbw_noise_shift = 10.0 * math.log10(max(self._rbw_hz, 1.0) / 100e3)
        for index in range(self._points):
            normalized = (index - (self._points - 1) / 2.0) / max(1.0, self._points - 1)
            main = -18.5 - 10.0 * (normalized / 0.12) ** 8
            lower_adjacent = -63.0 - 12.0 * ((normalized + 0.31) / 0.10) ** 2
            upper_adjacent = -61.5 - 12.0 * ((normalized - 0.31) / 0.10) ** 2
            deterministic_ripple = 1.1 * math.sin(index * 0.37)
            noise = -103.0 + rbw_noise_shift + deterministic_ripple
            values.append(max(main, lower_adjacent, upper_adjacent, noise))
        return values

    def _frequency_at(self, index: int) -> float:
        if self._points <= 1:
            return self._center_hz
        return self._center_hz - self._span_hz / 2.0 + self._span_hz * index / (self._points - 1)

    def _powersuite_payload(self, measurement: str) -> str:
        payloads = {
            "CHP": "-18.50",
            "ACP": "-18.50,-44.70,-43.90",
            "OBW": "18400000,-18.42",
        }
        return payloads[measurement]

    def _require_completed_acquisition(self, command: str) -> None:
        if not self._acquisition_complete:
            raise RuntimeError("{} requested before a completed acquisition".format(command))

    def _push_error(self, record: str) -> None:
        self._errors.insert(max(0, len(self._errors) - 1), record)


class FakeTransport(DryRunTransport):
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.fail_on: str | None = kwargs.pop("fail_on", None)  # type: ignore[assignment]
        self.response_sequences: Dict[str, List[str]] = kwargs.pop("response_sequences", {})  # type: ignore[assignment]
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]

    def write(self, command: str) -> None:
        if self.fail_on == command:
            raise TimeoutError("simulated timeout for {}".format(command))
        super().write(command)

    def query(self, command: str) -> str:
        if self.fail_on == command:
            raise TimeoutError("simulated timeout for {}".format(command))
        sequence = self.response_sequences.get(command)
        if sequence:
            self.history.append(Operation("QUERY", command.strip()))
            return sequence.pop(0)
        return super().query(command)


class PyVisaTransport:
    """Thin PyVISA wrapper opened only after explicit ``--execute`` validation."""

    def __init__(self, manager: object, instrument: object) -> None:
        self._manager = manager
        self._instrument = instrument
        self.closed = False

    @classmethod
    def open(cls, resource: str, timeout_ms: int = 30_000) -> "PyVisaTransport":
        try:
            import pyvisa  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError(
                "Install PyVISA and Keysight IO Libraries before using --execute"
            ) from error
        manager = pyvisa.ResourceManager()
        try:
            instrument = manager.open_resource(resource)
            instrument.timeout = timeout_ms
            instrument.read_termination = "\n"
            instrument.write_termination = "\n"
        except Exception:
            manager.close()
            raise
        return cls(manager, instrument)

    def write(self, command: str) -> None:
        self._instrument.write(command)

    def query(self, command: str) -> str:
        return str(self._instrument.query(command)).strip()

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        try:
            self._instrument.close()
        finally:
            self._manager.close()


def format_history(history: List[Operation]) -> str:
    return "\n".join("{:<6} {}".format(item.kind, item.command) for item in history)


def _parse_bool(value: str) -> bool:
    normalized = value.strip().upper()
    if normalized in {"1", "ON"}:
        return True
    if normalized in {"0", "OFF"}:
        return False
    raise ValueError("Expected ON/OFF or 1/0, got {!r}".format(value))


def _parse_number(value: str) -> float:
    match = re.match(r"^\s*([-+]?\d+(?:\.\d+)?(?:E[-+]?\d+)?)", value, re.IGNORECASE)
    if not match:
        raise ValueError("Expected numeric SCPI value, got {!r}".format(value))
    return float(match.group(1))


def _parse_frequency_hz(value: str) -> float:
    upper = value.strip().upper()
    for suffix, scale in (("GHZ", 1e9), ("MHZ", 1e6), ("KHZ", 1e3), ("HZ", 1.0)):
        if upper.endswith(suffix):
            return float(upper[: -len(suffix)]) * scale
    return float(upper)


def _format_number(value: float) -> str:
    return "{:.12g}".format(value)
