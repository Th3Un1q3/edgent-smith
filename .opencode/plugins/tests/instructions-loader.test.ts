import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { Effect } from 'effect'

import { describe, it, expect } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

import plugin from '@plugins/instructions-loader'

type AnyEffect = Effect.Effect<unknown>

interface Harness {
  context: Context
  prompts: Array<{ sessionID: string, text: string }>
  before: (event: unknown) => Promise<void>
  injectContext: (event: unknown) => Promise<void>
  directory: string
}

const writeInstruction = (directory: string, name: string, frontmatter: string, body: string): void => {
  const instructionsDirectory = path.join(directory, '.opencode', 'instructions')

  mkdirSync(instructionsDirectory, { recursive: true })
  writeFileSync(path.join(instructionsDirectory, name), `---\n${frontmatter}\n---\n${body}\n`)
}

const makeHarness = (): Harness => {
  const directory = mkdtempSync(path.join(tmpdir(), 'instr-'))
  const storage = new Map<string, unknown>()
  const prompts: Array<{ sessionID: string, text: string }> = []
  const hooks: Record<string, (event: unknown) => AnyEffect> = {}

  const context = {
    location: { directory },
    agent: { list: () => Effect.succeed({ data: [] }) },
    tool: {
      hook: (name: string, callback: (event: unknown) => AnyEffect) => {
        hooks['tool:' + name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
    },
    session: {
      hook: (name: string, callback: (event: unknown) => AnyEffect) => {
        hooks['session:' + name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
      get: () => Effect.succeed({ agent: 'build' }),
      prompt: (input: { sessionID: string, text: string }) => {
        prompts.push(input)
        return Effect.succeed(undefined)
      },
    },
    storage: {
      get: (key: string) => Effect.succeed(storage.get(key)),
      set: (key: string, value: unknown) => Effect.sync(() => { storage.set(key, value) }),
      remove: (key: string) => Effect.sync(() => { storage.delete(key) }),
    },
    options: {},
  } as unknown as Context

  return {
    context,
    prompts,
    directory,
    before: async (event) => {
      const callback = hooks['tool:execute.before']

      await Effect.runPromise(callback(event))
    },
    injectContext: async (event) => {
      const callback = hooks['session:context']
      if (callback) await Effect.runPromise(callback(event))
    },
  }
}

const register = async (h: Harness): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
}

describe('instructions-loader (v2)', () => {
  it('sends the matching instruction when a targeted file is touched', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'name: alpha\ndescription: Alpha rule\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(1)
    expect(h.prompts[0].text).toContain('ALPHA BODY')
  })

  it('does not re-send an instruction already injected in the session', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha rule\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(1)
  })

  it('sends at most 5 full contents; further matches are references', async () => {
    const h = makeHarness()
    for (let i = 1; i <= 6; i++) {
      writeInstruction(h.directory, `rule${i}.instructions.md`, `description: Rule ${i}\napplyTo: "src/**/*.ts"`, `BODY_${i}`)
    }
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    const text = h.prompts[0].text

    expect((text.match(/<instruction>/g) || []).length).toBe(6)
    expect((text.match(/<content>/g) || []).length).toBe(5)
    expect((text.match(/<meta /g) || []).length).toBe(1)
  })

  it('ignores tools that are not targeted', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'bash', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(0)
  })

  it('excludes instructions whose excludeAgents matches the session agent', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"\nexcludeAgents: build', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(0)
  })

  it('injects the pending instructions into the model request system prompt', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    const event = { sessionID: 'ses_1', agent: 'build', system: [], messages: [], model: {}, options: {} }

    await h.injectContext(event)
    expect(JSON.stringify(event.system)).toContain('ALPHA BODY')
  })
})
