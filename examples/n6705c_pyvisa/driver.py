"""N6705C + N6752A adapter with conservative output and cleanup gates."""

from __future__ import annotations

from dataclasses import dataclass
from math import isclose, isfinite
import re

from .transport import Transport

VOLTAGE_MAX_V = 50.0
CURRENT_MAX_A = 10.0
POWER_MAX_W = 100.0
OVP_MAX_V = 55.0
EXPECTED_FIRMWARE = "E_02_09_3271"


@dataclass(frozen=True)
class SafeBiasConfig:
    voltage_v: float = 28.0
    current_limit_a: float = 0.25
    ovp_v: float = 30.0
    slew_v_per_s: float = 1_000.0
    channel: int = 1

    def validate(self) -> None:
        if not 0 <= self.voltage_v <= VOLTAGE_MAX_V:
            raise ValueError("voltage must be within 0 to 50 V")
        if not 0 < self.current_limit_a <= CURRENT_MAX_A:
            raise ValueError("current limit must be within 0 to 10 A")
        if self.voltage_v * self.current_limit_a > POWER_MAX_W:
            raise ValueError("requested V × I limit exceeds the conservative 100 W envelope")
        if not self.voltage_v < self.ovp_v <= OVP_MAX_V:
            raise ValueError("OVP must be above the setpoint and no greater than 55 V")
        if self.slew_v_per_s <= 0:
            raise ValueError("slew must be positive")
        if self.channel != 1:
            raise ValueError("this example is intentionally scoped to slot/channel 1")


class CleanupError(RuntimeError):
    pass


class N6705cN6752a:
    def __init__(self, transport: Transport) -> None:
        self.io = transport
        self._scope_verified = False
        self._output_confirmed_off = False
        self._configuration_verified = False
        self._configured: SafeBiasConfig | None = None
        self._list_verified = False
        self._list_armed = False
        self._list_voltages_v: tuple[float, ...] = ()

    @staticmethod
    def _channel(channel: int = 1) -> str:
        return f"(@{channel})"

    def identify_and_verify_scope(self) -> tuple[str, str, str]:
        identity = self.io.query("*IDN?").strip()
        if "N6705C" not in identity.upper():
            raise RuntimeError(f"refusing unsupported mainframe: {identity}")
        firmware = identity.rsplit(",", 1)[-1].strip()
        normalized_firmware = re.sub(r"[^A-Z0-9]+", "_", firmware.upper()).strip("_")
        if normalized_firmware != EXPECTED_FIRMWARE:
            raise RuntimeError(
                f"refusing unverified N6705C firmware: expected {EXPECTED_FIRMWARE}, got {firmware}"
            )
        module = self.io.query("SYST:CHAN:MOD? (@1)").strip().strip('"')
        if "N6752A" not in module.upper():
            raise RuntimeError(f"refusing unsupported slot-1 module: {module}")
        options = self.io.query("SYST:CHAN:OPT? (@1)").strip().strip('"')
        if "761" not in options:
            raise RuntimeError(f"Option 761 not reported for slot 1: {options}")
        self._scope_verified = True
        return identity, module, options

    def output_off(self) -> None:
        self.io.write("OUTP OFF,(@1)")
        if self.io.query("OUTP? (@1)").strip() not in {"0", "+0"}:
            raise RuntimeError("output OFF query-back failed")
        self._output_confirmed_off = True
        self._configuration_verified = False

    def configure(self, config: SafeBiasConfig) -> None:
        if not self._scope_verified or not self._output_confirmed_off:
            raise RuntimeError("verified scope and confirmed output OFF are required before configuration")
        config.validate()
        self._configuration_verified = False
        self._configured = config
        self._list_verified = False
        self._list_armed = False
        self._list_voltages_v = ()
        channel = self._channel(config.channel)
        self.io.write(f"VOLT {config.voltage_v:.9g},{channel}")
        self.io.write(f"CURR {config.current_limit_a:.9g},{channel}")
        self.io.write(f"VOLT:PROT {config.ovp_v:.9g},{channel}")
        self.io.write(f"VOLT:SLEW {config.slew_v_per_s:.9g},{channel}")
        self.io.write(f"CURR:PROT:STAT ON,{channel}")

    def query_back(self, config: SafeBiasConfig) -> None:
        if not self._scope_verified or self._configured != config:
            raise RuntimeError("query-back requires the current verified-scope configuration")
        channel = self._channel(config.channel)
        expected = (
            ("VOLT", config.voltage_v),
            ("CURR", config.current_limit_a),
            ("VOLT:PROT", config.ovp_v),
            ("VOLT:SLEW", config.slew_v_per_s),
        )
        for header, target in expected:
            actual = float(self.io.query(f"{header}? {channel}"))
            if not isclose(actual, target, rel_tol=1e-6, abs_tol=1e-9):
                raise RuntimeError(f"query-back mismatch for {header}: expected {target}, got {actual}")
        ocp_state = self.io.query(f"CURR:PROT:STAT? {channel}").strip().upper()
        if ocp_state not in {"1", "+1", "ON"}:
            raise RuntimeError(f"OCP query-back did not confirm ON: {ocp_state}")
        self._configuration_verified = True

    def enable_output(self, *, permit: bool = False) -> tuple[float, float, int]:
        if not permit:
            raise RuntimeError("explicit output permit is required")
        if not self._scope_verified or not self._configuration_verified:
            raise RuntimeError("identity, module, protection and configuration must be verified before output ON")
        output_state = self.io.query("OUTP? (@1)").strip()
        self._output_confirmed_off = output_state in {"0", "+0"}
        if not self._output_confirmed_off:
            raise RuntimeError("a fresh output OFF query-back is required before output ON")
        self.assert_no_errors("before output ON")
        self.io.write("OUTP ON,(@1)")
        if self.io.query("OUTP? (@1)").strip() not in {"1", "+1"}:
            raise RuntimeError("output did not report ON")
        self._output_confirmed_off = False
        operating_point = self.assert_expected_cv()
        self.assert_no_errors("output enable")
        return operating_point

    def load_voltage_list(self, voltages_v: list[float], dwell_s: list[float]) -> None:
        if not self._scope_verified or not self._configuration_verified or self._configured is None:
            raise RuntimeError(
                "verified identity, module, protection and fixed configuration are required before LIST setup"
            )
        output_state = self.io.query("OUTP? (@1)").strip()
        self._output_confirmed_off = output_state in {"0", "+0"}
        if not self._output_confirmed_off:
            raise RuntimeError("LIST setup requires a fresh output OFF query-back")
        # Any new LIST attempt invalidates trust in the previously verified
        # segment. A rejected replacement must never silently arm stale data.
        self._list_verified = False
        self._list_armed = False
        self._list_voltages_v = ()
        if not voltages_v or len(voltages_v) != len(dwell_s) or len(voltages_v) > 512:
            raise ValueError("LIST requires 1 to 512 paired voltage/dwell values")
        if any(not isfinite(value) or value < 0 or value > VOLTAGE_MAX_V for value in voltages_v):
            raise ValueError("LIST voltage is outside N6752A scope")
        if any(not isfinite(value) or value < 0 or value > 262.144 for value in dwell_s):
            raise ValueError("LIST dwell is outside 0 to 262.144 s")
        for index, voltage_v in enumerate(voltages_v):
            if voltage_v >= self._configured.ovp_v:
                raise ValueError(
                    f"LIST point {index} at {voltage_v:g} V meets or exceeds configured OVP "
                    f"{self._configured.ovp_v:g} V"
                )
            point_power_w = voltage_v * self._configured.current_limit_a
            if point_power_w > POWER_MAX_W:
                raise ValueError(
                    f"LIST point {index} requests {voltage_v:g} V × "
                    f"{self._configured.current_limit_a:g} A = {point_power_w:g} W, "
                    "above the conservative 100 W envelope"
                )

        self.assert_no_errors("before LIST setup")
        voltage_csv = ",".join(f"{value:.9g}" for value in voltages_v)
        dwell_csv = ",".join(f"{value:.9g}" for value in dwell_s)
        self.io.write(f"VOLT:MODE LIST,(@1)")
        self.io.write(f"LIST:VOLT {voltage_csv},(@1)")
        self.io.write(f"LIST:DWEL {dwell_csv},(@1)")
        self.io.write("TRIG:TRAN:SOUR BUS,(@1)")
        if self.io.query("*OPC?").strip() != "1":
            raise RuntimeError("LIST configuration did not complete")
        self.assert_no_errors("LIST configuration")
        self._query_back_text("VOLT:MODE? (@1)", "LIST")
        self._query_back_text("TRIG:TRAN:SOUR? (@1)", "BUS")
        self._query_back_points("LIST:VOLT? (@1)", voltages_v, "LIST voltage")
        self._query_back_points("LIST:DWEL? (@1)", dwell_s, "LIST dwell")
        self.assert_no_errors("LIST query-back")
        self._list_voltages_v = tuple(voltages_v)
        self._list_verified = True

    def arm_voltage_list(self) -> None:
        if not self._scope_verified or not self._configuration_verified or not self._list_verified:
            raise RuntimeError("verified scope, fixed configuration and LIST query-back are required before arm")
        output_state = self.io.query("OUTP? (@1)").strip()
        self._output_confirmed_off = output_state in {"0", "+0"}
        if not self._output_confirmed_off:
            raise RuntimeError("LIST must be armed while output OFF")
        self.assert_no_errors("before LIST arm")
        self.io.write("INIT:TRAN (@1)")
        if self.io.query("*OPC?").strip() != "1":
            raise RuntimeError("LIST arm did not complete")
        self.assert_no_errors("LIST arm")
        self._list_armed = True

    def trigger_voltage_list(self, *, permit: bool = False) -> tuple[float, float, int]:
        if not permit:
            raise RuntimeError("explicit LIST trigger permit is required")
        if not self._scope_verified or not self._configuration_verified:
            raise RuntimeError("verified scope and configuration are required before LIST trigger")
        if not self._list_verified or not self._list_armed:
            raise RuntimeError("a query-backed LIST must be armed before trigger")
        if self.io.query("OUTP? (@1)").strip() not in {"1", "+1"}:
            raise RuntimeError("output must be explicitly enabled before LIST trigger")
        self.assert_no_errors("before LIST trigger")
        self.io.write("*TRG")
        # Once a trigger event is sent, a retry could advance an unknown list
        # position. Require an explicit reload/re-arm even if a later query fails.
        self._list_armed = False
        if self.io.query("*OPC?").strip() != "1":
            raise RuntimeError("LIST trigger did not complete")
        self.assert_no_errors("LIST trigger")
        operating_point = self.assert_expected_cv()
        self.assert_no_errors("LIST operating point")
        return operating_point

    def read_operating_point(self) -> tuple[float, float, int]:
        voltage = float(self.io.query("MEAS:VOLT? (@1)"))
        current = float(self.io.query("MEAS:CURR? (@1)"))
        status = int(float(self.io.query("STAT:OPER:COND? (@1)")))
        return voltage, current, status

    def assert_expected_cv(self) -> tuple[float, float, int]:
        """Fail closed when an energized PA point unexpectedly enters CC/protection."""
        if self.io.query("OUTP? (@1)").strip() not in {"1", "+1"}:
            raise RuntimeError("output is OFF or protection-disabled; expected an energized CV point")
        voltage, current, status = self.read_operating_point()
        if status & 0b10:
            raise RuntimeError(f"unexpected CC regulation at {voltage:g} V, {current:g} A")
        if not status & 0b1:
            raise RuntimeError(f"unexpected operation status 0x{status:X}; stop and inspect protection")
        return voltage, current, status

    def drain_errors(self, maximum: int = 32) -> list[str]:
        records: list[str] = []
        for _ in range(maximum):
            response = self.io.query("SYST:ERR?").strip()
            records.append(response)
            try:
                code = int(response.split(",", 1)[0])
            except ValueError as exc:
                raise RuntimeError(f"cannot parse error response: {response}") from exc
            if code == 0:
                return records
        raise RuntimeError("error queue did not terminate within the bounded drain")

    def assert_no_errors(self, context: str) -> list[str]:
        records = self.drain_errors()
        nonzero = []
        for response in records:
            code = int(response.split(",", 1)[0])
            if code != 0:
                nonzero.append(response)
        if nonzero:
            raise RuntimeError(f"{context} reported instrument errors: {nonzero}")
        return records

    def _query_back_text(self, command: str, expected: str) -> None:
        actual = self.io.query(command).strip().strip('"').upper()
        if actual != expected.upper():
            raise RuntimeError(
                f"query-back mismatch for {command}: expected {expected}, got {actual}"
            )

    def _query_back_points(
        self,
        command: str,
        expected: list[float],
        label: str,
    ) -> None:
        raw = self.io.query(command).strip()
        try:
            actual = [float(value.strip()) for value in raw.split(",") if value.strip()]
        except ValueError as exc:
            raise RuntimeError(f"cannot parse {label} query-back: {raw}") from exc
        if len(actual) != len(expected):
            raise RuntimeError(
                f"{label} query-back length mismatch: expected {len(expected)}, got {len(actual)}"
            )
        for index, (target, observed) in enumerate(zip(expected, actual)):
            if not isclose(observed, target, rel_tol=1e-6, abs_tol=1e-9):
                raise RuntimeError(
                    f"{label} point {index} query-back mismatch: expected {target}, got {observed}"
                )

    def cleanup(self) -> None:
        failures: list[str] = []
        # OFF is deliberately the first cleanup command.
        for message in ("OUTP OFF,(@1)", "ABOR:TRAN (@1)", "ABOR:ACQ (@1)"):
            try:
                self.io.write(message)
            except Exception as exc:  # cleanup must continue through independent attempts
                failures.append(f"{message}: {exc}")
        try:
            if self.io.query("OUTP? (@1)").strip() not in {"0", "+0"}:
                failures.append("output query did not confirm OFF")
        except Exception as exc:
            failures.append(f"OUTP?: {exc}")
        try:
            self.drain_errors()
        except Exception as exc:
            failures.append(f"error drain: {exc}")
        self._list_armed = False
        self._list_verified = False
        self._list_voltages_v = ()
        if failures:
            raise CleanupError("; ".join(failures))
        self._output_confirmed_off = True
        self._configuration_verified = False
