"""Command-line entry: dry-run unless --execute; output needs a second permit."""

from __future__ import annotations

import argparse

from .driver import CleanupError, N6705cN6752a, SafeBiasConfig
from .transport import DryRunTransport, VisaTransport


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Safe N6705C/N6752A bias example")
    result.add_argument("--resource", default="N6705C", help="Connection Expert VISA alias")
    result.add_argument("--execute", action="store_true", help="connect to the configured VISA resource")
    result.add_argument("--output-on", action="store_true", help="separate permission to energize slot 1")
    result.add_argument("--voltage", type=float, default=28.0)
    result.add_argument("--current-limit", type=float, default=0.25)
    result.add_argument("--ovp", type=float, default=30.0)
    result.add_argument("--slew", type=float, default=1_000.0)
    return result


def run(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.output_on and not args.execute:
        parser().error("--output-on requires --execute; dry-run can never energize hardware")
    config = SafeBiasConfig(args.voltage, args.current_limit, args.ovp, args.slew)
    config.validate()
    transport = VisaTransport(args.resource) if args.execute else DryRunTransport()
    instrument = N6705cN6752a(transport)
    result = 0
    try:
        identity, module, options = instrument.identify_and_verify_scope()
        instrument.output_off()
        instrument.configure(config)
        instrument.assert_no_errors("configuration")
        instrument.query_back(config)
        instrument.assert_no_errors("query-back")
        if args.output_on:
            instrument.enable_output(permit=True)
        print(f"scope: {identity} · {module} · option {options}")
        print(f"state: {config.voltage_v:g} V, {config.current_limit_a:g} A limit, output {'ON' if args.output_on else 'OFF'}")
        if isinstance(transport, DryRunTransport):
            print("dry-run transcript:")
            for direction, message in transport.transcript:
                print(f"  {'?' if direction == 'query' else '>'} {message}")
    except Exception as exc:
        result = 1
        print(f"ERROR: {exc}")
    finally:
        try:
            instrument.cleanup()
        except CleanupError as exc:
            result = 2
            print(f"CLEANUP FAILED — treat output state as unknown: {exc}")
        finally:
            transport.close()
    return result
