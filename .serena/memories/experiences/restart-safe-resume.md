---
id: experiences/restart-safe-resume
title: Restart Safe Resume
status: verified
date: 2026-10-21
scope: project
---

CONTEXT: Plugin restart must not kill sibling workflows.
DECISION: Abort own workflow only; additive resume; retire-last; standalone-after re-entry.
EVIDENCE: Verified via readback gateway-only.
USE: On restart abort self only; re-enter standalone; append additive state.