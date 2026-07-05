import * as fs from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import * as path from 'node:path'
import { ReadableStream } from 'node:stream/web'

// Convert a glob pattern to a RegExp that matches POSIX-style paths.
// Supported features:
// - "**/" matches zero or more whole path segments.
// - "*" matches any characters except a path separator.
// - "?" matches any single character except a path separator.
// - All other regex metacharacters are escaped literally.

const REGEX_META_CHARS = new Set(['.', '\\', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'])

function globToRegex(pattern: string): RegExp {
  let regex = '^'
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          regex += '(?:.*\\/)?'
          i += 3
          continue
        }
        regex += '.*'
        i += 2
        continue
      }
      regex += '[^\\/]*'
      i += 1
      continue
    }
    if (c === '?') {
      regex += '[^\\/]'
      i += 1
      continue
    }
    if (REGEX_META_CHARS.has(c)) {
      regex += '\\' + c
      i += 1
      continue
    }
    regex += c
    i += 1
  }
  regex += '$'
  return new RegExp(regex)
}

function listFilesRecursive(dir: string, dot: boolean): string[] {
  const results: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (!dot && entry.name.startsWith('.')) {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, dot))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

interface BunFile {
  text(): Promise<string>
  json(): Promise<unknown>
  exists(): Promise<boolean>
  stream(): ReadableStream<Uint8Array>
}

class Glob {
  public readonly regex: RegExp

  constructor(pattern: string) {
    this.regex = globToRegex(pattern)
  }

  match(filePath: string): boolean {
    return this.regex.test(filePath)
  }

  scan(options?: { cwd?: string; dot?: boolean; absolute?: boolean }): AsyncIterable<string> {
    const regex = this.regex
    const cwd = options?.cwd ?? process.cwd()
    const absolute = options?.absolute ?? false
    const dot = options?.dot ?? false

    return (async function* () {
      const allFiles = listFilesRecursive(cwd, dot)
      for (const filePath of allFiles) {
        const relative = path.relative(cwd, filePath)
        if (regex.test(relative)) {
          yield absolute ? filePath : relative
        }
      }
    })()
  }
}

function bunFile(filePath: string): BunFile {
  const fullPath = path.resolve(filePath)

  return {
    async text() {
      return readFile(fullPath, 'utf-8')
    },

    async json() {
      const content = await readFile(fullPath, 'utf-8')
      return JSON.parse(content) as unknown
    },

    async exists() {
      try {
        await stat(fullPath)
        return true
      } catch {
        return false
      }
    },

    stream() {
      const readable = fs.createReadStream(fullPath)
      return new ReadableStream<Uint8Array>({
        start(controller) {
          readable.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk))
          })
          readable.on('end', () => controller.close())
          readable.on('error', (err: Error) => controller.error(err))
        },
        cancel() {
          readable.destroy()
        },
      })
    },
  }
}

const Bun = {
  Glob,
  file(filePath: string): BunFile {
    return bunFile(filePath)
  },
}

export default Bun
export { Glob, globToRegex }
export type { BunFile }
