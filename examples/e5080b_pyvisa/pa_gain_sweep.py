from __future__ import annotations

import argparse
import os

from .driver import E5080B
from .transport import DryRunTransport, PyVisaTransport
from .workflow import require_power_safety_envelope


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="E5080B PA stimulus skeleton; measurement orchestration is station-specific")
    parser.add_argument("--resource", default=os.getenv("E5080B_VISA_RESOURCE", "E5080B"))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--rf-on", action="store_true")
    parser.add_argument("--start-power-dbm", type=float, default=-40.0)
    parser.add_argument("--stop-power-dbm", type=float, default=-30.0)
    parser.add_argument("--step-db", type=float, default=1.0)
    parser.add_argument("--frequency-hz", type=float, default=3.5e9)
    parser.add_argument("--power-limit-dbm", type=float, default=-20.0)
    parser.add_argument("--dut-input-limit-dbm", type=float)
    parser.add_argument("--receiver-input-limit-dbm", type=float)
    parser.add_argument("--maximum-dut-gain-db", type=float)
    parser.add_argument("--forward-path-gain-db", type=float, default=0.0)
    parser.add_argument("--receiver-path-gain-db", type=float, default=0.0)
    parser.add_argument("--uncertainty-db", type=float, default=1.0)
    parser.add_argument("--guard-margin-db", type=float, default=3.0)
    args = parser.parse_args(argv)
    if args.rf_on and not args.execute:
        raise SystemExit("--rf-on requires --execute")
    if args.step_db <= 0 or args.stop_power_dbm < args.start_power_dbm:
        raise SystemExit("Require positive --step-db and stop >= start")
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
            safety_envelope.evaluate(args.stop_power_dbm, args.power_limit_dbm)
    except ValueError as error:
        raise SystemExit(str(error)) from error

    vna = E5080B(PyVisaTransport(args.resource) if args.execute else DryRunTransport())
    try:
        vna.identify()
        vna.output_off()
        vna.transport.write("*CLS")
        vna.set_power_limit(args.power_limit_dbm)
        level = args.start_power_dbm
        while level <= args.stop_power_dbm + 1e-9:
            vna.output_off()
            vna.configure_sweep(
                start_hz=args.frequency_hz * 0.999999,
                stop_hz=args.frequency_hz * 1.000001,
                points=3,
                if_bandwidth_hz=1e3,
                power_dbm=level,
                parameter="S21",
            )
            if vna.transport.query("*OPC?").strip() != "1":
                raise RuntimeError("PA stimulus configuration did not complete")
            vna.verify_configuration(
                start_hz=args.frequency_hz * 0.999999,
                stop_hz=args.frequency_hz * 1.000001,
                points=3,
                if_bandwidth_hz=1e3,
                power_dbm=level,
                power_limit_dbm=args.power_limit_dbm,
            )
            vna.assert_no_errors(f"PA stimulus point {level:g} dBm before RF enable")
            if args.execute and args.rf_on:
                if safety_envelope is None:
                    raise PermissionError("Physical PA sweep requires a DUT/receiver power safety envelope")
                estimate = safety_envelope.evaluate(level, args.power_limit_dbm)
                vna.output_on(consent=True)
                try:
                    vna.sweep_and_wait()
                    # Fetch calibrated Pin/Pout/current/temperature from the station
                    # before committing this point. The VNA alone does not provide PAE/EVM/ACLR.
                finally:
                    vna.output_off_and_confirm()
                print(
                    f"POINT target_pin_dbm={level:g} dut_worst_dbm={estimate.dut_input_worst_dbm:g} "
                    f"receiver_worst_dbm={estimate.receiver_input_worst_dbm:g} status=rf-off-confirmed"
                )
            else:
                print(f"POINT target_pin_dbm={level:g} status=dry-run-rf-off")
            level += args.step_db
    finally:
        try:
            vna.output_off_and_confirm()
        finally:
            try:
                vna.assert_no_errors("cleanup")
            finally:
                vna.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
