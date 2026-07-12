---
name: rug-mcp
description: "External knowledge retrieval — look up library documentation, framework APIs, tool capabilities, current versions, and live web information. Use as the first step whenever a task requires accurate, up-to-date external data."
tasks: |
  - Retrieving documentation for specific libraries or frameworks
  - Looking up API signatures, method parameters, and return types
  - Finding current version numbers, release notes, and deprecation status
  - Fetching live web content (documentation sites, changelogs, RFCs)
  - Cross-referencing multiple external sources for accuracy
limits: >
  Cannot read workspace files. Must have all necessary local context provided in its input. Relies entirely on MCP tools for external data — if the answer requires reading a file, configuration, or codebase state, use another agent first and pass that information as context to rug-mcp.
---

# Agent Card: rug-mcp

## Overview

rug-mcp is the sole channel for live external knowledge retrieval. It accesses documentation, API references, version information, and web content through MCP tooling. Use it whenever accurate external data is required — never attempt to recall library APIs, version numbers, or framework behaviors from memory without verification.

### When to Delegate to rug-mcp

- "Look up [library/framework] docs for version X"
- "Find the API signature for [function/method]"
- "Check current version of [dependency] and any deprecation notices"
- "Fetch documentation for [tool] configuration options"
- Any task requiring accurate, up-to-date external information

### When NOT to Delegate to rug-mcp

- Reading local files or codebase state (use rug-puppet)
- Complex analysis requiring workspace context (use rug-expert with retrieved data passed as input)
- Feature implementation (use rug-swe)

## Example: Well-Sscoped Task

> "Look up the Click CLI framework docs for version 8.x. Find how to define command groups with subcommands, specifically the @click.group() decorator and how nested commands inherit context from parent commands. Return the relevant API signatures and a minimal example."

**Why this works:** Specific library + version scope. Clear question about a particular feature (command groups). Concrete output expectations (API signatures + minimal example).

## Example: Bad Task — Scope Creep

> "Tell me everything I need to know about Python CLI frameworks, compare Click vs argparse vs Typer, show examples of each, and tell me which one is best for building a CLI tool that does agent orchestration with Docker containers."

**Why this fails:** Compares three unrelated libraries in one prompt. Mixes API reference with architecture decision-making. No bounded scope — "everything I need to know" invites exhaustive but shallow coverage rather than targeted, accurate information.

## Example: Bad Task — Irrelevant Scope

> "What is the current best practice for implementing a neural network transformer model for natural language processing in 2025?"

**Why this fails:** Zero connection to the workspace or user's actual task. This is a general AI research question, not a documentation lookup tied to a specific implementation decision the user needs to make now.
