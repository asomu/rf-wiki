"""Command-line interface. Dry-run is intentionally the default."""

import argparse
import sys
from typing import List, Optional

from .driver import SUPPORTED_MODEL
from .transport import DryRunTransport, VisaTransport, format_dry_run
from .workflow import RunConfig, SessionSafetyError, run_session


def build_parser(fixed_mode: Optional[str] = None) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safely study and control a Keysight N5182B MXG with SCPI/PyVISA."
    )
    parser.add_argument(
        "--resource",
        default="MXG",
        help="VISA resource or Connection Expert alias (default: MXG)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="open the real VISA resource; without this flag all commands are dry-run only",
    )
    parser.add_argument(
        "--rf-on",
        action="store_true",
        help="allow RF ON briefly; requires --execute and RF is turned off in finally",
    )
    if fixed_mode is None:
        parser.add_argument("--mode", choices=("cw", "waveform"), default="cw")
    else:
        if fixed_mode not in {"cw", "waveform"}:
            raise ValueError("fixed_mode must be 'cw' or 'waveform'")
        parser.set_defaults(mode=fixed_mode)
    parser.add_argument("--frequency-hz", type=float, default=1_000_000_000.0)
    parser.add_argument("--power-dbm", type=float, default=-30.0)
    parser.add_argument(
        "--power-limit-dbm",
        type=float,
        default=-10.0,
        help="local safety ceiling; requested power may not exceed it",
    )
    parser.add_argument("--hold-seconds", type=float, default=2.0)
    parser.add_argument("--timeout-ms", type=int, default=10000)
    parser.add_argument("--waveform-name", default="RF_WIKI_IQ")
    parser.add_argument("--sample-rate-hz", type=float, default=100_000_000.0)
    parser.add_argument("--sample-count", type=int, default=4000)
    parser.add_argument("--tone-offset-hz", type=float, default=1_000_000.0)
    parser.add_argument("--iq-amplitude", type=float, default=0.5)
    parser.add_argument("--runtime-scale-percent", type=float, default=70.0)
    return parser


def validate_args(args: argparse.Namespace) -> None:
    if args.rf_on and not args.execute:
        raise ValueError("--rf-on requires --execute; dry-run never simulates permission")
    if args.timeout_ms <= 0:
        raise ValueError("--timeout-ms must be positive")


def main(
    argv: Optional[List[str]] = None, fixed_mode: Optional[str] = None
) -> int:
    parser = build_parser(fixed_mode=fixed_mode)
    args = parser.parse_args(argv)
    try:
        validate_args(args)
    except ValueError as exc:
        parser.error(str(exc))

    if args.execute:
        print(
            "EXECUTE mode: opening VISA resource {!r}; expected model {}.".format(
                args.resource, SUPPORTED_MODEL
            )
        )
        if args.rf_on:
            print(
                "RF permission granted for {:.3f} s at no more than {:.3f} dBm.".format(
                    args.hold_seconds, args.power_limit_dbm
                )
            )
        else:
            print("RF permission not granted: the instrument will remain RF OFF.")
        try:
            transport = VisaTransport.open(args.resource, args.timeout_ms)
        except Exception as exc:
            print("Connection failed: {}".format(exc), file=sys.stderr)
            return 1
    else:
        print("DRY RUN: no VISA session will be opened and no instrument can change state.")
        transport = DryRunTransport()

    config = RunConfig(
        mode=args.mode,
        frequency_hz=args.frequency_hz,
        power_dbm=args.power_dbm,
        power_limit_dbm=args.power_limit_dbm,
        rf_on=args.rf_on,
        hold_seconds=args.hold_seconds,
        waveform_name=args.waveform_name,
        sample_rate_hz=args.sample_rate_hz,
        sample_count=args.sample_count,
        tone_offset_hz=args.tone_offset_hz,
        iq_amplitude=args.iq_amplitude,
        runtime_scale_percent=args.runtime_scale_percent,
    )

    try:
        result = run_session(
            transport,
            config,
            event_sink=lambda message: print(
                "MXG session note: {}".format(message), file=sys.stderr
            ),
        )
    except Exception as exc:
        print("MXG workflow failed: {}".format(exc), file=sys.stderr)
        if isinstance(exc, SessionSafetyError) and exc.rf_state == "unknown":
            print(
                "SAFETY: RF STATE UNKNOWN. Verify the MXG front panel and bench "
                "interlocks before touching the DUT.",
                file=sys.stderr,
            )
        if isinstance(transport, DryRunTransport):
            print(format_dry_run(transport.history))
        return 1

    print(
        "Verified {}, serial {}, firmware {}.".format(
            result.identity.model, result.identity.serial, result.identity.firmware
        )
    )
    print(
        "Installed options: {}".format(
            ", ".join(sorted(result.option_codes)) or "none reported"
        )
    )
    print("Session complete; RF OFF was confirmed by cleanup query-back.")
    if isinstance(transport, DryRunTransport):
        print("\nSCPI preview\n------------")
        print(format_dry_run(transport.history))
    return 0
