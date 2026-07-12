from __future__ import annotations

from dataclasses import dataclass
import math

from .driver import E5080B


@dataclass(frozen=True)
class SweepRequest:
    start_hz: float = 1e9
    stop_hz: float = 6e9
    points: int = 201
    if_bandwidth_hz: float = 1e3
    power_dbm: float = -30.0
    power_limit_dbm: float = -20.0
    parameter: str = "S21"


@dataclass(frozen=True)
class EnaPowerEstimate:
    dut_input_worst_dbm: float
    receiver_input_worst_dbm: float


@dataclass(frozen=True)
class EnaPowerSafetyEnvelope:
    """Station limits expressed at the DUT and VNA receiver reference planes."""

    dut_input_limit_dbm: float
    receiver_input_limit_dbm: float
    maximum_dut_gain_db: float
    forward_path_gain_db: float = 0.0
    receiver_path_gain_db: float = 0.0
    uncertainty_db: float = 1.0
    guard_margin_db: float = 3.0

    def evaluate(self, source_power_dbm: float, source_power_limit_dbm: float) -> EnaPowerEstimate:
        values = (
            self.dut_input_limit_dbm,
            self.receiver_input_limit_dbm,
            self.maximum_dut_gain_db,
            self.forward_path_gain_db,
            self.receiver_path_gain_db,
            self.uncertainty_db,
            self.guard_margin_db,
            source_power_dbm,
            source_power_limit_dbm,
        )
        if not all(math.isfinite(value) for value in values):
            raise ValueError("Power safety envelope values must be finite")
        if self.uncertainty_db < 0 or self.guard_margin_db < 0:
            raise ValueError("Uncertainty and guard margin must be non-negative")
        if source_power_dbm > source_power_limit_dbm:
            raise ValueError(
                f"Source {source_power_dbm:g} dBm exceeds configured source limit {source_power_limit_dbm:g} dBm"
            )

        dut_input = source_power_dbm + self.forward_path_gain_db + self.uncertainty_db + self.guard_margin_db
        receiver_input = (
            source_power_dbm
            + self.forward_path_gain_db
            + self.maximum_dut_gain_db
            + self.receiver_path_gain_db
            + self.uncertainty_db
            + self.guard_margin_db
        )
        if dut_input > self.dut_input_limit_dbm:
            raise ValueError(
                f"Worst-case DUT input {dut_input:g} dBm exceeds limit {self.dut_input_limit_dbm:g} dBm"
            )
        if receiver_input > self.receiver_input_limit_dbm:
            raise ValueError(
                f"Worst-case receiver input {receiver_input:g} dBm exceeds station limit {self.receiver_input_limit_dbm:g} dBm"
            )
        return EnaPowerEstimate(dut_input, receiver_input)


def require_power_safety_envelope(
    *,
    required: bool,
    dut_input_limit_dbm: float | None,
    receiver_input_limit_dbm: float | None,
    maximum_dut_gain_db: float | None,
    forward_path_gain_db: float,
    receiver_path_gain_db: float,
    uncertainty_db: float,
    guard_margin_db: float,
) -> EnaPowerSafetyEnvelope | None:
    required_values = {
        "--dut-input-limit-dbm": dut_input_limit_dbm,
        "--receiver-input-limit-dbm": receiver_input_limit_dbm,
        "--maximum-dut-gain-db": maximum_dut_gain_db,
    }
    missing = [name for name, value in required_values.items() if value is None]
    if required and missing:
        raise ValueError(f"Physical RF enable requires explicit station limits: {', '.join(missing)}")
    if missing:
        return None
    return EnaPowerSafetyEnvelope(
        dut_input_limit_dbm=float(dut_input_limit_dbm),
        receiver_input_limit_dbm=float(receiver_input_limit_dbm),
        maximum_dut_gain_db=float(maximum_dut_gain_db),
        forward_path_gain_db=forward_path_gain_db,
        receiver_path_gain_db=receiver_path_gain_db,
        uncertainty_db=uncertainty_db,
        guard_margin_db=guard_margin_db,
    )


def run_safe_sweep(
    vna: E5080B,
    request: SweepRequest,
    *,
    enable_rf: bool,
    reverse_drive_consent: bool = False,
    safety_envelope: EnaPowerSafetyEnvelope | None = None,
) -> None:
    """Run configuration/acquisition; always attempt RF OFF first during cleanup."""
    try:
        vna.identify()
        vna.output_off()
        vna.transport.write("*CLS")
        vna.set_power_limit(request.power_limit_dbm)
        vna.configure_sweep(
            start_hz=request.start_hz,
            stop_hz=request.stop_hz,
            points=request.points,
            if_bandwidth_hz=request.if_bandwidth_hz,
            power_dbm=request.power_dbm,
            parameter=request.parameter,
        )
        if vna.transport.query("*OPC?").strip() != "1":
            raise RuntimeError("configuration did not complete")
        vna.verify_configuration(
            start_hz=request.start_hz,
            stop_hz=request.stop_hz,
            points=request.points,
            if_bandwidth_hz=request.if_bandwidth_hz,
            power_dbm=request.power_dbm,
            power_limit_dbm=request.power_limit_dbm,
        )
        vna.assert_no_errors("after sweep configuration and query-back")
        if enable_rf:
            if safety_envelope is None:
                raise PermissionError("RF source enable requires an explicit DUT/receiver power safety envelope")
            safety_envelope.evaluate(request.power_dbm, request.power_limit_dbm)
            vna.output_on(consent=True, reverse_drive_consent=reverse_drive_consent)
            vna.sweep_and_wait()
    finally:
        try:
            vna.output_off_and_confirm()
        finally:
            try:
                vna.assert_no_errors("cleanup")
            finally:
                vna.close()
