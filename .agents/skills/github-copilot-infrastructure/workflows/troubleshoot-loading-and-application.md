# Workflow: Troubleshoot Loading and Application

Use this workflow when instructions, skills, agents, or prompts appear to be
ignored, misapplied, or loaded at the wrong time.

## Goal

Isolate whether the problem is caused by the wrong primitive, the wrong
location, broken frontmatter, poor discovery wording, or unclear boundaries.

## Steps

1. Identify the failing behavior precisely.
   - What should have loaded or applied?
   - Under what file path, request wording, or workflow step?
   - Was the problem non-loading, over-loading, or conflicting guidance?

2. Check the primitive choice first.
   - If the behavior should auto-apply in the repo or on a specific matching
     surface, it is likely an instruction problem.
   - If the behavior should launch a specific task, it is likely a prompt
     problem.
   - If the behavior is reusable reference or workflow nuance, it is likely a
     skill problem.
   - If the behavior depends on orchestration or selecting which context to
     load, it is likely an agent problem.

3. Check location and naming.
   - Verify the file lives in the canonical directory for its primitive.
   - Confirm the filename and folder name match the intended discovery surface.
   - For skills, confirm the folder contains `SKILL.md` at the root.

4. Check frontmatter and applicability.
   - Verify YAML frontmatter is present and syntactically valid.
   - Check `description` for the exact trigger phrases that should match.
   - For instructions, confirm `applyTo` matches the relevant files and is not
     accidentally broad or narrow.
   - If the problem is a stable local rule buried in a skill, treat the
     primitive choice as the defect before tuning wording.
   - For prompts, compare frontmatter with the body text: if the prompt says to
     use one named agent or clearly depends on one agent-specific workflow,
     treat missing or mismatched `agent:` frontmatter as the defect.

5. Check boundary conflicts.
   - Remove duplicated guidance temporarily on paper and ask which file should
     own it.
   - If two primitives can both explain the behavior, pick the one whose role
     best matches the behavior and move the content there.
   - Do not patch a loading problem by copying the same rule into multiple
     files.

6. Check the concrete trace path.
   - Start with the Copilot debug session log at
     `{{VSCODE_TARGET_SESSION_LOG}}/main.jsonl`.
   - Look for discovery events that show which instructions, skills, or agents
     were resolved and whether anything was skipped.
   - If you need a structured log-reading workflow, follow the existing
     `troubleshoot` skill pattern for analyzing JSONL debug logs before making
     broader changes.

7. Re-test with a minimal scenario.
   - Use the smallest prompt or file path that should trigger the behavior.
   - Change one variable at a time: wording, file path, or owning primitive.
   - If the issue persists, continue with a trace-oriented review of tool use,
     loaded context, and instruction matching.

## Fast Triage Table

| Symptom | Most likely cause | First check |
|---|---|---|
| A repo rule is missing everywhere | Wrong or missing instruction | location, `applyTo`, frontmatter |
| A file-surface rule only appears when a skill is loaded | Wrong primitive choice | should this be a targeted instruction instead? |
| A reusable workflow never loads | Skill description or routing problem | `SKILL.md` description and links |
| A task launcher is not discoverable | Prompt wording is too generic | prompt description and filename |
| Too much context loads too often | Instruction scope is too broad | `applyTo` and always-on content |
| An agent adds no value | Wrong primitive chosen | whether orchestration is actually needed |

## Escalate Only After These Checks

Escalate beyond local file fixes only if:
- The primitive is correct.
- The file is in the right place.
- Frontmatter and descriptions are sound.
- The failure still appears in a minimal reproduction.