"""Focused CW example; dry-run unless --execute is explicitly supplied."""

from typing import List, Optional

from .cli import main as run_shared_cli


def main(argv: Optional[List[str]] = None) -> int:
    return run_shared_cli(argv, fixed_mode="cw")


if __name__ == "__main__":
    raise SystemExit(main())
