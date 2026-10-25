"""Remove the eval fixture subtree and nothing else."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

MEMORIES = Path(".serena") / "memories"
STORE = MEMORIES / "evals"


def repo_root() -> Path:
    cwd = Path.cwd()
    try:
        top = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        top = ""
    if top and Path(top).is_dir():
        return Path(top)
    for parent in (cwd, *cwd.parents):
        if (parent / ".serena").is_dir():
            return parent
    raise SystemExit(f"cannot locate repo root from {cwd}")


def main() -> int:
    memories = repo_root() / MEMORIES
    store = memories / STORE.name
    removed: list[str] = []
    if store.exists():
        shutil.rmtree(store)
        removed.append(STORE.name)
    print(
        json.dumps(
            {
                "ok": True,
                "removed": removed,
                "removed_count": len(removed),
                "store": str(store),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
