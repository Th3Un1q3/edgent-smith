#!/usr/bin/env python3
"""Syntax-check every javascript-code block in an Automa workflow.

Three generic checks:
  V1  structure: JSON parses; node ids unique; every edge resolves to existing
      source/target nodes with well-formed handle names
  V3  variable data-flow: every {{variables.X}} / [variables.X] read resolves
      to a trigger parameter or a node that writes X earlier in the graph
      (cycle-safe BFS reachability)
  V7  JS syntax: for each javascript-code block, substitute {{...}}
      interpolation with safe literal placeholders, wrap the result in automa's
      non-async IIFE (() => { try { CODE; automaNextBlock() } catch (e) {} })(),
      and run `node --check` on the wrapped code.
  V9  mustache-in-code: javascript-code data.code is executed raw, never
      interpolated, so any literal {{...}} tag inside it is a bug (the editor's
      variable autocomplete writes raw JS, not templates).

Exits non-zero if any check fails.
"""
import argparse
import collections
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

INTERP_RE = re.compile(r"\{\{.*?\}\}")
MUSTACHE_IN_CODE_RE = re.compile(r"\{\{")
VAR_REF_RES = [
    re.compile(r"\{\{\s*variables\.([A-Za-z0-9_]+)\s*\}\}"),
    re.compile(r"\[variables\.([A-Za-z0-9_]+)\]"),
]
SET_VAR_RE = re.compile(r"automaSetVariable\(\s*['\"]([A-Za-z0-9_]+)['\"]")
ASSIGN_WRITER_LABELS = {"get-text", "attribute-value"}
NAME_WRITER_LABELS = {"regex-variable", "increase-variable"}


def writer_vars(n):
    """Variable names a node writes, or an empty set if it writes nothing."""
    d = n.get("data", {})
    label = n.get("label")
    if label == "javascript-code":
        names = {v.get("name") for v in d.get("variables", []) if v.get("name")}
        names |= set(SET_VAR_RE.findall(d.get("code", "")))
        return names
    if label in ASSIGN_WRITER_LABELS:
        if d.get("assignVariable") and d.get("variableName"):
            return {d["variableName"]}
        return set()
    if label in NAME_WRITER_LABELS and d.get("variableName"):
        return {d["variableName"]}
    return set()


def check_structure(wf):
    nodes = wf["drawflow"].get("nodes", [])
    edges = wf["drawflow"].get("edges", [])
    by_id = {n.get("id"): n for n in nodes}
    problems = []
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
        if sh and not sh.startswith(f"{s}-output-"):
            problems.append(f"edge {e.get('id')}: bad sourceHandle {sh!r}")
        if th and not th.startswith(f"{t}-input-"):
            problems.append(f"edge {e.get('id')}: bad targetHandle {th!r}")
    return problems, nodes, edges, by_id


def check_data_flow(nodes, edges, params):
    problems = []
    adj = collections.defaultdict(list)
    for e in edges:
        adj[e.get("source")].append(e.get("target"))

    writer_nodes = collections.defaultdict(set)  # var -> node ids that write it
    for n in nodes:
        for v in writer_vars(n):
            writer_nodes[v].add(n.get("id"))

    def reaches(srcs, target):
        seen = set(srcs)
        q = list(srcs)
        while q:
            cur = q.pop()
            if cur == target:
                return True
            for nxt in adj[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    q.append(nxt)
        return False

    refs = collections.defaultdict(list)  # var -> node ids that read it
    for n in nodes:
        blob = json.dumps(n.get("data", {}))
        for rx in VAR_REF_RES:
            for m in rx.finditer(blob):
                refs[m.group(1)].append(n.get("id"))

    for var, readers in sorted(refs.items()):
        if var in params:
            continue
        if var not in writer_nodes:
            problems.append(f"{var}: no writer at all (read by {sorted(set(readers))})")
            continue
        for r in sorted(set(readers)):
            if not reaches(list(writer_nodes[var]), r):
                problems.append(
                    f"{var}: reader {r} NOT reachable from any writer {sorted(writer_nodes[var])}"
                )
    return problems


def check_mustache_in_code(nodes):
    """data.code is executed raw — a {{...}} tag inside it is never interpolated."""
    problems = []
    for n in nodes:
        if n.get("label") != "javascript-code":
            continue
        code = n.get("data", {}).get("code", "")
        if MUSTACHE_IN_CODE_RE.search(code):
            problems.append(
                "node {}: {{...}} is not interpolated in javascript-code blocks; "
                "read variables via automaRefData('variables', ...)".format(
                    n.get("id")
                )
            )
    return problems


def check_js(nodes, node_available):
    problems, warnings = [], []
    if not node_available:
        warnings.append("node not found; skipping V7 JS syntax checks")
        return problems, warnings
    for n in nodes:
        if n.get("label") != "javascript-code":
            continue
        code = n.get("data", {}).get("code", "")
        substituted = INTERP_RE.sub("0", code)
        wrapper = "(() => { try { " + substituted + "; automaNextBlock() } catch (e) { /* swallow */ } })();"
        fd, tmp = tempfile.mkstemp(suffix=".js")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(wrapper)
            r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        finally:
            os.unlink(tmp)
        if r.returncode != 0:
            problems.append(f"node {n.get('id')}: JS syntax error: {(r.stderr or '').strip()[:200]}")
    return problems, warnings


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Syntax-check javascript-code blocks in an Automa workflow."
    )
    ap.add_argument("path", help="path to the .automa.json workflow file")
    args = ap.parse_args(argv)

    try:
        with open(args.path, encoding="utf-8") as fh:
            wf = json.load(fh)
    except Exception as exc:
        print(f"FAIL V1a: JSON does not parse: {exc}")
        return 1
    if not isinstance(wf, dict) or "drawflow" not in wf:
        print("FAIL V1a: workflow JSON has no 'drawflow' section")
        return 1

    problems, nodes, edges, by_id = check_structure(wf)
    params = set()
    for n in nodes:
        if n.get("label") == "trigger":
            params |= {p.get("name") for p in n.get("data", {}).get("parameters", []) if p.get("name")}
    problems += check_data_flow(nodes, edges, params)
    problems += check_mustache_in_code(nodes)
    js_problems, js_warnings = check_js(nodes, shutil.which("node") is not None)
    problems += js_problems

    print(f"=== {args.path} ===")
    print(f"nodes: {len(nodes)}, edges: {len(edges)}")
    for w in js_warnings:
        print(f"WARN: {w}")

    if problems:
        print("\nFAILURES:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("\nOK: structure, variable data-flow, and JS syntax all pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
