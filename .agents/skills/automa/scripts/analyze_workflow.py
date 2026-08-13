#!/usr/bin/env python3
"""Summarize one or more Automa workflows (.automa.json).

For each file prints an envelope summary: parse status, name, description,
extVersion/version, settings, node count, edge count, block-type histogram,
and trigger parameters with their defaults.
"""
import argparse
import collections
import json
import sys


def summarize(path):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as exc:
        print(f"PARSE FAIL: {path} -> {type(exc).__name__}: {exc}")
        return 1

    nodes = data.get("drawflow", {}).get("nodes", [])
    edges = data.get("drawflow", {}).get("edges", [])
    histogram = collections.Counter(n.get("label") for n in nodes)

    print(f"\n=== {path} ===")
    print(f"name        = {data.get('name')!r}")
    print(f"description = {data.get('description')!r}")
    print(f"extVersion  = {data.get('extVersion')!r}")
    print(f"version     = {data.get('version')!r}")
    print(f"icon        = {data.get('icon')!r}")
    print(f"settings    = {json.dumps(data.get('settings'))}")
    print(f"globalData  = {data.get('globalData')!r}")
    print(f"table       = {[c.get('name') for c in data.get('table', [])]}")
    print(f"dataColumns = {json.dumps(data.get('dataColumns'))}")
    print(f"node_count  = {len(nodes)}, edge_count = {len(edges)}, "
          f"zoom = {data.get('drawflow', {}).get('zoom')}")

    print("block-type histogram:")
    for label, count in sorted(histogram.items()):
        print(f"  {label:24s} {count}")

    triggers = [n for n in nodes if n.get("label") == "trigger"]
    if triggers:
        params = triggers[0].get("data", {}).get("parameters", [])
        print(f"trigger ({triggers[0].get('data', {}).get('type', '?')}): "
              f"{len(params)} parameter(s)")
        for p in params:
            default = p.get("default", "<none>")
            print(f"  {p.get('name')!r} type={p.get('type')!r} default={default!r}")
    else:
        print("trigger: none found")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Summarize Automa workflow envelope and contents.")
    ap.add_argument("paths", nargs="+", help="one or more .automa.json workflow files")
    args = ap.parse_args(argv)

    codes = [summarize(p) for p in args.paths]
    return 1 if any(codes) else 0


if __name__ == "__main__":
    sys.exit(main())
