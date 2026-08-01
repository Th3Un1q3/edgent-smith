/**
 * Faithful shim of Bun's `bun` module for Node.js runtimes.
 *
 * Stryker runs under Node (node_modules/.bin/stryker has a node shebang), where the
 * `bun` module does not exist. This file is wired into vitest via `resolve.alias`
 * (`"bun" -> plugins/tests/__mocks__/bun.ts`) so test files that import `bun` load
 * under Node. It provides REAL implementations (no vi.fn / vitest imports) and works
 * in any runtime.
 *
 * Implements the subset of the Bun API used by the plugins:
 *   - Glob.match() and Glob.scan()
 *   - file(): exists() / text() / json() / stat()
 *   - write()
 */
import { access, readFile, readdir, stat as fsStat, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

/** Expand `{a,b}` brace groups into every alternative pattern (nested groups supported). */
function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern)
  if (!match) return [pattern]
  const alternatives = match[1].split(",")
  const expanded = alternatives.map((option) =>
    pattern.slice(0, match.index) + option + pattern.slice(match.index + match[0].length),
  )
  return expanded.flatMap(expandBraces)
}

/** Translate a single brace-free glob pattern into an anchored RegExp. */
function globToRegExp(pattern: string): RegExp {
  let out = "^"
  let i = 0
  while (i < pattern.length) {
    const char = pattern[i]
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        i += 2
        if (pattern[i] === "/") {
          // `**/` — zero or more directory levels
          out += "(?:[^/]*/)*"
          i += 1
        } else {
          // bare `**` — anything, including `/`
          out += ".*"
        }
      } else {
        // `*` — any characters except `/`
        out += "[^/]*"
        i += 1
      }
    } else if (char === "?") {
      // `?` — exactly one non-`/` character
      out += "[^/]"
      i += 1
    } else if (char === "[") {
      const end = pattern.indexOf("]", i + 1)
      if (end === -1) {
        out += "\\["
        i += 1
      } else {
        let contents = pattern.slice(i + 1, end)
        if (contents.startsWith("!")) contents = "^" + contents.slice(1)
        out += "[" + contents + "]"
        i = end + 1
      }
    } else {
      // Everything else is literal — regex special characters are escaped.
      out += char.replace(/[.+^${}()|[\]\\]/g, "\\$&")
      i += 1
    }
  }
  return new RegExp(out + "$")
}

/** Longest static (wildcard-free) directory prefix of a pattern, relative to cwd. */
function staticBaseDir(pattern: string): string {
  const dir = dirname(pattern)
  if (dir === ".") return ""
  return dir
    .split("/")
    .filter((segment) => !/[*?[\]{}]/.test(segment))
    .join("/")
}

type ScanOptions = {
  cwd?: string
  dot?: boolean
  absolute?: boolean
}

export class Glob {
  constructor(readonly pattern: string) {}

  /** Full-string glob match with Bun-compatible semantics. */
  match(subject: string): boolean {
    return expandBraces(this.pattern).some((pattern) => globToRegExp(pattern).test(subject))
  }

  /**
   * Walk the filesystem from `path.join(cwd, dirname(pattern))` (or cwd when the
   * pattern has no directory part), yielding file paths that match the pattern.
   * Paths are absolute when `absolute: true`, otherwise relative to `cwd`.
   */
  async *scan(options: ScanOptions = {}): AsyncGenerator<string, void, void> {
    const cwd = options.cwd ?? process.cwd()
    const dot = options.dot ?? false
    const absolute = options.absolute ?? false
    const base = join(cwd, staticBaseDir(this.pattern))

    async function* walk(directory: string): AsyncGenerator<string, void, void> {
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => null)
      if (!entries) return
      for (const entry of entries) {
        if (!dot && entry.name.startsWith(".")) continue
        if (entry.name === "node_modules" || entry.name === ".git") continue
        const fullPath = join(directory, entry.name)
        if (entry.isDirectory()) {
          yield* walk(fullPath)
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          yield fullPath
        }
      }
    }

    for await (const absolutePath of walk(base)) {
      const relativePath = relative(cwd, absolutePath)
      if (this.match(relativePath)) {
        yield absolute ? absolutePath : relativePath
      }
    }
  }
}

type BunFile = {
  exists(): Promise<boolean>
  text(): Promise<string>
  json(): Promise<unknown>
  stat(): Promise<{ mtimeMs: number }>
}

/** Bun-compatible file handle backed by node:fs/promises. */
export function file(path: string): BunFile {
  return {
    async exists(): Promise<boolean> {
      try {
        await access(path)
        return true
      } catch {
        return false
      }
    },
    async text(): Promise<string> {
      return readFile(path, "utf8")
    },
    async json(): Promise<unknown> {
      return JSON.parse(await readFile(path, "utf8"))
    },
    async stat(): Promise<{ mtimeMs: number }> {
      const result = await fsStat(path, { bigint: false })
      return { mtimeMs: result.mtimeMs }
    },
  }
}

/** Bun-compatible write (for completeness). Returns the number of bytes written. */
export async function write(path: string, data: string | Uint8Array): Promise<number> {
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data)
  await writeFile(path, buffer)
  return buffer.length
}

const bunModule = { Glob, file, write }

export default bunModule
