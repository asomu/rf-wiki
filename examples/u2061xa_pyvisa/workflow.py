"""Safe U2061XA average-power workflow and host-side PA calculations."""

from dataclasses import dataclass
import math
from typing import Callable, List, Optional, Tuple

from .driver import AbortReport, CleanupError, U2061Controller
from .transport import ScpiTransport


@dataclass(frozen=True)
class MeasurementConfig:
    frequency_hz: float = 3.5e9
    aperture_seconds: float = 1e-3
    trigger_source: str = "IMM"
    sg_rf_off_confirmed: bool = False
    require_physical_confirmation: bool = True


@dataclass(frozen=True)
class MeasurementResult:
    identity: str
    power_dbm: float
    preexisting_errors: Tuple[str, ...]
    stimulus_ready_evidence: str
    stimulus_release_evidence: str
    abort_report: AbortReport


@dataclass(frozen=True)
class StimulusLease:
    """Auditable stimulus permit paired with a mandatory safe-down callback."""

    evidence: str
    release: Callable[[], str]


StimulusReadyGate = Callable[[], StimulusLease]


def run_average_measurement(
    transport: ScpiTransport,
    config: MeasurementConfig,
    stimulus_ready_gate: Optional[StimulusReadyGate] = None,
) -> MeasurementResult:
    """Run a deliberately two-phase zero/cal -> stimulus -> acquisition sequence.

    A power sensor has no RF output to disable. The external source and PSU remain
    the responsibility of the test-station orchestration layer. For a real bench,
    ``stimulus_ready_gate`` must enable/query-back a guarded low-level stimulus
    *after* zero/cal and return a lease with auditable evidence and an RF-OFF
    release callback. It must not be a pre-set boolean.
    """

    controller = U2061Controller(transport)
    preexisting_errors: List[str] = []
    stimulus_evidence = ""
    stimulus_release_evidence = ""
    stimulus_lease: Optional[StimulusLease] = None
    abort_report = AbortReport(False, ("workflow did not reach cleanup",))
    try:
        # This check intentionally lives inside try/finally: an already-opened
        # VISA resource is still aborted and closed if the permit is missing.
        if config.require_physical_confirmation and not config.sg_rf_off_confirmed:
            raise RuntimeError(
                "Actual acquisition requires an explicit SG RF OFF confirmation before zero/calibration."
            )
        trigger_source = config.trigger_source.strip().upper()
        if trigger_source not in {"IMM", "INT", "EXT", "BUS", "HOLD"}:
            raise ValueError("Unsupported trigger source {!r}".format(config.trigger_source))
        if trigger_source == "HOLD":
            raise ValueError(
                "HOLD cannot complete this workflow; select IMM/BUS or provide an INT/EXT event path."
            )

        identity = controller.identify()
        preexisting_errors = controller.drain_errors()
        controller.clear_status()
        controller.configure_average(config.frequency_hz, config.aperture_seconds)
        controller.zero_and_calibrate()

        # Phase boundary: the upstream source stayed OFF through zero/cal. Only
        # now may the station establish and verify its guarded stimulus.
        if stimulus_ready_gate is None:
            if config.require_physical_confirmation:
                raise RuntimeError(
                    "A post-zero low-level stimulus-ready gate is required before acquisition."
                )
            stimulus_lease = StimulusLease(
                evidence="dry-run deterministic -20 dBm sensor stimulus",
                release=lambda: "dry-run stimulus released",
            )
        else:
            stimulus_lease = stimulus_ready_gate()
            if not isinstance(stimulus_lease, StimulusLease):
                raise TypeError("Stimulus-ready gate must return a StimulusLease.")
        stimulus_evidence = stimulus_lease.evidence.strip()
        if not stimulus_evidence:
            raise RuntimeError("Stimulus-ready gate returned no verification evidence.")

        controller.configure_trigger(trigger_source)
        if trigger_source == "IMM":
            power_dbm = controller.read_immediate_dbm()
        else:
            controller.arm()
            if trigger_source == "BUS":
                controller.send_bus_trigger()
            power_dbm = controller.fetch_dbm()
    finally:
        cleanup_failures = []
        if stimulus_lease is not None:
            try:
                stimulus_release_evidence = stimulus_lease.release().strip()
                if not stimulus_release_evidence:
                    cleanup_failures.append("stimulus release returned no RF-OFF evidence")
            except Exception as error:
                cleanup_failures.append("stimulus release: {}".format(error))
        abort_report = controller.abort_acquisition()
        cleanup_failures.extend(abort_report.failures)
        if not abort_report.aborted and not cleanup_failures:
            cleanup_failures.append("ABOR was not confirmed")
        try:
            transport.close()
        except Exception as error:  # pragma: no cover - real backend failure path
            cleanup_failures.append("close: {}".format(error))
        if cleanup_failures:
            raise CleanupError("U2061XA cleanup failed: {}".format("; ".join(cleanup_failures)))

    return MeasurementResult(
        identity="{},{},{},{}".format(
            identity.vendor, identity.model, identity.serial, identity.firmware
        ),
        power_dbm=power_dbm,
        preexisting_errors=tuple(preexisting_errors),
        stimulus_ready_evidence=stimulus_evidence,
        stimulus_release_evidence=stimulus_release_evidence,
        abort_report=abort_report,
    )


@dataclass(frozen=True)
class PaPowerResult:
    power_convention: str
    pin_dbm: float
    pout_dbm: float
    gain_db: float
    dc_power_w: float
    drain_efficiency_percent: float
    pae_percent: float


def calculate_pa_power(
    input_sensor_dbm: float,
    input_correction_db: float,
    output_sensor_dbm: float,
    output_correction_db: float,
    supply_voltage_v: float,
    supply_current_a: float,
) -> PaPowerResult:
    values = (
        input_sensor_dbm,
        input_correction_db,
        output_sensor_dbm,
        output_correction_db,
        supply_voltage_v,
        supply_current_a,
    )
    if not all(math.isfinite(value) for value in values):
        raise ValueError("All PA power inputs must be finite")
    if supply_voltage_v <= 0 or supply_current_a <= 0:
        raise ValueError("Supply voltage and current must be greater than zero")
    pin_dbm = input_sensor_dbm + input_correction_db
    pout_dbm = output_sensor_dbm + output_correction_db
    pin_w = 10 ** ((pin_dbm - 30) / 10)
    pout_w = 10 ** ((pout_dbm - 30) / 10)
    dc_power_w = supply_voltage_v * supply_current_a
    return PaPowerResult(
        power_convention="forward-wave; accepted/delivered requires reverse-wave measurement",
        pin_dbm=pin_dbm,
        pout_dbm=pout_dbm,
        gain_db=pout_dbm - pin_dbm,
        dc_power_w=dc_power_w,
        drain_efficiency_percent=100 * pout_w / dc_power_w,
        pae_percent=100 * (pout_w - pin_w) / dc_power_w,
    )
