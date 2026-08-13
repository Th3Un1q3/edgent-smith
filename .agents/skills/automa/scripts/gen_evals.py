#!/usr/bin/env python3
"""Regenerate the automa skill's eval suite (evals/evals.json) from the
embedded example workflows and eval cases defined below.

Usage:
    gen_evals.py [OUT]
    gen_evals.py                        # writes <skill root>/evals/evals.json
    gen_evals.py /tmp/evals.json        # writes to an explicit path

The embedded fixtures are the single source of truth for the suite; the
generator output is deterministic, so regenerating over the committed file
is byte-identical.
"""
import argparse
import json
import os
import sys
from pathlib import Path

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "evals" / "evals.json"

# --- Embedded example workflow for the "understand" case (stored form) ---
wf_understand = {
  "id": "WfStockCheck",
  "name": "Stock checker",
  "description": "Checks a product page and records in-stock titles.",
  "icon": "riGlobalLine",
  "folderId": None,
  "content": None,
  "connectedTable": None,
  "drawflow": {
    "nodes": [
      {"id": "triggerNode", "label": "trigger", "type": "BlockBasic", "position": {"x": 96, "y": 75.5},
       "data": {"type": "manual", "parameters": [],
                "observeElement": {"selector": "", "baseSelector": "", "matchPattern": "",
                                   "targetOptions": {"subtree": False, "childList": True, "attributes": False, "attributeFilter": [], "characterData": False},
                                   "baseElOptions": {"subtree": False, "childList": True, "attributes": False, "attributeFilter": [], "characterData": False}}}},
      {"id": "tabNode", "label": "new-tab", "type": "BlockBasic", "position": {"x": 96, "y": 230},
       "data": {"url": "{{globalData.baseUrl}}/products/42", "active": True, "waitTabLoaded": True, "inGroup": False}},
      {"id": "getTextNode", "label": "get-text", "type": "BlockBasic", "position": {"x": 96, "y": 400},
       "data": {"selector": "h1.product-title", "findBy": "cssSelector", "waitForSelector": False,
                "waitSelectorTimeout": 5000, "multiple": False, "saveData": True, "dataColumn": "title",
                "assignVariable": True, "variableName": "productTitle"}},
      {"id": "condNode", "label": "conditions", "type": "BlockConditions", "position": {"x": 96, "y": 560},
       "data": {"conditions": [{"id": "in-stock", "expression": {"valueType": "element#text", "value": "In stock",
                                                                 "data": {"selector": ".stock"}, "compareType": "cnt"}}],
                "retryConditions": False, "retryCount": 10, "retryTimeout": 1000}},
      {"id": "insertNode", "label": "insert-data", "type": "BlockBasic", "position": {"x": 96, "y": 720},
       "data": {"data": [{"dataColumn": "title", "value": "{{variables.productTitle}}"}], "tableName": ""}},
      {"id": "notifyNode", "label": "notification", "type": "BlockBasic", "position": {"x": 300, "y": 720},
       "data": {"title": "Stock check", "message": "Product not in stock", "url": ""}}
    ],
    "edges": [
      {"source": "triggerNode", "target": "tabNode", "sourceHandle": "triggerNode-output-1", "targetHandle": "tabNode-input-1", "id": "edge-1"},
      {"source": "tabNode", "target": "getTextNode", "sourceHandle": "tabNode-output-1", "targetHandle": "getTextNode-input-1", "id": "edge-2"},
      {"source": "getTextNode", "target": "condNode", "sourceHandle": "getTextNode-output-1", "targetHandle": "condNode-input-1", "id": "edge-3"},
      {"source": "condNode", "target": "insertNode", "sourceHandle": "condNode-output-in-stock", "targetHandle": "insertNode-input-1", "id": "edge-4"},
      {"source": "condNode", "target": "notifyNode", "sourceHandle": "condNode-output-fallback", "targetHandle": "notifyNode-input-1", "id": "edge-5"}
    ],
    "zoom": 1.3
  },
  "table": [{"name": "title", "type": "Text"}],
  "dataColumns": [],
  "trigger": None,
  "createdAt": 1780000000000,
  "updatedAt": 1780000000000,
  "isDisabled": False,
  "settings": {"blockDelay": 0, "saveLog": True, "debugMode": False, "execContext": "popup", "onError": "stop-workflow"},
  "version": "1.29.12",
  "globalData": "{\"baseUrl\": \"https://example.com\"}"
}

# --- Embedded failing workflow for the "troubleshoot" case (export form) ---
wf_troubleshoot = {
  "name": "Grab product title",
  "icon": "riGlobalLine",
  "table": [{"name": "title", "type": "Text"}],
  "version": "1.29.12",
  "drawflow": {
    "nodes": [
      {"id": "triggerNode", "label": "trigger", "type": "BlockBasic", "position": {"x": 96, "y": 75.5},
       "data": {"type": "manual", "parameters": []}},
      {"id": "getTextNode", "label": "get-text", "type": "BlockBasic", "position": {"x": 96, "y": 230},
       "data": {"selector": "h1.product-title", "findBy": "cssSelector", "waitForSelector": True,
                "waitSelectorTimeout": 5000, "multiple": False, "saveData": True, "dataColumn": "title",
                "assignVariable": True, "variableName": "productTitle"}},
      {"id": "insertDataNode", "label": "insert-data", "type": "BlockBasic", "position": {"x": 96, "y": 400},
       "data": {"data": [{"dataColumn": "title", "value": "{{variables.productTitle}}"}], "tableName": ""}}
    ],
    "edges": [
      {"source": "triggerNode", "target": "getTextNode", "sourceHandle": "triggerNode-output-1", "targetHandle": "getTextNode-input-1", "id": "edge-1"},
      {"source": "getTextNode", "target": "insertDataNode", "sourceHandle": "getTextNode-output-1", "targetHandle": "insertDataNode-input-1", "id": "edge-2"}
    ],
    "zoom": 1.3
  },
  "settings": {"blockDelay": 0, "saveLog": True, "debugMode": False, "execContext": "popup", "onError": "stop-workflow"},
  "globalData": "{}",
  "description": "Read the product title from the current page and append it as a table row.",
  "extVersion": "1.29.12",
  "includedWorkflows": {}
}


def json_block(obj):
    return "```json\n" + json.dumps(obj, indent=2) + "\n```"


cases = []

# ---- Case 1: create a workflow (JSON authoring) ----
cases.append({
  "id": 1,
  "prompt": (
    "I am building an Automa workflow to scrape product pages and need the workflow as importable JSON. "
    "Build a .automa.json file that: (1) starts with exactly one manual trigger block; (2) opens the product URL "
    "https://example.com/products/42 in a new tab; (3) extracts the h1 title text into a variable named "
    "productTitle; (4) appends the title to a 'title' table column using an insert-data block. "
    "Follow the create-workflow discipline: use the export-form key set (name, icon, table, version, drawflow, "
    "settings, globalData, description, extVersion, includedWorkflows); put the new-tab block before the get-text "
    "block; connect every block with edges whose sourceHandle is '<sourceId>-output-1' and targetHandle is "
    "'<targetId>-input-1'; and validate before delivering: the JSON must parse, every node label must come from "
    "the block catalog, every edge must resolve to existing node ids, and every {{...}} tag must use one of the "
    "nine known namespaces. Output the complete workflow JSON in a ```json code block."
  ),
  "expected_output": (
    "A complete export-form .automa.json document: parses with json.loads; drawflow.nodes holds exactly one manual "
    "trigger, a new-tab whose data.url starts with http(s), a get-text that assigns the extracted text to variable "
    "productTitle, and an insert-data that appends {{variables.productTitle}} to the 'title' column; every edge's "
    "source and target resolve to node ids in drawflow.nodes with sourceHandle '<id>-output-1' and targetHandle "
    "'<id>-input-1'; every {{...}} tag uses a documented namespace."
  ),
  "assertions": [
    {"text": "output-json-parses: The response contains a JSON document that parses with python3 json.loads", "passed": None, "evidence": None},
    {"text": "trigger-node-present: drawflow.nodes contains a node with label 'trigger'", "passed": None, "evidence": None},
    {"text": "exactly-one-trigger-node: drawflow.nodes contains exactly one node with label 'trigger'", "passed": None, "evidence": None},
    {"text": "new-tab-node-with-http-url: a node with label 'new-tab' exists and its data.url starts with 'http://' or 'https://'", "passed": None, "evidence": None},
    {"text": "get-text-node-present: a node with label 'get-text' exists", "passed": None, "evidence": None},
    {"text": "get-text-assigns-variable: the 'get-text' node's data sets assignVariable to true and variableName to a non-empty name", "passed": None, "evidence": None},
    {"text": "edges-resolve-with-valid-handles: every edge's source and target reference node ids present in drawflow.nodes; sourceHandle follows '<sourceId>-output-1' and targetHandle follows '<targetId>-input-1'", "passed": None, "evidence": None},
    {"text": "namespaces-in-known-list: every '{{...}}' tag starts with one of the nine documented namespaces: variables, table, globalData, loopData, secrets, prevBlockData, workflow, googleSheets, activeTabUrl", "passed": None, "evidence": None}
  ],
  "files": []
})

# ---- Case 2: understand an existing workflow ----
cases.append({
  "id": 2,
  "prompt": (
    "I exported this Automa workflow and no longer remember what it does. Explain it to me in plain language.\n\n"
    + json_block(wf_understand) + "\n\n"
    "Walk through it step by step: start with a one-sentence goal statement, then the workflow's identity card "
    "(name, settings, trigger type), every block and what it does, how the blocks connect, what the conditions "
    "block checks and what happens on each branch, which {{...}} namespaces the workflow reads, and any design "
    "problems you spot. I have never built an Automa workflow, so keep the explanation plain-language."
  ),
  "expected_output": (
    "A plain-language explanation following the understand-workflow procedure: an opening goal statement; the "
    "identity card names 'Stock checker' and the manual trigger; every block label (trigger, new-tab, get-text, "
    "conditions, insert-data, notification) is enumerated; all five edges resolve; the conditions block's 'in-stock' "
    "condition branch and its wired fallback output are named; the namespaces referenced are globalData and "
    "variables; the waitForSelector-off smell on get-text is flagged with a fix."
  ),
  "assertions": [
    {"text": "trigger-type-identified: The explanation identifies the trigger block and its type (manual)", "passed": None, "evidence": None},
    {"text": "all-block-labels-named: The explanation names every block label present in the JSON: trigger, new-tab, get-text, conditions, insert-data, notification", "passed": None, "evidence": None},
    {"text": "conditions-and-fallback-semantics-identified: The explanation identifies the conditions block, the 'in-stock' condition branch, and the fallback output that runs when no condition matches (wired to the notification block)", "passed": None, "evidence": None},
    {"text": "namespaces-referenced-identified: The explanation lists the '{{}}' namespaces referenced in the file — globalData (new-tab url) and variables (insert-data value)", "passed": None, "evidence": None},
    {"text": "plain-language-goal-statement: The explanation opens with a plain-language goal statement that a reader with no Automa experience can restate", "passed": None, "evidence": None},
    {"text": "design-smell-flagged: The explanation flags a real defect present in the file — getTextNode has waitForSelector off, so extraction can race the page load — with a fix (enable wait for selector or insert an element-exists check)", "passed": None, "evidence": None}
  ],
  "files": []
})

# ---- Case 3: design guidance (best practices) ----
cases.append({
  "id": 3,
  "prompt": (
    "I built an Automa workflow to scrape a list of products from a store site: trigger -> loop-data -> get-text -> "
    "insert-data. The loop-data block iterates a hardcoded JSON list of product ids and uses loopId 'items'; get-text "
    "reads a selector's text; insert-data appends a row to the table. Two problems: the loop body only ever runs once, "
    "and the first run on a fresh browser profile fails with an error about not being able to connect to a tab. What "
    "is wrong with this design, and how should I restructure the workflow? Give me design guidance only — no need to "
    "emit a full workflow file."
  ),
  "expected_output": (
    "Design guidance that: pairs the loop-data block with a loop-breakpoint block carrying the same loopId ('items') "
    "and explains that a loop without its breakpoint runs its body once; satisfies the active-tab precondition by "
    "placing a new-tab (or active-tab) block before the get-text block; recommends moving the hardcoded list and page "
    "URL into globalData, or trigger parameters for per-run values, instead of embedding them in block options."
  ),
  "assertions": [
    {"text": "loop-breakpoint-pairing-recommended: The answer recommends adding a 'loop-breakpoint' block whose loopId matches the 'loop-data' block's loopId ('items')", "passed": None, "evidence": None},
    {"text": "loop-without-breakpoint-runs-once: The answer explains that a loop without its breakpoint runs the loop body once, with no error", "passed": None, "evidence": None},
    {"text": "active-tab-precondition-mentioned: The answer states that a 'new-tab' or 'active-tab' block must precede the 'get-text' block and that its absence causes the 'Can't connect to a tab' error", "passed": None, "evidence": None},
    {"text": "shared-values-in-global-data-recommended: The answer recommends moving the hardcoded list and page URL into globalData (or trigger parameters for per-run values) instead of embedding them in block options", "passed": None, "evidence": None}
  ],
  "files": []
})

# ---- Case 4: troubleshooting ----
cases.append({
  "id": 4,
  "prompt": (
    "My Automa workflow 'Grab product title' fails on every run. The workflow log shows:\n"
    "12:03:41  ERROR  getTextNode (get-text)  Can't connect to a tab, use 'New tab' or 'Active tab' block before "
    "using the 'Get Text' block\n\n"
    "Here is the workflow JSON:\n\n" + json_block(wf_troubleshoot) + "\n\n"
    "Diagnose the root cause, explain the fix, and give me the corrected workflow JSON. The corrected file must still "
    "parse as JSON and keep exactly one trigger block."
  ),
  "expected_output": (
    "A diagnosis that matches the error text to the documented active-tab cause (a web-interaction block runs with no "
    "active tab), names getTextNode as the failing block and the missing new-tab/active-tab as the violated "
    "precondition, quotes the error text, and proposes a fix that inserts a new-tab block between the trigger and "
    "get-text with rewired edges; the corrected workflow JSON parses and keeps exactly one trigger node."
  ),
  "assertions": [
    {"text": "error-matched-to-documented-cause: The report attributes the error to the documented cause — a web-interaction block running with no active tab (no 'new-tab' or 'active-tab' block on the path before getTextNode)", "passed": None, "evidence": None},
    {"text": "error-text-quoted-verbatim: The report reproduces the full error text from the log exactly as shown in the prompt — the 'Can't connect to a tab...' message naming the 'Get Text' block", "passed": None, "evidence": None},
    {"text": "fix-inserts-new-tab-before-get-text: The fix inserts a 'new-tab' (or 'active-tab') block between the trigger and the get-text block and rewires the edges accordingly", "passed": None, "evidence": None},
    {"text": "fixed-json-parses: Any workflow JSON in the corrected output parses with python3 json.loads", "passed": None, "evidence": None},
    {"text": "fixed-json-keeps-trigger: The corrected workflow JSON contains a node with label 'trigger'", "passed": None, "evidence": None}
  ],
  "files": []
})

data = {"skill_name": "automa", "evals": cases}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Regenerate the automa skill eval suite.")
    ap.add_argument("out", nargs="?", default=str(DEFAULT_OUT),
                    help=f"output path (default: {DEFAULT_OUT})")
    args = ap.parse_args(argv)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(cases)} cases)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
