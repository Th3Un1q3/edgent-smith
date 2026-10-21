import { Effect, Fiber, Logger, Stream } from 'effect'

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

const harness = vi.hoisted(() => {
  const defaults = {
    instructions: '.agents/skills/task-delegation/SKILL.md',
    agents: ['rug', 'rug-workflow'],
  }
  const config: { plugins: { workflow?: { instructions?: unknown, agents?: unknown } } } = {
    plugins: { workflow: { ...defaults } },
  }
  return {
    config,
    set: (overrides: { instructions?: unknown, agents?: unknown }) => {
      config.plugins.workflow = { ...defaults, ...overrides }
    },
    reset: () => {
      config.plugins.workflow = { ...defaults }
    },
  }
})

vi.mock('@plugins/config/harness.config', () => ({ harnessConfig: harness.config }))

const entryClient = vi.hoisted(() => ({
  writeEntry: vi.fn(),
  removeEntry: vi.fn(),
}))

vi.mock('@plugins/helpers/instruction-entry-client', () => ({
  writeEntry: entryClient.writeEntry,
  removeEntry: entryClient.removeEntry,
  entryValueBytes: (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8'),
  get MAX_ENTRY_VALUE_BYTES() { return 256 * 1024 },
}))

import { createWorkflowClient } from '@plugins/helpers/workflow-client-adapter'

import plugin, { handleSessionEvent, isWorkflowSessionEvent, loadWorkflowInstructions, WORKFLOW_INSTRUCTIONS_SENTINEL } from '@plugins/workflow'

import type { WorkflowSessionHandlerOptions } from '@plugins/workflow'

interface SessionEventPayload {
  type: string
  data: { sessionID: string, agent?: string }
}

interface Harness {
  context: Context
  tools: Array<Record<string, unknown>>
  logs: Array<ReadonlyArray<unknown>>
  subscriptions: number
}

const collectLogger = (logs: Harness['logs']): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message : [message])
  })

const makeHarness = (events: SessionEventPayload[] = []): Harness => {
  const tools: Array<Record<string, unknown>> = []
  const logs: Array<ReadonlyArray<unknown>> = []
  let subscriptions = 0
  const context = {
    options: {},
    location: { directory: '/workspace' },
    event: {
      subscribe: () => {
        subscriptions += 1
        return events.length === 0 ? Stream.empty : Stream.fromIterable(events).pipe(Stream.concat(Stream.never))
      },
    },
    tool: {
      transform: (callback: (editor: unknown) => void) => {
        callback({
          add: (tool: unknown) => { tools.push(tool as unknown as Record<string, unknown>) },
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
    session: {
      create: () => Effect.succeed({ id: 'ses_child' }),
      prompt: () => Effect.succeed({}),
      fork: () => Effect.succeed({ id: 'ses_fork' }),
      context: () => Effect.succeed([]),
      interrupt: () => Effect.succeed(undefined),
      update: () => Effect.succeed(undefined),
    },
  } as unknown as Context

  return {
    context,
    tools,
    logs,
    get subscriptions() { return subscriptions },
  }
}

const emitSessionEvent = async (
  event: SessionEventPayload,
  options?: WorkflowSessionHandlerOptions,
): Promise<Harness['logs']> => {
  const logs: Harness['logs'] = []
  const effect = handleSessionEvent(event, options ?? {
    agentAllowlist: new Set(['rug', 'rug-workflow']),
    block: 'BLOCK-BODY',
    entryBytes: 10,
  })

  await Effect.runPromise(Effect.withLogger(collectLogger(logs))(effect))
  return logs
}

const register = async (h: Harness): Promise<void> => {
  const effect = Effect.scoped(plugin.effect(h.context))

  await Effect.runPromise(Effect.withLogger(collectLogger(h.logs))(effect))
}

describe('workflow (v2)', () => {
  beforeEach(() => {
    entryClient.writeEntry.mockReset().mockResolvedValue({ status: 'written' })
    entryClient.removeEntry.mockReset().mockResolvedValue({ status: 'absent' })
  })

  it('registers the standalone trio with JSON-Schema inputs (workflow retired)', async () => {
    const h = makeHarness()

    await register(h)
    expect(h.tools).toHaveLength(3)
    expect(h.tools[0].name).toBe('subtask_ls')
    expect(h.tools[1].name).toBe('subtask_run')
    expect(h.tools[2].name).toBe('subtask_tail')
    expect(typeof h.tools[1].execute).toBe('function')

    const names = h.tools.map(tool => tool.name)

    expect(names).not.toContain('workflow')
  })
})

describe('workflow instruction session events', () => {
  beforeEach(() => {
    entryClient.writeEntry.mockReset().mockResolvedValue({ status: 'written' })
    entryClient.removeEntry.mockReset().mockResolvedValue({ status: 'absent' })
  })

  it('writes the entry when a session.created payload names a listed agent', async () => {
    await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_created', agent: 'rug-workflow' } })

    expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_created', 'workflow.instructions', 'BLOCK-BODY')
  })

  it('removes the entry for an unlisted agent', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'removed' })

    await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_unlisted', agent: 'build' } })

    expect(entryClient.removeEntry).toHaveBeenCalledWith('ses_unlisted', 'workflow.instructions')
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('logs the removed status when the entry was present', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'removed' })

    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_removed', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_removed', status: 'removed' }),
    ])
  })

  it('logs the absent status without an error when there is no entry to remove', async () => {
    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_absent', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_absent', status: 'absent' }),
    ])
    expect(logs).not.toContainEqual(['workflow.instructions.error', expect.anything()])
  })

  it('logs one skip line when the payload carries no agent', async () => {
    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_no_agent' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_no_agent', agent: 'unknown' }),
    ])
  })

  it('writes the entry when session.agent.selected names a listed agent', async () => {
    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_selected', agent: 'rug' } })

    expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_selected', 'workflow.instructions', 'BLOCK-BODY')
    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_selected', status: 'written' }),
    ])
  })

  it('logs the unchanged status when the entry value is already current', async () => {
    entryClient.writeEntry.mockResolvedValue({ status: 'unchanged' })

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_unchanged', agent: 'rug-workflow' } })

    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_unchanged', status: 'unchanged' }),
    ])
  })

  it('skips the write when the entry would exceed the size limit', async () => {
    const logs = await emitSessionEvent(
      { type: 'session.created', data: { sessionID: 'ses_big', agent: 'rug-workflow' } },
      { agentAllowlist: new Set(['rug', 'rug-workflow']), block: 'BLOCK-BODY', entryBytes: 300_000 },
    )

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_big', reason: 'entry-too-large' }),
    ])
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('writes an entry that is exactly at the size limit and skips the next byte', async () => {
    const options = { agentAllowlist: new Set(['rug', 'rug-workflow']), block: 'BLOCK-BODY', entryBytes: 256 * 1024 }

    await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_at_limit', agent: 'rug-workflow' } }, options)
    expect(entryClient.writeEntry).toHaveBeenCalledTimes(1)

    entryClient.writeEntry.mockClear()

    await emitSessionEvent(
      { type: 'session.created', data: { sessionID: 'ses_over_limit', agent: 'rug-workflow' } },
      { ...options, entryBytes: 256 * 1024 + 1 },
    )
    expect(entryClient.writeEntry).not.toHaveBeenCalled()
  })

  it('writes the entry once per subscribed event and ignores other event types', async () => {
    const h = makeHarness([
      { type: 'session.created', data: { sessionID: 'ses_stream_created', agent: 'rug-workflow' } },
      { type: 'session.agent.selected', data: { sessionID: 'ses_stream_selected', agent: 'rug' } },
      { type: 'session.idle', data: { sessionID: 'ses_stream_idle', agent: 'rug-workflow' } },
    ])

    const log = collectLogger(h.logs)
    const subscribed = Effect.scoped(Effect.flatMap(plugin.effect(h.context), () => Effect.never))

    const fiber = Effect.runFork(Effect.withLogger(log)(subscribed))

    try {
      await vi.waitFor(() => {
        expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_stream_created', 'workflow.instructions', expect.stringContaining(WORKFLOW_INSTRUCTIONS_SENTINEL))
        expect(entryClient.writeEntry).toHaveBeenCalledWith('ses_stream_selected', 'workflow.instructions', expect.stringContaining(WORKFLOW_INSTRUCTIONS_SENTINEL))
      })
    }
    finally {
      await Effect.runPromise(Fiber.interrupt(fiber))
    }

    expect(entryClient.writeEntry).toHaveBeenCalledTimes(2)
    expect(entryClient.writeEntry).not.toHaveBeenCalledWith('ses_stream_idle', expect.anything(), expect.anything())
  })

  it('reports a failed write status as an error', async () => {
    entryClient.writeEntry.mockResolvedValue({ status: 'failed', error: 'put failed' })

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_put_error', agent: 'rug-workflow' } })

    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_put_error', status: 'failed' }),
    ])
    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: expect.stringContaining('put failed') }),
    ])
  })

  it('reports a failed removal status as an error', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'failed', error: 'remove failed' })

    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_remove_error', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.skipped',
      expect.objectContaining({ sessionID: 'ses_remove_error', status: 'failed' }),
    ])
    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: expect.stringContaining('remove failed') }),
    ])
  })

  it('reports a rejected write as an error instead of swallowing it', async () => {
    entryClient.writeEntry.mockRejectedValue(new Error('write exploded'))

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_write_reject', agent: 'rug-workflow' } })

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: expect.stringContaining('write exploded') }),
    ])
  })

  it('logs an error when the handler throws', async () => {
    const agentAllowlist = {
      has: () => {
        throw new Error('allowlist exploded')
      },
    } as unknown as ReadonlySet<string>

    const logs = await emitSessionEvent(
      { type: 'session.created', data: { sessionID: 'ses_throw', agent: 'rug-workflow' } },
      { agentAllowlist, block: 'BLOCK-BODY', entryBytes: 10 },
    )

    expect(logs).toContainEqual(['workflow.instructions.error', expect.objectContaining({ message: 'allowlist exploded' })])
  })

  it('subscribes to session.created and session.agent.selected', async () => {
    const h = makeHarness()

    await register(h)

    expect(h.subscriptions).toBe(2)
    expect(isWorkflowSessionEvent({ type: 'session.created' }, 'session.created')).toBe(true)
    expect(isWorkflowSessionEvent({ type: 'session.agent.selected' }, 'session.agent.selected')).toBe(true)
    expect(isWorkflowSessionEvent({ type: 'session.idle' }, 'session.created')).toBe(false)
  })
})

describe('workflow instructions registration log', () => {
  it('logs the loaded instruction source and content size once at registration', async () => {
    const h = makeHarness()

    await register(h)

    const loaded = h.logs.filter(entry => entry[0] === 'workflow.instructions.loaded')

    expect(loaded).toHaveLength(1)

    const details = loaded[0][1] as { path: string, resolvedPath: string, contentBytes: number, agents: string[] }

    expect(details.resolvedPath).toBe(path.resolve('/workspace', details.path))
    expect(details.contentBytes).toBe(Buffer.byteLength(readFileSync(details.resolvedPath, 'utf8'), 'utf8'))
    expect(details.agents).toEqual(['rug', 'rug-workflow'])
  })
})

describe('workflow instruction config validation', () => {
  beforeEach(() => {
    harness.reset()
  })

  it('rejects a whitespace-only instructions path', () => {
    harness.set({ instructions: ' '.repeat(3) })

    expect(() => loadWorkflowInstructions('/workspace')).toThrow(/plugins\["workflow"\]\.instructions: missing or not a non-empty string/)
  })

  it('names the instructions config key when the path is empty', () => {
    harness.set({ instructions: '' })

    expect(() => loadWorkflowInstructions('/workspace')).toThrow(/plugins\["workflow"\]\.instructions/)
  })

  it('treats a path reading "Stryker was here!" as an ordinary path', () => {
    harness.set({ instructions: 'Stryker was here!' })

    expect(() => loadWorkflowInstructions('/workspace')).toThrow(/cannot read/)
  })

  it('rejects a non-string project directory', () => {
    expect(() => loadWorkflowInstructions(42 as unknown as string)).toThrow(/project directory is missing/)
  })

  it('rejects an instructions file that is only whitespace', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'workflow-instructions-'))
    const file = path.join(directory, 'empty.md')

    writeFileSync(file, '  \n')
    harness.set({ instructions: file })

    try {
      expect(() => loadWorkflowInstructions('/workspace')).toThrow(/file is empty or whitespace/)
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('fails registration when the instructions file cannot be read', async () => {
    harness.set({ instructions: '/nonexistent/workflow-instructions.md' })

    await expect(register(makeHarness())).rejects.toThrow(/cannot read/)
  })

  it('rejects a whitespace-only agent entry at registration', async () => {
    harness.set({ agents: ['rug', '  '] })

    await expect(register(makeHarness())).rejects.toThrow(/not a non-empty string array/)
  })
})

describe('workflow client adapter (v2 -> v1 shape)', () => {
  it('maps prompt to admit + wait + context and returns the assistant text parts', async () => {
    const calls: string[] = []
    const session = {
      switchAgent: () => {
        calls.push('switch')
        return Effect.succeed(undefined)
      },
      prompt: (input: { text: string }) => {
        calls.push('prompt:' + input.text)
        return Effect.succeed({})
      },
      wait: () => {
        calls.push('wait')
        return Effect.succeed(undefined)
      },
      context: () => {
        calls.push('context')
        return Effect.succeed([{ type: 'assistant', content: [{ type: 'text', text: 'ANSWER' }] }])
      },
    }
    const client = createWorkflowClient(session as never)
    const response = await client.session.prompt({ path: { id: 'ses_1' }, body: { agent: 'build', parts: [{ type: 'text', text: 'Q' }] } })

    expect(calls).toEqual(['switch', 'prompt:Q', 'wait', 'context'])
    expect(response.data?.parts).toEqual([{ type: 'text', text: 'ANSWER' }])
  })

  it('sets the child agent before prompting', async () => {
    const calls: string[] = []
    const session = {
      switchAgent: (input: { agent: string }) => {
        calls.push('switch:' + input.agent)
        return Effect.succeed(undefined)
      },
      prompt: () => Effect.succeed({}),
      wait: () => Effect.succeed(undefined),
      context: () => Effect.succeed([]),
    }
    const client = createWorkflowClient(session as never)

    await client.session.prompt({ path: { id: 'ses_1' }, body: { agent: 'general', parts: [{ type: 'text', text: 'Q' }] } })
    expect(calls).toEqual(['switch:general'])
  })

  it('applies the inherited parent model through switchModel before prompting', async () => {
    const calls: string[] = []
    const session = {
      switchAgent: () => Effect.succeed(undefined),
      switchModel: (input: { model: { id: string, providerID: string } }) => {
        calls.push('switchModel:' + input.model.providerID + '/' + input.model.id)
        return Effect.succeed(undefined)
      },
      prompt: () => Effect.succeed({}),
      wait: () => Effect.succeed(undefined),
      context: () => Effect.succeed([]),
    }
    const client = createWorkflowClient(session as never)

    await client.session.prompt({
      path: { id: 'ses_1' },
      body: { agent: 'build', model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' }, parts: [{ type: 'text', text: 'Q' }] },
    })
    expect(calls).toEqual(['switchModel:opencode-go/deepseek-v4.1-flash'])
  })

  it('maps v2 session messages to the v1 info shape for model inheritance', async () => {
    const session = {
      context: () => Effect.succeed([
        { type: 'user', text: 'hi' },
        { type: 'assistant', model: { id: 'deepseek-v4.1-flash', providerID: 'opencode-go' }, content: [] },
      ]),
    }
    const client = createWorkflowClient(session as never)
    const messages = client.session.messages
    if (messages === undefined) throw new Error('adapter must expose session.messages')
    const response = await messages({ path: { id: 'ses_1' } })

    expect(response.data).toEqual([
      { info: { role: 'user', providerID: undefined, modelID: undefined } },
      { info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } },
    ])
  })
})
