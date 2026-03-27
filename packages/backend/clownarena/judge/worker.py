from __future__ import annotations

import sys

from dramatiq.cli import main as dramatiq_main


def main() -> None:
    sys.argv = ["dramatiq", "clownarena.judge.tasks"]
    dramatiq_main()

