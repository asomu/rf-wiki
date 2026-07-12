"""IQ sizing calculator; native N9020B IQ commands are intentionally excluded."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import math
from typing import Sequence


MAX_PROFILE_IF_BANDWIDTH_HZ = 160e6
SAMPLE_RATE_RATIO = 1.25


@dataclass(frozen=True)
class IqCaptureSizing:
    if_bandwidth_hz: float
    sample_rate_hz: float
    samples: int
    duration_seconds: float
    bin_spacing_hz: float


def calculate_iq_sizing(if_bandwidth_hz: float, samples: int) -> IqCaptureSizing:
    if not math.isfinite(if_bandwidth_hz) or not 0 < if_bandwidth_hz <= MAX_PROFILE_IF_BANDWIDTH_HZ:
        raise ValueError("if_bandwidth_hz must be greater than zero and no wider than B1X 160 MHz")
    if samples < 2:
        raise ValueError("samples must be at least 2")
    sample_rate_hz = SAMPLE_RATE_RATIO * if_bandwidth_hz
    return IqCaptureSizing(
        if_bandwidth_hz=if_bandwidth_hz,
        sample_rate_hz=sample_rate_hz,
        samples=samples,
        duration_seconds=samples / sample_rate_hz,
        bin_spacing_hz=sample_rate_hz / samples,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="N9020B B1X IQ record-size calculator; sends no SCPI"
    )
    parser.add_argument("--if-bandwidth-hz", type=float, default=100e6)
    parser.add_argument("--samples", type=int, default=1_000_000)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Always rejected: native IQ Analyzer command tree is outside this package",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.execute:
        raise SystemExit(
            "Native IQ capture is intentionally unsupported here. Review the separately licensed "
            "IQ Analyzer application's official programmer reference before adding any IQ SCPI."
        )
    try:
        sizing = calculate_iq_sizing(args.if_bandwidth_hz, args.samples)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print("IQ sizing only · no VISA resource opened · no SCPI sent")
    print("IF bandwidth: {:.6g} Hz".format(sizing.if_bandwidth_hz))
    print("Nominal sample rate (1.25 × IFBW): {:.6g} Sa/s".format(sizing.sample_rate_hz))
    print("Record: {} complex samples, {:.6g} s".format(sizing.samples, sizing.duration_seconds))
    print("FFT bin spacing for one full record: {:.6g} Hz".format(sizing.bin_spacing_hz))
    print("This sizing relation is not a native-IQ acquisition command or memory guarantee.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
