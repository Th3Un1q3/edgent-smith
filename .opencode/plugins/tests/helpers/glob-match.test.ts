import { describe, it, expect } from "vitest"

import { isGlobMatch } from "@plugins/helpers/glob-match"

describe("isGlobMatch", () => {
  const cases = [
    // ── literal matching ──────────────────────────────────────────
    { name: "exact literal match",           pattern: "foo",      subject: "foo",       expected: true },
    { name: "literal mismatch",              pattern: "foo",      subject: "bar",       expected: false },
    { name: "literal prefix — must be fully anchored", pattern: "foo", subject: "foobar", expected: false },
    { name: "empty pattern matches empty subject", pattern: "",    subject: "",          expected: true },
    { name: "empty pattern does not match non-empty", pattern: "", subject: "a",        expected: false },
    { name: "non-empty pattern does not match empty", pattern: "a", subject: "",        expected: false },

    // ── single star (*) — any chars except / ─────────────────────
    { name: "* matches any chars in a single segment",  pattern: "a*b",   subject: "aXb",    expected: true },
    { name: "* matches zero chars",                     pattern: "a*b",   subject: "ab",     expected: true },
    { name: "* matches multiple chars in segment",      pattern: "a*b",   subject: "aXYZb",  expected: true },
    { name: "* does not cross path separator",          pattern: "a*b",   subject: "a/b",    expected: false },
    { name: "leading * matches prefix",                 pattern: "*.ts",  subject: "foo.ts", expected: true },
    { name: "leading * must be fully anchored",         pattern: "*.ts",  subject: "a/foo.ts", expected: false },
    { name: "trailing * matches suffix",                pattern: "src/*", subject: "src/bar", expected: true },

    // ── double star (**) — anything including / ──────────────────
    { name: "** matches zero chars",              pattern: "a**b", subject: "ab",         expected: true },
    { name: "bare ** matches everything",         pattern: "**",   subject: "copilot",    expected: true },
    { name: "bare ** matches paths",              pattern: "**",   subject: "src/foo.ts", expected: true },

    // ── **/ — zero or more directory levels ──────────────────────
    { name: "**/ matches with leading directories",      pattern: "**/dir",  subject: "a/dir",     expected: true },
    { name: "**/ matches with multiple levels",           pattern: "**/dir",  subject: "a/b/dir",   expected: true },
    { name: "**/ matches with no leading directory",      pattern: "**/dir",  subject: "dir",       expected: true },
    { name: "**/ only matches when trailing matches",     pattern: "**/dir",  subject: "other",     expected: false },
    { name: "**/ is greedy — anchored at end",            pattern: "**/dir",  subject: "a/dir/extra", expected: false },

    // ── question mark (?) — single non-/ char ───────────────────
    { name: "? matches exactly one char",         pattern: "a?b", subject: "aXb",  expected: true },
    { name: "? does not match path separator",    pattern: "a?b", subject: "a/b",  expected: false },
    { name: "? does not match zero chars",        pattern: "a?b", subject: "ab",   expected: false },
    { name: "? does not match two chars",         pattern: "a?b", subject: "aXXb", expected: false },

    // ── regex special chars are escaped ─────────────────────────
    { name: "dot is literal not regex-any",       pattern: "a.b",  subject: "a.b", expected: true },
    { name: "dot does not match arbitrary char",  pattern: "a.b",  subject: "aXb", expected: false },
    { name: "plus sign is literal",               pattern: "a+b",  subject: "a+b", expected: true },

    // ── combined patterns ───────────────────────────────────────
    { name: "src/**/*.ts matches nested .ts files",  pattern: "src/**/*.ts", subject: "src/foo/bar.ts", expected: true },
    { name: "src/**/*.ts matches root-level .ts",    pattern: "src/**/*.ts", subject: "src/bar.ts",     expected: true },
    { name: "*.md matches top-level markdown",       pattern: "*.md",        subject: "README.md",      expected: true },
    { name: "copilot* matches prefix",               pattern: "copilot*",    subject: "copilot",        expected: true },
    { name: "copilot* matches with suffix",          pattern: "copilot*",    subject: "copilot-agent",  expected: true },
    { name: "**/*.ts matches any .ts file",          pattern: "**/*.ts",     subject: "dir/file.ts",    expected: true },
  ]

  it.each(cases)("$name", ({ pattern, subject, expected }) => {
    expect(isGlobMatch(pattern, subject)).toBe(expected)
  })
})
