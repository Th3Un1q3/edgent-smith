import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { Effect } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

// Config is read at plugin-registration time; mutate this hoisted object before
// `register()` to steer the instructions path per scenario.
const workflowConfig = vi.hoisted(() => ({
  instructions: '.agents/skills/task-delegation/SKILL.md',
}))

vi.mock('@plugins/config/harness.config', () => ({
  harnessConfig: { plugins: { workflow: workflowConfig } },
}))

import { loadWorkflowInstructions, WORKFLOW_INSTRUCTIONS_SENTINEL } from '@plugins/workflow'

import plugin from '@plugins/workflow'

const CONFIGURED_INSTRUCTIONS = '.agents/skills/task-delegation/SKILL.md'

const SENTINEL_CLOSING = '</workflow_instructions>'

interface SystemPart {
  type: string
  text: string
}

interface Harness {
  context: Context
  emit: (event: { tools: Record<string, unknown>, system: SystemPart[] }) => Promise<void>
}

type Hook = (event: { tools: Record<string, unknown>, system: SystemPart[] }) => Effect.Effect<void>

const directories: string[] = []

const makeDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), 'workflow-instructions-'))

  directories.push(directory)
  return directory
}

const writeInstructions = (directory: string, content: string | Buffer): void => {
  writeFileSync(path.join(directory, 'instructions.md'), content)
}

const makeHarness = (directory: string): Harness => {
  const hooks: Record<string, Hook> = {}
  const context = {
    options: {},
    location: { directory },
    session: {
      hook: (name: string, callback: Hook) => {
        hooks[name] = callback
        return Effect.succeed({ dispose: Effect.void })
      },
      create: () => Effect.succeed({ id: 'ses_child' }),
      prompt: () => Effect.succeed({}),
      fork: () => Effect.succeed({ id: 'ses_fork' }),
      context: () => Effect.succeed([]),
      interrupt: () => Effect.succeed(undefined),
      update: () => Effect.succeed(undefined),
    },
    tool: {
      transform: (callback: (editor: unknown) => void) => {
        callback({
          add: () => {},
          namespace: () => {},
          update: () => {},
          remove: () => {},
          list: () => [],
          get: () => {},
        })
        return Effect.succeed({ dispose: Effect.void })
      },
      hook: () => Effect.succeed({ dispose: Effect.void }),
    },
  } as unknown as Context

  return {
    context,
    emit: async (event) => {
      const callback = hooks.context

      if (callback === undefined) throw new Error('plugin did not register a context hook')
      await Effect.runPromise(callback(event))
    },
  }
}

const register = async (h: Harness): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
}

describe('workflow instructions', () => {
  beforeEach(() => {
    workflowConfig.instructions = CONFIGURED_INSTRUCTIONS
  })

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
  })

  describe('loadWorkflowInstructions', () => {
    it('returns the configured file content verbatim', () => {
      const directory = makeDirectory()
      const body = '# Custom Workflow\n\nBODY-MARKER-123\n'

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      expect(loadWorkflowInstructions(directory)).toBe(body)
    })

    it('loads the task-delegation skill configured for the repository', () => {
      const expected = readFileSync(path.join('/workspace', CONFIGURED_INSTRUCTIONS), 'utf8')

      const content = loadWorkflowInstructions('/workspace')

      expect(content).toBe(expected)
      expect(content).toContain('# Task Delegation Skill')
    })

    const failures: Array<{ name: string, prepare: (file: string) => void }> = [
      { name: 'a missing file', prepare: () => {} },
      {
        name: 'an unreadable path',
        prepare: file => mkdirSync(file, { recursive: true }),
      },
      {
        name: 'an empty file',
        prepare: file => writeFileSync(file, ' \n\t\n'),
      },
      {
        name: 'a non-text payload',
        prepare: file => writeFileSync(file, Buffer.from([0x41, 0xFF, 0xFE, 0x42])),
      },
    ]

    it.each(failures)('throws naming the configured path for $name', ({ prepare }) => {
      const directory = makeDirectory()

      writeInstructions(directory, 'placeholder')
      workflowConfig.instructions = 'instructions.md'
      rmSync(path.join(directory, 'instructions.md'))
      prepare(path.join(directory, 'instructions.md'))

      expect(() => loadWorkflowInstructions(directory)).toThrow('instructions.md')
    })

    it('returns a large payload byte-for-byte without truncation', () => {
      const directory = makeDirectory()
      const body = 'workflow-✓-0123456789\n'.repeat(6000)

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThanOrEqual(100 * 1024)

      const content = loadWorkflowInstructions(directory)

      expect(content).toBe(body)
      expect(Buffer.byteLength(content, 'utf8')).toBe(Buffer.byteLength(body, 'utf8'))
    })
  })

  describe('context hook injection', () => {
    const body = '# Workflow Instructions\n\nDELEGATION-BODY\n'
    const wrapped = `${WORKFLOW_INSTRUCTIONS_SENTINEL}\n${body}\n${SENTINEL_CLOSING}`

    const setup = async (): Promise<Harness> => {
      const directory = makeDirectory()

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      const h = makeHarness(directory)

      await register(h)
      return h
    }

    it('injects the sentinel-wrapped content when the workflow tool is available', async () => {
      const h = await setup()
      const event = { tools: { workflow: {} }, system: [{ type: 'text', text: 'prefix' }] as SystemPart[] }

      await h.emit(event)

      expect(event.system).toHaveLength(2)
      expect(event.system[1]).toEqual({ type: 'text', text: wrapped })
    })

    it('injects the sentinel-wrapped content when the workflow tool is exposed through code mode', async () => {
      const h = await setup()
      const event = { tools: { execute: {} }, system: [{ type: 'text', text: 'prefix' }] as SystemPart[] }

      await h.emit(event)

      expect(event.system).toHaveLength(2)
      expect(event.system[1]).toEqual({ type: 'text', text: wrapped })
    })

    it('does not inject when the workflow tool is absent', async () => {
      const h = await setup()
      const system = [{ type: 'text', text: 'prefix' }]
      const event = { tools: { bash: {} }, system }

      await h.emit(event)

      expect(event.system).toEqual(system)
    })

    it('replaces an existing sentinel block instead of duplicating it', async () => {
      const h = await setup()
      const event = {
        tools: { workflow: {} },
        system: [
          { type: 'text', text: 'before' },
          { type: 'text', text: `${WORKFLOW_INSTRUCTIONS_SENTINEL}\nstale\n${SENTINEL_CLOSING}` },
          { type: 'text', text: 'after' },
        ] as SystemPart[],
      }

      await h.emit(event)

      const blocks = event.system.filter(part => part.text.includes(WORKFLOW_INSTRUCTIONS_SENTINEL))

      expect(blocks).toHaveLength(1)
      expect(event.system).toEqual([
        { type: 'text', text: 'before' },
        { type: 'text', text: 'after' },
        { type: 'text', text: wrapped },
      ])
    })
  })
})
