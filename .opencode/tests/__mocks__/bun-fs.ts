import * as fs from 'node:fs'
import { type Mock, vi } from 'vitest'

// Local Bun-style signatures matching exactly what kv-store.ts consumes.
interface BunReadFileSync {
  (path: string): Buffer
  (path: string, encoding: string): string
}

interface BunWriteFileSync {
  (path: string, data: string | Uint8Array, options?: string): void
}

interface BunMkdirSync {
  (path: string, options?: { recursive?: boolean }): void
}

export const readFileSync: Mock<BunReadFileSync> = vi.fn(
  ((path: string, encoding?: string): string | Buffer => {
    if (encoding === undefined) {
      return fs.readFileSync(path)
    }
    return fs.readFileSync(path, encoding as BufferEncoding)
  }) as BunReadFileSync,
) as Mock<BunReadFileSync>

export const writeFileSync: Mock<BunWriteFileSync> = vi.fn(
  ((path: string, data: string | Uint8Array, options?: string): void => {
    if (options === undefined) {
      fs.writeFileSync(path, data)
    } else {
      fs.writeFileSync(path, data, options as BufferEncoding)
    }
  }) as BunWriteFileSync,
) as Mock<BunWriteFileSync>

export const mkdirSync: Mock<BunMkdirSync> = vi.fn(
  ((path: string, options?: { recursive?: boolean }): void => {
    fs.mkdirSync(path, options)
  }) as BunMkdirSync,
) as Mock<BunMkdirSync>
