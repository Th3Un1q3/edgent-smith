import { Effect, Logger, LogLevel, References } from 'effect'

import { readFileSync } from 'node:fs'

import path from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

vi.mock('@plugins/helpers/workflow-runner', async (importOriginal) => {
  const actual = (await importOriginal()) as unknown as Record<string, unknown>
  return { ...actual, runWorkflow: vi.fn() }
})

import { runWorkflow } from '@plugins/helpers/workflow-runner'

import { createWorkflowClient } from '@plugins/helpers/workflow-client-adapter'

import plugin, { WORKFLOW_INSTRUCTIONS_SENTINEL } from '@plugins/workflow'

type ContextEvent = { tools: Record<string, unknown>, system: Array<{ type: string, text: string }> }

interface Harness {
  context: Context
  tools: Array<Record<string, unknown>>
  logs: Array<ReadonlyArray<unknown>>
  contextHook: (event: ContextEvent) => Effect.Effect<void>
  execute: (input: unknown) => Promise<Record<string, unknown>>
}

const collectLogger = (logs: Harness['logs']): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message : [message])
  })

const makeHarness = (): Harness => {
  const tools: Array<Record<string, unknown>> = []
  const logs: Array<ReadonlyArray<unknown>> = []
  let contextHook: Harness['contextHook'] | undefined
  const context = {
    options: {},
    location: { directory: '/workspace' },
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
      hook: (name: string, callback: Harness['contextHook']) => {
        if (name === 'context') contextHook = callback
        return Effect.succeed({ dispose: Effect.void })
      },
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
    contextHook: (event) => {
      if (contextHook === undefined) throw new Error('context hook was not registered')
      return contextHook(event)
    },
    execute: async (input) => {
      const tool = tools[0]
      const executeFunction = tool.execute as (value: unknown, context_: unknown) => Effect.Effect<unknown>
      const result = await Effect.runPromise(executeFunction(input, { sessionID: 'ses_parent', agent: 'build', messageID: 'msg_1', id: 'call_1', progress: () => Effect.void }))
      return result as unknown as Record<string, unknown>
    },
  }
}

const register = async (h: Harness): Promise<void> => {
  const effect = Effect.scoped(plugin.effect(h.context))

  await Effect.runPromise(Effect.withLogger(collectLogger(h.logs))(effect))
}

describe('workflow (v2)', () => {
  beforeEach(() => {
    vi.mocked(runWorkflow).mockReset()
  })

  it('registers a workflow tool with a JSON-Schema input', async () => {
    const h = makeHarness()

    await register(h)
    expect(h.tools).toHaveLength(1)
    expect(h.tools[0].name).toBe('workflow')
    expect(typeof h.tools[0].execute).toBe('function')

    const input = h.tools[0].input as { type: string, required?: string[] }

    expect(input.type).toBe('object')
    expect(input.required).toContain('script')
  })

  it('executes the script and returns the workflow envelope', async () => {
    const h = makeHarness()

    vi.mocked(runWorkflow).mockResolvedValue(JSON.stringify({ status: 'ok', stats: { subtasks: 2, ok: 2, totalMs: 1234 } }))
    await register(h)

    const result = await h.execute({ script: 'return 1', timeout_minutes: 5, max_concurrent: 2, max_subtasks: 10 })

    expect(runWorkflow).toHaveBeenCalledTimes(1)

    const call = vi.mocked(runWorkflow).mock.calls[0][0] as unknown as Record<string, unknown>

    expect(call.script).toBe('return 1')
    expect(call.parentSessionID).toBe('ses_parent')
    expect(call.timeoutMs).toBe(5 * 60_000)
    expect(call.maxConcurrent).toBe(2)
    expect(call.maxSubtasks).toBe(10)
    expect(result.content).toContain('"status":"ok"')
    expect((result.metadata as { title: string }).title).toContain('workflow: ok · 2/2')
  })

  it('applies defaults when optional parameters are omitted', async () => {
    const h = makeHarness()

    vi.mocked(runWorkflow).mockResolvedValue('{"status":"ok","stats":{"subtasks":0,"ok":0,"totalMs":0}}')
    await register(h)
    await h.execute({ script: 'return 1' })

    const call = vi.mocked(runWorkflow).mock.calls[0][0] as unknown as Record<string, unknown>

    expect(call.timeoutMs).toBe(90 * 60_000)
    expect(call.maxConcurrent).toBeUndefined()
    expect(call.maxSubtasks).toBeUndefined()
  })
})

describe('workflow instructions log lines', () => {
  const runContextHook = async (h: Harness, event: ContextEvent, minimumLogLevel: LogLevel.LogLevel = 'Debug'): Promise<void> => {
    const effect = Effect.provideService(h.contextHook(event), References.MinimumLogLevel, minimumLogLevel)

    await Effect.runPromise(Effect.withLogger(collectLogger(h.logs))(effect))
  }

  it('logs the loaded instruction source and content size once at registration', async () => {
    const h = makeHarness()

    await register(h)

    const loaded = h.logs.filter(entry => entry[0] === 'workflow.instructions.loaded')

    expect(loaded).toHaveLength(1)

    const details = loaded[0][1] as { path: string, resolvedPath: string, contentBytes: number }

    expect(details.resolvedPath).toBe(path.resolve('/workspace', details.path))
    expect(details.contentBytes).toBe(Buffer.byteLength(readFileSync(details.resolvedPath, 'utf8'), 'utf8'))
  })

  it('logs the context event shape then a debug skip and leaves the context untouched when the workflow tool is absent', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    const system = [{ type: 'text', text: 'base' }]

    await runContextHook(h, { tools: { read: {}, grep: {} }, system })

    expect(system).toEqual([{ type: 'text', text: 'base' }])
    expect(h.logs).toEqual([
      ['workflow.instructions.context', { received: true, eventKeys: ['tools', 'system'], toolsIsObject: true, tools: ['read', 'grep'] }],
      ['workflow.instructions.skipped', { tools: ['read', 'grep'] }],
    ])
  })

  it('keeps the per-request context line below the production info level while still logging the injection', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    await runContextHook(h, { tools: { workflow: {} }, system: [] }, 'Info')

    expect(h.logs.map(entry => entry[0])).toEqual(['workflow.instructions.injected'])
  })

  it('keeps the skip line below the production info level', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    await runContextHook(h, { tools: { read: {} }, system: [] }, 'Info')

    expect(h.logs).toEqual([])
  })

  it('logs an info injection with the block size, tool keys and no strip', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    const system: ContextEvent['system'] = []

    await runContextHook(h, { tools: { workflow: {}, read: {} }, system })

    expect(system).toHaveLength(1)
    expect(system[0].text.startsWith(WORKFLOW_INSTRUCTIONS_SENTINEL)).toBe(true)
    expect(h.logs).toHaveLength(2)
    expect(h.logs[0][0]).toBe('workflow.instructions.context')
    expect(h.logs[1][0]).toBe('workflow.instructions.injected')
    expect(h.logs[1][1]).toEqual({
      carrier: 'system',
      reason: 'entry-unavailable',
      blockBytes: Buffer.byteLength(system[0].text, 'utf8'),
      tools: ['workflow', 'read'],
      exposure: 'workflow',
      stripped: false,
    })
  })

  it('reports stripped true when a prior sentinel block is replaced', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    const system = [
      { type: 'text', text: `${WORKFLOW_INSTRUCTIONS_SENTINEL}\nold\n</workflow_instructions>` },
      { type: 'text', text: 'base' },
    ]

    await runContextHook(h, { tools: { workflow: {} }, system })

    expect(system.map(part => part.text.startsWith(WORKFLOW_INSTRUCTIONS_SENTINEL))).toEqual([false, true])
    expect((h.logs[1][1] as { stripped: boolean }).stripped).toBe(true)
  })

  it('logs received false and skips when the hook receives no event', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    await runContextHook(h, undefined as unknown as ContextEvent)

    expect(h.logs).toEqual([
      ['workflow.instructions.context', { received: false, eventKeys: [], toolsIsObject: false }],
      ['workflow.instructions.skipped', { tools: [] }],
    ])
  })

  const missingToolsEvents: Array<{ name: string, event: ContextEvent }> = [
    { name: 'an event without a tools field', event: { system: [] } as unknown as ContextEvent },
    { name: 'a non-object tools field', event: { tools: 'workflow', system: [] } as unknown as ContextEvent },
  ]

  it.each(missingToolsEvents)('logs the shape and skips with an empty tool list for $name', async ({ event }) => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    await runContextHook(h, event)

    expect(h.logs).toEqual([
      ['workflow.instructions.context', { received: true, eventKeys: Object.keys(event), toolsIsObject: false }],
      ['workflow.instructions.skipped', { tools: [] }],
    ])
  })

  it('logs an error instead of throwing when the event has no system array', async () => {
    const h = makeHarness()

    await register(h)
    h.logs.length = 0

    await runContextHook(h, { tools: { workflow: {} } } as unknown as ContextEvent)

    expect(h.logs[1]).toEqual(['workflow.instructions.error', { message: 'context event has no system array' }])
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
