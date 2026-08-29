# Agent Environments Stack (verified live 2026-08-24)

Reviewed 2026-08-25: confirmed org-universal (GitHub-level, language-agnostic).

Local development: Dev Container spec + Features is the baseline (org is DevContainer-first).

Pod-based remote workspaces: pick Coder (AGPL-3.0, ~14k stars, active). Runner-up DevPod (MPL-2.0, ~15k stars) - stalled since 2025-11.

Untrusted-code isolation: gVisor (Apache-2.0, ~19k stars) on Kubernetes; E2B (Apache-2.0, ~13k stars) when exposing untrusted-code execution behind APIs.

Contract: environments ship as a prebuilt OCI image produced by the devcontainer CLI, consumed uniformly by VS Code, Coder, and CI.

Security insight: Docker alone does not stop prompt-injected agents holding credentials; kernel-level isolation (gVisor) or API sandboxes (E2B) are required for hostile input.