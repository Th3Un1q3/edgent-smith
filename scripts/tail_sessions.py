#!/usr/bin/env python3
"""Live DSH session tailer — 30 LOC core that replaces manual zip export.

Reads authoritative live state at .dsh/sessions/**/*.jsonl.zstd
(decompressed via python zstandard) + experiments/manual.state.json.
Prints job_output live without GUI export.

Usage:
  uv run python scripts/tail_sessions.py --watch        # tail live
  uv run python scripts/tail_sessions.py --once         # single scan
  uv run python scripts/tail_sessions.py --session 49b0d89f  # filter
"""

from __future__ import annotations

import json
import pathlib
import sys
import time
from typing import Any

zstd: Any = None
try:
    import zstandard as zstd
except ImportError:
    zstd = None  # fallback to raw read for tests

REPO = pathlib.Path(__file__).resolve().parent.parent
LIVE_GLOBS = [".dsh/sessions/**/*.jsonl.zstd", ".dsh/child-home/sessions/**/*.jsonl.zstd"]
STATE = REPO / "experiments/manual.state.json"


def iter_live_sessions(limit: int = 5) -> list[pathlib.Path]:
    paths: list[pathlib.Path] = []
    for pat in LIVE_GLOBS:
        paths.extend(REPO.glob(pat))
    paths.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return paths[:limit]


def tail_jsonl_zstd(path: pathlib.Path, tail_n: int = 20) -> list[dict[str, Any]]:
    if zstd is None or not path.exists():
        return []
    try:
        with open(path, "rb") as fh:
            d = zstd.ZstdDecompressor()
            with d.stream_reader(fh) as r:
                text = r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"# decompress failed {path}: {e}", file=sys.stderr)
        return []
    parsed = []
    for line in text.splitlines():
        if line.strip().startswith("{"):
            parsed.append(json.loads(line))
    return parsed[-tail_n:]


def print_state_summary() -> None:
    if not STATE.exists():
        print(f"# no state at {STATE}")
        return
    data = json.loads(STATE.read_text())
    for a in data.get("attempts", [])[-5:]:
        print(
            f"attempt {a.get('attempt')} status={a.get('status')} "
            f"delta={a.get('score_delta')} base={a.get('baseline_score')} "
            f"cand={a.get('candidate_score')}"
        )


def watch_loop(poll: int = 2, tail_n: int = 8) -> None:
    seen: set[str] = set()
    while True:
        for p in iter_live_sessions():
            for rec in tail_jsonl_zstd(p, tail_n):
                # authoritative pass/fail: job_output with status/isError
                payload = rec.get("payload") or rec
                out = rec.get("job_output") or payload.get("job_output") or ""
                status = rec.get("status") or payload.get("status") or ""
                is_error = rec.get("isError") or payload.get("isError")
                key = json.dumps(rec, sort_keys=True)
                if key in seen:
                    continue
                seen.add(key)
                has_fail = "failed" in str(status).lower() or bool(is_error)
                has_subagent_fail = "subagent run failed" in str(out).lower()
                if has_fail or has_subagent_fail:
                    print(
                        f"[FAIL] {p.parent.name} status={status} "
                        f"isError={is_error} {str(out)[:200]}"
                    )
                elif out:
                    print(f"[OUT] {p.parent.name} {str(out)[:300]}")
        print_state_summary()
        # live state is authoritative — zip is GUI export of same JSONL
        sys.stdout.flush()
        time.sleep(poll)


def _consume_val(argv: list[str], idx: int) -> tuple[str | None, int]:
    if idx + 1 < len(argv):
        return argv[idx + 1], idx + 1
    return None, idx


def _handle_flag(arg: str, args: dict[str, Any]) -> bool:
    if arg in ("--help", "-h"):
        args["help"] = True
        return True
    if arg == "--once":
        args["once"] = True
        return True
    if arg == "--watch":
        args["watch"] = True
        return True
    return False


def _handle_param(arg: str, argv: list[str], idx: int, args: dict[str, Any]) -> int:
    if arg == "--session":
        v, idx = _consume_val(argv, idx)
        if v:
            args["session"] = v
    elif arg.startswith("--session="):
        args["session"] = arg.split("=", 1)[1]
    elif arg == "--limit":
        v, idx = _consume_val(argv, idx)
        if v:
            args["limit"] = int(v)
    elif arg.startswith("--limit="):
        args["limit"] = int(arg.split("=", 1)[1])
    elif arg == "--tail-n":
        v, idx = _consume_val(argv, idx)
        if v:
            args["tail_n"] = int(v)
    elif arg.startswith("--tail-n="):
        args["tail_n"] = int(arg.split("=", 1)[1])
    return idx


def _handle_arg(arg: str, argv: list[str], idx: int, args: dict[str, Any]) -> int:
    if _handle_flag(arg, args):
        return idx
    return _handle_param(arg, argv, idx, args)


def parse_args() -> dict[str, Any]:
    args: dict[str, Any] = {
        "once": False,
        "watch": False,
        "help": False,
        "session": None,
        "limit": 5,
        "tail_n": 20,
    }
    argv = sys.argv[1:]
    i = 0
    while i < len(argv):
        i = _handle_arg(argv[i], argv, i, args)
        i += 1
    return args


def print_help() -> None:
    print(__doc__)
    print("Options:")
    print("  --once               single scan (no loop)")
    print("  --watch              tail live with 2s poll (default loop)")
    print("  --session ID         filter to session id substring")
    print("  --limit N            number of newest sessions to scan (default 5)")
    print("  --tail-n N           records per session tail (default 20)")
    print("  --help, -h           show this help")


if __name__ == "__main__":
    args = parse_args()
    if args["help"]:
        print_help()
        sys.exit(0)
    limit = args["limit"]
    tail_n = args["tail_n"]
    sess_filter = args["session"]
    if args["once"] or sess_filter:
        for p in iter_live_sessions(limit=limit):
            if sess_filter and sess_filter not in str(p):
                continue
            print(f"## {p}")
            for r in tail_jsonl_zstd(p, tail_n=tail_n):
                print(json.dumps(r)[:600])
        print_state_summary()
    else:
        # --watch or no flag -> stream; --once already handled
        if "--watch" in sys.argv or len(sys.argv) == 1:
            watch_loop(tail_n=8)
        else:
            # fallback for bare call like watch-worker without args -> watch
            watch_loop(tail_n=8)
