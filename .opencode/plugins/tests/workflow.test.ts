import { describe, expect, it, vi } from 'vitest'

import { tool } from '@opencode-ai/plugin'

import type { PluginInput, ToolContext } from '@opencode-ai/plugin'

import type { WorkflowEnvelope, WorkflowSdkClient, WorkflowStats } from '@plugins/helpers/workflow-types'

import { workflowPlugin } from '@plugins/workflow'

type FakeClient = {
  client: WorkflowSdkClient
  create: ReturnType<typeof vi.fn>
  prompt: ReturnType<typeof vi.fn>
}

// The locked tool boundary returns a ToolResult object rather than a bare
// envelope string: { title, output, metadata: { status, stats } }.
interface WorkflowToolResult {
  title: string
  output: string
  metadata: { status: WorkflowEnvelope['status'], stats: WorkflowStats }
}

const createFakeClient = (
  promptImplementation?: () => Promise<unknown>,
): FakeClient => {
  const create = vi.fn().mockResolvedValue({ data: { id: 'ses_child' } })
  const prompt = vi.fn().mockImplementation(
    promptImplementation
    ?? (() => Promise.resolve({ data: { parts: [{ type: 'text', text: 'OUT' }] } })),
  )
  return { client: { session: { create, prompt } } as unknown as WorkflowSdkClient, create, prompt }
}

const createContext = (overrides: Partial<Omit<ToolContext, 'metadata'>> = {}) => ({
  sessionID: 'ses_parent',
  directory: '/workspace',
  agent: 'rug-debug',
  messageID: 'm',
  worktree: '/workspace',
  abort: new AbortController().signal,
  metadata: vi.fn(),
  ask: vi.fn(),
  ...overrides,
})

const loadWorkflowTool = async (fake: FakeClient, directory = '/workspace') => {
  const hooks = await workflowPlugin({ client: fake.client, directory } as unknown as PluginInput)
  const workflowTool = hooks.tool?.workflow
  if (workflowTool === undefined) {
    throw new Error('workflow tool was not registered')
  }
  return workflowTool
}

// The tool boundary now returns an object; the legacy plain-string return is
// still understood here so the RED run isolates the contract change instead of
// crashing the helper with an opaque `JSON.parse(undefined)`.
const envelopeFrom = (result: WorkflowToolResult | string): WorkflowEnvelope =>
  JSON.parse(typeof result === 'string' ? result : result.output) as WorkflowEnvelope

const runTool = async (
  arguments_: Record<string, unknown>,
  fake: FakeClient = createFakeClient(),
  context: ReturnType<typeof createContext> = createContext(),
): Promise<{ result: WorkflowToolResult | string, envelope: WorkflowEnvelope, fake: FakeClient }> => {
  const workflowTool = await loadWorkflowTool(fake)
  const result = await workflowTool.execute(
    arguments_ as never,
    context as never,
  ) as unknown as WorkflowToolResult | string
  return { result, envelope: envelopeFrom(result), fake }
}

describe('workflow plugin', () => {
  describe('execute envelope', () => {
    it('returns an ok envelope with the script result', async () => {
      const { envelope } = await runTool({ script: 'return {n:1}' })

      expect(envelope.status).toBe('ok')
      expect(envelope.result).toEqual({ n: 1 })
    })

    it('returns a ToolResult object wrapping the serialized envelope', async () => {
      const workflowTool = await loadWorkflowTool(createFakeClient())
      const result = await workflowTool.execute(
        { script: 'return { n: 1 }' } as never,
        createContext() as never,
      ) as unknown as WorkflowToolResult

      expect(typeof result).toBe('object')
      expect(typeof result.title).toBe('string')
      expect(result.title.length).toBeGreaterThan(0)

      const envelope = JSON.parse(result.output) as WorkflowEnvelope

      expect(envelope.status).toBe('ok')
      expect(envelope.result).toEqual({ n: 1 })
      expect(result.metadata).toMatchObject({ status: 'ok', stats: envelope.stats })
    })

    it('forwards parentSessionID and returns the child output', async () => {
      const { envelope, fake } = await runTool({
        script: 'const r = await subtask({prompt:\'hi\', description:\'hi\'}); return r.outputText',
      })

      expect(fake.create).toHaveBeenCalledWith({ body: { title: 'hi', parentID: 'ses_parent' } })
      expect(envelope.status).toBe('ok')
      expect(envelope.result).toBe('OUT')
    })

    it('uses rug-swe as the default child agent', async () => {
      const { fake } = await runTool({ script: 'await subtask(\'hi\'); return 1' })

      expect(fake.prompt).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.objectContaining({ agent: 'rug-swe' }) }),
      )
    })

    it('returns forbidden_script instead of throwing for forbidden code', async () => {
      const { envelope } = await runTool({ script: 'const x = require(\'fs\')' })

      expect(envelope.status).toBe('forbidden_script')
    })

    it('returns invalid_script instead of throwing for syntax errors', async () => {
      const { envelope } = await runTool({ script: 'const x = ;' })

      expect(envelope.status).toBe('invalid_script')
    })
  })

  describe('tool progress metadata', () => {
    it('reports subtask start and finish through context.metadata', async () => {
      const context = createContext()

      const { envelope } = await runTool(
        { script: 'await subtask({ prompt: "hi", description: "run work" }); return "done"' },
        createFakeClient(),
        context,
      )

      expect(envelope.status).toBe('ok')
      expect(context.metadata).toHaveBeenCalledTimes(2)

      const [start, finish] = context.metadata.mock.calls.map(([progress]) => progress) as Array<{
        title: string
        metadata?: Record<string, unknown>
      }>

      expect(start).toMatchObject({ title: 'run work', metadata: { event: 'start' } })
      expect(finish).toMatchObject({
        title: 'run work',
        metadata: { event: 'finish', status: 'ok', task_id: 'ses_child' },
      })
      expect(typeof finish.metadata?.durationMs).toBe('number')
    })
  })

  describe('forwarded limits', () => {
    it('enforces max_subtasks forwarded from args', async () => {
      const { envelope } = await runTool({
        script: 'await subtask(\'a\'); await subtask(\'b\'); return 1',
        max_subtasks: 1,
      })

      expect(envelope.status).toBe('budget_exceeded')
    })

    it('enforces timeout_seconds forwarded from args', async () => {
      const { envelope } = await runTool({
        script: 'await new Promise(() => undefined); return 1',
        timeout_seconds: 1,
      })

      expect(envelope.status).toBe('timeout')
    }, 10_000)

    it('bounds child concurrency using max_concurrent', async () => {
      let active = 0
      let peak = 0
      const fake = createFakeClient(async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => {
          setTimeout(resolve, 5)
        })
        active -= 1
        return { data: { parts: [{ type: 'text', text: 'OUT' }] } }
      })

      const { envelope } = await runTool({
        script: 'const rs = await Promise.all([subtask(\'a\'), subtask(\'b\')]); return rs.length',
        max_concurrent: 1,
      }, fake)

      expect(envelope.status).toBe('ok')
      expect(envelope.result).toBe(2)
      expect(peak).toBe(1)
    })
  })

  describe('args schema', () => {
    it('rejects out-of-range numeric options', async () => {
      const workflowTool = await loadWorkflowTool(createFakeClient())
      const schema = tool.schema.object(workflowTool.args)
      const invalidPatches = [
        { timeout_seconds: 0 },
        { timeout_seconds: 36_001 },
        { max_concurrent: 0 },
        { max_concurrent: 9 },
        { max_subtasks: 0 },
        { max_subtasks: 65 },
      ]

      for (const patch of invalidPatches) {
        expect(schema.safeParse({ script: 'return 1', ...patch }).success).toBe(false)
      }
    })

    it('applies the documented defaults', async () => {
      const workflowTool = await loadWorkflowTool(createFakeClient())
      const schema = tool.schema.object(workflowTool.args)
      const parsed = schema.parse({ script: 'return 1' })

      expect(parsed.timeout_seconds).toBe(600)
      expect(parsed.max_concurrent).toBe(4)
      expect(parsed.max_subtasks).toBe(32)
    })
  })

  describe('description', () => {
    it('documents the DSL and failure model', async () => {
      const workflowTool = await loadWorkflowTool(createFakeClient())
      const fragments = ['subtask', 'Promise.all', 'task_id', 'forbidden_script']

      for (const fragment of fragments) {
        expect(workflowTool.description).toContain(fragment)
      }
    })

    it('documents description as a required object field', async () => {
      const workflowTool = await loadWorkflowTool(createFakeClient())

      expect(workflowTool.description).not.toContain('description?')
      expect(workflowTool.description).toContain('{prompt, description, agent?')
    })

    it('documents description on each step record', async () => {
      const workflowTool = await loadWorkflowTool(createFakeClient())

      expect(workflowTool.description).toMatch(/Steps: \{label, description/)
    })
  })

  // Integration coverage for abort safety: `session.abort` can reject, but the
  // subtask must still record its aborted step and nothing must leak as an
  // unhandled rejection.
  describe('abort safety', () => {
    it('does not leak an unhandled rejection when the server-side abort rejects', async () => {
      const create = vi.fn().mockResolvedValue({ data: { id: 'ses_child' } })
      const prompt = vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
        new Promise((_resolve, reject) => {
          const onAbort = (): void => reject({ name: 'AbortError', message: 'aborted' })
          if (signal?.aborted === true) {
            onAbort()
          }
          else {
            signal?.addEventListener('abort', onAbort, { once: true })
          }
        }),
      )
      const abort = vi.fn(() => Promise.reject(new Error('abort failed')))
      const fake: FakeClient = {
        client: { session: { create, prompt, abort } } as unknown as WorkflowSdkClient,
        create,
        prompt,
      }
      const unhandled: unknown[] = []
      const onUnhandled = (reason: unknown): void => {
        unhandled.push(reason)
      }

      process.on('unhandledRejection', onUnhandled)

      try {
        const workflowTool = await loadWorkflowTool(fake)
        const result = await workflowTool.execute(
          { script: 'return await subtask("x")', timeout_seconds: 1 } as never,
          createContext() as never,
        ) as unknown as WorkflowToolResult | string

        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })

        const envelope = envelopeFrom(result)

        expect(envelope.status).toBe('timeout')
        expect(abort).toHaveBeenCalled()
        expect(envelope.steps[0]).toMatchObject({ status: 'aborted' })
        expect(unhandled).toEqual([])
      }
      finally {
        process.off('unhandledRejection', onUnhandled)
      }
    }, 10_000)

    it('returns an aborted envelope when the tool context is already aborted', async () => {
      const controller = new AbortController()

      controller.abort()

      const { result, envelope } = await runTool(
        { script: 'return "never"' },
        createFakeClient(),
        createContext({ abort: controller.signal }),
      )

      expect(envelope.status).toBe('aborted')
      expect(envelope.error?.toLowerCase()).toContain('abort')
      expect((result as WorkflowToolResult).metadata.status).toBe('aborted')
    })
  })
})
