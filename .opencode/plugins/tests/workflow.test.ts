import { describe, expect, it, vi } from 'vitest'

import { tool } from '@opencode-ai/plugin'

import type { PluginInput, ToolContext } from '@opencode-ai/plugin'

import type { SubtaskStatus, WorkflowEnvelope, WorkflowSdkClient, WorkflowStats } from '@plugins/helpers/workflow-types'

import { readNumber, toToolResult, workflowPlugin } from '@plugins/workflow'

type FakeClient = {
  client: WorkflowSdkClient
  create: ReturnType<typeof vi.fn>
  prompt: ReturnType<typeof vi.fn>
  showToast: ReturnType<typeof vi.fn>
  sessionUpdate: ReturnType<typeof vi.fn>
}

// The locked tool boundary returns a ToolResult object rather than a bare
// envelope string: { title, output, metadata: { status, stats, subtasks } }.
interface WorkflowToolResult {
  title: string
  output: string
  metadata: {
    status: WorkflowEnvelope['status']
    stats: WorkflowStats
    subtasks: Array<{ description: string, status: SubtaskStatus, durationMs: number }>
  }
}

const createFakeClient = (
  promptImplementation?: () => Promise<unknown>,
): FakeClient => {
  const create = vi.fn().mockResolvedValue({ data: { id: 'ses_child' } })
  const prompt = vi.fn().mockImplementation(
    promptImplementation
    ?? (() => Promise.resolve({ data: { parts: [{ type: 'text', text: 'OUT' }] } })),
  )
  const showToast = vi.fn().mockResolvedValue({ data: true })
  const sessionUpdate = vi.fn().mockResolvedValue({ data: {} })
  const client = {
    session: { create, prompt, update: sessionUpdate },
    tui: { showToast },
  } as unknown as WorkflowSdkClient
  return { client, create, prompt, showToast, sessionUpdate }
}

const createContext = (overrides: Partial<ToolContext> = {}) => ({
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

    it('reports the executed steps in result.metadata.subtasks', async () => {
      const { result } = await runTool({
        script: 'await subtask({ prompt: "a", description: "first" }); '
          + 'await subtask({ prompt: "b", description: "second" }); return "done"',
      })

      const toolResult = result as WorkflowToolResult

      expect(toolResult.metadata).toMatchObject({
        status: 'ok',
        subtasks: [
          { description: 'first', status: 'ok' },
          { description: 'second', status: 'ok' },
        ],
      })
      for (const entry of toolResult.metadata.subtasks) {
        expect(typeof entry.durationMs).toBe('number')
      }
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

  describe('tool notifications', () => {
    interface ToastSummary {
      title?: string
      message: string
      variant: string
    }

    const toastSummaries = (fake: FakeClient): ToastSummary[] =>
      fake.showToast.mock.calls.map(([argument]) => {
        const body = (argument as { body: ToastSummary }).body
        return { title: body.title, message: body.message, variant: body.variant }
      })

    const sessionTitles = (fake: FakeClient): string[] =>
      fake.sessionUpdate.mock.calls.map(
        ([argument]) => (argument as { body: { title: string } }).body.title,
      )

    const RUN_ID_PATTERN = /wf#[0-9a-f]{6}/

    // Derive the dynamic run id from a toast that carries it, so assertions
    // compare against the same id the runner generated rather than a literal.
    const runIdOf = (summary: ToastSummary): string => {
      const match = RUN_ID_PATTERN.exec(summary.message)
      if (match === null) {
        throw new Error(`toast does not carry a run id: ${summary.message}`)
      }
      return match[0]
    }

    // The old `context.metadata` progress channel is a proven dead end: the
    // visible signal now rides TUI toasts plus the child-session title.
    it('reports progress through toasts and the child session title, not context.metadata', async () => {
      const context = createContext()
      const fake = createFakeClient()

      const { envelope } = await runTool(
        { script: 'await subtask({ prompt: "hi", description: "run work" }); return "done"' },
        fake,
        context,
      )

      expect(envelope.status).toBe('ok')

      const metadataMock = context.metadata as unknown as ReturnType<typeof vi.fn>

      expect(metadataMock).not.toHaveBeenCalled()

      const summaries = toastSummaries(fake)

      expect(summaries[0]).toMatchObject({ title: 'workflow', variant: 'info' })
      expect(summaries[0].message).toMatch(/^started · wf#[0-9a-f]{6}$/)

      const runId = runIdOf(summaries[0])

      expect(summaries.at(-1)?.variant).toBe('success')
      expect(summaries.at(-1)?.message).toMatch(
        new RegExp(String.raw`^workflow ok · 1\/1 subtasks · ${runId} · \d+\.\d+s$`),
      )

      expect(sessionTitles(fake)).toEqual([
        `${runId} · [running] run work`,
        `${runId} · [ok] run work`,
      ])
    })

    it('surfaces progress even when context.metadata is unavailable', async () => {
      const context = createContext({ metadata: undefined })
      const fake = createFakeClient()

      const { envelope } = await runTool(
        { script: 'await subtask({ prompt: "hi", description: "run work" }); return "done"' },
        fake,
        context,
      )

      expect(envelope.status).toBe('ok')

      const summaries = toastSummaries(fake)

      expect(summaries.length).toBeGreaterThan(0)
      expect(sessionTitles(fake)).toContain(`${runIdOf(summaries[0])} · [ok] run work`)
    })

    it('includes elapsed run time in the final tool title and the success toast', async () => {
      const fake = createFakeClient()

      const { result } = await runTool(
        { script: 'await subtask({ prompt: "hi", description: "run work" }); return "done"' },
        fake,
      )

      const toolResult = result as WorkflowToolResult

      // Locked final title format: `workflow: <status> · <ok>/<n> subtasks · <seconds>s`.
      expect(toolResult.title).toMatch(/^workflow: ok · 1\/1 subtasks · \d+\.\d+s$/)

      const summaries = toastSummaries(fake)
      const runId = runIdOf(summaries[0])
      const success = summaries.find(summary => summary.variant === 'success')

      expect(success?.message).toMatch(
        new RegExp(String.raw`^workflow ok · 1\/1 subtasks · ${runId} · \d+\.\d+s$`),
      )
    })
  })

  describe('readNumber coercion', () => {
    it('coerces malformed values to the finite fallback 0', () => {
      const malformed = [
        NaN,
        Infinity,
        -Infinity,
        null,
        undefined,
        '12',
      ]

      for (const value of malformed) {
        expect(readNumber(value)).toBe(0)
      }
    })

    it('passes finite numbers through unchanged', () => {
      expect(readNumber(0)).toBe(0)
      expect(readNumber(12.5)).toBe(12.5)
      expect(readNumber(-3)).toBe(-3)
    })
  })

  describe('completion title robustness', () => {
    it('renders a finite elapsed time when stats.totalMs overflows to Infinity', () => {
      // `1e999` is valid JSON number syntax; JSON.parse evaluates it to Infinity.
      const { title } = toToolResult('{"status":"ok","stats":{"ok":1,"subtasks":1,"totalMs":1e999}}')

      expect(title).not.toContain('Infinity')
      expect(title).toBe('workflow: ok · 1/1 subtasks · 0.0s')
    })

    it('coerces NaN before formatting so the title never renders NaN', () => {
      // JSON cannot express NaN, so assert the coercion directly.
      expect(readNumber(NaN)).toBe(0)

      // Serialized, NaN becomes null; that must not leak into the title either.
      const { title } = toToolResult(
        JSON.stringify({ status: 'ok', stats: { ok: 1, subtasks: 1, totalMs: NaN } }),
      )

      expect(title).not.toContain('NaN')
      expect(title).toMatch(/ · 0\.0s$/)
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
      const showToast = vi.fn().mockResolvedValue({ data: true })
      const sessionUpdate = vi.fn().mockResolvedValue({ data: {} })
      const fake: FakeClient = {
        client: {
          session: { create, prompt, abort, update: sessionUpdate },
          tui: { showToast },
        } as unknown as WorkflowSdkClient,
        create,
        prompt,
        showToast,
        sessionUpdate,
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
