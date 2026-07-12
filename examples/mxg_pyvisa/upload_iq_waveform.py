"""Focused I/Q upload example; RF ON remains a separate explicit permission."""

from typing import List, Optional

from .cli import main as run_shared_cli


def main(argv: Optional[List[str]] = None) -> int:
    return run_shared_cli(argv, fixed_mode="waveform")


if __name__ == "__main__":
    raise SystemExit(main())
