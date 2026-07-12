"""Conservative PA input sweep referenced to the DUT plane, not the SG port."""

import argparse
from dataclasses import dataclass
import math
import sys
import time
from typing import Callable, List, Optional, Sequence, Tuple

from .driver import InstrumentIdentity, SUPPORTED_MODEL
from .transport import DryRunTransport, ScpiTransport, VisaTransport, format_dry_run
from .waveform import generate_iq_tone
from .workflow import SessionSafetyError, managed_mxg_session


@dataclass(frozen=True)
class DutPlaneBudget:
    max_average_input_dbm: float
    max_peak_input_dbm: float
    path_gain_db: float
    path_loss_db: float
    uncertainty_db: float
    guard_db: float
    waveform_papr_db: float

    def validate(self) -> None:
        values = (
            self.max_average_input_dbm,
            self.max_peak_input_dbm,
            self.path_gain_db,
            self.path_loss_db,
            self.uncertainty_db,
            self.guard_db,
            self.waveform_papr_db,
        )
        if not all(math.isfinite(value) for value in values):
            raise ValueError("all DUT-plane budget values must be finite")
        if self.path_gain_db < 0 or self.path_loss_db < 0:
            raise ValueError("path gain and path loss must be non-negative magnitudes")
        if self.uncertainty_db < 0 or self.guard_db < 0:
            raise ValueError("uncertainty and guard must be non-negative")
        if self.waveform_papr_db < 0:
            raise ValueError("waveform PAPR must be non-negative")

    @property
    def net_path_gain_db(self) -> float:
        return self.path_gain_db - self.path_loss_db

    def setpoint_ceiling_dbm(self, modulated: bool) -> float:
        """Largest SG average setpoint satisfying average and peak DUT limits."""

        self.validate()
        papr_db = self.waveform_papr_db if modulated else 0.0
        common_margin_db = self.uncertainty_db + self.guard_db
        average_ceiling = (
            self.max_average_input_dbm
            - self.net_path_gain_db
            - common_margin_db
        )
        peak_ceiling = (
            self.max_peak_input_dbm
            - self.net_path_gain_db
            - common_margin_db
            - papr_db
        )
        return min(average_ceiling, peak_ceiling)

    def budgeted_dut_average_dbm(self, sg_setpoint_dbm: float) -> float:
        return (
            sg_setpoint_dbm
            + self.net_path_gain_db
            + self.uncertainty_db
            + self.guard_db
        )

    def budgeted_dut_peak_dbm(
        self, sg_setpoint_dbm: float, modulated: bool
    ) -> float:
        papr_db = self.waveform_papr_db if modulated else 0.0
        return self.budgeted_dut_average_dbm(sg_setpoint_dbm) + papr_db


@dataclass(frozen=True)
class PaSweepConfig:
    mode: str
    frequency_hz: float
    points_dbm: Tuple[float, ...]
    rf_on: bool
    hold_seconds: float
    waveform_name: str = "RF_WIKI_PA_SWEEP"
    sample_rate_hz: float = 100_000_000.0
    sample_count: int = 4000
    tone_offset_hz: float = 1_000_000.0
    iq_amplitude: float = 0.5
    runtime_scale_percent: float = 70.0
    stimulus_duty_cycle_percent: float = 10.0
    max_duty_cycle_percent: float = 10.0

    def validate(self) -> None:
        if self.mode not in {"cw", "waveform"}:
            raise ValueError("mode must be 'cw' or 'waveform'")
        if not self.points_dbm:
            raise ValueError("the sweep must contain at least one point")
        if not all(math.isfinite(point) for point in self.points_dbm):
            raise ValueError("all sweep points must be finite")
        if any(
            later <= earlier
            for earlier, later in zip(self.points_dbm, self.points_dbm[1:])
        ):
            raise ValueError("sweep points must be strictly increasing")
        if (
            not math.isfinite(self.hold_seconds)
            or self.hold_seconds < 0
            or self.hold_seconds > 60
        ):
            raise ValueError("hold_seconds must be in [0, 60]")
        if not math.isfinite(
            self.stimulus_duty_cycle_percent
        ) or not math.isfinite(self.max_duty_cycle_percent):
            raise ValueError("duty-cycle values must be finite")
        if not 0 <= self.stimulus_duty_cycle_percent <= 100:
            raise ValueError("stimulus duty cycle must be in [0, 100]")
        if not 0 <= self.max_duty_cycle_percent <= 100:
            raise ValueError("maximum duty cycle must be in [0, 100]")
        if self.stimulus_duty_cycle_percent > self.max_duty_cycle_percent:
            raise ValueError(
                "stimulus duty cycle {:.3f}% exceeds allowed maximum {:.3f}%".format(
                    self.stimulus_duty_cycle_percent,
                    self.max_duty_cycle_percent,
                )
            )
        if self.rf_on and self.stimulus_duty_cycle_percent == 0:
            raise ValueError("RF ON is incompatible with a declared 0% duty cycle")

    def off_dwell_seconds(self) -> float:
        if not self.rf_on or self.stimulus_duty_cycle_percent >= 100:
            return 0.0
        if self.stimulus_duty_cycle_percent <= 0:
            return 0.0
        return self.hold_seconds * (
            100.0 - self.stimulus_duty_cycle_percent
        ) / self.stimulus_duty_cycle_percent


@dataclass(frozen=True)
class PaSweepPoint:
    sg_setpoint_dbm: float
    budgeted_dut_average_dbm: float
    budgeted_dut_peak_dbm: float


@dataclass(frozen=True)
class PaSweepResult:
    identity: InstrumentIdentity
    setpoint_ceiling_dbm: float
    points: Tuple[PaSweepPoint, ...]
    rf_was_enabled: bool


def make_sweep_points(
    start_dbm: float, stop_dbm: float, step_db: float
) -> Tuple[float, ...]:
    if not all(math.isfinite(value) for value in (start_dbm, stop_dbm, step_db)):
        raise ValueError("sweep start, stop and step must be finite")
    if step_db <= 0:
        raise ValueError("sweep step must be positive")
    if stop_dbm < start_dbm:
        raise ValueError("sweep stop must be greater than or equal to start")
    point_count = int(math.floor((stop_dbm - start_dbm) / step_db + 1e-12)) + 1
    if point_count > 1000:
        raise ValueError("sweep is limited to 1000 points")
    return tuple(start_dbm + index * step_db for index in range(point_count))


def run_pa_sweep(
    transport: ScpiTransport,
    config: PaSweepConfig,
    budget: DutPlaneBudget,
    sleep_fn: Callable[[float], None] = time.sleep,
    event_sink: Optional[Callable[[str], None]] = None,
) -> PaSweepResult:
    with managed_mxg_session(transport, event_sink) as session:
        config.validate()
        budget.validate()
        modulated = config.mode == "waveform"
        ceiling_dbm = budget.setpoint_ceiling_dbm(modulated)
        highest_setpoint_dbm = max(config.points_dbm)
        if highest_setpoint_dbm > ceiling_dbm + 1e-12:
            raise ValueError(
                "highest SG setpoint {:.3f} dBm exceeds DUT-plane budget ceiling "
                "{:.3f} dBm".format(highest_setpoint_dbm, ceiling_dbm)
            )

        samples = None
        if modulated:
            samples = generate_iq_tone(
                config.sample_count,
                config.sample_rate_hz,
                config.tone_offset_hz,
                config.iq_amplitude,
            )

        measured_points: List[PaSweepPoint] = []
        for setpoint_dbm in config.points_dbm:
            if modulated:
                if samples is None:
                    raise RuntimeError("waveform samples were not generated")
                session.controller.configure_iq_waveform(
                    config.waveform_name,
                    samples,
                    config.sample_rate_hz,
                    config.runtime_scale_percent,
                    config.frequency_hz,
                    setpoint_dbm,
                    ceiling_dbm,
                )
            else:
                session.controller.configure_cw(
                    config.frequency_hz,
                    setpoint_dbm,
                    ceiling_dbm,
                )

            if config.rf_on:
                session.controller.rf_on()
                sleep_fn(config.hold_seconds)
                session.controller.rf_off_verified()
                off_dwell_seconds = config.off_dwell_seconds()
                if off_dwell_seconds > 0:
                    sleep_fn(off_dwell_seconds)

            measured_points.append(
                PaSweepPoint(
                    setpoint_dbm,
                    budget.budgeted_dut_average_dbm(setpoint_dbm),
                    budget.budgeted_dut_peak_dbm(setpoint_dbm, modulated),
                )
            )

        return PaSweepResult(
            session.identity,
            ceiling_dbm,
            tuple(measured_points),
            config.rf_on,
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Sweep an N5182B from a conservative DUT-plane input budget."
    )
    parser.add_argument("--resource", default="MXG")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument(
        "--rf-on",
        action="store_true",
        help="permit brief output at each point; requires --execute",
    )
    parser.add_argument("--timeout-ms", type=int, default=10000)
    parser.add_argument("--mode", choices=("cw", "waveform"), default="cw")
    parser.add_argument("--frequency-hz", type=float, default=1_000_000_000.0)
    parser.add_argument("--start-dbm", type=float, default=-30.0)
    parser.add_argument("--stop-dbm", type=float, default=-20.0)
    parser.add_argument("--step-db", type=float, default=2.0)
    parser.add_argument("--hold-seconds", type=float, default=0.25)
    parser.add_argument("--max-dut-average-dbm", type=float, default=-10.0)
    parser.add_argument("--max-dut-peak-dbm", type=float, default=0.0)
    parser.add_argument("--path-gain-db", type=float, default=0.0)
    parser.add_argument("--path-loss-db", type=float, default=2.0)
    parser.add_argument("--uncertainty-db", type=float, default=0.5)
    parser.add_argument("--guard-db", type=float, default=3.0)
    parser.add_argument("--waveform-papr-db", type=float, default=10.0)
    parser.add_argument("--stimulus-duty-cycle-percent", type=float, default=10.0)
    parser.add_argument("--max-duty-cycle-percent", type=float, default=10.0)
    parser.add_argument("--waveform-name", default="RF_WIKI_PA_SWEEP")
    parser.add_argument("--sample-rate-hz", type=float, default=100_000_000.0)
    parser.add_argument("--sample-count", type=int, default=4000)
    parser.add_argument("--tone-offset-hz", type=float, default=1_000_000.0)
    parser.add_argument("--iq-amplitude", type=float, default=0.5)
    parser.add_argument("--runtime-scale-percent", type=float, default=70.0)
    return parser


def _print_unknown_rf_warning(error: Exception) -> None:
    if isinstance(error, SessionSafetyError) and error.rf_state == "unknown":
        print(
            "SAFETY: RF STATE UNKNOWN. Verify the MXG front panel and bench "
            "interlocks before touching the DUT.",
            file=sys.stderr,
        )


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.rf_on and not args.execute:
        parser.error("--rf-on requires --execute; dry-run never simulates permission")
    if args.timeout_ms <= 0:
        parser.error("--timeout-ms must be positive")

    try:
        points = make_sweep_points(args.start_dbm, args.stop_dbm, args.step_db)
        budget = DutPlaneBudget(
            args.max_dut_average_dbm,
            args.max_dut_peak_dbm,
            args.path_gain_db,
            args.path_loss_db,
            args.uncertainty_db,
            args.guard_db,
            args.waveform_papr_db,
        )
        config = PaSweepConfig(
            mode=args.mode,
            frequency_hz=args.frequency_hz,
            points_dbm=points,
            rf_on=args.rf_on,
            hold_seconds=args.hold_seconds,
            waveform_name=args.waveform_name,
            sample_rate_hz=args.sample_rate_hz,
            sample_count=args.sample_count,
            tone_offset_hz=args.tone_offset_hz,
            iq_amplitude=args.iq_amplitude,
            runtime_scale_percent=args.runtime_scale_percent,
            stimulus_duty_cycle_percent=args.stimulus_duty_cycle_percent,
            max_duty_cycle_percent=args.max_duty_cycle_percent,
        )
        budget.validate()
        config.validate()
        ceiling_dbm = budget.setpoint_ceiling_dbm(args.mode == "waveform")
        if max(points) > ceiling_dbm + 1e-12:
            raise ValueError(
                "requested stop point exceeds the {:.3f} dBm DUT-plane ceiling".format(
                    ceiling_dbm
                )
            )
    except ValueError as error:
        parser.error(str(error))

    if args.execute:
        print(
            "EXECUTE mode: opening {!r}; expected model {}.".format(
                args.resource, SUPPORTED_MODEL
            )
        )
        try:
            transport = VisaTransport.open(args.resource, args.timeout_ms)
        except Exception as error:
            print("Connection failed: {}".format(error), file=sys.stderr)
            return 1
    else:
        print("DRY RUN: no VISA session will be opened and RF cannot turn on.")
        transport = DryRunTransport()

    print(
        "DUT-plane ceiling: {:.3f} dBm SG average setpoint; net path {:+.3f} dB, "
        "uncertainty {:.3f} dB, guard {:.3f} dB, effective PAPR {:.3f} dB, "
        "declared duty {:.3f}% <= {:.3f}%.".format(
            ceiling_dbm,
            budget.net_path_gain_db,
            budget.uncertainty_db,
            budget.guard_db,
            budget.waveform_papr_db if args.mode == "waveform" else 0.0,
            config.stimulus_duty_cycle_percent,
            config.max_duty_cycle_percent,
        )
    )

    try:
        result = run_pa_sweep(
            transport,
            config,
            budget,
            event_sink=lambda message: print(
                "MXG session note: {}".format(message), file=sys.stderr
            ),
        )
    except Exception as error:
        print("PA stimulus sweep failed: {}".format(error), file=sys.stderr)
        _print_unknown_rf_warning(error)
        if isinstance(transport, DryRunTransport):
            print(format_dry_run(transport.history))
        return 1

    for point in result.points:
        print(
            "SG {:+.3f} dBm -> budgeted DUT average {:+.3f} dBm, peak {:+.3f} dBm".format(
                point.sg_setpoint_dbm,
                point.budgeted_dut_average_dbm,
                point.budgeted_dut_peak_dbm,
            )
        )
    print("Sweep complete; RF OFF was confirmed by cleanup query-back.")
    if isinstance(transport, DryRunTransport):
        print("\nSCPI preview\n------------")
        print(format_dry_run(transport.history))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
