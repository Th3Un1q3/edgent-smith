#!/usr/bin/env python3
"""Normalize every conditions block in an Automa workflow to the modern
serialization shape.

Modern group shape (per Automa's EditConditions.vue / handlerConditions.js):

    data.conditions[i] = {
      "id": <group id, preserved>, "name": "...",
      "conditions": [{
        "id": "...", "conditions": [{
          "id": "...",
          "items": [
            {"id": "...", "type": "value", "category": "value", "data": {"value": <subject>}},
            {"id": "...", "category": "compare", "type": <op>},
            {"id": "...", "type": "value", "category": "value", "data": {"value": <compared value>}},
          ],
        }],
      }],
    }

Legacy groups carry a flat `expression: {valueType, value, compareType, data}`
and are converted: value-based subjects become the interpolation literal
(e.g. {{variables.X}}), element-based subjects keep their element type and
selector data. Comparison operators map per Automa's shared.js compare ids
(eq, eqi, nq, gt, gte, lt, lte, cnt, cni, nct, nci, stw, enw, rgx, itr, ifl).

Idempotent: already-modern groups are left untouched, and converted output is
deterministic, so running twice yields identical bytes.

Emits the normalized JSON to stdout; with --write, overwrites the file in place.
"""
import argparse
import json
import sys

COMPARE_MAP = {
    "eq": "eq", "eqi": "eqi", "nq": "nq", "neq": "nq",
    "gt": "gt", "gte": "gte", "lt": "lt", "lte": "lte",
    "cnt": "cnt", "cni": "cni", "nct": "nct", "nci": "nci",
    "stw": "stw", "enw": "enw", "rgx": "rgx", "itr": "itr", "ifl": "ifl",
}

NAMESPACE_TEMPLATES = {
    "variables": "{{variables.{}}}",
    "table": "{{table.{}}}",
    "globalData": "{{globalData.{}}}",
    "loopData": "{{loopData.{}}}",
    "secrets": "{{secrets.{}}}",
    "prevBlockData": "{{prevBlockData.{}}}",
    "workflow": "{{workflow.{}}}",
    "googleSheets": "{{googleSheets.{}}}",
    "activeTabUrl": "{{activeTabUrl.{}}}",
}


def interpolate(value_type, value):
    tpl = NAMESPACE_TEMPLATES.get(value_type)
    if tpl:
        return tpl.format(value)
    return value


def is_element_subject(value_type):
    return isinstance(value_type, str) and value_type.startswith("element")


def convert_group(node_id, group, gi):
    expr = group["expression"]
    value_type = expr.get("valueType", "value")
    compare_type = COMPARE_MAP.get(expr.get("compareType"), expr.get("compareType"))

    if is_element_subject(value_type):
        subject = {
            "id": f"{node_id}-v{gi}a",
            "category": "element",
            "type": value_type,
            "data": expr.get("data"),
        }
        right_value = expr.get("value", "")
    else:
        subject = {
            "id": f"{node_id}-v{gi}a",
            "type": "value",
            "category": "value",
            "data": {"value": interpolate(value_type, expr.get("value", ""))},
        }
        right_value = expr.get("data", "")

    return {
        "id": group.get("id"),
        "name": group.get("name", "Path 1"),
        "conditions": [
            {
                "id": f"{node_id}-g{gi}",
                "conditions": [
                    {
                        "id": f"{node_id}-r{gi}",
                        "items": [
                            subject,
                            {"id": f"{node_id}-c{gi}", "category": "compare", "type": compare_type},
                            {"id": f"{node_id}-v{gi}b", "type": "value", "category": "value",
                             "data": {"value": right_value}},
                        ],
                    }
                ],
            }
        ],
    }


def normalize_workflow(wf):
    """Return (new_wf, changed_node_ids)."""
    changed = []
    for n in wf.get("drawflow", {}).get("nodes", []):
        if n.get("label") != "conditions":
            continue
        groups = n.get("data", {}).get("conditions")
        if not isinstance(groups, list):
            continue
        new_groups = []
        touched = False
        for gi, group in enumerate(groups):
            if isinstance(group, dict) and "expression" in group:
                new_groups.append(convert_group(n.get("id"), group, gi))
                touched = True
            else:
                new_groups.append(group)
        if touched:
            n["data"]["conditions"] = new_groups
            changed.append(n.get("id"))
    return wf, changed


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Normalize conditions blocks to Automa's modern serialization (idempotent)."
    )
    ap.add_argument("path", help="path to the .automa.json workflow file")
    ap.add_argument("--write", action="store_true",
                    help="overwrite the file in place; default prints to stdout")
    args = ap.parse_args(argv)

    try:
        with open(args.path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as exc:
        print(f"FAIL: cannot load {args.path}: {exc}", file=sys.stderr)
        return 1

    data, changed = normalize_workflow(data)
    out = json.dumps(data, indent=2, ensure_ascii=False) + "\n"

    if changed:
        print(f"normalized conditions blocks: {', '.join(changed)}")
    else:
        print("no legacy condition groups found; output unchanged")

    if args.write:
        with open(args.path, "w", encoding="utf-8") as fh:
            fh.write(out)
        print(f"wrote {args.path} ({len(out.encode('utf-8'))} bytes)")
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
