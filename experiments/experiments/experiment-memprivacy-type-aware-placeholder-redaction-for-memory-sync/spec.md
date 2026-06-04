# Hypothesis
On-device type-aware placeholder redaction applied before memory/cloud sync combined with encrypted local restoration will prevent sensitive data leakage to cloud memory while keeping task utility loss ≤2% on representative retrieval and reasoning tasks.

# Motivation
Docs/ideas.md highlights MemPrivacy as a high-impact edge pattern: detecting sensitive spans, replacing them with structured placeholders for cloud-side memory, and restoring originals locally preserves privacy while retaining utility. This experiment implements a minimal, low-cost integration and validation path.

# Type
Prototype + empirical validation (privacy-utility tradeoff benchmark).

# Mutation surface
- Memory sync pipeline: pre-sync redaction hook
- Memory storage: store structured placeholders and locally-encrypted originals
- Memory retrieval / context restore API: local restoration step before passing context to on-device models
- CI/eval: add privacy-utility regression tests and small benchmark scripts

# Implementation Instructions
1. Add a small module: `agents/memprivacy.py` implementing:
   - detect_sensitive_spans(text) -> list of (start,end,type)
   - redact_with_placeholders(text, spans) -> redacted_text, placeholder_metadata
   - encrypt_local_fragment(fragment) -> ciphertext (use repo crypto helper or libsodium if available; fall back to AES-GCM with per-repo key stub)
   - restore_from_local(fragment_id, ciphertext) -> original_text
2. Add an integration hook in the memory sync path (create a `memory_sync.pre_sync_hooks` list and call each hook with the memory item). If no central sync path exists, add a `sync_memory_item(item)` helper in `agents/memory_sync.py` and call it from the places that perform cloud upload.
3. Implement placeholder metadata format: `{type: "EMAIL", id: "local-uuid-1234", summary: "user@email.com (redacted)", hint: "email"}`. Store mapping id -> encrypted fragment in a local encrypted store (`~/.edgent/memory_store/`) with strict file perms.
4. On retrieval, implement a restore step: when assembled context contains placeholders and the runtime is local, fetch and decrypt originals and replace placeholders before presenting context to the on-device model.
5. Add a toggle/config: `EDGENT_MEMPRIVACY_ENABLED` (default true) and a test-key fallback for CI.
6. Add small CLI utilities to inspect placeholder indices and to run an end-to-end demo: redaction -> sync (simulate cloud upload) -> retrieval -> restoration.

# Validation (code, prompts, tasks)
- Unit tests for detection, redaction, encryption/decryption roundtrip, and restore path (`tests/test_memprivacy.py`).
- Privacy regression: a sample corpus with marked sensitive spans; assert that synced payloads contain no raw sensitive spans (exact-match) and only structured placeholders.
- Utility regression: run a small downstream task (QA or retrieval-augmented generation) on a held-out set with full memory vs redacted+restored and measure metric (e.g., exact-match / F1). Target ≤2% drop.
- Latency check: measure extra CPU/IO cost for redaction+restore on representative device (or local CI) — must be modest (single-digit ms per document for typical short memories).

# Anticipated missteps and fallbacks
- Detection false positives/negatives: provide conservative default (favor redaction for strongly flagged spans) and log counts; provide a developer knob to tune detector sensitivity.
- Key management: CI/dev will use a test key; production must inject key via secure env. If secure key not present, fall back to storing locally but mark as non-production and refuse cloud sync.
- Runtime complexity: if on-device decryption is too costly, allow placeholder-only mode (no restoration) for high-privacy deployments.

# Sources
- Docs/ideas.md — MemPrivacy section (refs: 2605.09530)
- MemPrivacy paper/repo: https://github.com/MemTensor/MemPrivacy (reference)

# Notes
- Keep the implementation minimal: a detection heuristic (regex+simple NER via spaCy/transformers) is acceptable for prototype. Production improvements (ML-based NER) can be added later.
- Ensure all local stores use strict file permissions and do not leak to logs.