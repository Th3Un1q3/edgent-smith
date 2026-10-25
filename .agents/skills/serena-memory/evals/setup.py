"""Seed the eval fixtures straight into .serena/memories/evals.

Sanctioned exception to the gateway-only memory rule: this writes the disposable
eval-fixture subtree and nothing else. Lives beside fixtures.json so the harness
needs no agent to reset state.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

FIXTURES = "fixtures.json"
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


def load_fixtures(path: Path) -> dict[str, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise SystemExit(f"fixtures unreadable: {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"fixtures are not valid JSON: {path}: {exc}") from exc
    if not isinstance(data, dict) or not data:
        raise SystemExit(f"fixtures must be a non-empty JSON object: {path}")
    bad = sorted(name for name, content in data.items() if not isinstance(content, str))
    if bad:
        raise SystemExit(f"fixture values must be strings: {', '.join(bad[:5])}")
    return data


def main() -> int:
    fixtures = load_fixtures(Path(__file__).with_name(FIXTURES))
    root = repo_root()
    memories = root / MEMORIES
    store = root / STORE
    removed: list[str] = []
    if store.exists():
        shutil.rmtree(store)
        removed.append(STORE.name)
    store.mkdir(parents=True)
    for name, content in fixtures.items():
        target = memories / f"{name}.md"
        if not target.resolve().is_relative_to(store.resolve()):
            raise SystemExit(f"fixture name escapes the eval store: {name}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "seeded": len(fixtures),
                "removed": removed,
                "removed_count": len(removed),
                "store": str(store),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
