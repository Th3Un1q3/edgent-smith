# Detecting and Fixing Fragile Closure Forward References

A closure that references a variable declared after it is fragile — safe at runtime today but a `ReferenceError` waiting to happen if the initialization order changes.

## Detection Pattern

Look for:
- `const fnName = (...) => { ... usesVariable ... }` followed later by `const usesVariable = ...`
- Common in async plugin initialization: a closure is defined early, then `await` calls assign the data it captures

## Fix Pattern

Move the variable declarations before the closure. In the case of async initialization:

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
- Any time a `const` declaration uses another `const` declared later in the same scope

## Cross-References

- mem:refactoring/restructure-patterns - related restructure patterns
- mem:refactoring/plugin-imports - plugin architectural constraints
