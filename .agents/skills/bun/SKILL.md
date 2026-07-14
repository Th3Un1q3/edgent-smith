---
name: Bun
description: Use when building, testing, running, or bundling JavaScript/TypeScript applications. Reach for Bun when you need to execute code, manage dependencies, run tests, or bundle projects with a single unified toolkit.
metadata:
    mintlify-proj: bun
    version: "1.0"
---

# Bun Skill

## Product Summary

Bun is an all-in-one JavaScript/TypeScript toolkit that replaces Node.js, npm, Jest, and esbuild. It ships as a single binary with four integrated tools: a fast runtime (powered by JavaScriptCore), a package manager, a test runner, and a bundler. Key files: `bunfig.toml` (configuration), `bun.lock` (lockfile), `package.json` (project metadata). Primary CLI commands: `bun run`, `bun install`, `bun test`, `bun build`. See https://bun.com/docs for comprehensive documentation.

## When to Use

- **Running code**: Execute `.ts`, `.tsx`, `.js`, `.jsx` files directly without compilation steps
- **Package management**: Install, add, remove, or update dependencies faster than npm/yarn/pnpm
- **Testing**: Write and run Jest-compatible tests with TypeScript support, snapshots, and watch mode
- **Bundling**: Bundle JavaScript/TypeScript for browsers or servers with code splitting and plugins
- **Building servers**: Create HTTP servers with `Bun.serve()` with built-in routing and WebSocket support
- **File operations**: Read/write files with optimized APIs (`Bun.file()`, `Bun.write()`)
- **Scripting**: Run package.json scripts or shell commands with minimal overhead
- **Full-stack apps**: Build and deploy applications with HTML imports and server-side rendering

## Quick Reference

### Essential Commands

| Task | Command |
|------|---------|
| Run a file | `bun run index.ts` or `bun index.ts` |
| Run a script | `bun run dev` (from package.json) |
| Install dependencies | `bun install` |
| Add a package | `bun add react` |
| Add dev dependency | `bun add -d @types/react` |
| Remove a package | `bun remove react` |
| Run tests | `bun test` |
| Watch tests | `bun test --watch` |
| Bundle code | `bun build ./index.ts --outdir ./dist` |
| Start a server | `bun run server.ts` (with `Bun.serve()`) |
| Execute a package | `bunx cowsay "Hello"` |

### Configuration Files

| File | Purpose |
|------|---------|
| `bunfig.toml` | Bun-specific settings (runtime, test, bundler, package manager) |
| `package.json` | Project metadata, dependencies, scripts |
| `tsconfig.json` | TypeScript compiler options (Bun respects this) |
| `bun.lock` | Lockfile (text-based, commit to git) |

### Key Bun APIs

| API | Purpose |
|-----|---------|
| `Bun.serve()` | Start an HTTP server with routing |
| `Bun.file(path)` | Create a file reference (lazy-loaded) |
| `Bun.write(dest, data)` | Write data to disk (optimized syscalls) |
| `Bun.test()` | Define a test |
| `Bun.build()` | Programmatic bundling |
| `import.meta.dir` | Current directory |
| `import.meta.main` | Is this the entry file? |

## Decision Guidance

### When to Use X vs Y

| Scenario | Use | Why |
|----------|-----|-----|
| Running TypeScript | `bun run file.ts` | No compilation step needed |
| Running Node.js code | `bun run file.js` | Drop-in replacement, faster startup |
| Installing packages | `bun install` | 25x faster than npm |
| Running tests | `bun test` | Jest-compatible, built-in, no config |
| Bundling for browser | `bun build --target browser` | Fast, handles JSX/CSS/assets |
| Bundling for server | `bun build --target bun` | Optimized for Bun runtime |
| Creating HTTP server | `Bun.serve()` | 2.5x faster than Node.js http |
| Reading files | `Bun.file()` + `await file.text()` | Lazy-loaded, optimized |
| Writing files | `Bun.write(path, data)` | Uses fastest syscall per platform |
| Package manager | `bun install` vs `npm install` | Bun is faster, compatible with npm |

## Workflow

### 1. Initialize a Project
```bash
bun init my-app
cd my-app
```
Choose template: Blank, React, or Library.

### 2. Install Dependencies
```bash
bun install
# or add specific packages
bun add react
bun add -d @types/react
```
Bun creates `bun.lock` (commit this to git).

### 3. Write Code
- Create `.ts`, `.tsx`, `.js`, `.jsx` files
- Bun transpiles on the fly; no build step needed for development
- Use `import` or `require()` interchangeably

### 4. Run Code
```bash
bun run index.ts
# or run a script from package.json
bun run dev
# or watch mode
bun --watch run index.ts
```

### 5. Write Tests
Create `*.test.ts` or `*.spec.ts` files:
```ts
import { test, expect } from "bun:test";
test("2 + 2 = 4", () => {
  expect(2 + 2).toBe(4);
});
```
Run with `bun test` or `bun test --watch`.

### 6. Bundle for Production
```bash
bun build ./index.ts --outdir ./dist
# or with minification
bun build ./index.ts --outdir ./dist --minify
```

### 7. Verify and Deploy
- Check `dist/` output
- Test with `bun test`
- Commit `bun.lock` to version control
- Deploy the built files

## Common Gotchas

- **Lifecycle scripts are not executed by default** — Bun doesn't run `postinstall` scripts for security. Add packages to `trustedDependencies` in `package.json` to allow them.
- **`bun run` flags go before the script name** — `bun --watch run dev` ✓, `bun run dev --watch` ✗
- **Module resolution is strict** — Imports must match files on disk. Use `tsconfig.json` `paths` for aliasing.
- **CommonJS and ESM work together** — You can `require()` ESM files and `import` CommonJS files, but top-level await can't be `require()`'d.
- **Bun.serve() routes are not regex** — Use simple string paths or `:param` syntax, not regex patterns.
- **File operations are lazy** — `Bun.file()` doesn't read the file until you call `.text()`, `.json()`, etc.
- **Lockfile format changed in v1.2** — Old `bun.lockb` is binary; new `bun.lock` is text. Migrate with `bun install --save-text-lockfile --frozen-lockfile --lockfile-only`.
- **TypeScript errors in Bun.serve()** — Install `@types/bun` and configure `tsconfig.json` with `"lib": ["ESNext"]` and `"module": "Preserve"`.
- **Auto-install is enabled by default** — If no `node_modules` exists, Bun installs dependencies on the fly. Disable with `[install] auto = "disable"` in `bunfig.toml`.
- **Bundler doesn't replace tsc** — Use `bun build` for bundling, not type-checking. Run `tsc --noEmit` separately for type safety.

## Verification Checklist

Before submitting work with Bun:

- [ ] Code runs without errors: `bun run index.ts`
- [ ] All tests pass: `bun test`
- [ ] No TypeScript errors (if using TS): `tsc --noEmit`
- [ ] Dependencies are installed: `bun install` completes without errors
- [ ] `bun.lock` is committed to git (if applicable)
- [ ] `bunfig.toml` is configured correctly (if using custom settings)
- [ ] Build output is correct: `bun build` produces expected files
- [ ] No lifecycle script warnings during install (or `trustedDependencies` is set)
- [ ] File paths are relative or absolute, not bare specifiers (except for packages)
- [ ] Server starts without errors: `bun run server.ts` (if applicable)

## Resources

- **Comprehensive navigation**: https://bun.com/docs/llms.txt — Full page-by-page listing for agent navigation
- **Runtime documentation**: https://bun.com/docs/runtime — Core APIs, file I/O, HTTP server, networking
- **Package manager**: https://bun.com/docs/pm/cli/install — Install, add, remove, workspaces, lockfile
- **Bundler**: https://bun.com/docs/bundler — Build, code splitting, plugins, minification
- **Test runner**: https://bun.com/docs/test — Writing tests, mocks, snapshots, watch mode

---

> For additional documentation and navigation, see: https://bun.com/docs/llms.txt