import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { Effect, Logger, References } from 'effect'
import { vi } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

import { getClient } from '@plugins/helpers/service-client'
import plugin from '@plugins/instructions-loader'

export type AnyEffect = Effect.Effect<unknown>

export interface Store {
  entries: Array<{ key: string, value: unknown }>
  list: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

export interface Harness {
  context: Context
  prompts: Array<{ sessionID: string, text: string }>
  logs: Array<ReadonlyArray<unknown>>
  directory: string
  store: Store
  entries: Store['entries']
  list: Store['list']
  put: Store['put']
  remove: Store['remove']
  register: () => Promise<void>
  before: (event: unknown) => Promise<void>
  injectContext: (event: unknown) => Promise<void>
}

export const SRC_TOUCH = { tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } }

const getClientMock = getClient as unknown as { mockResolvedValue: (value: unknown) => void }

const collectLogger = (logs: Harness['logs']): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message : [message])
  })

export const writeInstruction = (directory: string, name: string, frontmatter: string, body: string): string => {
  const instructionsDirectory = path.join(directory, '.opencode', 'instructions')

  mkdirSync(instructionsDirectory, { recursive: true })

  const filePath = path.join(instructionsDirectory, name)

  writeFileSync(filePath, `---\n${frontmatter}\n---\n${body}\n`)
  return filePath
}

export const makeHarness = (): Harness => {
  const directory = mkdtempSync(path.join(tmpdir(), 'instr-'))
  const storage = new Map<string, unknown>()
  const prompts: Array<{ sessionID: string, text: string }> = []
  const logs: Array<ReadonlyArray<unknown>> = []
  const hooks: Record<string, (event: unknown) => AnyEffect> = {}
  const entries: Array<{ key: string, value: unknown }> = []

  const store: Store = {
    entries,
    list: vi.fn(async () => entries.map(entry => ({ ...entry }))),
    put: vi.fn(async (input: { sessionID: string, key: string, value: unknown }) => {
      const existing = entries.findIndex(entry => entry.key === input.key)
      if (existing === -1) entries.push({ key: input.key, value: input.value })
      else entries[existing] = { key: input.key, value: input.value }
    }),
    remove: vi.fn(async (input: { sessionID: string, key: string }) => {
      const existing = entries.findIndex(entry => entry.key === input.key)
      if (existing !== -1) entries.splice(existing, 1)
    }),
  }

  getClientMock.mockResolvedValue({ session: { instructions: { entry: store } } })

  const context = {
    location: { directory },
    agent: { list: () => Effect.succeed({ data: [] }) },
    tool: {
      hook: (name: string, callback: (event: unknown) => AnyEffect) => {
        hooks[name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
    },
    session: {
      hook: (name: string, callback: (event: unknown) => AnyEffect) => {
        hooks['session:' + name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
      get: () => Effect.succeed({ agent: 'build' }),
      prompt: vi.fn((input: { sessionID: string, text: string }) => {
        prompts.push(input)
        return Effect.succeed(undefined)
      }),
    },
    storage: {
      get: (key: string) => Effect.succeed(storage.get(key)),
      set: (key: string, value: unknown) => Effect.sync(() => { storage.set(key, value) }),
      remove: (key: string) => Effect.sync(() => { storage.delete(key) }),
    },
    options: {},
  } as unknown as Context

  const run = async (effect: AnyEffect): Promise<void> => {
    await Effect.runPromise(
      Effect.withLogger(effect, collectLogger(logs)).pipe(Effect.provideService(References.MinimumLogLevel, 'Debug')),
    )
  }

  return {
    context,
    prompts,
    logs,
    directory,
    store,
    entries,
    list: store.list,
    put: store.put,
    remove: store.remove,
    register: async () => {
      await run(Effect.scoped(plugin.effect(context)))
    },
    before: async (event) => {
      await run(hooks['execute.before'](event))
    },
    injectContext: async (event) => {
      const callback = hooks['session:context']
      if (callback) await run(callback(event))
    },
  }
}

export const register = async (h: Harness): Promise<void> => {
  await h.register()
}

export const touch = (h: Harness, event: unknown = SRC_TOUCH): Promise<void> => h.before(event)

export const keys = (h: Harness): string[] => h.entries.map(entry => entry.key)
