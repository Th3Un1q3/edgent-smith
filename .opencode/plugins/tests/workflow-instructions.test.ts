import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { Effect, Logger, Stream } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

import type { SessionID } from '@opencode/schema/session-id'

// Config is read at plugin-registration time; mutate this hoisted object before
// `register()` to steer the instructions path per scenario.
const workflowConfig = vi.hoisted(() => ({
  instructions: '.agents/skills/task-delegation/SKILL.md',
  agents: ['rug-swe'],
  missing: false,
}))

vi.mock('@plugins/config/harness.config', () => ({
  harnessConfig: {
    plugins: {
      get workflow() { return workflowConfig.missing ? undefined : workflowConfig },
    },
  },
}))

const entryClient = vi.hoisted(() => ({
  writeEntry: vi.fn(),
  removeEntry: vi.fn(),
  limits: { max: 256 * 1024 },
}))

vi.mock('@plugins/helpers/instruction-entry-client', () => ({
  writeEntry: entryClient.writeEntry,
  removeEntry: entryClient.removeEntry,
  entryValueBytes: (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8'),
  get MAX_ENTRY_VALUE_BYTES() { return entryClient.limits.max },
}))

import { handleSessionEvent, loadWorkflowInstructions, WORKFLOW_INSTRUCTIONS_SENTINEL } from '@plugins/workflow'

import plugin from '@plugins/workflow'

import { REPO_ROOT } from '@tests/helpers/repo-root'

const CONFIGURED_INSTRUCTIONS = '.agents/skills/task-delegation/SKILL.md'

interface Harness {
  context: Context
  logs: Array<ReadonlyArray<unknown>>
  subscriptions: number
}

const directories: string[] = []

const makeDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), 'workflow-instructions-'))

  directories.push(directory)
  return directory
}

const writeInstructions = (directory: string, content: string | Buffer): void => {
  writeFileSync(path.join(directory, 'instructions.md'), content)
}

const collectLogger = (logs: Harness['logs']): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message : [message])
  })

const makeHarness = (directory: string, events: ReadonlyArray<{ type: string, data: { sessionID: SessionID, agent?: string } }> = []): Harness => {
  const logs: Harness['logs'] = []
  let subscriptions = 0
  const context = {
    options: {},
    location: { directory },
    event: {
      subscribe: () => {
        subscriptions += 1
        return events.length === 0 ? Stream.empty : Stream.fromIterable(events)
      },
    },
    session: {
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
    logs,
    get subscriptions() { return subscriptions },
  }
}

const register = async (h: Harness): Promise<void> => {
  const scoped = Effect.scoped(plugin.effect(h.context))
  const logged = Effect.withLogger(collectLogger(h.logs))(scoped)

  await Effect.runPromise(logged)
}

describe('workflow instructions', () => {
  beforeEach(() => {
    workflowConfig.instructions = CONFIGURED_INSTRUCTIONS
    workflowConfig.agents = ['rug-swe']
    workflowConfig.missing = false
    entryClient.writeEntry.mockReset().mockResolvedValue({ status: 'written' })
    entryClient.removeEntry.mockReset().mockResolvedValue({ status: 'absent' })
  })

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
  })

  describe('loadWorkflowInstructions', () => {
    it('returns the configured file content verbatim beside its resolved source', () => {
      const directory = makeDirectory()
      const body = '# Custom Workflow\n\nBODY-MARKER-123\n'

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      expect(loadWorkflowInstructions(directory)).toEqual({ source: path.resolve(directory, 'instructions.md'), content: body })
    })

    it('loads the task-delegation skill configured for the repository', () => {
      const expected = readFileSync(path.join(REPO_ROOT, CONFIGURED_INSTRUCTIONS), 'utf8')

      const { content } = loadWorkflowInstructions(REPO_ROOT)

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

      const { content } = loadWorkflowInstructions(directory)

      expect(content).toBe(body)
      expect(Buffer.byteLength(content, 'utf8')).toBe(Buffer.byteLength(body, 'utf8'))
    })
  })

  describe('configuration and content guards', () => {
    const harnessWithInstructions = (): Harness => {
      const directory = makeDirectory()

      writeInstructions(directory, '# Body\n')
      workflowConfig.instructions = 'instructions.md'
      return makeHarness(directory)
    }

    it('names the instructions key when the workflow section is absent', () => {
      workflowConfig.missing = true

      expect(() => loadWorkflowInstructions(makeDirectory())).toThrow('harnessConfig.plugins["workflow"].instructions')
    })

    it('names the instructions key when the configured value is not a string', () => {
      workflowConfig.instructions = 42 as unknown as string

      expect(() => loadWorkflowInstructions(makeDirectory())).toThrow('harnessConfig.plugins["workflow"].instructions')
    })

    it('rejects an agents value that is not an array', async () => {
      workflowConfig.agents = 'rug' as unknown as string[]

      await expect(register(harnessWithInstructions())).rejects.toThrow('.agents: missing or not a non-empty string array')
    })

    it('rejects an empty agents list', async () => {
      workflowConfig.agents = []

      await expect(register(harnessWithInstructions())).rejects.toThrow('.agents: missing or not a non-empty string array')
    })

    it('rejects a blank agent name', async () => {
      workflowConfig.agents = ['rug', '']

      await expect(register(harnessWithInstructions())).rejects.toThrow('.agents: missing or not a non-empty string array')
    })

    it('rejects a non-string agent name', async () => {
      workflowConfig.agents = [42] as unknown as string[]

      await expect(register(harnessWithInstructions())).rejects.toThrow('.agents: missing or not a non-empty string array')
    })

    it('rejects a blank project directory', () => {
      expect(() => loadWorkflowInstructions(' '.repeat(3))).toThrow('project directory is missing')
    })

    it('rejects content that contains a NUL byte', () => {
      const directory = makeDirectory()

      writeInstructions(directory, 'A\0B')
      workflowConfig.instructions = 'instructions.md'

      expect(() => loadWorkflowInstructions(directory)).toThrow('NUL byte')
    })

    it('rejects content that contains U+FFFD', () => {
      const directory = makeDirectory()

      writeInstructions(directory, 'A\u{FFFD}B')
      workflowConfig.instructions = 'instructions.md'

      expect(() => loadWorkflowInstructions(directory)).toThrow('U+FFFD')
    })
  })

  describe('session event entry', () => {
    const body = '# Workflow Instructions\n\nDELEGATION-BODY\n'
    const entryValue = `${WORKFLOW_INSTRUCTIONS_SENTINEL} source="${REPO_ROOT}/.agents/skills/task-delegation/SKILL.md" version="1">\n${body}\n</workflow_instructions>`

    const setup = async (): Promise<Harness> => {
      const directory = makeDirectory()

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      const h = makeHarness(directory)

      await register(h)
      return h
    }

    const emit = async (h: Harness, event: { type: string, data: { sessionID: SessionID, agent?: string } }): Promise<void> => {
      const effect = handleSessionEvent(event, {
        agentAllowlist: new Set(workflowConfig.agents),
        block: entryValue,
        entryBytes: Buffer.byteLength(JSON.stringify(entryValue), 'utf8'),
      })

      await Effect.runPromise(Effect.withLogger(collectLogger(h.logs))(effect))
    }

    it('writes the entry for an agent named on the session.agent.selected event', async () => {
      const h = await setup()

      await emit(h, { type: 'session.agent.selected', data: { sessionID: 'ses_selected' as unknown as SessionID, agent: 'rug-swe' } })

      expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_selected', 'workflow.instructions', entryValue)
    })

    describe('when the entry value is already current', () => {
      beforeEach(() => {
        entryClient.writeEntry.mockResolvedValueOnce({ status: 'written' }).mockResolvedValueOnce({ status: 'unchanged' })
      })

      it('calls the writer and logs that nothing was written', async () => {
        const h = await setup()

        await emit(h, { type: 'session.created', data: { sessionID: 'ses_repeat' as unknown as SessionID, agent: 'rug-swe' } })
        await emit(h, { type: 'session.created', data: { sessionID: 'ses_repeat' as unknown as SessionID, agent: 'rug-swe' } })

        expect(entryClient.writeEntry).toHaveBeenCalledTimes(2)
        expect(entryClient.writeEntry).toHaveBeenLastCalledWith('ses_repeat', 'workflow.instructions', entryValue)
        expect(h.logs).toContainEqual(['workflow.instructions', expect.objectContaining({ sessionID: 'ses_repeat', status: 'unchanged' })])
      })
    })

    describe('when the session agent is not listed', () => {
      beforeEach(() => {
        entryClient.removeEntry.mockResolvedValue({ status: 'removed' })
      })

      it('removes the existing entry and writes nothing', async () => {
        const h = await setup()

        await emit(h, { type: 'session.agent.selected', data: { sessionID: 'ses_unlisted' as unknown as SessionID, agent: 'build' } })

        expect(entryClient.removeEntry).toHaveBeenCalledWith('ses_unlisted', 'workflow.instructions')
        expect(entryClient.writeEntry).not.toHaveBeenCalled()
        expect(h.logs).toContainEqual(['workflow.instructions.skipped', expect.objectContaining({ sessionID: 'ses_unlisted', status: 'removed' })])
      })
    })

    describe('when the session holds no instruction entry', () => {
      it('logs the absent status without an error', async () => {
        const h = await setup()

        await emit(h, { type: 'session.agent.selected', data: { sessionID: 'ses_absent' as unknown as SessionID, agent: 'build' } })

        expect(h.logs).toContainEqual(['workflow.instructions.skipped', expect.objectContaining({ sessionID: 'ses_absent', status: 'absent' })])
        expect(h.logs).not.toContainEqual(['workflow.instructions.error', expect.anything()])
      })
    })

    it('reports a failed write status as an error', async () => {
      entryClient.writeEntry.mockResolvedValue({ status: 'failed', error: 'write failed' })

      const h = await setup()

      await emit(h, { type: 'session.created', data: { sessionID: 'ses_write_failed' as unknown as SessionID, agent: 'rug-swe' } })

      expect(h.logs).toContainEqual(['workflow.instructions', expect.objectContaining({ sessionID: 'ses_write_failed', status: 'failed' })])
      expect(h.logs).toContainEqual(['workflow.instructions.error', expect.objectContaining({ message: expect.stringContaining('write failed') })])
    })

    describe('when the event carries no agent', () => {
      it('logs one skip line and writes nothing', async () => {
        const h = await setup()

        await expect(emit(h, { type: 'session.created', data: { sessionID: 'ses_no_agent' as unknown as SessionID } })).resolves.toBeUndefined()

        expect(h.logs).toContainEqual(['workflow.instructions.skipped', expect.objectContaining({ sessionID: 'ses_no_agent', agent: 'unknown' })])
        expect(entryClient.writeEntry).not.toHaveBeenCalled()
      })
    })
  })

  describe('rendered instruction block', () => {
    const body = '# Workflow Instructions\n\nDELEGATION-BODY\n'

    const parseTagAttributes = (tag: string): Record<string, string> => {
      const attributes: Record<string, string> = {}
      for (const [, name, value] of tag.matchAll(/([a-z_]+)="([^"]*)"/g)) {
        attributes[name] = value
      }
      return attributes
    }

    const decodeEntities = (value: string): string =>
      value.replaceAll('&lt;', '<').replaceAll('&quot;', '"').replaceAll('&amp;', '&')

    const renderBlock = async (directory: string): Promise<string> => {
      let written: string | undefined
      let resumeWrite: (() => void) | undefined

      entryClient.writeEntry.mockClear()
      entryClient.writeEntry.mockImplementation(async (_sessionID: string, _key: string, value: string) => {
        written = value
        resumeWrite?.()
        return { status: 'written' }
      })

      const h = makeHarness(directory, [{ type: 'session.created', data: { sessionID: 'ses_rendered' as unknown as SessionID, agent: 'rug-swe' } }])
      const registered = plugin.effect(h.context)
      const awaitWrite = Effect.callback<void>((resume) => {
        if (written === undefined) {
          resumeWrite = () => {
            resume(Effect.void)
          }
          return
        }
        resume(Effect.void)
      })

      await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
        yield* registered
        yield* awaitWrite
      })))

      entryClient.writeEntry.mockResolvedValue({ status: 'written' })

      if (written === undefined) throw new Error('the workflow instruction entry was not written')
      return written
    }

    it('writes the resolved instruction source path alongside the content', async () => {
      const directory = makeDirectory()

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      const block = await renderBlock(directory)
      const [openingTag] = block.split('\n', 1)

      expect(openingTag).toBe(`${WORKFLOW_INSTRUCTIONS_SENTINEL} source="${path.resolve(directory, 'instructions.md')}" version="1">`)
    })

    it('keeps the instruction content unchanged inside the block', async () => {
      const directory = makeDirectory()

      writeInstructions(directory, body)
      workflowConfig.instructions = 'instructions.md'

      const block = await renderBlock(directory)
      const openingTag = `${WORKFLOW_INSTRUCTIONS_SENTINEL} source="${path.resolve(directory, 'instructions.md')}" version="1">`

      expect(block).toBe(`${openingTag}\n${body}\n</workflow_instructions>`)
    })

    it('escapes a quote in the resolved source path so the opening tag stays well formed', async () => {
      const directory = makeDirectory()
      const fileName = String.raw`inst"ruc&t<ions\.md`

      writeFileSync(path.join(directory, fileName), body)
      workflowConfig.instructions = fileName

      const block = await renderBlock(directory)
      const [openingTag] = block.split('\n', 1)

      expect(openingTag).toMatch(new RegExp(`^${WORKFLOW_INSTRUCTIONS_SENTINEL} source="[^"]*" version="1">$`))
      expect(openingTag).toContain('&quot;')
      expect(openingTag).toContain('&lt;')
      expect(openingTag).toContain('&amp;')
      expect(openingTag).not.toContain(fileName)

      const attributes = parseTagAttributes(openingTag)

      expect(Object.keys(attributes)).toEqual(['source', 'version'])
      expect(decodeEntities(attributes.source)).toBe(path.resolve(directory, fileName))
    })
  })
})
