# OpenCode Session Export JSON Schema

> Reference guide for navigating any OpenCode session export (e.g., `session.json`). All field names, types, and nested structures are preserved from the raw export format.

## Overview

The session review document has a two-level structure: session metadata and message history.

| Field | Type | Description |
|-------|------|-------------|
| `info` | Object | Session-level metadata (cost, tokens, model, timestamps) |
| `messages` | Array | Message objects, each with `info` (metadata) and `parts` (content payloads) |

## Top-Level Structure

### `info` — Session Metadata Object

The top-level `info` field is a single object containing session identity, model config, telemetry, and timestamps.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique session identifier (`"ses_..."`) |
| `slug` | string | Human-readable slug |
| `projectID` | string | Project/workspace identifier |
| `directory` | string | Root directory of the session |
| `path` | string | Sub-path within project (may be empty) |
| `title` | string | Session title |
| `agent` | string | Agent name |
| `model` | Object | Model configuration (see nested table below) |
| `version` | string | OpenCode version identifier |
| `summary` | Object | Session-level diff summary (see nested table) |
| `cost` | number | Total cost in USD |
| `parentID` | string? | Parent session identifier (nullable). Links to a parent/ancestor session for lineage tracing. |
| `permission` | array of objects | Permission policy entries applied during the session. Each object has: `permission` (string, permission name), `pattern` (string glob), and `action` (`"allow"` or `"deny"`). |
| `tokens` | Object | Token usage breakdown (see nested table) |
| `time` | Object | Session timestamps (see nested table) |

#### `.info.model` — Model Configuration

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Full model identifier |
| `providerID` | string | Provider identifier |
| `variant` | string? | Model variant or flavor. May be null if not applicable. |

#### `.info.summary` — Diff Summary

| Field | Type | Notes |
|-------|------|-------|
| `additions` | number | Total lines added across session |
| `deletions` | number | Total lines deleted across session |
| `files` | number | Number of files modified |

#### `.info.tokens` — Token Usage Breakdown

| Field | Type | Notes |
|-------|------|-------|
| `input` | number | Input tokens consumed |
| `output` | number | Output tokens generated |
| `reasoning` | number | Tokens used for reasoning steps |
| `cache.read` | number | Cache reads (prompt caching) |
| `cache.write` | number | Cache writes (prompt caching) |

> **Note:** The `cache` fields above are nested under `.tokens.cache`, not flat keys. Access via `.info.tokens.cache.read`.

#### `.info.time` — Timestamps

| Field | Type | Notes |
|-------|------|-------|
| `created` | number | Session creation time (epoch ms) |
| `updated` | number | Last update time (epoch ms) |

### `messages` — Message History Array

An array of message objects. Each message has exactly two keys: `info` and `parts`. Roles include `assistant` and `user`.

#### Role Distribution

| Role | Description |
|------|-------------|
| `assistant` | Agent/system messages (including tool responses) |
| `user` | User prompts |
