# Detecting and Fixing Fragile Closure Forward References

A closure that references a variable declared after it is fragile — safe at runtime today but a `ReferenceError` waiting to happen if the initialization order changes. Detect it by looking for a `const` closure defined before another `const` it captures; this is common in async plugin initialization, where `await` calls assign the data the closure reads later.

## Fix Pattern

Move the variable declarations before the closure:

```typescript
// BEFORE (fragile):
const runGate = () => {
    const delay = config.debounceMs ?? 0  // ReferenceError if called before config assigned
}
const config = await loadConfig()

// AFTER (safe):
const config = await loadConfig()
const runGate = () => {
    const delay = config.debounceMs ?? 0  // config always defined when closure runs
}
```

## When to Check

- During code reviews of plugin factory functions
- When refactoring code that mixes sync and async initialization

## Cross-References

- mem:refactoring/restructure-patterns - related restructure patterns (mock-isolation scope decisions)
- mem:refactoring/plugin-imports - plugin architectural constraints
