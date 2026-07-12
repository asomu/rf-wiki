"""U2061XA-specific SCPI adapter with bounded diagnostics."""

from dataclasses import dataclass
import math
import re
from typing import List, Optional, Tuple

from .transport import ScpiTransport


SUPPORTED_MODEL = "U2061XA"
FIRMWARE_SCOPE = "A.03.16"
MIN_FREQUENCY_HZ = 10_000_000.0
MAX_FREQUENCY_HZ = 6_000_000_000.0
ERROR_QUEUE_CAPACITY = 30
ERROR_DRAIN_MAX_QUERIES = ERROR_QUEUE_CAPACITY + 1


class U2061Error(RuntimeError):
    pass


class ModelMismatchError(U2061Error):
    pass


class ScpiError(U2061Error):
    def __init__(self, context: str, errors: List[str]) -> None:
        super().__init__("{}: {}".format(context, "; ".join(errors)))
        self.context = context
        self.errors = errors


class CleanupError(U2061Error):
    """Raised when acquisition abort or transport close cannot be confirmed."""


@dataclass(frozen=True)
class InstrumentIdentity:
    vendor: str
    model: str
    serial: str
    firmware: str

    @classmethod
    def parse(cls, response: str) -> "InstrumentIdentity":
        fields = [field.strip() for field in response.strip().split(",")]
        if len(fields) < 4:
            raise ModelMismatchError("Unexpected *IDN? response: {!r}".format(response))
        return cls(fields[0], fields[1].upper(), fields[2], fields[3])


@dataclass(frozen=True)
class AbortReport:
    aborted: bool
    failures: Tuple[str, ...]

    @property
    def ok(self) -> bool:
        return self.aborted and not self.failures


class U2061Controller:
    def __init__(self, transport: ScpiTransport) -> None:
        self.transport = transport
        self.identity: Optional[InstrumentIdentity] = None

    def identify(self) -> InstrumentIdentity:
        identity = InstrumentIdentity.parse(self.transport.query("*IDN?"))
        vendor = identity.vendor.upper()
        if "KEYSIGHT" not in vendor and "AGILENT" not in vendor:
            raise ModelMismatchError("Expected Keysight/Agilent, got {!r}".format(identity.vendor))
        if identity.model != SUPPORTED_MODEL:
            raise ModelMismatchError(
                "This example supports {} only; connected model is {}".format(
                    SUPPORTED_MODEL, identity.model
                )
            )
        if identity.firmware.upper() != FIRMWARE_SCOPE.upper():
            raise ModelMismatchError(
                "This example is pinned to {} firmware {}; connected firmware is {}".format(
                    SUPPORTED_MODEL, FIRMWARE_SCOPE, identity.firmware
                )
            )
        self.identity = identity
        return identity

    def drain_errors(self) -> List[str]:
        errors: List[str] = []
        for _ in range(ERROR_DRAIN_MAX_QUERIES):
            response = self.transport.query("SYST:ERR?").strip()
            match = re.match(r"^\s*([+-]?\d+)", response)
            if not match:
                raise ScpiError(
                    "SCPI error queue returned malformed data",
                    errors + [repr(response)],
                )
            if int(match.group(1)) == 0:
                return errors
            errors.append(response)
        raise ScpiError(
            "SCPI error queue did not terminate with +0 within 31 queries",
            errors,
        )

    def assert_no_errors(self, context: str) -> None:
        errors = self.drain_errors()
        if errors:
            raise ScpiError(context, errors)

    def clear_status(self) -> None:
        self.transport.write("*CLS")

    def wait_complete(self) -> None:
        response = self.transport.query("*OPC?").strip()
        if response != "1":
            raise ScpiError("Operation did not complete", [response])

    def zero_and_calibrate(self) -> None:
        self.transport.write("CAL:ZERO:TYPE INT")
        response = self.transport.query("CAL:ALL?").strip()
        if response != "0":
            raise ScpiError("Zero/calibration failed", [response])
        self.assert_no_errors("Zero/calibration")

    def configure_average(
        self,
        frequency_hz: float,
        aperture_seconds: float,
        auto_average: bool = True,
    ) -> None:
        self._validate_frequency(frequency_hz)
        minimum_aperture = 20e-6 if frequency_hz >= 300e6 else 50e-6
        if not math.isfinite(aperture_seconds) or not minimum_aperture <= aperture_seconds <= 200e-3:
            raise ValueError(
                "aperture_seconds must be between {} and 0.2 at this frequency".format(
                    minimum_aperture
                )
            )
        self.transport.write("SENS:DET:FUNC AVER")
        self.transport.write("SENS:FREQ {}HZ".format(_format_number(frequency_hz)))
        self.transport.write("SENS:SWE:APER {}S".format(_format_number(aperture_seconds)))
        self.transport.write("SENS:AVER:COUN:AUTO {}".format("ON" if auto_average else "OFF"))
        self._query_back("SENS:DET:FUNC?", "AVER")
        self._query_float("SENS:FREQ?", frequency_hz, 1.0)
        self._query_float("SENS:SWE:APER?", aperture_seconds, 100e-9)
        self._query_back("SENS:AVER:COUN:AUTO?", "1" if auto_average else "0")
        self.assert_no_errors("Average configuration")

    def configure_trigger(
        self,
        source: str,
        level_dbm: float = -20.0,
        delay_seconds: float = 0.0,
        holdoff_seconds: float = 1e-6,
    ) -> None:
        normalized = source.strip().upper()
        if normalized not in {"IMM", "INT", "EXT", "BUS", "HOLD"}:
            raise ValueError("Unsupported trigger source {!r}".format(source))
        self.transport.write("TRIG:SOUR {}".format(normalized))
        if normalized == "INT":
            if not -48 <= level_dbm <= 20:
                raise ValueError("level_dbm must be between -48 and +20")
            self.transport.write("TRIG:LEV {}DBM".format(_format_number(level_dbm)))
        if normalized in {"INT", "EXT"}:
            self.transport.write("TRIG:SLOP POS")
            self.transport.write("TRIG:DEL {}S".format(_format_number(delay_seconds)))
            self.transport.write("TRIG:HOLD {}S".format(_format_number(holdoff_seconds)))
        self._query_back("TRIG:SOUR?", normalized)
        self.assert_no_errors("Trigger configuration")

    def read_immediate_dbm(self) -> float:
        response = self.transport.query("READ?").strip()
        value = float(response)
        if not math.isfinite(value) or value > 1e30:
            raise ScpiError("Invalid power reading", [response])
        self.assert_no_errors("Power acquisition")
        return value

    def arm(self) -> None:
        self.transport.write("INIT:CONT OFF")
        self.transport.write("INIT")

    def send_bus_trigger(self) -> None:
        """Deliver the BUS event after INIT; never use *TRG as an arm command."""

        self.transport.write("*TRG")

    def send_immediate_trigger(self) -> None:
        """Release an intentionally armed manual/HOLD acquisition once."""

        self.transport.write("TRIG:IMM")

    def fetch_dbm(self) -> float:
        response = self.transport.query("FETC?").strip()
        value = float(response)
        if not math.isfinite(value) or value > 1e30:
            raise ScpiError("Invalid fetched power", [response])
        self.assert_no_errors("Triggered acquisition")
        return value

    def abort_acquisition(self) -> AbortReport:
        failures: List[str] = []
        try:
            self.transport.write("ABOR")
            aborted = True
        except Exception as error:
            failures.append("ABOR: {}".format(error))
            aborted = False
        return AbortReport(aborted, tuple(failures))

    def _validate_frequency(self, frequency_hz: float) -> None:
        if not math.isfinite(frequency_hz) or not MIN_FREQUENCY_HZ <= frequency_hz <= MAX_FREQUENCY_HZ:
            raise ValueError("frequency_hz must be within the U2061XA 10 MHz to 6 GHz range")

    def _query_back(self, command: str, expected: str) -> None:
        actual = self.transport.query(command).strip().upper()
        if actual != expected.upper():
            raise ScpiError("Query-back mismatch for {}".format(command), [actual])

    def _query_float(self, command: str, expected: float, tolerance: float) -> None:
        actual = float(self.transport.query(command).strip())
        if not math.isclose(actual, expected, rel_tol=0.0, abs_tol=tolerance):
            raise ScpiError(
                "Query-back mismatch for {}".format(command),
                ["expected {}, got {}".format(expected, actual)],
            )


def _format_number(value: float) -> str:
    return "{:.12g}".format(value)
