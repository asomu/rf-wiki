"""Identify an N5182B and decode its relevant frequency/ARB options safely."""

import argparse
import sys
from typing import List, Optional

from .driver import SUPPORTED_MODEL
from .transport import DryRunTransport, VisaTransport, format_dry_run
from .workflow import SessionSafetyError, run_identification_session


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Read N5182B identity/options with RF forced OFF."
    )
    parser.add_argument(
        "--resource",
        default="MXG",
        help="VISA resource or Connection Expert alias (default: MXG)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="open the real VISA resource; default is an offline dry-run",
    )
    parser.add_argument("--timeout-ms", type=int, default=10000)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.timeout_ms <= 0:
        parser.error("--timeout-ms must be positive")

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
        print("DRY RUN: no VISA session will be opened.")
        transport = DryRunTransport()

    try:
        result = run_identification_session(
            transport,
            event_sink=lambda message: print(
                "MXG session note: {}".format(message), file=sys.stderr
            ),
        )
    except Exception as error:
        print("MXG identification failed: {}".format(error), file=sys.stderr)
        if isinstance(error, SessionSafetyError) and error.rf_state == "unknown":
            print(
                "SAFETY: RF STATE UNKNOWN. Verify the MXG front panel and bench "
                "interlocks.",
                file=sys.stderr,
            )
        if isinstance(transport, DryRunTransport):
            print(format_dry_run(transport.history))
        return 1

    capabilities = result.capabilities
    print(
        "Verified {}, serial {}, firmware {}.".format(
            result.identity.model,
            result.identity.serial,
            result.identity.firmware,
        )
    )
    print(
        "Options: {}".format(
            ", ".join(sorted(capabilities.option_codes)) or "none reported"
        )
    )
    print(
        "Decoded limits: RF <= {} Hz, ARB clock <= {} Sa/s, ARB={}.".format(
            capabilities.max_frequency_hz,
            capabilities.max_arb_sample_rate_hz,
            "yes" if capabilities.has_arb else "no",
        )
    )
    print("Session complete; RF OFF was confirmed by cleanup query-back.")
    if isinstance(transport, DryRunTransport):
        print("\nSCPI preview\n------------")
        print(format_dry_run(transport.history))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
