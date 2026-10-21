---
id: experiences/memory-first-gates-distinct
title: Memory-First Gates Distinct
status: verified
date: 2026-10-21
scope: project
---

CONTEXT: Gateway-only stores need recall before act to avoid stale writes.
DECISION: Memory-first; 8 temps deleted; ID-proof allowlist; distinct gates per write.
EVIDENCE: Verified via readback gateway-only.
USE: Recall first; check allowlist ID; use distinct gate per store.