"""Shared utilities for experiment orchestration scripts."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LEDGER_PATH = REPO_ROOT / "experiments" / "ledger.json"
BASELINES_DIR = REPO_ROOT / "experiments" / "baselines"
RESULTS_DIR = REPO_ROOT / "experiments" / "results"
MANIFESTS_DIR = REPO_ROOT / "experiments" / "manifests"


def load_ledger() -> list[dict[str, Any]]:
    """Load the experiment ledger."""
    if not LEDGER_PATH.exists():
        return []
    return json.loads(LEDGER_PATH.read_text())


def save_ledger(entries: list[dict[str, Any]]) -> None:
    """Persist the experiment ledger."""
    LEDGER_PATH.write_text(json.dumps(entries, indent=2))


def append_ledger(entry: dict[str, Any]) -> None:
    """Append one entry to the ledger."""
    entries = load_ledger()
    entries.append(entry)
    save_ledger(entries)


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)
