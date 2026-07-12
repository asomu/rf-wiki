"""N5182B-specific SCPI driver with explicit safety and capability checks."""

from dataclasses import dataclass
import math
import re
from typing import List, Optional, Set, Tuple

from .transport import ScpiTransport
from .waveform import (
    MIN_N5182B_WAVEFORM_SAMPLES,
    encode_iq_int16,
    ieee4882_definite_block,
    waveform_rms,
)


SUPPORTED_MODEL = "N5182B"
MIN_FREQUENCY_HZ = 9_000.0
FREQUENCY_QUERY_TOLERANCE_HZ = 1.0
POWER_QUERY_TOLERANCE_DB = 0.01
SAMPLE_RATE_QUERY_TOLERANCE_HZ = 1.0
RUNTIME_SCALE_QUERY_TOLERANCE_PERCENT = 0.01
N5182B_ERROR_QUEUE_CAPACITY = 30
N5182B_ERROR_DRAIN_MAX_QUERIES = N5182B_ERROR_QUEUE_CAPACITY + 1


class MxgError(RuntimeError):
    pass


class ModelMismatchError(MxgError):
    pass


class CapabilityError(MxgError):
    pass


class ScpiError(MxgError):
    def __init__(self, context: str, errors: List[str]) -> None:
        super().__init__("{}: {}".format(context, "; ".join(errors)))
        self.context = context
        self.errors = errors


@dataclass(frozen=True)
class CleanupReport:
    """Outcome of the non-throwing session cleanup path."""

    rf_state: str
    failures: Tuple[str, ...]

    @property
    def ok(self) -> bool:
        return self.rf_state == "off" and not self.failures


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
class InstrumentCapabilities:
    option_codes: Set[str]
    max_frequency_hz: float
    max_arb_sample_rate_hz: float

    @property
    def has_arb(self) -> bool:
        return "656" in self.option_codes


def _format_number(value: float) -> str:
    return "{:.12g}".format(value)


class MxgController:
    def __init__(self, transport: ScpiTransport) -> None:
        self.transport = transport
        self.identity: Optional[InstrumentIdentity] = None
        self.capabilities: Optional[InstrumentCapabilities] = None

    def emergency_rf_off(self) -> None:
        """Use the common output command before the connected model is trusted."""

        self.transport.write("OUTP OFF")

    def safe_rf_off(self) -> None:
        """Turn RF off first, then disable modulation and the ARB player."""

        self.transport.write("OUTP OFF")
        self.transport.write("OUTP:MOD OFF")
        if self.capabilities is None or self.capabilities.has_arb:
            self.transport.write("SOUR:RAD:ARB:STAT OFF")

    def cleanup_rf_off(self) -> CleanupReport:
        """Attempt every safe cleanup action and verify the connector output.

        This method never raises for transport failures. The workflow inspects the
        report and converts any incomplete cleanup into a non-zero session result.
        """

        failures: List[str] = []
        rf_off_write_failed = False
        commands = ["OUTP OFF"]
        if self.identity is not None:
            commands.append("OUTP:MOD OFF")
            if self.capabilities is None or self.capabilities.has_arb:
                commands.append("SOUR:RAD:ARB:STAT OFF")

        for command in commands:
            try:
                self.transport.write(command)
            except Exception as error:
                failures.append("{}: {}".format(command, error))
                if command == "OUTP OFF":
                    rf_off_write_failed = True

        if rf_off_write_failed:
            try:
                self.transport.write("OUTP OFF")
            except Exception as error:
                failures.append("OUTP OFF retry: {}".format(error))

        rf_state = "unknown"
        try:
            response = self.transport.query("OUTP?").strip()
            parsed_state = _parse_switch_state(response)
            if parsed_state is False:
                rf_state = "off"
            elif parsed_state is True:
                failures.append("OUTP? reported ON after cleanup")
            else:
                failures.append("OUTP? returned unrecognized state {!r}".format(response))
        except Exception as error:
            failures.append("OUTP? verification: {}".format(error))

        return CleanupReport(rf_state, tuple(failures))

    def identify(self) -> InstrumentIdentity:
        identity = InstrumentIdentity.parse(self.transport.query("*IDN?"))
        vendor = identity.vendor.upper()
        if "KEYSIGHT" not in vendor and "AGILENT" not in vendor:
            raise ModelMismatchError(
                "Expected a Keysight/Agilent {}, got {!r}".format(
                    SUPPORTED_MODEL, identity.vendor
                )
            )
        if identity.model != SUPPORTED_MODEL:
            raise ModelMismatchError(
                "This example supports {} only; connected model is {}".format(
                    SUPPORTED_MODEL, identity.model
                )
            )
        self.identity = identity
        return identity

    def read_capabilities(self) -> InstrumentCapabilities:
        raw_options = self.transport.query("*OPT?")
        option_codes: Set[str] = set()
        for raw_token in re.split(r"[,;\s]+", raw_options.strip()):
            token = raw_token.upper()
            if not token or token == "0":
                continue
            option_codes.add(token.rsplit("-", 1)[-1])

        if "657" in option_codes and "656" not in option_codes:
            raise CapabilityError(
                "*OPT? reported Option 657 without its required Option 656"
            )

        max_frequency_hz = 0.0
        if "506" in option_codes:
            max_frequency_hz = 6_000_000_000.0
        elif "503" in option_codes:
            max_frequency_hz = 3_000_000_000.0
        elif "501" in option_codes:
            max_frequency_hz = 1_000_000_000.0
        max_sample_rate_hz = 0.0
        if "657" in option_codes:
            max_sample_rate_hz = 200_000_000.0
        elif "656" in option_codes:
            max_sample_rate_hz = 100_000_000.0
        capabilities = InstrumentCapabilities(
            option_codes, max_frequency_hz, max_sample_rate_hz
        )
        self.capabilities = capabilities
        return capabilities

    def clear_status(self) -> None:
        self.transport.write("*CLS")

    def wait_complete(self) -> None:
        response = self.transport.query("*OPC?").strip()
        if response != "1":
            raise ScpiError("operation did not complete", [response])

    def drain_errors(self) -> List[str]:
        """Drain at most 30 queued records and require the following +0 record."""

        errors: List[str] = []
        for _ in range(N5182B_ERROR_DRAIN_MAX_QUERIES):
            response = self.transport.query("SYST:ERR?").strip()
            match = re.match(r"^\s*([+-]?\d+)", response)
            if not match:
                raise ScpiError(
                    "SCPI error queue did not return a valid +0 terminator",
                    errors + ["Malformed SYST:ERR? response {!r}".format(response)],
                )
            if int(match.group(1)) == 0:
                return errors
            errors.append(response)
        raise ScpiError(
            "SCPI error queue did not terminate with +0 within {} queries".format(
                N5182B_ERROR_DRAIN_MAX_QUERIES
            ),
            errors,
        )

    def assert_no_errors(self, context: str) -> None:
        errors = self.drain_errors()
        if errors:
            raise ScpiError(context, errors)

    def _validate_frequency(self, frequency_hz: float) -> None:
        if not math.isfinite(frequency_hz):
            raise ValueError("frequency_hz must be finite")
        if self.capabilities is None:
            raise CapabilityError("read *OPT? before setting the RF frequency")
        if self.capabilities.max_frequency_hz == 0:
            raise CapabilityError(
                "*OPT? did not report a recognized N5182B frequency option (501/503/506)"
            )
        if (
            frequency_hz < MIN_FREQUENCY_HZ
            or frequency_hz > self.capabilities.max_frequency_hz
        ):
            raise ValueError(
                "frequency_hz must be within 9 kHz to {} Hz for the installed option".format(
                    _format_number(self.capabilities.max_frequency_hz)
                )
            )

    @staticmethod
    def _validate_power(power_dbm: float, power_limit_dbm: float) -> None:
        if not math.isfinite(power_dbm) or not math.isfinite(power_limit_dbm):
            raise ValueError("power values must be finite")
        if power_dbm > power_limit_dbm:
            raise ValueError(
                "requested {:.3f} dBm exceeds the example safety limit {:.3f} dBm".format(
                    power_dbm, power_limit_dbm
                )
            )

    def _set_frequency_and_power(
        self, frequency_hz: float, power_dbm: float, power_limit_dbm: float
    ) -> None:
        self._validate_frequency(frequency_hz)
        self._validate_power(power_dbm, power_limit_dbm)
        self.transport.write(
            "SOUR:FREQ:CW {}HZ".format(_format_number(frequency_hz))
        )
        self.transport.write(
            "SOUR:POW:LEV:IMM:AMPL {}DBM".format(_format_number(power_dbm))
        )

    def _query_float(self, command: str, label: str) -> float:
        response = self.transport.query(command).strip()
        try:
            value = float(response)
        except ValueError as error:
            raise ScpiError(
                "{} query-back was not numeric".format(label), [response]
            ) from error
        if not math.isfinite(value):
            raise ScpiError(
                "{} query-back was not finite".format(label), [response]
            )
        return value

    @staticmethod
    def _append_numeric_mismatch(
        mismatches: List[str],
        label: str,
        actual: float,
        expected: float,
        tolerance: float,
        unit: str,
    ) -> None:
        if not math.isclose(actual, expected, rel_tol=0.0, abs_tol=tolerance):
            mismatches.append(
                "{} expected {} {}, got {} {} (tolerance {} {})".format(
                    label,
                    _format_number(expected),
                    unit,
                    _format_number(actual),
                    unit,
                    _format_number(tolerance),
                    unit,
                )
            )

    def _verify_frequency_power_rf_off(
        self, frequency_hz: float, power_dbm: float
    ) -> List[str]:
        mismatches: List[str] = []
        actual_frequency_hz = self._query_float("SOUR:FREQ:CW?", "frequency")
        actual_power_dbm = self._query_float(
            "SOUR:POW:LEV:IMM:AMPL?", "power"
        )
        output_response = self.transport.query("OUTP?").strip()
        output_state = _parse_switch_state(output_response)

        self._append_numeric_mismatch(
            mismatches,
            "frequency",
            actual_frequency_hz,
            frequency_hz,
            FREQUENCY_QUERY_TOLERANCE_HZ,
            "Hz",
        )
        self._append_numeric_mismatch(
            mismatches,
            "power",
            actual_power_dbm,
            power_dbm,
            POWER_QUERY_TOLERANCE_DB,
            "dBm",
        )
        if output_state is not False:
            mismatches.append(
                "RF output expected OFF during configuration, got {!r}".format(
                    output_response
                )
            )
        return mismatches

    def configure_cw(
        self, frequency_hz: float, power_dbm: float, power_limit_dbm: float
    ) -> None:
        self.safe_rf_off()
        self._set_frequency_and_power(frequency_hz, power_dbm, power_limit_dbm)
        self.wait_complete()
        self.assert_no_errors("CW configuration failed")
        mismatches = self._verify_frequency_power_rf_off(frequency_hz, power_dbm)
        self.assert_no_errors("CW query-back failed")
        if mismatches:
            raise ScpiError("CW query-back mismatch", mismatches)

    def configure_iq_waveform(
        self,
        waveform_name: str,
        samples: List[complex],
        sample_rate_hz: float,
        runtime_scale_percent: float,
        frequency_hz: float,
        power_dbm: float,
        power_limit_dbm: float,
    ) -> None:
        if self.capabilities is None:
            raise CapabilityError("read *OPT? before configuring an ARB waveform")
        if not self.capabilities.has_arb:
            raise CapabilityError(
                "N5182B Option 656 (ARB) is required for waveform playback"
            )
        if len(samples) < MIN_N5182B_WAVEFORM_SAMPLES:
            raise ValueError(
                "waveform must contain at least {} complex samples".format(
                    MIN_N5182B_WAVEFORM_SAMPLES
                )
            )
        if (
            not math.isfinite(sample_rate_hz)
            or sample_rate_hz <= 0
            or sample_rate_hz > self.capabilities.max_arb_sample_rate_hz
        ):
            raise CapabilityError(
                "sample rate {} Hz exceeds the installed ARB limit {} Hz".format(
                    _format_number(sample_rate_hz),
                    _format_number(self.capabilities.max_arb_sample_rate_hz),
                )
            )
        if (
            not math.isfinite(runtime_scale_percent)
            or runtime_scale_percent < 1
            or runtime_scale_percent > 100
        ):
            raise ValueError("runtime_scale_percent must be in [1, 100]")
        if not re.match(r"^[A-Za-z0-9_.-]+$", waveform_name):
            raise ValueError(
                "waveform_name may contain only letters, digits, dot, underscore and hyphen"
            )

        self.safe_rf_off()
        self._set_frequency_and_power(frequency_hz, power_dbm, power_limit_dbm)

        payload = encode_iq_int16(samples, byte_order="big")
        block = ieee4882_definite_block(payload)
        memory_name = "WFM1:{}".format(waveform_name)
        raw_command = (
            'MMEM:DATA "{}",'.format(memory_name).encode("ascii")
            + block
            + b"\n"
        )
        self.transport.write_raw(raw_command)
        self.transport.write(
            "SOUR:RAD:ARB:SCL:RATE {}HZ".format(_format_number(sample_rate_hz))
        )
        self.transport.write(
            'SOUR:RAD:ARB:HEAD:RMS "{}",{}'.format(
                memory_name, _format_number(waveform_rms(samples))
            )
        )
        self.transport.write(
            "SOUR:RAD:ARB:RSC {}".format(_format_number(runtime_scale_percent))
        )
        self.transport.write('SOUR:RAD:ARB:WAV "{}"'.format(memory_name))
        self.transport.write("SOUR:RAD:ARB:STAT ON")
        self.transport.write("OUTP:MOD ON")
        self.wait_complete()
        self.assert_no_errors("waveform upload or playback configuration failed")
        mismatches = self._verify_frequency_power_rf_off(frequency_hz, power_dbm)
        selected_waveform = self.transport.query("SOUR:RAD:ARB:WAV?").strip()
        selected_waveform = selected_waveform.strip('"')
        if selected_waveform != memory_name:
            mismatches.append(
                "waveform expected {!r}, got {!r}".format(
                    memory_name, selected_waveform
                )
            )

        actual_sample_rate_hz = self._query_float(
            "SOUR:RAD:ARB:SCL:RATE?", "ARB sample rate"
        )
        self._append_numeric_mismatch(
            mismatches,
            "ARB sample rate",
            actual_sample_rate_hz,
            sample_rate_hz,
            SAMPLE_RATE_QUERY_TOLERANCE_HZ,
            "Hz",
        )
        actual_runtime_scale = self._query_float(
            "SOUR:RAD:ARB:RSC?", "runtime scaling"
        )
        self._append_numeric_mismatch(
            mismatches,
            "runtime scaling",
            actual_runtime_scale,
            runtime_scale_percent,
            RUNTIME_SCALE_QUERY_TOLERANCE_PERCENT,
            "%",
        )

        arb_response = self.transport.query("SOUR:RAD:ARB:STAT?").strip()
        if _parse_switch_state(arb_response) is not True:
            mismatches.append("ARB expected ON, got {!r}".format(arb_response))
        modulation_response = self.transport.query("OUTP:MOD?").strip()
        if _parse_switch_state(modulation_response) is not True:
            mismatches.append(
                "modulation expected ON, got {!r}".format(modulation_response)
            )
        self.assert_no_errors("waveform query-back failed")
        if mismatches:
            raise ScpiError("waveform query-back mismatch", mismatches)

    def rf_on(self) -> None:
        self.transport.write("OUTP ON")
        self.wait_complete()
        self.assert_no_errors("RF enable failed")
        state = self.transport.query("OUTP?").strip()
        if _parse_switch_state(state) is not True:
            raise ScpiError("RF output did not report ON", [state])

    def rf_off_verified(self) -> None:
        """Disable all output stages and require connector RF OFF query-back."""

        self.safe_rf_off()
        self.wait_complete()
        self.assert_no_errors("RF disable failed")
        state = self.transport.query("OUTP?").strip()
        if _parse_switch_state(state) is not False:
            raise ScpiError("RF output did not report OFF", [state])
        self.assert_no_errors("RF OFF query-back failed")


def _parse_switch_state(response: str) -> Optional[bool]:
    normalized = response.strip().upper()
    if normalized == "ON":
        return True
    if normalized == "OFF":
        return False
    try:
        numeric = float(normalized)
    except ValueError:
        return None
    if numeric == 1.0:
        return True
    if numeric == 0.0:
        return False
    return None


# Public adapter name used by the study guide. Keep the original controller name
# as a compatibility alias for existing examples and tests.
MxgN5182B = MxgController
