#!/usr/bin/env python3
"""Probe a priority list of models and report the first one that answers."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tomllib
from pathlib import Path
from typing import Any

MARKER = "PROBE_OK"
TEXT_TYPES = {"text", "assistant"}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="evals/config.toml")
    parser.add_argument("--opencode-bin", default="opencode")
    parser.add_argument("--probe-prompt", default=f"Reply with exactly {MARKER}")
    parser.add_argument("--timeout", type=float, default=60)
    return parser.parse_args(argv)


def load_models(config_path: Path) -> list[str]:
    """Return the probe order, or an empty list when the config is unusable."""
    if not config_path.is_file():
        return []
    try:
        with config_path.open("rb") as handle:
            data = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError):
        return []

    section = data.get("opencode")
    if not isinstance(section, dict):
        section = {}

    declared = section.get("models")
    models: list[str] = []
    if isinstance(declared, list):
        models = [item for item in declared if isinstance(item, str) and item.strip()]
    if models:
        return models

    for key in ("model", "fallback_model"):
        value = section.get(key)
        if isinstance(value, str) and value.strip() and value not in models:
            models.append(value)
    return models


def texts_from_line(line: str) -> list[str]:
    """Extract assistant text from one NDJSON line, ignoring other parts."""
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        return []
    if not isinstance(event, dict):
        return []

    kind = event.get("type")
    if isinstance(kind, str) and kind not in TEXT_TYPES:
        return []

    texts: list[str] = []
    part = event.get("part")
    if isinstance(part, dict):
        part_text = part.get("text")
        if isinstance(part_text, str) and part_text:
            texts.append(part_text)
    event_text = event.get("text")
    if isinstance(event_text, str) and event_text and event_text not in texts:
        texts.append(event_text)
    return texts


def probe(model: str, args: argparse.Namespace) -> dict[str, Any]:
    command = [
        args.opencode_bin,
        "run",
        args.probe_prompt,
        "--format",
        "json",
        "--auto",
        "--model",
        model,
        "--title",
        "eval-probe",
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=args.timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"model": model, "ok": False, "reason": f"timed out after {args.timeout}s"}
    except OSError as exc:
        return {"model": model, "ok": False, "reason": f"could not spawn: {exc}"}

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip().splitlines()
        tail = detail[-1][:200] if detail else "no output"
        reason = f"exit {completed.returncode}: {tail}"
        return {"model": model, "ok": False, "reason": reason}

    stream = "\n".join(
        text for line in completed.stdout.splitlines() for text in texts_from_line(line)
    )
    if MARKER in stream:
        return {"model": model, "ok": True, "reason": f"saw {MARKER}"}
    return {"model": model, "ok": False, "reason": f"{MARKER} missing from text output"}


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    models = load_models(Path(args.config))

    probed: list[dict[str, Any]] = []
    selected: str | None = None
    for model in models:
        result = probe(model, args)
        probed.append(result)
        if result["ok"]:
            selected = model
            break

    payload = {"ok": selected is not None, "model": selected, "probed": probed}
    print(json.dumps(payload))
    return 0 if selected is not None else 1


if __name__ == "__main__":
    sys.exit(main())
