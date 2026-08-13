#!/usr/bin/env python3
"""Schema-validate the automa skill's eval suite (evals/evals.json).

Checks, mirroring the generator's contract:
  - file parses as JSON
  - top-level keys are exactly {skill_name, evals}; skill_name == 'automa'
  - case ids are exactly 1..4 in order
  - per-case keys within {id, prompt, expected_output, assertions, files};
    prompt/expected_output have minimum lengths; files is empty; assertions
    carry exactly {text, passed, evidence} with null values and kebab-case
    names
  - embedded ```json workflow fixtures in prompts parse, have unique node ids,
    catalog labels, exactly one trigger, resolvable edges with valid handles,
    and documented {{...}} namespaces
  - case-specific fixtures (case 2 stock-checker, case 4 no-tab workflow) are
    present as the assertions reference them

Exits non-zero on any failure.
"""
import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parents[1] / "evals" / "evals.json"

CATALOG = {
 "trigger", "ai-workflow", "execute-workflow", "delay", "export-data", "webhook", "blocks-group", "clipboard",
 "wait-connections", "notification", "note", "workflow-state", "parameter-prompt", "active-tab", "new-tab",
 "switch-tab", "new-window", "proxy", "go-back", "forward-page", "close-tab", "take-screenshot", "browser-event",
 "handle-dialog", "handle-download", "reload-tab", "tab-url", "cookie", "event-click", "get-text", "element-scroll",
 "link", "attribute-value", "forms", "javascript-code", "trigger-event", "switch-to", "upload-file", "hover-element",
 "save-assets", "press-key", "create-element", "repeat-task", "conditions", "element-exists", "while-loop",
 "loop-data", "loop-elements", "loop-breakpoint", "insert-data", "delete-data", "log-data", "slice-variable",
 "increase-variable", "regex-variable", "data-mapping", "sort-data", "google-sheets", "google-sheets-drive",
 "google-drive", "block-package",
}
NAMESPACES = {"variables", "table", "globalData", "loopData", "secrets", "prevBlockData",
              "workflow", "googleSheets", "activeTabUrl"}
ALLOWED_CASE_KEYS = {"id", "prompt", "expected_output", "assertions", "files"}
ASSERTION_KEYS = {"text", "passed", "evidence"}


def check_workflow(w, label, errors):
    nodes = w["drawflow"]["nodes"]
    edges = w["drawflow"]["edges"]
    ids = [n["id"] for n in nodes]
    if len(ids) != len(set(ids)):
        errors.append(f"{label}: duplicate node ids")
    labels = [n["label"] for n in nodes]
    bad = [l for l in labels if l not in CATALOG]
    if bad:
        errors.append(f"{label}: unknown labels {bad}")
    if labels.count("trigger") != 1:
        errors.append(f"{label}: expected exactly one trigger, got {labels.count('trigger')}")
    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        if src not in ids or tgt not in ids:
            errors.append(f"{label}: dangling edge {edge}")
            continue
        sh, th = edge["sourceHandle"], edge["targetHandle"]
        if not sh.startswith(src + "-output-"):
            errors.append(f"{label}: bad sourceHandle {sh!r}")
        if th != f"{tgt}-input-1":
            errors.append(f"{label}: bad targetHandle {th!r}")
    text = json.dumps(w)
    for m in re.finditer(r"\{\{([^}]+)\}\}", text):
        key = m.group(1).strip()
        ns = key.split(".", 1)[0].split("[", 1)[0].split("@", 1)[0]
        if ns not in NAMESPACES:
            errors.append(f"{label}: unknown namespace {ns!r} in {m.group(0)}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Schema-validate the automa eval suite.")
    ap.add_argument("path", nargs="?", default=str(DEFAULT_PATH),
                    help=f"path to evals.json (default: {DEFAULT_PATH})")
    args = ap.parse_args(argv)

    try:
        with open(args.path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as exc:
        print(f"FAIL: cannot parse {args.path}: {exc}")
        return 1

    errors = []

    # top-level keys
    if set(data.keys()) != {"skill_name", "evals"}:
        errors.append(f"top-level keys = {sorted(data.keys())}, want {{skill_name, evals}}")
    if data.get("skill_name") != "automa":
        errors.append(f"skill_name = {data.get('skill_name')!r}, want 'automa'")

    evals = data.get("evals", [])
    ids = [e.get("id") for e in evals]
    if ids != [1, 2, 3, 4]:
        errors.append(f"case ids = {ids}, want [1, 2, 3, 4]")

    # per-case keys
    for e in evals:
        extra = set(e.keys()) - ALLOWED_CASE_KEYS
        if extra:
            errors.append(f"case {e.get('id')}: unexpected keys {sorted(extra)}")
        if not isinstance(e.get("prompt"), str) or len(e["prompt"]) <= 50:
            errors.append(f"case {e.get('id')}: prompt missing or too short")
        if not isinstance(e.get("expected_output"), str) or len(e["expected_output"]) <= 20:
            errors.append(f"case {e.get('id')}: expected_output missing or too short")
        if e.get("files") != []:
            errors.append(f"case {e.get('id')}: files = {e.get('files')!r}, want []")
        for a in e.get("assertions", []):
            if set(a.keys()) != ASSERTION_KEYS:
                errors.append(f"case {e.get('id')}: assertion keys = {sorted(a.keys())}, want {sorted(ASSERTION_KEYS)}")
                continue
            if a["passed"] is not None or a["evidence"] is not None:
                errors.append(f"case {e.get('id')}: assertion passed/evidence must be null")
            name, _, desc = a["text"].partition(": ")
            if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name):
                errors.append(f"case {e.get('id')}: assertion name {name!r} not kebab-case")
            if len(desc) <= 20:
                errors.append(f"case {e.get('id')}: assertion description too short")

    # embedded workflow fixtures in prompts
    for e in evals:
        for block in re.findall(r"```json\n(.*?)\n```", e.get("prompt", ""), re.DOTALL):
            try:
                w = json.loads(block)
            except json.JSONDecodeError as exc:
                errors.append(f"case {e['id']}: embedded JSON does not parse: {exc}")
                continue
            check_workflow(w, f"case {e['id']}", errors)

    # case-specific fixtures
    by_id = {e.get("id"): e for e in evals}
    c2 = by_id.get(2)
    if c2 is not None:
        blocks2 = [json.loads(b) for b in re.findall(r"```json\n(.*?)\n```", c2["prompt"], re.DOTALL)]
        if blocks2:
            labels2 = {n["label"] for n in blocks2[0]["drawflow"]["nodes"]}
            if labels2 != {"trigger", "new-tab", "get-text", "conditions", "insert-data", "notification"}:
                errors.append(f"case 2: labels = {labels2}")
    c4 = by_id.get(4)
    if c4 is not None:
        if "Can't connect to a tab, use 'New tab' or 'Active tab' block before using the 'Get Text' block" not in c4["prompt"]:
            errors.append("case 4: verbatim error string missing from prompt")
        blocks4 = [json.loads(b) for b in re.findall(r"```json\n(.*?)\n```", c4["prompt"], re.DOTALL)]
        if blocks4:
            labels4 = {n["label"] for n in blocks4[0]["drawflow"]["nodes"]}
            if labels4 != {"trigger", "get-text", "insert-data"}:
                errors.append(f"case 4: labels = {labels4}")

    if errors:
        print(f"{len(errors)} ERROR(S):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"OK: {args.path} schema-valid; {len(evals)} cases, "
          f"ids {ids}, skill_name 'automa'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
