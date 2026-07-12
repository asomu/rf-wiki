from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Protocol


class Transport(Protocol):
    def write(self, message: str) -> None: ...
    def query(self, message: str) -> str: ...
    def close(self) -> None: ...


DEFAULT_RESPONSES = {
    "*IDN?": "Keysight Technologies,E5080B,MY00000000,A.20.25.03",
    "*OPT?": "2K0",
    "*OPC?": "1",
    "OUTP?": "0",
    "SOUR1:POW1?": "-30.000000",
    "SYST:POW1:LIM?": "-20.000000",
    "SYST:POW1:LIM:STAT?": "1",
    "SENS1:FREQ:STAR?": "1000000000.000000",
    "SENS1:FREQ:STOP?": "6000000000.000000",
    "SENS1:SWE:POIN?": "201",
    "SENS1:BWID?": "1000.000000",
    "CALC1:PAR:MNUM?": "1",
    "FORM:DATA?": "ASC,+0",
    "SENS1:CORR:STAT?": "1",
    "SENS1:CORR:CSET:ACT? NAME": '"TrainingCalSet"',
    "SYST:ERR?": '+0,"No error"',
}


@dataclass
class DryRunTransport:
    responses: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_RESPONSES))
    transcript: list[tuple[str, str]] = field(default_factory=list)

    def _apply_write(self, message: str) -> None:
        if message == "OUTP OFF":
            self.responses["OUTP?"] = "0"
        elif message == "OUTP ON":
            self.responses["OUTP?"] = "1"
        elif message == "SYST:POW1:LIM:STAT ON":
            self.responses["SYST:POW1:LIM:STAT?"] = "1"
        elif message == "SYST:POW1:LIM:STAT OFF":
            self.responses["SYST:POW1:LIM:STAT?"] = "0"
        elif message.upper().startswith("FORM:DATA ASC"):
            self.responses["FORM:DATA?"] = "ASC,+0"
        elif message.upper().startswith("FORM:DATA REAL,32"):
            self.responses["FORM:DATA?"] = "REAL,+32"
        for prefix, query in (
            ("SOUR1:POW1 ", "SOUR1:POW1?"),
            ("SYST:POW1:LIM ", "SYST:POW1:LIM?"),
            ("SENS1:FREQ:STAR ", "SENS1:FREQ:STAR?"),
            ("SENS1:FREQ:STOP ", "SENS1:FREQ:STOP?"),
            ("SENS1:SWE:POIN ", "SENS1:SWE:POIN?"),
            ("SENS1:BWID ", "SENS1:BWID?"),
        ):
            if message.startswith(prefix):
                match = re.search(r"[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?", message[len(prefix):], re.IGNORECASE)
                if match:
                    self.responses[query] = match.group(0)

    def write(self, message: str) -> None:
        self._apply_write(message)
        self.transcript.append(("write", message))
        print(f"WRITE {message}")

    def query(self, message: str) -> str:
        response = self.responses.get(message, "0")
        self.transcript.append(("query", message))
        print(f"QUERY {message}")
        print(f"READ  {response}")
        return response

    def close(self) -> None:
        self.transcript.append(("close", ""))
        print("CLOSE")


@dataclass
class FakeTransport(DryRunTransport):
    fail_on: str | None = None
    response_sequences: dict[str, list[str]] = field(default_factory=dict)

    def write(self, message: str) -> None:
        if self.fail_on == message:
            raise TimeoutError(f"simulated timeout for {message}")
        self._apply_write(message)
        self.transcript.append(("write", message))

    def query(self, message: str) -> str:
        if self.fail_on == message:
            raise TimeoutError(f"simulated timeout for {message}")
        sequence = self.response_sequences.get(message)
        response = sequence.pop(0) if sequence else self.responses.get(message, "0")
        self.transcript.append(("query", message))
        return response

    def close(self) -> None:
        self.transcript.append(("close", ""))


class PyVisaTransport:
    def __init__(self, resource: str, timeout_ms: int = 20_000) -> None:
        try:
            import pyvisa  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError("Install PyVISA and Keysight IO Libraries before --execute") from error
        self._manager = pyvisa.ResourceManager()
        self._instrument = self._manager.open_resource(resource)
        self._instrument.timeout = timeout_ms
        self._instrument.read_termination = "\n"
        self._instrument.write_termination = "\n"

    def write(self, message: str) -> None:
        self._instrument.write(message)

    def query(self, message: str) -> str:
        return str(self._instrument.query(message)).strip()

    def close(self) -> None:
        try:
            self._instrument.close()
        finally:
            self._manager.close()
