import { Glob } from "bun"

/**
 * Match a string against a glob pattern using Bun's built-in Glob.
 *
 * @param pattern - The glob pattern, e.g. "src/**\/*.ts" or "*.md"
 * @param subject - The string to test, e.g. a file path or agent name
 * @returns true if the subject matches the pattern
 *
 * @example
 * isGlobMatch("src/**\/*.ts", "src/foo/bar.ts")  // true
 * isGlobMatch("*.md", "README.md")                // true
 * isGlobMatch("**", "copilot")                    // true
 */
export function isGlobMatch(pattern: string, subject: string): boolean {
  return new Glob(pattern).match(subject)
}
