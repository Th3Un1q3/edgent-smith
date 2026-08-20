# Skill Rework: Consumer-Role Probes Validate Executable Fidelity

After reworking skill files, run consumer-role probes — load the skill as a user would and follow it for real task types — because structural checks validate shape, not executable fidelity. In the context-gathering probe+fix campaign (5 probes, 2026-08), anchor/link/structure validation passed while probes surfaced runtime bugs: a snippet variable never interpolated (ReferenceError), a snippet returning a count instead of the data, a dedupe key mismatch causing an infinite click loop, and a fallback extracting the previous page.

Run probes across diverse task types (external research, browser automation, memory writes, batch flows), executing the actual snippets. Structural validation (link anchors, schema, cross-references) and prompt-QA catch prose and shape defects; probes are the only check that catches what actually runs.

Related: mem:skills/general/skill-review-generality-actionability (structural review misses first-time-reader defects), mem:skills/general/prompt-qa-review-of-skill-files.