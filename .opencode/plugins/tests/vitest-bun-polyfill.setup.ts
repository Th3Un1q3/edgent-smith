import { vi } from 'vitest'

/**
 * Polyfill the Bun global for Node.js environments.
 *
 * Bun runtime provides `Bun` as a global (with `Bun.file()`, `Bun.write()`, etc.).
 * When vitest runs with `environment: 'node'` (e.g., during Stryker mutation tests),
 * this global does not exist. Test files that use `vi.spyOn(Bun, 'file')` or
 * otherwise reference `Bun` directly will fail with ReferenceError.
 *
 * This setup file defines stub implementations for the Bun APIs used in tests,
 * allowing `vi.spyOn()` and other mock patterns to work in Node.js.
 */
 
if (typeof Bun === 'undefined') {
  Object.assign(globalThis, {
    Bun: {
      file: vi.fn().mockImplementation((_path: string) => ({
        exists: vi.fn().mockResolvedValue(false),
        json: vi.fn().mockRejectedValue(new Error('File does not exist')),
        text: vi.fn().mockRejectedValue(new Error('File does not exist')),
        stat: vi.fn().mockRejectedValue(new Error('File does not exist')),
      })),
      write: vi.fn(),
      read: vi.fn(),
      build: vi.fn(),
      argv: [] as string[],
      exit: vi.fn(),
      spawn: vi.fn(),
      serve: vi.fn(),
      listen: vi.fn(),
    },
  })
}
 
