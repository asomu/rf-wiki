"""Configure and acquire one corrected complex S-parameter trace."""

from __future__ import annotations

import argparse
import os

from .driver import E5080B
from .transport import DryRunTransport, PyVisaTransport
from .workflow import require_power_safety_envelope


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Acquire E5080B SDATA; dry-run by default")
    parser.add_argument("--resource", default=os.getenv("E5080B_VISA_RESOURCE", "E5080B"))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--rf-on", action="store_true")
    parser.add_argument("--reverse-drive", action="store_true", help="Additional consent required for S12/S22 physical source drive")
    parser.add_argument("--expected-calset", help="Required for a physical corrected trace; must match the active CalSet name")
    parser.add_argument("--start-hz", type=float, default=1e9)
    parser.add_argument("--stop-hz", type=float, default=6e9)
    parser.add_argument("--points", type=int, default=201)
    parser.add_argument("--if-bandwidth-hz", type=float, default=1e3)
    parser.add_argument("--power-dbm", type=float, default=-30.0)
    parser.add_argument("--power-limit-dbm", type=float, default=-20.0)
    parser.add_argument("--parameter", choices=("S11", "S21", "S12", "S22"), default="S21")
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
    if args.reverse_drive and not (args.execute and args.rf_on):
        raise SystemExit("--reverse-drive requires --execute and --rf-on")
    if args.parameter in {"S12", "S22"} and args.execute and args.rf_on and not args.reverse_drive:
        raise SystemExit("S12/S22 physical source drive additionally requires --reverse-drive")
    if args.execute and args.rf_on and not args.expected_calset:
        raise SystemExit("Physical corrected SDATA requires --expected-calset")
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

    vna = E5080B(PyVisaTransport(args.resource) if args.execute else DryRunTransport())
    try:
        vna.identify()
        vna.output_off()
        vna.transport.write("*CLS")
        vna.set_power_limit(args.power_limit_dbm)
        vna.configure_sweep(
            start_hz=args.start_hz,
            stop_hz=args.stop_hz,
            points=args.points,
            if_bandwidth_hz=args.if_bandwidth_hz,
            power_dbm=args.power_dbm,
            parameter=args.parameter,
        )
        vna.transport.query("*OPC?")
        vna.verify_configuration(
            start_hz=args.start_hz,
            stop_hz=args.stop_hz,
            points=args.points,
            if_bandwidth_hz=args.if_bandwidth_hz,
            power_dbm=args.power_dbm,
            power_limit_dbm=args.power_limit_dbm,
        )
        vna.assert_no_errors("before corrected acquisition RF enable")
        vna.set_and_verify_ascii_data_format()
        active_calset = vna.verify_correction(args.expected_calset)
        vna.assert_no_errors("after data-format and correction/CalSet verification")
        if args.execute and args.rf_on:
            if safety_envelope is None:
                raise PermissionError("Physical acquisition requires a power safety envelope")
            safety_envelope.evaluate(args.power_dbm, args.power_limit_dbm)
            vna.output_on(consent=True, reverse_drive_consent=args.reverse_drive)
            vna.sweep_and_wait()
            trace = vna.read_ascii_sdata()
            print(f"TRACE corrected_calset={active_calset} parameter={args.parameter} points={len(trace.values)}")
            for frequency, value in zip(trace.frequencies_hz[:3], trace.values[:3], strict=True):
                print(f"DATA frequency_hz={frequency:g} real={value.real:g} imag={value.imag:g}")
        else:
            # Show the two data queries without parsing fabricated measurement values.
            frequency_query, sdata_query = vna.selected_ascii_data_queries()
            vna.transport.query(frequency_query)
            vna.transport.query(sdata_query)
            print(f"DRY-RUN verified_calset={active_calset}; no physical trace was acquired")
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
