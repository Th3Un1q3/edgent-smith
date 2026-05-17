# Reference: Anti-Patterns

Use this reference to spot design mistakes that make GitHub Copilot
customization infrastructure brittle or confusing.

## Common Anti-Patterns

| Anti-pattern | Why it hurts | Better move |
|---|---|---|
| Putting repo-wide policy in prompts | The policy disappears unless the prompt is used | Move the rule to instructions |
| Parking stable file-surface rules in a skill | The guidance stays optional instead of auto-applying where it is needed | Move the concise rule to a targeted instruction; keep only deeper optional material in the skill |
| Putting large workflow detail in always-on instructions | Context stays loaded when it is not needed | Move reusable detail into a skill |
| Creating an agent with no orchestration job | Adds complexity without changing behavior | Use an instruction, prompt, or skill instead |
| Turning a skill root into a long handbook | Makes the skill expensive to load and hard to scan | Split detail into workflows and references |
| Copying the same rule into multiple primitives | Hides ownership mistakes and causes drift | Pick one owner and move the content there |
| Using broad `applyTo` patterns by default | Targeted instructions become accidental global policy | Narrow the pattern to the affected files |
| Writing vague `description` fields | The right asset is harder to discover | Add specific user intents and keywords |

## Boundary Failures to Watch For

- An instruction tells the model exactly how to execute a long task sequence.
- A skill is preferred by default even though the guidance should auto-apply on a stable scoped surface.
- A prompt tries to carry the reference material needed by many unrelated tasks.
- A skill contains only one command-style entry point and no reusable nuance.
- An agent exists solely to restate repo policy or paste documentation.

## Maintenance Smells

- New assets are added faster than old ones are tightened or removed.
- The same topic appears in multiple folders with slightly different wording.
- File placement no longer predicts behavior.
- Team members need oral explanations to know which primitive should own a
  change.

## Correction Strategy

When you find an anti-pattern:

1. Name the intended behavior.
2. Pick the correct owning primitive.
3. Move or split the content instead of copying it.
4. Tighten descriptions, locations, and scope so the mistake does not recur.