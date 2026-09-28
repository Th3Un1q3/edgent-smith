# Reference: Portability Evidence Record

An evidence record for a skill whose mechanisms must stay environment-neutral. This record is distinct from the [Shaping Checklist](../workflows/shaping-checklist.md): the checklist gates the rules, while this record captures the environment-specific evidence behind each claim. Run it before publishing a skill that names a harness, tool, or command, and record the outcome in `metadata.delta`.

**When to load:** when you author or audit a skill for portability; when a review suspects a mechanism is tied to one environment.

## Verification checks

1. **Outcome before mechanism.** Every mechanism states the outcome it produces before its realization. Evidence: open each reference and confirm no mechanism sentence begins with an environment name.
2. **No unverified names.** Every environment the skill names is one the repo shows can load it. Evidence: grep the skill tree for each environment name; for every hit, cite the repo file or command that demonstrates the claim.
3. **Generic fallback present.** Every mechanism needing a capability only some environments have states the outcome and a fallback that names no environment. Evidence: each such mechanism has an adjacent fallback sentence.
4. **No invented tooling.** Every command, config key, and file path the skill cites exists in the repo. Evidence: run each cited command or open each cited path.
5. **Examples stay descriptive.** Environment-specific examples sit in a labeled section and never read as universal instructions. Evidence: grep for environment names and confirm each appears inside a labeled note.

## Structural gates live elsewhere

Budgets, routing completeness, version coherence, and the validator exit code belong to the [Shaping Checklist](../workflows/shaping-checklist.md) (checks 8, 12, 13, 19) — this record names environment-specific evidence only and does not restate them.
