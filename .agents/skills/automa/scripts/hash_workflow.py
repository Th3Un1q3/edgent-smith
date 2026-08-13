#!/usr/bin/env python3
"""Hash an Automa workflow and optionally verify its structural integrity.

Prints the SHA256 of the raw file bytes, then runs three lightweight checks:
  - node ids are unique
  - every edge resolves to existing source/target nodes with well-formed
    handle naming (<source>-output-*, <target>-input-*)
  - loop pairing: every loop-breakpoint loopId matches a loop block
    (loop-data / loop-elements / while-loop / repeat-task)

With --expect <sha256>, exits non-zero when the computed hash differs.
Without --expect, the structural checks still gate the exit code.
"""
import argparse
import hashlib
import json
import sys


def check_structure(nodes, edges):
    problems = []
    by_id = {n.get("id"): n for n in nodes}
    ids = [n.get("id") for n in nodes]
    dups = {i for i in ids if ids.count(i) > 1}
    if dups:
        problems.append(f"duplicate node ids: {sorted(dups)}")
    for e in edges:
        s, t = e.get("source"), e.get("target")
        sh, th = e.get("sourceHandle", ""), e.get("targetHandle", "")
        if s not in by_id or t not in by_id:
            problems.append(f"edge {e.get('id')}: node missing {s if s not in by_id else t}")
            continue
        if not sh.startswith(f"{s}-output-"):
            problems.append(f"edge {e.get('id')}: bad sourceHandle {sh!r}")
        if not th.startswith(f"{t}-input-"):
            problems.append(f"edge {e.get('id')}: bad targetHandle {th!r}")
    return problems


def check_loop_pairs(nodes):
    loop_ids = {
        n["data"].get("loopId")
        for n in nodes
        if n.get("label") in ("loop-data", "loop-elements", "while-loop", "repeat-task")
        and n.get("data", {}).get("loopId")
    }
    problems = []
    for n in nodes:
        if n.get("label") != "loop-breakpoint":
            continue
        lid = n.get("data", {}).get("loopId")
        if lid not in loop_ids:
            problems.append(f"{n.get('id')}: loopId {lid!r} has no matching loop block")
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description="Hash and structurally verify an Automa workflow.")
    ap.add_argument("path", help="path to the .automa.json workflow file")
    ap.add_argument("--expect", metavar="SHA256", default=None,
                    help="expected sha256; exits non-zero on mismatch")
    args = ap.parse_args(argv)

    try:
        raw = open(args.path, "rb").read()
    except OSError as exc:
        print(f"FAIL: cannot read {args.path}: {exc}")
        return 1

    digest = hashlib.sha256(raw).hexdigest()
    print("== SHA256 ==")
    print(f"sha256: {digest}")
    if args.expect:
        match = digest == args.expect
        print(f"expect: {args.expect}")
        print(f"MATCH:  {match}")
        if not match:
            return 1

    try:
        wf = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"\nFAIL: workflow JSON does not parse: {exc}")
        return 1

    nodes = wf.get("drawflow", {}).get("nodes", [])
    edges = wf.get("drawflow", {}).get("edges", [])
    print(f"\n== COUNTS == nodes: {len(nodes)}, edges: {len(edges)}")

    problems = check_structure(nodes, edges)
    problems += check_loop_pairs(nodes)

    if problems:
        print("\nFAILURES:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("\nSTRUCTURE OK: unique node ids, edges resolve, loop pairs match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
