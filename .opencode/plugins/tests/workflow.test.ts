import { Effect, Exit, Fiber, Logger, Stream } from 'effect'

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

const harness = vi.hoisted(() => {
  const defaults = {
    instructions: '.agents/skills/task-delegation/SKILL.md',
    agents: ['rug', 'rug-swe'],
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
}))

const subtaskFactory = vi.hoisted(() => ({ createSubtask: vi.fn() }))

vi.mock('@plugins/helpers/workflow-subtask', () => ({ createSubtask: subtaskFactory.createSubtask }))

vi.mock('@plugins/helpers/subtask-ls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/helpers/subtask-ls')>()
  return { ...actual, listSubtasksFromSessions: vi.fn(actual.listSubtasksFromSessions) }
})

import { createWorkflowClient } from '@plugins/helpers/workflow-client-adapter'

import { listSubtasksFromSessions } from '@plugins/helpers/subtask-ls'

import { recordTailOutput } from '@plugins/helpers/subtask-tail'

import plugin, { handleSessionEvent, isWorkflowSessionEvent, loadWorkflowInstructions, WORKFLOW_INSTRUCTIONS_SENTINEL } from '@plugins/workflow'

import type { WorkflowSessionHandlerOptions } from '@plugins/workflow'

import { REPO_ROOT } from '@tests/helpers/repo-root'

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

const makeHarness = (events: SessionEventPayload[] = [], session: Record<string, unknown> = {}): Harness => {
  const tools: Array<Record<string, unknown>> = []
  const logs: Array<ReadonlyArray<unknown>> = []
  let subscriptions = 0
  const context = {
    options: {},
    location: { directory: REPO_ROOT },
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
      ...session,
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
    agentAllowlist: new Set(['rug', 'rug-swe']),
    block: 'BLOCK-BODY',
  })

  await Effect.runPromise(Effect.withLogger(collectLogger(logs))(effect))
  return logs
}

const register = async (h: Harness): Promise<void> => {
  const effect = Effect.scoped(plugin.effect(h.context))

  await Effect.runPromise(Effect.withLogger(collectLogger(h.logs))(effect))
}

const executeTool = async <T>(tool: Record<string, unknown>, input: unknown, sessionID = 'ses_parent'): Promise<T> => {
  const execute = tool.execute as (toolInput: unknown, toolContext: { sessionID: string }) => Effect.Effect<T>

  return await Effect.runPromise(execute(input, { sessionID }))
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

  it('accepts only task_id on subtask_tail', async () => {
    const h = makeHarness()

    await register(h)

    const input = h.tools[2].input as { properties: Record<string, unknown>, additionalProperties: boolean }

    expect(Object.keys(input.properties)).toEqual(['task_id', 'count'])
    expect(input.additionalProperties).toBe(false)
  })

  it('offers only ok and error as subtask_ls status filters', async () => {
    const h = makeHarness()

    await register(h)

    const input = h.tools[0].input as { properties: { status: { enum: string[] } } }

    expect(input.properties.status.enum).toEqual(['ok', 'error'])
  })

  it('propagates a throwing registration instead of swallowing it', async () => {
    const h = makeHarness()
    const tool = h.context.tool as unknown as {
      transform: (callback: (editor: unknown) => void) => Effect.Effect<unknown>
    }

    tool.transform = (callback) => {
      callback({
        add: () => {
          throw new Error('add exploded')
        },
      })
      return Effect.succeed({ dispose: Effect.void })
    }

    const exit = await Effect.runPromiseExit(Effect.scoped(plugin.effect(h.context)))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(h.tools).toHaveLength(0)
  })
})

describe('workflow tool handlers', () => {
  beforeEach(() => {
    subtaskFactory.createSubtask.mockReset()
  })

  it('returns the entries the sessions reader supplied for subtask_ls', async () => {
    const list = vi.fn(() => [
      { id: 'ses_child_1', title: '[ok] first task', time: { created: 1000, updated: 1500 }, outcome: 'succeeded' },
      { id: 'ses_child_2', title: 'second task', time: { created: 2000, updated: 2400 }, outcome: 'failed' },
    ])
    const h = makeHarness([], { list })

    await register(h)

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[0], { count: 10 })

    expect(list).toHaveBeenCalledWith({ parentID: 'ses_parent' })
    expect(listSubtasksFromSessions).toHaveBeenCalledWith(expect.anything(), 'ses_parent', { count: 10, status: undefined })
    expect(JSON.parse(result.content)).toEqual([
      { description: 'first task', durationMs: 500, task_id: 'ses_child_1', status: 'ok' },
      { description: 'second task', durationMs: 400, task_id: 'ses_child_2', status: 'error' },
    ])
    expect(result.metadata.title).toBe('subtask_ls: 2 subtask(s)')

    const filtered = await executeTool<{ content: string }>(h.tools[0], { count: 1, status: 'ok' })

    expect(listSubtasksFromSessions).toHaveBeenLastCalledWith(expect.anything(), 'ses_parent', { count: 1, status: 'ok' })
    expect(JSON.parse(filtered.content)).toEqual([
      { description: 'first task', durationMs: 500, task_id: 'ses_child_1', status: 'ok' },
    ])
  })

  it('returns an empty list when the reader list call throws', async () => {
    const h = makeHarness([], {
      list: () => {
        throw new Error('list unavailable')
      },
    })

    await register(h)

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[0], {})

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_ls: 0 subtask(s)')
  })

  it('returns an empty array for a task id with no stored output', async () => {
    const h = makeHarness()

    await register(h)

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[2], { task_id: 'task_missing' })

    expect(JSON.parse(result.content)).toEqual([])
    expect(result.metadata.title).toBe('subtask_tail: 0 output(s)')
  })

  it('returns recorded outputs in the order they were recorded', async () => {
    const h = makeHarness()

    await register(h)
    recordTailOutput({ outputText: 'out-0', task_id: 'task_tail_order', status: 'ok', durationMs: 1 })
    recordTailOutput({ outputText: 'out-1', task_id: 'task_tail_order', status: 'error', durationMs: 2 })

    const result = await executeTool<{ content: string, metadata: { title: string } }>(h.tools[2], { task_id: 'task_tail_order', count: 3 })
    const entries = JSON.parse(result.content) as Array<{ outputText: string }>

    expect(entries.map(entry => entry.outputText)).toEqual(['out-0', 'out-1'])
    expect(result.metadata.title).toBe('subtask_tail: 2 output(s)')
  })

  it('passes count through to the tail helper', async () => {
    const h = makeHarness()

    await register(h)
    recordTailOutput({ outputText: 'out-0', task_id: 'task_tail_count', status: 'ok', durationMs: 1 })
    recordTailOutput({ outputText: 'out-1', task_id: 'task_tail_count', status: 'ok', durationMs: 2 })

    const result = await executeTool<{ content: string }>(h.tools[2], { task_id: 'task_tail_count', count: 1 })
    const entries = JSON.parse(result.content) as Array<{ outputText: string }>

    expect(entries.map(entry => entry.outputText)).toEqual(['out-1'])
  })

  it('passes the documented context and parsed parameters to createSubtask', async () => {
    const subtask = vi.fn(async () => ({ outputText: 'DONE', task_id: 'task_run_1', status: 'ok' as const, durationMs: 12 }))

    subtaskFactory.createSubtask.mockReturnValue(subtask)

    const h = makeHarness()

    await register(h)

    const result = await executeTool<{ metadata: Record<string, unknown> }>(
      h.tools[1],
      { prompt: 'do it', description: 'one thing', agent: 'rug', skills: ['test-design'], timeout_minutes: 5 },
    )
    const [context] = subtaskFactory.createSubtask.mock.calls[0] as [Record<string, unknown>]

    expect(subtaskFactory.createSubtask).toHaveBeenCalledTimes(1)
    expect(context.parentSessionID).toBe('ses_parent')
    expect(context.directory).toBe(REPO_ROOT)
    expect(context.defaultAgent).toBe('rug-swe')
    expect(context.maxSubtasks).toBe(32)
    expect(context.budget).toEqual({ used: 0 })
    expect(context.steps).toEqual([])
    expect(context.logs).toEqual([])
    expect(context.active).toBeInstanceOf(Set)
    expect(context.signal).toBeInstanceOf(AbortSignal)
    expect(subtask).toHaveBeenCalledWith({ prompt: 'do it', description: 'one thing', agent: 'rug', skills: ['test-design'], timeout_minutes: 5 })
    expect(result.metadata).toEqual({ title: 'subtask_run: ok', status: 'ok', task_id: 'task_run_1' })
  })
})

describe('workflow instruction session events', () => {
  beforeEach(() => {
    entryClient.writeEntry.mockReset().mockResolvedValue({ status: 'written' })
    entryClient.removeEntry.mockReset().mockResolvedValue({ status: 'absent' })
  })

  it('writes the entry when a session.created payload names a listed agent', async () => {
    await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_created', agent: 'rug-swe' } })

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

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_unchanged', agent: 'rug-swe' } })

    expect(logs).toContainEqual([
      'workflow.instructions',
      expect.objectContaining({ sessionID: 'ses_unchanged', status: 'unchanged' }),
    ])
  })

  it('writes the entry once per subscribed event and ignores other event types', async () => {
    const h = makeHarness([
      { type: 'session.created', data: { sessionID: 'ses_stream_created', agent: 'rug-swe' } },
      { type: 'session.agent.selected', data: { sessionID: 'ses_stream_selected', agent: 'rug' } },
      { type: 'session.idle', data: { sessionID: 'ses_stream_idle', agent: 'rug-swe' } },
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

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_put_error', agent: 'rug-swe' } })

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

  it('names the remove action when the removal fails', async () => {
    entryClient.removeEntry.mockResolvedValue({ status: 'failed', reason: 'entry missing' })

    const logs = await emitSessionEvent({ type: 'session.agent.selected', data: { sessionID: 'ses_action_remove', agent: 'build' } })

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: 'workflow instructions: remove failed: entry missing' }),
    ])
  })

  it('names the write action when the write fails', async () => {
    entryClient.writeEntry.mockResolvedValue({ status: 'failed', reason: 'entry refused' })

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_action_write', agent: 'rug-swe' } })

    expect(logs).toContainEqual([
      'workflow.instructions.error',
      expect.objectContaining({ message: 'workflow instructions: write failed: entry refused' }),
    ])
  })

  it('reports a rejected write as an error instead of swallowing it', async () => {
    entryClient.writeEntry.mockRejectedValue(new Error('write exploded'))

    const logs = await emitSessionEvent({ type: 'session.created', data: { sessionID: 'ses_write_reject', agent: 'rug-swe' } })

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
      { type: 'session.created', data: { sessionID: 'ses_throw', agent: 'rug-swe' } },
      { agentAllowlist, block: 'BLOCK-BODY' },
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

    expect(details.resolvedPath).toBe(path.resolve(REPO_ROOT, details.path))
    expect(details.contentBytes).toBe(Buffer.byteLength(readFileSync(details.resolvedPath, 'utf8'), 'utf8'))
    expect(details.agents).toEqual(['rug', 'rug-swe'])
  })
})

describe('workflow instruction config validation', () => {
  beforeEach(() => {
    harness.reset()
  })

  it('treats a path reading "Stryker was here!" as an ordinary path', () => {
    harness.set({ instructions: 'Stryker was here!' })

    expect(() => loadWorkflowInstructions(REPO_ROOT)).toThrow(/cannot read/)
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
      expect(() => loadWorkflowInstructions(REPO_ROOT)).toThrow(/file is empty or whitespace/)
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('names the configured path and directory when the directory is unusable', () => {
    harness.set({ instructions: 'custom/instructions.md' })

    expect(() => loadWorkflowInstructions(7 as unknown as string)).toThrow(
      'cannot resolve custom/instructions.md against 7: project directory is missing',
    )
  })

  it('converts a non-Error configuration failure into an Error at registration', async () => {
    Object.defineProperty(harness.config.plugins, 'workflow', {
      configurable: true,
      get() {
        const failure: unknown = 'config exploded'
        throw failure as Error
      },
    })

    try {
      let failure: unknown
      try {
        await register(makeHarness())
      }
      catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toBe('config exploded')
    }
    finally {
      delete (harness.config.plugins as { workflow?: unknown }).workflow
      harness.reset()
    }
  })

  it('fails registration when the instructions file cannot be read', async () => {
    harness.set({ instructions: '/nonexistent/workflow-instructions.md' })

    await expect(register(makeHarness())).rejects.toThrow(/cannot read/)
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
