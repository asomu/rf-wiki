"""Transport boundary; PyVISA is imported only for explicit real execution."""

from dataclasses import dataclass
from typing import Dict, List, Protocol


class ScpiTransport(Protocol):
    def write(self, command: str) -> None:
        ...

    def query(self, command: str) -> str:
        ...

    def close(self) -> None:
        ...


@dataclass(frozen=True)
class Operation:
    kind: str
    command: str


class DryRunTransport:
    """Deterministic U2061XA fake used by default and by unit tests."""

    def __init__(
        self,
        idn: str = "Keysight Technologies,U2061XA,RF-WIKI-DEMO,A.03.16",
        measurement_dbm: float = -20.0,
    ) -> None:
        self.history: List[Operation] = []
        self.closed = False
        self._errors: List[str] = ['+0,"No error"']
        self._trigger_source = "IMM"
        self._continuous_enabled = True
        self._armed = False
        self._measurement_complete = False
        self._measurement_dbm = measurement_dbm
        self._responses: Dict[str, str] = {
            "*IDN?": idn,
            "*OPT?": '""',
            "*OPC?": "1",
            "CAL:ALL?": "0",
            "SENS:DET:FUNC?": "AVER",
            "SENS:FREQ?": "3500000000",
            "SENS:SWE:APER?": "0.001",
            "SENS:AVER:COUN:AUTO?": "1",
            "TRIG:SOUR?": "IMM",
            "INIT:CONT?": "1",
            "READ?": str(measurement_dbm),
            "FETC?": str(measurement_dbm),
        }

    def write(self, command: str) -> None:
        normalized = command.strip()
        self.history.append(Operation("WRITE", normalized))
        upper = normalized.upper()
        if upper == "*CLS":
            self._errors = ['+0,"No error"']
        elif upper.startswith("SENS:DET:FUNC "):
            self._responses["SENS:DET:FUNC?"] = upper.split(None, 1)[1]
        elif upper.startswith("SENS:FREQ "):
            raw = upper.split(None, 1)[1]
            self._responses["SENS:FREQ?"] = str(_parse_frequency_hz(raw))
        elif upper.startswith("SENS:SWE:APER "):
            raw = upper.split(None, 1)[1]
            self._responses["SENS:SWE:APER?"] = str(_parse_seconds(raw))
        elif upper.startswith("SENS:AVER:COUN:AUTO "):
            value = upper.split(None, 1)[1]
            self._responses["SENS:AVER:COUN:AUTO?"] = "1" if value in {"1", "ON"} else "0"
        elif upper.startswith("TRIG:SOUR "):
            self._trigger_source = upper.split(None, 1)[1]
            self._responses["TRIG:SOUR?"] = self._trigger_source
        elif upper.startswith("INIT:CONT "):
            value = upper.split(None, 1)[1]
            self._continuous_enabled = value in {"ON", "1"}
            self._responses["INIT:CONT?"] = "1" if self._continuous_enabled else "0"
        elif upper in {"INIT", "INIT:IMM"}:
            self._measurement_complete = self._trigger_source == "IMM"
            self._armed = not self._measurement_complete
        elif upper == "*TRG":
            if not self._armed:
                self._push_error('-211,"Trigger ignored"')
            elif self._trigger_source != "BUS":
                self._push_error('-221,"Settings conflict"')
            else:
                self._armed = False
                self._measurement_complete = True
        elif upper in {"TRIG:IMM", "TRIGGER:IMMEDIATE"}:
            if not self._armed:
                self._push_error('-211,"Trigger ignored"')
            else:
                self._armed = False
                self._measurement_complete = True
        elif upper == "ABOR":
            self._armed = False

    def query(self, command: str) -> str:
        normalized = command.strip().upper()
        self.history.append(Operation("QUERY", normalized))
        if normalized == "SYST:ERR?":
            if len(self._errors) > 1:
                return self._errors.pop(0)
            return self._errors[0]
        if normalized == "READ?":
            if self._trigger_source != "IMM":
                raise RuntimeError(
                    "READ? would wait for a non-immediate trigger in this deterministic fake"
                )
            self._measurement_complete = True
            return str(self._measurement_dbm)
        if normalized == "FETC?":
            if self._armed or not self._measurement_complete:
                raise RuntimeError("FETC? requested before a completed trigger event")
            return str(self._measurement_dbm)
        try:
            return self._responses[normalized]
        except KeyError as exc:
            raise RuntimeError("No dry-run response for {!r}".format(normalized)) from exc

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.history.append(Operation("CLOSE", "transport closed"))

    def _push_error(self, error: str) -> None:
        """Append before the permanent +0 sentinel to preserve FIFO order."""

        self._errors.insert(max(0, len(self._errors) - 1), error)


class VisaTransport:
    """Thin PyVISA wrapper for a USB-TMC message-based resource."""

    def __init__(self, resource_manager: object, resource: object) -> None:
        self._resource_manager = resource_manager
        self._resource = resource
        self.closed = False

    @classmethod
    def open(cls, resource_name: str, timeout_ms: int = 10_000) -> "VisaTransport":
        try:
            import pyvisa  # type: ignore
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "PyVISA is required only for --execute. Install examples/u2061xa_pyvisa/requirements.txt."
            ) from exc

        resource_manager = pyvisa.ResourceManager()
        try:
            resource = resource_manager.open_resource(resource_name)
            resource.timeout = timeout_ms
            resource.write_termination = "\n"
            resource.read_termination = "\n"
        except Exception:
            resource_manager.close()
            raise
        return cls(resource_manager, resource)

    def write(self, command: str) -> None:
        self._resource.write(command)

    def query(self, command: str) -> str:
        return str(self._resource.query(command)).strip()

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        try:
            self._resource.close()
        finally:
            self._resource_manager.close()


def _parse_frequency_hz(value: str) -> float:
    upper = value.strip().upper()
    scales = (("GHZ", 1e9), ("MHZ", 1e6), ("KHZ", 1e3), ("HZ", 1.0))
    for suffix, scale in scales:
        if upper.endswith(suffix):
            return float(upper[: -len(suffix)]) * scale
    return float(upper)


def _parse_seconds(value: str) -> float:
    upper = value.strip().upper()
    scales = (("MS", 1e-3), ("US", 1e-6), ("NS", 1e-9), ("S", 1.0))
    for suffix, scale in scales:
        if upper.endswith(suffix):
            return float(upper[: -len(suffix)]) * scale
    return float(upper)


def format_history(history: List[Operation]) -> str:
    return "\n".join("{:<6} {}".format(item.kind, item.command) for item in history)
