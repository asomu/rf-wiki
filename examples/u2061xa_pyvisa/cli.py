"""Command-line entry point; dry-run is the default and opens no VISA session."""

import argparse
from typing import Optional, Sequence

from .transport import DryRunTransport, VisaTransport, format_history
from .workflow import MeasurementConfig, StimulusLease, calculate_pa_power, run_average_measurement


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safe Keysight U2061XA PyVISA examples")
    parser.add_argument("--mode", choices=("identify", "average", "pa"), default="average")
    parser.add_argument("--resource", default="U2061XA", help="Connection Expert VISA alias")
    parser.add_argument("--frequency-hz", type=float, default=3.5e9)
    parser.add_argument("--aperture-seconds", type=float, default=1e-3)
    parser.add_argument("--trigger-source", choices=("IMM", "INT", "EXT", "BUS", "HOLD"), default="IMM")
    parser.add_argument("--execute", action="store_true", help="Open the actual VISA resource")
    parser.add_argument(
        "--sg-rf-off-confirmed",
        action="store_true",
        help="Required with --execute; confirms the external SG is RF OFF before zero/cal",
    )
    parser.add_argument(
        "--confirm-stimulus-at-boundary",
        action="store_true",
        help="After zero/cal, pause for a separate guarded low-level stimulus permit",
    )
    return parser


def _interactive_stimulus_gate() -> StimulusLease:
    print("Zero/calibration complete with upstream RF OFF.")
    print("Establish the guarded low-level stimulus, query it back, then type STIMULUS READY.")
    response = input("permit> ").strip()
    if response != "STIMULUS READY":
        raise RuntimeError("Low-level stimulus permit was not confirmed.")

    def release_stimulus() -> str:
        print("Set the upstream SG RF OFF, verify query-back, then type SG RF OFF.")
        if input("cleanup> ").strip() != "SG RF OFF":
            return ""
        return "human cleanup permit: SG RF OFF query-back confirmed"

    return StimulusLease(
        evidence="human boundary permit: guarded low-level stimulus query-back confirmed",
        release=release_stimulus,
    )


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.execute and args.mode == "average" and not args.sg_rf_off_confirmed:
        raise SystemExit("actual average acquisition requires --sg-rf-off-confirmed")
    if args.execute and args.mode == "average" and not args.confirm_stimulus_at_boundary:
        raise SystemExit(
            "actual average acquisition requires --confirm-stimulus-at-boundary; "
            "automation should call run_average_measurement with a verified station callback"
        )

    if args.mode == "pa":
        result = calculate_pa_power(-10.0, 20.0, 0.0, 40.0, 28.0, 0.5)
        print("PA calculation only; no instrument session opened")
        print("Pin={:.2f} dBm Pout={:.2f} dBm Gain={:.2f} dB PAE={:.2f}%".format(
            result.pin_dbm, result.pout_dbm, result.gain_db, result.pae_percent
        ))
        return 0

    transport = VisaTransport.open(args.resource) if args.execute else DryRunTransport()
    if args.mode == "identify":
        from .driver import U2061Controller

        controller = U2061Controller(transport)
        try:
            identity = controller.identify()
            print(identity)
        finally:
            transport.close()
        if isinstance(transport, DryRunTransport):
            print(format_history(transport.history))
        return 0

    result = run_average_measurement(
        transport,
        MeasurementConfig(
            frequency_hz=args.frequency_hz,
            aperture_seconds=args.aperture_seconds,
            trigger_source=args.trigger_source,
            sg_rf_off_confirmed=args.sg_rf_off_confirmed,
            require_physical_confirmation=args.execute,
        ),
        stimulus_ready_gate=_interactive_stimulus_gate if args.execute else None,
    )
    print("{}\nPower={:.3f} dBm".format(result.identity, result.power_dbm))
    print("Stimulus evidence: {}".format(result.stimulus_ready_evidence))
    print("Stimulus cleanup: {}".format(result.stimulus_release_evidence))
    if result.preexisting_errors:
        print("Pre-existing errors:")
        for error in result.preexisting_errors:
            print("  {}".format(error))
    if isinstance(transport, DryRunTransport):
        print("\nDRY RUN · no VISA resource opened")
        print(format_history(transport.history))
    return 0
