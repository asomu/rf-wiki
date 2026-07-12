from __future__ import annotations

import math
import struct
from dataclasses import dataclass

from .transport import Transport


class UnexpectedInstrumentError(RuntimeError):
    pass


class InstrumentErrorQueueError(RuntimeError):
    pass


class OutputStateUnknownError(RuntimeError):
    pass


@dataclass(frozen=True)
class ComplexTrace:
    frequencies_hz: tuple[float, ...]
    values: tuple[complex, ...]


class E5080B:
    """Small E5080B adapter; safety policy remains the station's responsibility."""

    def __init__(self, transport: Transport) -> None:
        self.transport = transport
        self._profile_verified = False
        self._measurement_name: str | None = None
        self._measurement_number: int | None = None
        self._ascii_format_verified = False
        self._verified_calset: str | None = None
        self._configuration_verified = False

    def identify(self) -> tuple[str, str]:
        identity = self.transport.query("*IDN?").strip()
        options = self.transport.query("*OPT?").strip()
        fields = [field.strip() for field in identity.split(",")]
        if len(fields) < 2 or fields[0] != "Keysight Technologies" or fields[1] != "E5080B":
            raise UnexpectedInstrumentError(f"Expected Keysight E5080B, got {identity!r}")
        if len(fields) < 4 or fields[3] != "A.20.25.03":
            raise UnexpectedInstrumentError(f"Examples are reviewed for firmware A.20.25.03, got {identity!r}")
        if "2K0" not in {option.strip() for option in options.split(",")}:
            raise UnexpectedInstrumentError(f"Examples require the E5080B-2K0 profile, got options {options!r}")
        self._profile_verified = True
        return identity, options

    def output_off(self) -> None:
        self.transport.write("OUTP OFF")

    def output_off_and_confirm(self) -> None:
        try:
            self.output_off()
            response = self.transport.query("OUTP?").strip().upper()
        except Exception as error:
            raise OutputStateUnknownError("OUTP OFF write/query confirmation failed; physical RF state is unknown") from error
        if response not in {"0", "OFF"}:
            raise OutputStateUnknownError(f"OUTP OFF was sent but OUTP? returned {response!r}; physical RF state is unknown")

    def output_on(self, *, consent: bool, reverse_drive_consent: bool = False) -> None:
        if not consent:
            raise PermissionError("RF source enable requires explicit --rf-on consent")
        if not self._configuration_verified:
            raise PermissionError("RF source enable requires a clean full configuration query-back")
        if self._measurement_name is None:
            raise PermissionError("Configure and select a measurement before RF source enable")
        if self._measurement_name.endswith(("S12", "S22")) and not reverse_drive_consent:
            raise PermissionError("S12/S22 source enable requires explicit --reverse-drive consent")
        try:
            self.transport.write("OUTP ON")
            response = self.transport.query("OUTP?").strip().upper()
        except Exception as error:
            raise OutputStateUnknownError("OUTP ON write/query confirmation failed; physical RF state is unknown") from error
        if response not in {"1", "ON"}:
            raise OutputStateUnknownError(f"OUTP ON was sent but OUTP? returned {response!r}; physical RF state is unknown")

    def set_power_limit(self, limit_dbm: float) -> None:
        self._configuration_verified = False
        self.transport.write(f"SYST:POW1:LIM {limit_dbm:g} DBM")
        self.transport.write("SYST:POW1:LIM:STAT ON")

    def set_calibration_power_limit(self, limit_dbm: float, *, enabled: bool) -> None:
        self.transport.write(f"SYST:POW1:LIM:CAL {limit_dbm:g} DBM")
        self.transport.write(f"SYST:POW:LIM:CAL:STAT {'ON' if enabled else 'OFF'}")

    def configure_sweep(
        self,
        *,
        start_hz: float,
        stop_hz: float,
        points: int,
        if_bandwidth_hz: float,
        power_dbm: float,
        parameter: str = "S21",
    ) -> None:
        self._configuration_verified = False
        if not self._profile_verified:
            raise UnexpectedInstrumentError("Call identify() and verify *OPT? includes 2K0 before configuring the 20 GHz profile")
        if not 9e3 <= start_hz < stop_hz <= 20e9:
            raise ValueError("E5080B-2K0 learning profile requires 9 kHz <= start < stop <= 20 GHz")
        if points < 2:
            raise ValueError("points must be at least 2")
        if parameter not in {"S11", "S21", "S12", "S22"}:
            raise ValueError("parameter must be S11, S21, S12, or S22")
        measurement_name = f"RF_WIKI_{parameter}"
        commands = (
            f"SENS1:FREQ:STAR {start_hz:g} HZ",
            f"SENS1:FREQ:STOP {stop_hz:g} HZ",
            f"SENS1:SWE:POIN {points}",
            f"SENS1:BWID {if_bandwidth_hz:g} HZ",
            f"SOUR1:POW1 {power_dbm:g} DBM",
            f"CALC1:PAR:DEF:EXT '{measurement_name}','{parameter}'",
            f"CALC1:PAR:SEL '{measurement_name}'",
            "TRIG:SOUR IMM",
        )
        for command in commands:
            self.transport.write(command)
        measurement_number = int(float(self.transport.query("CALC1:PAR:MNUM?")))
        if measurement_number < 1:
            raise RuntimeError(f"Invalid selected measurement number {measurement_number}")
        self._measurement_name = measurement_name
        self._measurement_number = measurement_number
        self._ascii_format_verified = False
        self._verified_calset = None

    def verify_source(self) -> tuple[float, bool]:
        power_dbm = float(self.transport.query("SOUR1:POW1?"))
        output_on = self.transport.query("OUTP?").strip() in {"1", "ON"}
        return power_dbm, output_on

    def verify_configuration(
        self,
        *,
        start_hz: float,
        stop_hz: float,
        points: int,
        if_bandwidth_hz: float,
        power_dbm: float,
        power_limit_dbm: float,
    ) -> None:
        actual = {
            "start_hz": float(self.transport.query("SENS1:FREQ:STAR?")),
            "stop_hz": float(self.transport.query("SENS1:FREQ:STOP?")),
            "points": int(float(self.transport.query("SENS1:SWE:POIN?"))),
            "if_bandwidth_hz": float(self.transport.query("SENS1:BWID?")),
            "power_dbm": float(self.transport.query("SOUR1:POW1?")),
            "power_limit_dbm": float(self.transport.query("SYST:POW1:LIM?")),
            "power_limit_enabled": self.transport.query("SYST:POW1:LIM:STAT?").strip() in {"1", "ON"},
            "output_on": self.transport.query("OUTP?").strip() in {"1", "ON"},
        }
        expected = {
            "start_hz": start_hz,
            "stop_hz": stop_hz,
            "points": points,
            "if_bandwidth_hz": if_bandwidth_hz,
            "power_dbm": power_dbm,
            "power_limit_dbm": power_limit_dbm,
            "power_limit_enabled": True,
            "output_on": False,
        }
        numeric_tolerances = {
            "start_hz": max(1.0, abs(start_hz) * 1e-9),
            "stop_hz": max(1.0, abs(stop_hz) * 1e-9),
            "if_bandwidth_hz": max(1e-3, abs(if_bandwidth_hz) * 1e-9),
            "power_dbm": 1e-3,
            "power_limit_dbm": 1e-3,
        }
        mismatches: dict[str, tuple[object, object]] = {}
        for name, expected_value in expected.items():
            actual_value = actual[name]
            tolerance = numeric_tolerances.get(name)
            matches = (
                math.isclose(float(actual_value), float(expected_value), rel_tol=0.0, abs_tol=tolerance)
                if tolerance is not None
                else actual_value == expected_value
            )
            if not matches:
                mismatches[name] = (expected_value, actual_value)
        if mismatches:
            raise RuntimeError(f"E5080B query-back mismatch (expected, actual): {mismatches!r}")
        self._configuration_verified = True

    def sweep_and_wait(self) -> None:
        self.transport.write("INIT1:IMM")
        if self.transport.query("*OPC?").strip() != "1":
            raise RuntimeError("E5080B did not report operation complete")

    def set_and_verify_ascii_data_format(self) -> None:
        self.transport.write("FORM:DATA ASC,0")
        response = self.transport.query("FORM:DATA?").strip().upper().replace(" ", "")
        if not response.startswith("ASC,"):
            raise RuntimeError(f"Expected ASCII transfer format, got {response!r}")
        self._ascii_format_verified = True

    def verify_correction(self, expected_calset: str | None = None) -> str:
        correction_on = self.transport.query("SENS1:CORR:STAT?").strip().upper() in {"1", "ON"}
        active_calset = self.transport.query("SENS1:CORR:CSET:ACT? NAME").strip().strip('"')
        if not correction_on:
            raise RuntimeError("Correction is OFF; data must not be labeled corrected SDATA")
        if not active_calset or active_calset.lower() == "no calset selected":
            raise RuntimeError("No active CalSet; data must not be labeled corrected SDATA")
        if expected_calset is not None and active_calset != expected_calset:
            raise RuntimeError(f"Expected CalSet {expected_calset!r}, got {active_calset!r}")
        self._verified_calset = active_calset
        return active_calset

    def selected_ascii_data_queries(self) -> tuple[str, str]:
        if self._measurement_number is None or self._measurement_name is None:
            raise RuntimeError("No named measurement has been selected")
        if not self._ascii_format_verified:
            raise RuntimeError("Call set_and_verify_ascii_data_format() before ASCII SDATA")
        if self._verified_calset is None:
            raise RuntimeError("Verify correction and the active CalSet before reading corrected SDATA")
        prefix = f"CALC1:MEAS{self._measurement_number}"
        return f"{prefix}:X:VAL?", f"{prefix}:DATA:SDAT?"

    def read_ascii_sdata(self) -> ComplexTrace:
        frequency_query, sdata_query = self.selected_ascii_data_queries()
        frequencies = tuple(float(value) for value in self.transport.query(frequency_query).split(",") if value)
        scalars = tuple(float(value) for value in self.transport.query(sdata_query).split(",") if value)
        if len(scalars) != 2 * len(frequencies):
            raise ValueError(f"SDATA has {len(scalars)} scalars for {len(frequencies)} frequencies")
        values = tuple(complex(scalars[index], scalars[index + 1]) for index in range(0, len(scalars), 2))
        return ComplexTrace(frequencies, values)

    @staticmethod
    def decode_real32_sdata(payload: bytes, *, points: int, byte_order: str = "<") -> tuple[complex, ...]:
        if byte_order not in {"<", ">"}:
            raise ValueError("byte_order must be '<' (little) or '>' (big)")
        expected = points * 2 * 4
        if len(payload) != expected:
            raise ValueError(f"REAL,32 payload is {len(payload)} bytes; expected {expected}")
        scalars = struct.unpack(f"{byte_order}{points * 2}f", payload)
        return tuple(complex(scalars[index], scalars[index + 1]) for index in range(0, len(scalars), 2))

    @staticmethod
    def unwrap_definite_length_block(block: bytes) -> bytes:
        if len(block) < 2 or block[:1] != b"#" or not block[1:2].isdigit():
            raise ValueError("Expected an IEEE 488.2 definite-length block")
        length_digits = int(block[1:2])
        if length_digits == 0 or len(block) < 2 + length_digits:
            raise ValueError("Indefinite or truncated binary block header")
        declared = int(block[2 : 2 + length_digits])
        payload = block[2 + length_digits :]
        if len(payload) != declared:
            raise ValueError(f"Binary block declares {declared} payload bytes, received {len(payload)}")
        return payload

    @classmethod
    def decode_real32_block(cls, block: bytes, *, points: int, byte_order: str = "<") -> tuple[complex, ...]:
        return cls.decode_real32_sdata(cls.unwrap_definite_length_block(block), points=points, byte_order=byte_order)

    def drain_errors(self, maximum_queries: int = 32) -> tuple[str, ...]:
        records: list[str] = []
        for _ in range(maximum_queries):
            response = self.transport.query("SYST:ERR?").strip()
            records.append(response)
            if response.startswith("+0,") or response.startswith("0,"):
                return tuple(records)
        raise RuntimeError("Error queue did not reach no-error within bounded drain")

    def assert_no_errors(self, context: str, maximum_queries: int = 32) -> tuple[str, ...]:
        records = self.drain_errors(maximum_queries)
        nonzero: list[str] = []
        for response in records:
            try:
                code = int(response.split(",", 1)[0])
            except (ValueError, IndexError) as error:
                raise InstrumentErrorQueueError(f"{context}: malformed SYST:ERR? response {response!r}") from error
            if code != 0:
                nonzero.append(response)
        if nonzero:
            raise InstrumentErrorQueueError(f"{context}: E5080B error queue was not clean: {nonzero!r}")
        return records

    def close(self) -> None:
        self.transport.close()
