"""N9020B command-line entry point; dry-run is the default."""

from __future__ import annotations

import argparse
import os
from typing import Sequence

from .driver import N9020B
from .transport import DryRunTransport, PyVisaTransport, format_history
from .workflow import (
    PowerSuiteRequest,
    SpectrumRequest,
    dry_run_input_envelope,
    require_input_safety_envelope,
    run_powersuite_measurement,
    run_safe_spectrum,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safe-by-default Keysight N9020B Swept-SA examples"
    )
    parser.add_argument("--mode", choices=("identify", "spectrum", "pa"), default="spectrum")
    parser.add_argument(
        "--resource",
        default=os.getenv("N9020B_VISA_RESOURCE", "N9020B"),
        help="Connection Expert VISA alias/resource; do not hard-code an IP",
    )
    parser.add_argument("--execute", action="store_true", help="Open the real VISA resource")
    parser.add_argument(
        "--acquire",
        action="store_true",
        help="With --execute, additionally initiate a real acquisition; dry-run always simulates one",
    )
    parser.add_argument("--center-hz", type=float, default=3.5e9)
    parser.add_argument("--span-hz", type=float, default=100e6)
    parser.add_argument("--reference-level-dbm", type=float, default=0.0)
    parser.add_argument("--rbw-hz", type=float, default=100e3)
    parser.add_argument("--vbw-hz", type=float, default=300e3)
    parser.add_argument("--points", type=int, default=1001)
    parser.add_argument("--detector", choices=("NORM", "POS", "SAMP", "NEG", "AVER"), default="NORM")
    parser.add_argument("--trigger-source", choices=("IMM", "EXT1", "RFB"), default="IMM")
    parser.add_argument("--attenuation-db", type=float, default=40.0)
    parser.add_argument("--measurement", choices=("CHP", "ACP", "OBW"), default="ACP")
    parser.add_argument(
        "--read-semantics",
        action="store_true",
        help="PowerSuite: use blocking READ? instead of INIT/*OPC?/FETC?",
    )

    safety = parser.add_argument_group("physical connector safety envelope (required with --execute)")
    safety.add_argument("--source-max-average-dbm", type=float)
    safety.add_argument(
        "--path-gain-db",
        type=float,
        help="Signed source-to-analyzer-connector path gain; 40 dB loss is -40",
    )
    safety.add_argument("--waveform-papr-db", type=float)
    safety.add_argument("--connector-average-limit-dbm", type=float)
    safety.add_argument("--connector-peak-limit-dbm", type=float)
    safety.add_argument("--dc-volts", type=float)
    safety.add_argument("--uncertainty-db", type=float, default=1.0)
    safety.add_argument("--guard-margin-db", type=float, default=3.0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.acquire and not args.execute:
        raise SystemExit("--acquire is only needed with --execute; dry-run already simulates acquisition")

    if args.mode == "identify":
        transport = PyVisaTransport.open(args.resource) if args.execute else DryRunTransport()
        analyzer = N9020B(transport)
        try:
            identity = analyzer.identify()
            print(
                "{},{},{},{} options={}".format(
                    identity.vendor,
                    identity.model,
                    identity.serial,
                    identity.firmware,
                    ",".join(identity.options),
                )
            )
        finally:
            analyzer.close()
        if isinstance(transport, DryRunTransport):
            print("\nDRY RUN · no VISA resource opened")
            print(format_history(transport.history))
        return 0

    try:
        safety_envelope = require_input_safety_envelope(
            required=args.execute,
            source_max_average_dbm=args.source_max_average_dbm,
            path_gain_db=args.path_gain_db,
            waveform_papr_db=args.waveform_papr_db,
            connector_average_limit_dbm=args.connector_average_limit_dbm,
            connector_peak_limit_dbm=args.connector_peak_limit_dbm,
            dc_volts=args.dc_volts,
            uncertainty_db=args.uncertainty_db,
            guard_margin_db=args.guard_margin_db,
        )
        if safety_envelope is None:
            safety_envelope = dry_run_input_envelope()
        estimate = safety_envelope.evaluate(
            input_attenuation_db=args.attenuation_db,
            reference_level_dbm=args.reference_level_dbm,
            preamp_enabled=False,
        )
    except ValueError as error:
        # This validation occurs before PyVisaTransport.open by design.
        raise SystemExit(str(error)) from error

    transport = PyVisaTransport.open(args.resource) if args.execute else DryRunTransport()
    analyzer = N9020B(transport)
    acquire = args.acquire if args.execute else True
    if args.mode == "pa":
        result = run_powersuite_measurement(
            analyzer,
            PowerSuiteRequest(
                measurement=args.measurement,
                center_hz=args.center_hz,
                reference_level_dbm=args.reference_level_dbm,
                attenuation_db=args.attenuation_db,
                use_read=args.read_semantics,
            ),
            acquire=acquire,
            safety_envelope=safety_envelope,
        )
        if result is None:
            print("Configured {} safely; acquisition not requested".format(args.measurement))
        else:
            print("{} raw result: {}".format(result.measurement, result.raw_values))
            print("Interpret fields only against the active N9060 measurement/version result contract.")
    else:
        result = run_safe_spectrum(
            analyzer,
            SpectrumRequest(
                center_hz=args.center_hz,
                span_hz=args.span_hz,
                reference_level_dbm=args.reference_level_dbm,
                rbw_hz=args.rbw_hz,
                vbw_hz=args.vbw_hz,
                points=args.points,
                detector=args.detector,
                trigger_source=args.trigger_source,
                attenuation_db=args.attenuation_db,
            ),
            acquire=acquire,
            safety_envelope=safety_envelope,
        )
        if result is None:
            print("Configured Swept SA safely; acquisition not requested")
        else:
            print(
                "TRACE1 points={} peak={:.3f} dBm @ {:.6f} GHz".format(
                    len(result.levels_dbm),
                    result.marker_level_dbm,
                    result.marker_frequency_hz / 1e9,
                )
            )

    print(
        "Input estimate: average={:.2f} dBm peak={:.2f} dBm mixer={:.2f} dBm".format(
            estimate.connector_average_worst_dbm,
            estimate.connector_peak_worst_dbm,
            estimate.mixer_peak_worst_dbm,
        )
    )
    print("ABOR does not remove RF or DC from the analyzer connector.")
    if isinstance(transport, DryRunTransport):
        print("\nDRY RUN · no VISA resource opened")
        print(format_history(transport.history))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
