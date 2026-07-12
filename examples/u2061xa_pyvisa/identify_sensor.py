"""Identify a U2061XA. Dry-run unless --execute is supplied."""

import sys

from .cli import main


if __name__ == "__main__":
    raise SystemExit(main(["--mode", "identify", *sys.argv[1:]]))
