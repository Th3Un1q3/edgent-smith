---
id: cases/opencode/skill_catalog_name_mismatch
type: cases
L0: "Skill catalog names must be verified against .agents/skills/; a generated catalog listed building-opencode-plugin, the directory exists, but the loader did not resolve it; confirm before relying"
hotness: 0.7
ttl: 180d
version: 1
freshness: 2026-09-20
directory: cases/opencode
provenance: "Observed loader listing vs .agents/skills/, 2026-09-20"
---
# Skill catalog names must be verified
Skill catalog names must be verified against the real `.agents/skills/` directory before use.
- A generated catalog listed `building-opencode-plugin`; the directory exists, but the skill loader did not resolve it (absent from the loader available skills).
- Confirm existence and loader resolution before relying on a name.
Source: observed loader listing vs `.agents/skills/`. See mem:cases/opencode/workflow_producer_unverified_tree.