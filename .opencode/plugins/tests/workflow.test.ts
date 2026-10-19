import { Effect } from 'effect'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'

vi.mock('@plugins/helpers/workflow-runner', async (importOriginal) => {
  const actual = (await importOriginal()) as unknown as Record<string, unknown>
  return { ...actual, runWorkflow: vi.fn() }
})

import { runWorkflow } from '@plugins/helpers/workflow-runner'

import { createWorkflowClient } from '@plugins/helpers/workflow-client-adapter'

import plugin from '@plugins/workflow'

interface Harness {
  context: Context
  tools: Array<Record<string, unknown>>
  execute: (input: unknown) => Promise<Record<string, unknown>>
}

const makeHarness = (): Harness => {
  const tools: Array<Record<string, unknown>> = []
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
    execute: async (input) => {
      const tool = tools[0]
      const executeFunction = tool.execute as (value: unknown, context_: unknown) => Effect.Effect<unknown>
      const result = await Effect.runPromise(executeFunction(input, { sessionID: 'ses_parent', agent: 'build', messageID: 'msg_1', id: 'call_1', progress: () => Effect.void }))
      return result as unknown as Record<string, unknown>
    },
  }
}

const register = async (h: Harness): Promise<void> => {
  await Effect.runPromise(Effect.scoped(plugin.effect(h.context)))
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
