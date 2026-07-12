"""Small, pinned N9020B Swept-SA adapter with explicit query-back."""

from __future__ import annotations

from dataclasses import dataclass
import math
import re
from typing import Tuple

from .transport import ScpiTransport


SUPPORTED_MODEL = "N9020B"
FIRMWARE_SCOPE = "A.43.49"
REQUIRED_OPTIONS = frozenset({"526", "B1X", "MPB", "P26"})
PROFILE_MAX_FREQUENCY_HZ = 26.5e9
ERROR_DRAIN_MAX_QUERIES = 32
SAFE_BASELINE_ATTENUATION_DB = 40.0
SUPPORTED_DETECTORS = frozenset({"NORM", "POS", "SAMP", "NEG", "AVER"})
SUPPORTED_TRIGGERS = frozenset({"IMM", "EXT1", "RFB"})
SUPPORTED_POWERSUITE = frozenset({"CHP", "ACP", "OBW"})


class N9020BError(RuntimeError):
    pass


class ProfileMismatchError(N9020BError):
    pass


class ScpiError(N9020BError):
    def __init__(self, context: str, records: Tuple[str, ...]) -> None:
        super().__init__("{}: {}".format(context, "; ".join(records)))
        self.context = context
        self.records = records


class CleanupError(N9020BError):
    pass


@dataclass(frozen=True)
class InstrumentIdentity:
    vendor: str
    model: str
    serial: str
    firmware: str
    options: Tuple[str, ...]


@dataclass(frozen=True)
class SpectrumTrace:
    frequencies_hz: Tuple[float, ...]
    levels_dbm: Tuple[float, ...]
    marker_frequency_hz: float
    marker_level_dbm: float


@dataclass(frozen=True)
class PowerSuiteResult:
    measurement: str
    raw_values: Tuple[float, ...]


class N9020B:
    """N9020B-526/B1X/MPB/P26 adapter for Spectrum Analyzer/Swept SA only."""

    def __init__(self, transport: ScpiTransport) -> None:
        self.transport = transport
        self.identity: InstrumentIdentity | None = None
        self._configuration_verified = False
        self._measurement = "SAN"

    def identify(self) -> InstrumentIdentity:
        idn = self.transport.query("*IDN?").strip()
        option_response = self.transport.query("*OPT?").strip().strip('"')
        fields = [field.strip() for field in idn.split(",")]
        if len(fields) < 4:
            raise ProfileMismatchError("Unexpected *IDN? response {!r}".format(idn))
        vendor, model, serial, firmware = fields[:4]
        if "KEYSIGHT" not in vendor.upper() or model.upper() != SUPPORTED_MODEL:
            raise ProfileMismatchError(
                "Expected Keysight {}, got {!r}".format(SUPPORTED_MODEL, idn)
            )
        if firmware.upper() != FIRMWARE_SCOPE:
            raise ProfileMismatchError(
                "Examples are pinned to firmware {}, got {}".format(FIRMWARE_SCOPE, firmware)
            )
        options = tuple(
            token.strip().upper()
            for token in re.split(r"[,;]", option_response)
            if token.strip()
        )
        missing = sorted(REQUIRED_OPTIONS.difference(options))
        if missing:
            raise ProfileMismatchError(
                "N9020B learning profile requires options {}; missing {} from {!r}".format(
                    ",".join(sorted(REQUIRED_OPTIONS)), ",".join(missing), option_response
                )
            )
        self.identity = InstrumentIdentity(vendor, model.upper(), serial, firmware, options)
        return self.identity

    def abort(self) -> None:
        self.transport.write("ABOR")

    def clear_status(self) -> None:
        self.transport.write("*CLS")

    def select_default_swept_sa(self) -> None:
        self._configuration_verified = False
        self._measurement = "SAN"
        self.transport.write("CONF:SAN:NDEF")

    def set_single_acquisition(self) -> None:
        self.transport.write("INIT:CONT OFF")

    def set_input_protection(self, attenuation_db: float = SAFE_BASELINE_ATTENUATION_DB) -> None:
        if not math.isfinite(attenuation_db) or not 0.0 <= attenuation_db <= 70.0:
            raise ValueError("attenuation_db must be within this example's 0 to 70 dB guard range")
        self._configuration_verified = False
        self.transport.write("POW:ATT:AUTO OFF")
        self.transport.write("POW:ATT {}DB".format(_format_number(attenuation_db)))
        self.transport.write("POW:GAIN OFF")

    def verify_safe_baseline(self, attenuation_db: float = SAFE_BASELINE_ATTENUATION_DB) -> None:
        actual_continuous = _parse_bool(self.transport.query("INIT:CONT?"))
        actual_attenuation_auto = _parse_bool(self.transport.query("POW:ATT:AUTO?"))
        actual_attenuation = float(self.transport.query("POW:ATT?"))
        actual_preamp = _parse_bool(self.transport.query("POW:GAIN?"))
        mismatches = []
        if actual_continuous:
            mismatches.append("INIT:CONT expected OFF")
        if actual_attenuation_auto:
            mismatches.append("POW:ATT:AUTO expected OFF")
        if not math.isclose(actual_attenuation, attenuation_db, rel_tol=0.0, abs_tol=1e-3):
            mismatches.append(
                "POW:ATT expected {} dB, got {} dB".format(attenuation_db, actual_attenuation)
            )
        if actual_preamp:
            mismatches.append("POW:GAIN expected OFF")
        if mismatches:
            raise ScpiError("Safe input baseline query-back failed", tuple(mismatches))

    def configure_spectrum(
        self,
        *,
        center_hz: float,
        span_hz: float,
        reference_level_dbm: float,
        rbw_hz: float,
        vbw_hz: float,
        points: int,
        detector: str,
        trigger_source: str,
    ) -> None:
        self._require_profile()
        detector = detector.strip().upper()
        trigger_source = trigger_source.strip().upper()
        _validate_spectrum_settings(center_hz, span_hz, rbw_hz, vbw_hz, points)
        if detector not in SUPPORTED_DETECTORS:
            raise ValueError("detector must be one of {}".format(", ".join(sorted(SUPPORTED_DETECTORS))))
        if trigger_source not in SUPPORTED_TRIGGERS:
            raise ValueError(
                "trigger_source must be one of {}".format(", ".join(sorted(SUPPORTED_TRIGGERS)))
            )

        self._configuration_verified = False
        commands = (
            "FREQ:CENT {}HZ".format(_format_number(center_hz)),
            "FREQ:SPAN {}HZ".format(_format_number(span_hz)),
            "DISP:WIND:TRAC:Y:RLEV {}DBM".format(_format_number(reference_level_dbm)),
            "BAND:RES:AUTO OFF",
            "BAND:RES {}HZ".format(_format_number(rbw_hz)),
            "BAND:VID:AUTO OFF",
            "BAND:VID {}HZ".format(_format_number(vbw_hz)),
            "SWE:POIN {}".format(points),
            "DET:TRAC1 {}".format(detector),
            "TRIG:SAN:SOUR {}".format(trigger_source),
            "FORM:DATA ASC",
        )
        for command in commands:
            self.transport.write(command)

    def verify_spectrum_configuration(
        self,
        *,
        center_hz: float,
        span_hz: float,
        reference_level_dbm: float,
        rbw_hz: float,
        vbw_hz: float,
        points: int,
        detector: str,
        trigger_source: str,
    ) -> None:
        expected_numeric = {
            "FREQ:CENT?": center_hz,
            "FREQ:SPAN?": span_hz,
            "DISP:WIND:TRAC:Y:RLEV?": reference_level_dbm,
            "BAND:RES?": rbw_hz,
            "BAND:VID?": vbw_hz,
            "SWE:POIN?": float(points),
        }
        mismatches = []
        for command, expected in expected_numeric.items():
            actual = float(self.transport.query(command))
            tolerance = max(1e-3, abs(expected) * 1e-9)
            if not math.isclose(actual, expected, rel_tol=0.0, abs_tol=tolerance):
                mismatches.append("{} expected {}, got {}".format(command, expected, actual))
        expected_text = {
            "DET:TRAC1?": detector.strip().upper(),
            "TRIG:SAN:SOUR?": trigger_source.strip().upper(),
        }
        for command in ("BAND:RES:AUTO?", "BAND:VID:AUTO?"):
            if _parse_bool(self.transport.query(command)):
                mismatches.append("{} expected OFF".format(command))
        for command, expected in expected_text.items():
            actual = self.transport.query(command).strip().upper()
            if actual != expected:
                mismatches.append("{} expected {}, got {}".format(command, expected, actual))
        transfer_format = self.transport.query("FORM:DATA?").strip().upper().replace(" ", "")
        if not transfer_format.startswith("ASC"):
            mismatches.append("FORM:DATA expected ASCII, got {}".format(transfer_format))
        if mismatches:
            raise ScpiError("Swept-SA configuration query-back failed", tuple(mismatches))
        self._configuration_verified = True

    def initiate_and_wait(self) -> None:
        if not self._configuration_verified:
            raise N9020BError("Acquisition requires successful full configuration query-back")
        self.transport.write("INIT:IMM")
        if self.transport.query("*OPC?").strip() != "1":
            raise ScpiError("Acquisition did not complete", ("*OPC? was not 1",))

    def read_trace(
        self,
        *,
        center_hz: float,
        span_hz: float,
        points: int,
    ) -> SpectrumTrace:
        if not self._configuration_verified:
            raise N9020BError("Trace transfer requires verified configuration")
        raw = self.transport.query("TRAC? TRACE1")
        levels = tuple(float(value) for value in raw.split(",") if value.strip())
        if len(levels) != points:
            raise N9020BError(
                "TRACE1 returned {} points; expected {} from SWE:POIN query-back".format(
                    len(levels), points
                )
            )
        if not all(math.isfinite(value) for value in levels):
            raise N9020BError("TRACE1 contained a non-finite amplitude value")
        if points == 1:
            frequencies = (center_hz,)
        else:
            start_hz = center_hz - span_hz / 2.0
            frequencies = tuple(start_hz + span_hz * index / (points - 1) for index in range(points))
        self.transport.write("CALC:MARK1:STAT ON")
        self.transport.write("CALC:MARK1:MAX")
        marker_frequency_hz = float(self.transport.query("CALC:MARK1:X?"))
        marker_level_dbm = float(self.transport.query("CALC:MARK1:Y?"))
        return SpectrumTrace(frequencies, levels, marker_frequency_hz, marker_level_dbm)

    def configure_powersuite(
        self,
        measurement: str,
        *,
        center_hz: float,
        reference_level_dbm: float,
    ) -> str:
        self._require_profile()
        measurement = measurement.strip().upper()
        if measurement not in SUPPORTED_POWERSUITE:
            raise ValueError("measurement must be CHP, ACP, or OBW")
        if not math.isfinite(center_hz) or not 10.0 <= center_hz <= PROFILE_MAX_FREQUENCY_HZ:
            raise ValueError("center_hz must be within the N9020B-526 10 Hz to 26.5 GHz profile")
        if not math.isfinite(reference_level_dbm):
            raise ValueError("reference_level_dbm must be finite")
        self._configuration_verified = False
        self._measurement = measurement
        self.transport.write("CONF:{}".format(measurement))
        self.transport.write("{}:FREQ:CENT {}HZ".format(measurement, _format_number(center_hz)))
        self.transport.write(
            "DISP:WIND:TRAC:Y:RLEV {}DBM".format(_format_number(reference_level_dbm))
        )
        return measurement

    def verify_powersuite_configuration(
        self,
        *,
        center_hz: float,
        reference_level_dbm: float,
    ) -> None:
        """Called only after safe baseline query-back and a clean error queue."""

        if self._measurement not in SUPPORTED_POWERSUITE:
            raise N9020BError("No CHP/ACP/OBW measurement is selected")
        actual_center_hz = float(self.transport.query("{}:FREQ:CENT?".format(self._measurement)))
        if not math.isclose(
            actual_center_hz,
            center_hz,
            rel_tol=0.0,
            abs_tol=max(1.0, abs(center_hz) * 1e-9),
        ):
            raise ScpiError(
                "PowerSuite center-frequency query-back failed",
                ("expected {}, got {}".format(center_hz, actual_center_hz),),
            )
        actual_reference_level_dbm = float(self.transport.query("DISP:WIND:TRAC:Y:RLEV?"))
        if not math.isclose(
            actual_reference_level_dbm,
            reference_level_dbm,
            rel_tol=0.0,
            abs_tol=1e-3,
        ):
            raise ScpiError(
                "PowerSuite reference-level query-back failed",
                (
                    "expected {}, got {}".format(
                        reference_level_dbm, actual_reference_level_dbm
                    ),
                ),
            )
        self._configuration_verified = True

    def read_powersuite(self) -> PowerSuiteResult:
        """READ initiates and returns a fresh result; it does not reuse prior INIT data."""

        if not self._configuration_verified:
            raise N9020BError("PowerSuite READ requires verified safe configuration")
        return PowerSuiteResult(
            self._measurement,
            _parse_numeric_csv(self.transport.query("READ:{}?".format(self._measurement))),
        )

    def fetch_powersuite(self) -> PowerSuiteResult:
        """FETC returns the result from the last completed INIT acquisition."""

        if not self._configuration_verified:
            raise N9020BError("PowerSuite FETC requires verified safe configuration")
        return PowerSuiteResult(
            self._measurement,
            _parse_numeric_csv(self.transport.query("FETC:{}?".format(self._measurement))),
        )

    def drain_errors(self, maximum_queries: int = ERROR_DRAIN_MAX_QUERIES) -> Tuple[str, ...]:
        nonzero = []
        for _ in range(maximum_queries):
            response = self.transport.query("SYST:ERR?").strip()
            match = re.match(r"^\s*([+-]?\d+)", response)
            if not match:
                raise ScpiError("Malformed error-queue response", tuple(nonzero + [response]))
            if int(match.group(1)) == 0:
                return tuple(nonzero)
            nonzero.append(response)
        raise ScpiError("Error queue did not terminate within bounded drain", tuple(nonzero))

    def assert_no_errors(self, context: str) -> None:
        records = self.drain_errors()
        if records:
            raise ScpiError(context, records)

    def close(self) -> None:
        self.transport.close()

    def _require_profile(self) -> None:
        if self.identity is None:
            raise ProfileMismatchError("Call identify() before applying N9020B-526 settings")


def _validate_spectrum_settings(
    center_hz: float,
    span_hz: float,
    rbw_hz: float,
    vbw_hz: float,
    points: int,
) -> None:
    if not all(math.isfinite(value) for value in (center_hz, span_hz, rbw_hz, vbw_hz)):
        raise ValueError("Spectrum settings must be finite")
    start_hz = center_hz - span_hz / 2.0
    stop_hz = center_hz + span_hz / 2.0
    if span_hz <= 0 or start_hz < 10.0 or stop_hz > PROFILE_MAX_FREQUENCY_HZ:
        raise ValueError("N9020B-526 profile requires 10 Hz <= start < stop <= 26.5 GHz")
    if rbw_hz <= 0 or rbw_hz > span_hz:
        raise ValueError("rbw_hz must be greater than zero and no wider than span_hz")
    if vbw_hz <= 0:
        raise ValueError("vbw_hz must be greater than zero")
    if not 3 <= points <= 20_001:
        raise ValueError("This learning adapter limits points to 3 through 20,001")


def _parse_numeric_csv(response: str) -> Tuple[float, ...]:
    values = tuple(float(value) for value in response.split(",") if value.strip())
    if not values or not all(math.isfinite(value) for value in values):
        raise N9020BError("Measurement response was empty or contained non-finite data")
    return values


def _parse_bool(response: str) -> bool:
    normalized = response.strip().upper()
    if normalized in {"1", "ON"}:
        return True
    if normalized in {"0", "OFF"}:
        return False
    raise ScpiError("Expected boolean query response", (response,))


def _format_number(value: float) -> str:
    return "{:.12g}".format(value)
