from __future__ import annotations

import argparse
import os

from .driver import E5080B
from .transport import DryRunTransport, PyVisaTransport


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Identify an E5080B without enabling RF")
    parser.add_argument("--resource", default=os.getenv("E5080B_VISA_RESOURCE", "E5080B"))
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    vna = E5080B(PyVisaTransport(args.resource) if args.execute else DryRunTransport())
    try:
        identity, options = vna.identify()
        print(f"IDENTITY {identity}")
        print(f"OPTIONS  {options}")
    finally:
        try:
            vna.output_off_and_confirm()
        finally:
            vna.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
