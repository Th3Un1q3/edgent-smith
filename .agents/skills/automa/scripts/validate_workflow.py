#!/usr/bin/env python3
"""Adversarial structural validation for an Automa workflow (.automa.json).

Checks (hard failures -> exit 1):
  1. JSON parses and carries a drawflow section
  2. node ids are unique
  3. every edge resolves: source/target nodes exist, sourceHandle follows
     '<sourceId>-output-<suffix>' with a known suffix (digits, 'fallback', or a
     conditions-group id), targetHandle follows '<targetId>-input-1'
  4. condition-group ids are alphanumeric and start with a letter
     (Automa accepts arbitrary output-handle ids, e.g. camelCase 'hasRows')
  5. loop pairing: every loop-breakpoint loopId matches a loop block's loopId
     (loop-data / loop-elements / while-loop / repeat-task)
  6. javascript-code blocks parse after substituting {{...}} interpolation with
     safe literals and wrapping in automa's non-async IIFE (skipped when node
     is unavailable)
   7. insert-data blocks use the 1.30 data.dataList schema (legacy bare `data`
      array crashes with 't.dataList is not iterable'); every item carries
      name/value and a type in {table, variable}; type:'table' names must exist
      in the workflow's top-level table columns (column mismatch is a warning)
   8. no {{tableData(...)}} template reference anywhere in node data
      (renderString has no tableData function; the literal text survives into
      the rendered string and breaks JSON.parse — use {{table}} for the
      whole-table JSON array)
   9. url-bearing fields (new-tab/webhook data.url) never start with '!!':
      automa consumes the prefix and uses the raw expression body as the URL,
      causing 'is an invalid URL' (use {{variables.*}} interpolation instead)

Informational (warnings only, never fail): node/edge counts, zero-incoming
blocks, per-block output wiring, insert-data table-column mismatch. These
depend on workflow-specific expectations and are reported so the caller can
judge them.
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

LOOP_LABELS = {"loop-data", "loop-elements", "while-loop", "repeat-task"}
COND_ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9]*$")
INSERT_DATA_TYPES = {"table", "variable"}


def load_workflow(path):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict) or "drawflow" not in data:
        raise ValueError("workflow JSON has no 'drawflow' section")
    return data


def check_edges(edges, by_id, cond_group_ids):
    problems = []
    for e in edges:
        s, t = e.get("source"), e.get("target")
        sh, th = e.get("sourceHandle", ""), e.get("targetHandle", "")
        if s not in by_id or t not in by_id:
            problems.append(f"{e.get('id')}: node missing {s if s not in by_id else t}")
            continue
        if not th == f"{t}-input-1":
            problems.append(f"{e.get('id')}: bad targetHandle {th!r}")
            continue
        if not sh.startswith(f"{s}-output-"):
            problems.append(f"{e.get('id')}: bad sourceHandle {sh!r}")
            continue
        suffix = sh[len(f"{s}-output-"):]
        if suffix == "fallback" or suffix.isdigit():
            continue
        if s in cond_group_ids and suffix in cond_group_ids[s]:
            continue
        problems.append(
            f"{e.get('id')}: unmapped output suffix {suffix!r} for {s} ({by_id[s].get('label')})"
        )
    return problems


def check_condition_ids(nodes):
    problems = []
    for n in nodes:
        if n.get("label") != "conditions":
            continue
        for c in n.get("data", {}).get("conditions", []):
            cid = c.get("id")
            if not cid or not COND_ID_RE.match(str(cid)):
                problems.append(
                    f"{n.get('id')}: condition id {cid!r} invalid "
                    "(must match ^[a-zA-Z][a-zA-Z0-9]*$)"
                )
    return problems


def check_loop_pairs(nodes):
    loop_ids = {
        n["data"].get("loopId")
        for n in nodes
        if n.get("label") in LOOP_LABELS and n.get("data", {}).get("loopId")
    }
    problems = []
    for n in nodes:
        if n.get("label") != "loop-breakpoint":
            continue
        lid = n.get("data", {}).get("loopId")
        if lid not in loop_ids:
            problems.append(
                f"{n.get('id')}: loopId {lid!r} has no matching loop block"
            )
    return problems


def check_js_code(nodes, node_available):
    """Substitute {{...}} interpolation, wrap in automa's non-async IIFE,
    run `node --check`. Returns (problems, warnings)."""
    problems, warnings = [], []
    if not node_available:
        warnings.append("node not found; skipping javascript-code syntax checks")
        return problems, warnings
    for n in nodes:
        if n.get("label") != "javascript-code":
            continue
        code = n.get("data", {}).get("code", "")
        substituted = re.sub(r"\{\{.*?\}\}", "0", code)
        wrapper = "(() => { try { " + substituted + "; automaNextBlock() } catch (e) { /* swallow */ } })();"
        fd, tmp = tempfile.mkstemp(suffix=".js")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(wrapper)
            r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        finally:
            os.unlink(tmp)
        if r.returncode != 0:
            problems.append(f"{n.get('id')}: JS syntax error: {(r.stderr or '').strip()[:200]}")
    return problems, warnings


def check_insert_data(nodes, table_columns):
    """insert-data must use the 1.30 data.dataList schema. Column-name
    mismatches are warnings when the workflow defines a table."""
    problems, warnings = [], []
    for n in nodes:
        if n.get("label") != "insert-data":
            continue
        d = n.get("data", {})
        data_list = d.get("dataList")
        if not isinstance(data_list, list):
            problems.append(
                f"{n.get('id')}: insert-data must use data.dataList (1.30 schema); "
                "legacy data array crashes with 't.dataList is not iterable'"
            )
            continue
        for item in data_list:
            if not isinstance(item, dict) or "name" not in item or "value" not in item:
                problems.append(
                    f"{n.get('id')}: dataList item missing name/value: {item!r}"
                )
                continue
            if item.get("type") not in INSERT_DATA_TYPES:
                problems.append(
                    f"{n.get('id')}: dataList item type {item.get('type')!r} "
                    f"not in {sorted(INSERT_DATA_TYPES)}"
                )
            if (
                item.get("type") == "table"
                and table_columns
                and item.get("name") not in table_columns
            ):
                warnings.append(
                    f"{n.get('id')}: dataList table column {item.get('name')!r} "
                    f"not in workflow table columns {sorted(table_columns)}"
                )
    return problems, warnings


def iter_data_strings(data):
    """Yield every string value nested inside a node's data (dicts/lists)."""
    if isinstance(data, dict):
        for v in data.values():
            yield from iter_data_strings(v)
    elif isinstance(data, list):
        for v in data:
            yield from iter_data_strings(v)
    elif isinstance(data, str):
        yield data


def check_template_refs(nodes):
    """renderString has no tableData function: a {{tableData(...)}} tag renders
    literally into the output string and breaks JSON.parse downstream. The
    table renders via the bare key {{table}}. Covers every node-data string,
    including webhook bodies and javascript-code data.code."""
    problems = []
    for n in nodes:
        for s in iter_data_strings(n.get("data", {})):
            if "{{tableData(" in s:
                problems.append(
                    f"{n.get('id')}: invalid template "
                    "{{tableData(…}} — use {{table}} "
                    "(whole-table JSON); tableData is not an Automa function"
                )
                break
    return problems


def check_url_expressions(nodes):
    """Automa (1.30.02) consumes the '!!' prefix on url-bearing fields and
    treats the raw expression body as the URL — it is never evaluated, so the
    tab fails with 'is an invalid URL'. The supported pattern is plain
    {{variables.*}} interpolation."""
    problems = []
    for n in nodes:
        url = n.get("data", {}).get("url")
        if isinstance(url, str) and url.startswith("!!"):
            problems.append(
                f"{n.get('id')}: !! sandbox expressions are not evaluated on url "
                "fields in 1.30.02 — use {{variables.*}} interpolation"
            )
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Adversarial structural validation of an Automa workflow."
    )
    ap.add_argument("path", help="path to the .automa.json workflow file")
    args = ap.parse_args(argv)

    try:
        wf = load_workflow(args.path)
    except Exception as exc:
        print(f"FAIL: JSON does not parse: {exc}")
        return 1

    nodes = wf["drawflow"].get("nodes", [])
    edges = wf["drawflow"].get("edges", [])
    by_id = {}
    problems = []
    warnings = []

    # --- node id uniqueness ---
    ids = [n.get("id") for n in nodes]
    dups = {i for i in ids if ids.count(i) > 1}
    if dups:
        problems.append(f"duplicate node ids: {sorted(dups)}")
    by_id = {n.get("id"): n for n in nodes}

    # --- condition group ids per conditions block ---
    cond_group_ids = {
        n.get("id"): [c.get("id") for c in n.get("data", {}).get("conditions", [])]
        for n in nodes
        if n.get("label") == "conditions"
    }
    problems += check_condition_ids(nodes)

    # --- edge resolution + handle naming ---
    problems += check_edges(edges, by_id, cond_group_ids)

    # --- loop pairing ---
    problems += check_loop_pairs(nodes)

    # --- JS syntax of javascript-code blocks (node --check) ---
    js_problems, js_warnings = check_js_code(nodes, shutil.which("node") is not None)
    problems += js_problems
    warnings += js_warnings

    # --- insert-data 1.30 schema ---
    raw_table = wf.get("table")
    table_columns = (
        {c.get("name") for c in raw_table if isinstance(c, dict)}
        if isinstance(raw_table, list)
        else set()
    )
    ins_problems, ins_warnings = check_insert_data(nodes, table_columns)
    problems += ins_problems
    warnings += ins_warnings

    # --- runtime template / url traps ---
    problems += check_template_refs(nodes)
    problems += check_url_expressions(nodes)

    print(f"=== {args.path} ===")
    print(f"nodes: {len(nodes)}, edges: {len(edges)}")

    # --- informational (warnings, never hard failures) ---
    incoming = collections.Counter(e.get("target") for e in edges)
    zero_in = [nid for nid in ids if incoming[nid] == 0]
    trigs = [n for n in nodes if n.get("label") == "trigger"]
    if len(trigs) != 1:
        warnings.append(f"expected exactly one trigger block, got {len(trigs)}")
    if len(zero_in) != 1 or (zero_in and zero_in[0] != (trigs[0].get("id") if trigs else None)):
        warnings.append(f"blocks with zero incoming edges: {zero_in}")
    cond_bad = []
    for nid, cids in cond_group_ids.items():
        outs = {e.get("sourceHandle") for e in edges if e.get("source") == nid}
        suffixes = {o[len(f"{nid}-output-"):] for o in outs if o and o.startswith(f"{nid}-output-")}
        for c in cids:
            if c not in suffixes:
                cond_bad.append(f"{nid} missing condition output {c!r}")
        if "fallback" not in suffixes:
            cond_bad.append(f"{nid} missing fallback output")
    if cond_bad:
        warnings.append("condition outputs not fully wired: " + "; ".join(cond_bad))

    for w in warnings:
        print(f"WARN: {w}")

    if problems:
        print("\nFAILURES:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("\nVALID: structure OK (warnings are informational)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
