# Scoping Mutation Tests During Changes

When the overall project mutation score is below threshold (<72%) but your change is scoped to one module:

## Scoped Mutation Validation

Use `--mutate` flag to scope mutation to just the changed file:

```
just mutation -- --mutate plugins/instructions-loader.ts
```

This validates that the changed module's mutation score is adequate (≥break threshold) without being blocked by pre-existing low scores in unrelated modules.

## Mutation Threshold Interaction

- Each module's score contributes to the overall score proportionally to its mutant count.
- Modules with 0% score and 100+ no-coverage mutants (e.g., `quality-gate-enforcer.ts` with 198 no-cov) drag the overall score down regardless of your changes.
- Fixing these is a separate effort — don't let it block your in-scope improvements.

## Equivalent Mutants

Some mutants cannot be killed without source code changes:
- `ConditionalExpression` replacements on nullish coalescing (`?? {}` → `{}` or reader) — both alternatives change behavior
- Post-decrement (`--`) where the value before decrement is used — removing `-1` has no effect on the conditional
- String literal replacements where the empty string variant is functionally identical in context (e.g., `PLUGIN_ID = ""`)

Document these with `// Stryker disable next-line` comments if they become permanent noise.

## Cross-References

- mem:quality-gates/configuration - how the mutation gate is configured
- mem:refactoring/side-effect-cascades - related failure patterns
