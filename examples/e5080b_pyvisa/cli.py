from __future__ import annotations

import argparse
import os

from .driver import E5080B
from .transport import DryRunTransport, PyVisaTransport
from .workflow import SweepRequest, require_power_safety_envelope, run_safe_sweep


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Safe-by-default Keysight E5080B sweep")
    result.add_argument("--resource", default=os.getenv("E5080B_VISA_RESOURCE", "E5080B"), help="Connection Expert VISA alias/resource")
    result.add_argument("--start-hz", type=float, default=1e9)
    result.add_argument("--stop-hz", type=float, default=6e9)
    result.add_argument("--points", type=int, default=201)
    result.add_argument("--if-bandwidth-hz", type=float, default=1e3)
    result.add_argument("--power-dbm", type=float, default=-30.0)
    result.add_argument("--power-limit-dbm", type=float, default=-20.0)
    result.add_argument("--parameter", choices=("S11", "S21", "S12", "S22"), default="S21")
    result.add_argument("--execute", action="store_true", help="Open the real VISA resource")
    result.add_argument("--rf-on", action="store_true", help="Additionally consent to source RF ON")
    result.add_argument("--reverse-drive", action="store_true", help="Additionally consent to S12/S22 source drive from port 2")
    result.add_argument("--dut-input-limit-dbm", type=float, help="Working limit at the driven DUT reference plane")
    result.add_argument("--receiver-input-limit-dbm", type=float, help="Station working limit at the receiving VNA port")
    result.add_argument("--maximum-dut-gain-db", type=float, help="Conservative maximum DUT gain across this sweep")
    result.add_argument("--forward-path-gain-db", type=float, default=0.0, help="Signed source-to-DUT path gain; cable loss is negative")
    result.add_argument("--receiver-path-gain-db", type=float, default=0.0, help="Signed DUT-output-to-receiver path gain; attenuation is negative")
    result.add_argument("--uncertainty-db", type=float, default=1.0)
    result.add_argument("--guard-margin-db", type=float, default=3.0)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.rf_on and not args.execute:
        raise SystemExit("--rf-on requires --execute; dry-run never enables physical RF")
    if args.reverse_drive and not (args.execute and args.rf_on):
        raise SystemExit("--reverse-drive requires --execute and --rf-on")
    if args.parameter in {"S12", "S22"} and args.execute and args.rf_on and not args.reverse_drive:
        raise SystemExit("S12/S22 physical source drive additionally requires --reverse-drive")
    try:
        safety_envelope = require_power_safety_envelope(
            required=args.execute and args.rf_on,
            dut_input_limit_dbm=args.dut_input_limit_dbm,
            receiver_input_limit_dbm=args.receiver_input_limit_dbm,
            maximum_dut_gain_db=args.maximum_dut_gain_db,
            forward_path_gain_db=args.forward_path_gain_db,
            receiver_path_gain_db=args.receiver_path_gain_db,
            uncertainty_db=args.uncertainty_db,
            guard_margin_db=args.guard_margin_db,
        )
        if safety_envelope is not None:
            safety_envelope.evaluate(args.power_dbm, args.power_limit_dbm)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    transport = PyVisaTransport(args.resource) if args.execute else DryRunTransport()
    request = SweepRequest(args.start_hz, args.stop_hz, args.points, args.if_bandwidth_hz, args.power_dbm, args.power_limit_dbm, args.parameter)
    run_safe_sweep(
        E5080B(transport),
        request,
        enable_rf=args.execute and args.rf_on,
        reverse_drive_consent=args.reverse_drive,
        safety_envelope=safety_envelope,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
