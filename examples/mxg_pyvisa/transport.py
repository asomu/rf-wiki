"""Small transport boundary that keeps PyVISA optional in dry-run mode."""

from dataclasses import dataclass
from typing import Dict, List, Protocol


class ScpiTransport(Protocol):
    """Minimum I/O surface used by the example driver."""

    def write(self, command: str) -> None:
        ...

    def query(self, command: str) -> str:
        ...

    def write_raw(self, data: bytes) -> None:
        ...

    def close(self) -> None:
        ...


@dataclass(frozen=True)
class Operation:
    kind: str
    summary: str
    byte_count: int = 0


class DryRunTransport:
    """Deterministic fake MXG used by the default CLI mode and unit tests."""

    def __init__(
        self,
        idn: str = "Keysight Technologies,N5182B,RF-WIKI-DEMO,B.01.96",
        options: str = "506,656",
    ) -> None:
        self.history: List[Operation] = []
        self.closed = False
        self._responses: Dict[str, str] = {
            "*IDN?": idn,
            "*OPT?": options,
            "*OPC?": "1",
            "SYST:ERR?": '+0,"No error"',
            "SOUR:FREQ:CW?": "1000000000",
            "SOUR:POW:LEV:IMM:AMPL?": "-30",
            "OUTP?": "0",
            "OUTP:MOD?": "0",
            "SOUR:RAD:ARB:WAV?": '"WFM1:RF_WIKI_IQ"',
            "SOUR:RAD:ARB:SCL:RATE?": "100000000",
            "SOUR:RAD:ARB:RSC?": "70",
            "SOUR:RAD:ARB:STAT?": "0",
        }

    def write(self, command: str) -> None:
        normalized = command.strip()
        self.history.append(Operation("WRITE", normalized))
        upper = normalized.upper()

        if upper.startswith("SOUR:FREQ:CW "):
            self._responses["SOUR:FREQ:CW?"] = normalized.split(None, 1)[1].rstrip(
                "HhZz"
            )
        elif upper.startswith("SOUR:POW:LEV:IMM:AMPL "):
            value = normalized.split(None, 1)[1]
            self._responses["SOUR:POW:LEV:IMM:AMPL?"] = value.upper().replace(
                "DBM", ""
            )
        elif upper in {"OUTP ON", "OUTP:STAT ON"}:
            self._responses["OUTP?"] = "1"
        elif upper in {"OUTP OFF", "OUTP:STAT OFF"}:
            self._responses["OUTP?"] = "0"
        elif upper == "OUTP:MOD ON":
            self._responses["OUTP:MOD?"] = "1"
        elif upper == "OUTP:MOD OFF":
            self._responses["OUTP:MOD?"] = "0"
        elif upper.startswith("SOUR:RAD:ARB:WAV "):
            self._responses["SOUR:RAD:ARB:WAV?"] = normalized.split(None, 1)[1]
        elif upper.startswith("SOUR:RAD:ARB:SCL:RATE "):
            self._responses["SOUR:RAD:ARB:SCL:RATE?"] = normalized.split(None, 1)[
                1
            ].upper().replace("HZ", "")
        elif upper.startswith("SOUR:RAD:ARB:RSC "):
            self._responses["SOUR:RAD:ARB:RSC?"] = normalized.split(None, 1)[1]
        elif upper == "SOUR:RAD:ARB:STAT ON":
            self._responses["SOUR:RAD:ARB:STAT?"] = "1"
        elif upper == "SOUR:RAD:ARB:STAT OFF":
            self._responses["SOUR:RAD:ARB:STAT?"] = "0"

    def query(self, command: str) -> str:
        normalized = command.strip()
        self.history.append(Operation("QUERY", normalized))
        try:
            return self._responses[normalized.upper()]
        except KeyError as exc:
            raise RuntimeError("No dry-run response for {!r}".format(normalized)) from exc

    def write_raw(self, data: bytes) -> None:
        prefix = data.split(b"#", 1)[0].decode("ascii", errors="replace").rstrip()
        self.history.append(Operation("WRITE_RAW", prefix + " <binary block>", len(data)))

    def close(self) -> None:
        self.closed = True
        self.history.append(Operation("CLOSE", "transport closed"))


class VisaTransport:
    """Thin wrapper around a PyVISA message-based resource."""

    def __init__(self, resource_manager: object, resource: object) -> None:
        self._resource_manager = resource_manager
        self._resource = resource
        self.closed = False

    @classmethod
    def open(cls, resource_name: str, timeout_ms: int = 10000) -> "VisaTransport":
        try:
            import pyvisa  # type: ignore
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "PyVISA is required only for --execute. Install examples/mxg_pyvisa/requirements.txt."
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

    def write_raw(self, data: bytes) -> None:
        self._resource.write_raw(data)

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        try:
            self._resource.close()
        finally:
            self._resource_manager.close()


def format_dry_run(history: List[Operation]) -> str:
    lines: List[str] = []
    for operation in history:
        if operation.kind == "WRITE_RAW":
            lines.append(
                "{:<9} {} ({} bytes)".format(
                    operation.kind, operation.summary, operation.byte_count
                )
            )
        else:
            lines.append("{:<9} {}".format(operation.kind, operation.summary))
    return "\n".join(lines)
