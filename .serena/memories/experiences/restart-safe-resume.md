---
id: experiences/restart-safe-resume
type: experiences
L0: "Plugin restart aborts only its own workflow, resumes additively, retires last, then re-enters standalone; verified by gateway readback."
title: Restart Safe Resume
status: verified
date: 2026-10-21
scope: project
---

CONTEXT: Plugin restart must not kill sibling workflows.
DECISION: Abort own workflow only; additive resume; retire-last; standalone-after re-entry.
EVIDENCE: Verified via readback gateway-only.
USE: On restart abort self only; re-enter standalone; append additive state.