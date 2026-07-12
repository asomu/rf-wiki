"""Print or execute the safe average-power workflow."""

import sys

from .cli import main


if __name__ == "__main__":
    raise SystemExit(main(["--mode", "average", *sys.argv[1:]]))
