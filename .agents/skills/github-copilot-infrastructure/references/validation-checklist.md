# Reference: Validation Checklist

Use this checklist before considering a GitHub Copilot infrastructure change
done.

## Structural Checks

- The file lives in the canonical location for its primitive.
- The filename and folder name reflect the intended discovery surface.
- Required frontmatter exists and is syntactically valid.
- Any prompt that depends on a specific custom agent has `agent:` frontmatter
  in the `.prompt.md` file itself.
- Skill roots remain short and route to focused docs when the skill is
  non-trivial.

## Boundary Checks

- The owning primitive is explicit: prompt, agent, skill, or instruction.
- The content matches that primitive's role.
- The same rule or workflow is not duplicated across multiple primitives.
- Stable auto-apply guidance stays in instructions, whether repo-wide or narrowly scoped; on-demand material stays in skills.
- If a skill contains concise file-surface rules, review whether a targeted instruction is the correct owner.
- Prompts own launch framing, but prompt-to-agent coupling is expressed as
  prompt metadata, not hidden in prompt body prose.

## Discovery Checks

- The `description` contains realistic trigger phrases.
- The asset says both when to use it and when not to use it.
- Targeted instructions use `applyTo` patterns that are specific enough to avoid
  accidental global loading.
- Instructions that should auto-apply on a stable local surface are not buried in a skill instead.
- Root skill routing tables cover every linked workflow and reference file.

## Practical Checks

- The change solves a concrete setup, maintenance, audit, or troubleshooting
  need.
- Recommendations are actionable and tied to one owning primitive.
- No unrelated prompts, instructions, agents, scripts, or templates were added
  without a demonstrated need.
- The stack became simpler or clearer, not merely larger.
- For each prompt that names or relies on a specific agent, compare the body to
  the frontmatter and fail review if the `agent:` binding is missing,
  mismatched, or points to no real target.

## Review Questions

- What exact failure or maintenance cost does this change remove?
- Why is this the right primitive for that behavior?
- Should this guidance auto-apply by scope, or should it stay optional and on demand?
- What would break if this file were missing?
- Could the same result be achieved by tightening an existing asset instead?
- If this prompt assumes a named agent, where is that binding encoded and how
  was it verified?