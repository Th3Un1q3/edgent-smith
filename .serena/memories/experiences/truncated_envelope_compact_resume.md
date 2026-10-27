---
id: experiences/truncated_envelope_compact_resume
type: experiences
L0: "A truncated envelope resumes compact under 2000c carrying only IDs and the next step, dropping history rather than replaying it verbosely."
title: Truncated Envelope Compact Resume
status: verified
date: 2026-10-21
scope: project
---

CONTEXT: Partial truncated envelope risks verbose history replay.
DECISION: Resume compact under 2000c carrying only IDs plus next step.
EVIDENCE: Verified via readback gateway-only single-batch.
USE: On truncation drop history; resume with IDs and next-step only.