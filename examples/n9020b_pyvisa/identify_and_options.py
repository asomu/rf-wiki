"""Identify the fixed N9020B profile without changing measurement state."""

from __future__ import annotations

import sys
from typing import Sequence

from .cli import main as cli_main


def main(argv: Sequence[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    return cli_main(["--mode", "identify", *arguments])


if __name__ == "__main__":
    raise SystemExit(main())
