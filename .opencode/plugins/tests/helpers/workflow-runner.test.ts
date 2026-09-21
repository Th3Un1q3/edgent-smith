import { describe, expect, it, vi } from 'vitest'

import {
  BudgetExceededError,
  buildWorkflowFunction,
  checkScript,
  createSubtask,
  DEFAULT_TIMEOUT_SECONDS,
  runWorkflow,
  serializeEnvelope,
} from '@plugins/helpers/workflow-runner'
import type { RunWorkflowOptions } from '@plugins/helpers/workflow-runner'
import {
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_SUBTASK_AGENT,
  MAX_ENVELOPE_BYTES,
  MAX_LOGS,
  MAX_LOG_CHARS,
  MAX_MAX_SUBTASKS_CAP,
  createEmptyStats,
} from '@plugins/helpers/workflow-types'
// Namespace import so a missing MAX_DESCRIPTION_CHARS export fails the bounded
// description test instead of breaking the whole module at link time.
import * as workflowTypes from '@plugins/helpers/workflow-types'
import type { StepRecord, WorkflowEnvelope, WorkflowSdkClient } from '@plugins/helpers/workflow-types'

const MARKER = '…[truncated]'

interface PromptInput {
  signal?: AbortSignal
  body: {
    agent: string
    parts: Array<{ type: string, text: string }>
    model?: unknown
  }
}

const abortablePrompt = (): unknown =>
  vi.fn((input: { signal?: AbortSignal } = {}) =>
    new Promise((_resolve, reject) => {
      const onAbort = (): void => {
        reject({ name: 'AbortError', message: 'aborted' })
      }
      if (input.signal?.aborted === true) {
        onAbort()
      }
      else {
        input.signal?.addEventListener('abort', onAbort, { once: true })
      }
    }),
  )

const makeClient = (overrides: Record<string, unknown> = {}): WorkflowSdkClient =>
  ({
    session: {
      create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
      prompt: vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
      abort: vi.fn(async () => true),
      ...overrides,
    },
  }) as unknown as WorkflowSdkClient

const options = (script: string, overrides: Partial<RunWorkflowOptions> = {}): RunWorkflowOptions => ({
  script,
  client: makeClient(),
  parentSessionID: 'ses_parent',
  timeoutMs: 1000,
  ...overrides,
})

const parse = (json: string): WorkflowEnvelope => JSON.parse(json) as WorkflowEnvelope

const step = (index: number, label = `step ${index}`): StepRecord => ({
  label,
  description: label,
  task_id: `ses_${index}`,
  status: 'ok',
  durationMs: 1,
  truncated: false,
})

const makeLargeEnvelope = (overrides: Partial<WorkflowEnvelope> = {}): WorkflowEnvelope => ({
  status: 'ok',
  result: { payload: 'r'.repeat(2000) },
  steps: [step(0)],
  stats: createEmptyStats(),
  logs: [],
  ...overrides,
})

const callArgument = <T>(mock: { mock: { calls: unknown[][] } }, index = 0): T =>
  mock.mock.calls[index]?.[0] as T

const circular = (): Record<string, unknown> => {
  const value: Record<string, unknown> = {}
  return Object.assign(value, { self: value })
}

// Builds a script that launches `count` subtasks in parallel.
const parallelSubtasks = (count: number): string =>
  `await Promise.all([${Array.from({ length: count }, (_, index) => `subtask("s${index}")`).join(',')}]); return "done"`

// A client whose prompt resolves after a short delay, tracking peak concurrency.
const concurrencyClient = (): { client: WorkflowSdkClient, peak: () => number } => {
  let active = 0
  let peak = 0
  const prompt = vi.fn(async () => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => {
      setTimeout(resolve, 5)
    })
    active -= 1
    return { data: { parts: [{ type: 'text', text: 'OUT' }] } }
  })
  return { client: makeClient({ prompt }), peak: () => peak }
}

describe('runWorkflow', () => {
  it('returns an ok envelope for a script without subtasks', async () => {
    const envelope = parse(await runWorkflow(options('return { n: 1 }')))

    expect(envelope.status).toBe('ok')
    expect(envelope.result).toEqual({ n: 1 })
    expect(envelope.steps).toEqual([])
    expect(envelope.stats.subtasks).toBe(0)
  })

  it('returns an ok envelope with result, steps, stats and logs', async () => {
    const envelope = parse(await runWorkflow(options('log("hi"); const r = await subtask("x"); return r.outputText')))

    expect(envelope.status).toBe('ok')
    expect(envelope.error).toBeUndefined()
    expect(envelope.result).toBe('OUT')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.stats).toMatchObject({ subtasks: 1, ok: 1 })
    expect(envelope.logs).toContain('"hi"')
  })

  it('records a subtask step and propagates its task_id', async () => {
    const envelope = parse(await runWorkflow(options('const r = await subtask("work"); return r.outputText')))

    expect(envelope.status).toBe('ok')
    expect(envelope.result).toBe('OUT')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.steps[0]).toMatchObject({ task_id: 'ses_child', status: 'ok' })
    expect(envelope.stats).toMatchObject({ subtasks: 1, ok: 1 })
  })

  it('records the prompt-derived description on a string-shorthand step', async () => {
    const prompt = 'p'.repeat(100)
    const script = `await subtask(${JSON.stringify(prompt)}); return "done"`
    const envelope = parse(await runWorkflow(options(script)))
    const step = envelope.steps[0]

    expect(step.description).toBe(prompt.slice(0, workflowTypes.MAX_DESCRIPTION_CHARS))
  })

  it('records the object description on the step', async () => {
    const script = 'await subtask({ prompt: "p", description: "run work" }); return "done"'
    const envelope = parse(await runWorkflow(options(script)))
    const step = envelope.steps[0]

    expect(step).toMatchObject({ label: 'run work', description: 'run work' })
  })

  it('uses the default subtask agent unless the subtask overrides it', async () => {
    const prompt = vi.fn(async () => ({ data: { parts: [{ type: 'text', text: 'OUT' }] } }))
    await runWorkflow(options('await subtask("x"); return 1', { client: makeClient({ prompt }) }))
    expect(callArgument<PromptInput>(prompt).body.agent).toBe(DEFAULT_SUBTASK_AGENT)

    const overridePrompt = vi.fn(async () => ({ data: { parts: [{ type: 'text', text: 'OUT' }] } }))
    await runWorkflow(
      options('await subtask({ prompt: "x", description: "x", agent: "custom-agent" }); return 1', {
        client: makeClient({ prompt: overridePrompt }),
      }),
    )
    expect(callArgument<PromptInput>(overridePrompt).body.agent).toBe('custom-agent')
  })

  it('stringifies non-string log messages', async () => {
    const envelope = parse(await runWorkflow(options('log({ a: 1 }); return "done"')))

    expect(envelope.logs).toEqual(['{"a":1}'])
  })

  it('stringifies log messages that cannot be JSON-encoded', async () => {
    const envelope = parse(await runWorkflow(options('const a = {}; a.self = a; log(a); return "done"')))

    expect(envelope.logs).toEqual(['[object Object]'])
  })

  it('stringifies undefined log messages', async () => {
    const envelope = parse(await runWorkflow(options('log(undefined); return "done"')))

    expect(envelope.logs).toEqual(['undefined'])
  })

  it('does not add the marker when a log is exactly at the character cap', async () => {
    const message = 'a'.repeat(MAX_LOG_CHARS - 2)
    const script = `log(${JSON.stringify(message)}); return "done"`
    const envelope = parse(await runWorkflow(options(script)))

    const expected = JSON.stringify(message)
    expect(expected).toHaveLength(MAX_LOG_CHARS)
    expect(envelope.logs[0]).toBe(expected)
  })

  it('does not add the marker one character below the cap', async () => {
    const message = 'a'.repeat(MAX_LOG_CHARS - 3)
    const script = `log(${JSON.stringify(message)}); return "done"`
    const envelope = parse(await runWorkflow(options(script)))

    expect(envelope.logs[0]).toBe(JSON.stringify(message))
    expect(envelope.logs[0]).not.toContain(MARKER)
  })

  it('adds the marker one character above the cap', async () => {
    const message = 'a'.repeat(MAX_LOG_CHARS - 1)
    const script = `log(${JSON.stringify(message)}); return "done"`
    const envelope = parse(await runWorkflow(options(script)))

    expect(envelope.logs[0]).toHaveLength(MAX_LOG_CHARS + MARKER.length)
    expect(envelope.logs[0].endsWith(MARKER)).toBe(true)
  })

  it('caps logs at MAX_LOGS', async () => {
    const script = [
      `for (let i = 0; i < ${MAX_LOGS + 5}; i++) {`,
      '  log({ i })',
      '}',
      'return "done"',
    ].join('\n')

    const envelope = parse(await runWorkflow(options(script)))

    expect(envelope.status).toBe('ok')
    expect(envelope.logs).toHaveLength(MAX_LOGS)
  })

  it('truncates long log entries with a shared marker', async () => {
    const longLog = 'x'.repeat(MAX_LOG_CHARS + 50)
    const script = `log({ data: ${JSON.stringify(longLog)} }); return "done"`
    const envelope = parse(await runWorkflow(options(script)))

    const expected = JSON.stringify({ data: longLog })
    expect(envelope.logs[0]).toBe(expected.slice(0, MAX_LOG_CHARS) + MARKER)
  })

  it('returns an exact forbidden_script envelope without throwing', async () => {
    const envelope = parse(await runWorkflow(options('const x = require(\'fs\')')))

    expect(envelope).toEqual({
      status: 'forbidden_script',
      error: 'forbidden token: require(',
      steps: [],
      stats: createEmptyStats(),
      logs: [],
    })
  })

  it('returns an exact invalid_script envelope for a syntax error', async () => {
    const envelope = parse(await runWorkflow(options('const x = ;')))

    expect(envelope.status).toBe('invalid_script')
    expect(envelope.error).toBeTruthy()
    expect(envelope.steps).toEqual([])
    expect(envelope.stats).toEqual(createEmptyStats())
    expect(envelope.logs).toEqual([])
  })

  it('returns budget_exceeded with the partial steps when the budget runs out', async () => {
    const script = 'await subtask("one"); await subtask("two"); return "never"'
    const envelope = parse(await runWorkflow(options(script, { maxSubtasks: 1 })))

    expect(envelope.status).toBe('budget_exceeded')
    expect(envelope.error).toBe('workflow subtask budget exceeded (1)')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.stats).toMatchObject({ subtasks: 1, ok: 1 })
  })

  it('clamps maxSubtasks below the minimum up to one', async () => {
    const script = 'await subtask("one"); await subtask("two"); return "never"'
    const envelope = parse(await runWorkflow(options(script, { maxSubtasks: 0 })))

    expect(envelope.status).toBe('budget_exceeded')
    expect(envelope.steps).toHaveLength(1)
  })

  it('clamps maxSubtasks above the cap down to 64', async () => {
    const script = 'for (let i = 0; i < 65; i++) { await subtask("s" + i) } return "all"'
    const envelope = parse(await runWorkflow(options(script, { maxSubtasks: 65 })))

    expect(envelope.status).toBe('budget_exceeded')
    expect(envelope.stats.subtasks).toBe(MAX_MAX_SUBTASKS_CAP)
  })

  it('keeps stats consistent with steps for a run exceeding the old 32-step cap', async () => {
    const script = 'for (let i = 0; i < 40; i++) { await subtask("s" + i) } return "done"'
    const envelope = parse(await runWorkflow(options(script, { maxSubtasks: 40 })))

    expect(envelope.status).toBe('ok')
    expect(envelope.stats.subtasks).toBe(40)
    expect(envelope.steps).toHaveLength(40)
    const perStatus = envelope.stats.ok + envelope.stats.error + envelope.stats.empty
      + envelope.stats.timeout + envelope.stats.aborted
    expect(perStatus).toBe(envelope.steps.length)
  })

  it('returns a timeout envelope and records the aborted in-flight step', async () => {
    const script = 'return await subtask({ prompt: "x", description: "x" })'
    const client = makeClient({ prompt: abortablePrompt() })
    const envelope = parse(await runWorkflow(options(script, { client, timeoutMs: 30 })))

    expect(envelope.status).toBe('timeout')
    expect(envelope.error).toBe('workflow timed out after 0.0s')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.steps[0].status).toBe('aborted')
    expect(envelope.stats).toMatchObject({ subtasks: 1, aborted: 1, timeout: 0 })
  })

  it('preserves completed steps when a later step is cut off by the timeout', async () => {
    let call = 0
    const prompt = vi.fn((input: { signal?: AbortSignal } = {}) => {
      call += 1
      return call === 1
        ? Promise.resolve({ data: { parts: [{ type: 'text', text: 'first' }] } })
        : new Promise((_resolve, reject) => {
            const onAbort = (): void => {
              reject({ name: 'AbortError', message: 'aborted' })
            }
            if (input.signal?.aborted === true) {
              onAbort()
            }
            else {
              input.signal?.addEventListener('abort', onAbort, { once: true })
            }
          })
    })
    const client = makeClient({ prompt })
    const envelope = parse(await runWorkflow(options('const a = await subtask("a"); return await subtask("b")', { client, timeoutMs: 30 })))

    expect(envelope.status).toBe('timeout')
    expect(envelope.steps.map(entry => entry.status)).toEqual(['ok', 'aborted'])
    expect(envelope.stats).toMatchObject({ subtasks: 2, ok: 1, aborted: 1 })
  })

  it('honors a per-subtask timeout_seconds for a hanging subtask', async () => {
    const client = makeClient({ prompt: abortablePrompt() })
    const envelope = parse(await runWorkflow(
      options('return await subtask({ prompt: "x", description: "x", timeout_seconds: 0.02 })', { client, timeoutMs: 1000 }),
    ))

    expect(envelope.status).toBe('ok')
    expect(envelope.steps[0].status).toBe('timeout')
    expect(envelope.stats).toMatchObject({ subtasks: 1, timeout: 1, aborted: 0 })
  })

  it('counts every subtask status in stats', async () => {
    let call = 0
    const prompt = vi.fn((input: { signal?: AbortSignal } = {}) => {
      call += 1
      if (call === 1) {
        return Promise.resolve({ data: { info: { error: 'boom' } } })
      }
      return call === 2
        ? Promise.resolve({ data: { info: {}, parts: [] } })
        : new Promise((_resolve, reject) => {
            const onAbort = (): void => {
              reject({ name: 'AbortError', message: 'aborted' })
            }
            if (input.signal?.aborted === true) {
              onAbort()
            }
            else {
              input.signal?.addEventListener('abort', onAbort, { once: true })
            }
          })
    })
    const client = makeClient({ prompt })
    const script = [
      'const a = await subtask("a")',
      'const b = await subtask("b")',
      'const c = await subtask({ prompt: "c", description: "c", timeout_seconds: 0.02 })',
      'return [a.status, b.status, c.status]',
    ].join('\n')
    const envelope = parse(await runWorkflow(options(script, { client, timeoutMs: 1000 })))

    expect(envelope.status).toBe('ok')
    expect(envelope.result).toEqual(['error', 'empty', 'timeout'])
    expect(envelope.stats).toMatchObject({
      subtasks: 3,
      ok: 0,
      error: 1,
      empty: 1,
      timeout: 1,
      aborted: 0,
    })
  })

  it('truncates subtask output beyond the shared limit and marks stats.truncated', async () => {
    const prompt = vi.fn(async () => ({ data: { parts: [{ type: 'text', text: 'A'.repeat(4100) }] } }))
    const client = makeClient({ prompt })
    const envelope = parse(await runWorkflow(
      options('const r = await subtask("x"); return r.outputText', { client }),
    ))

    expect(envelope.steps[0].truncated).toBe(true)
    expect(envelope.stats.truncated).toBe(true)
    expect((envelope.result as string).startsWith('A'.repeat(4000))).toBe(true)
  })

  it('does not mark truncation at exactly the output limit', async () => {
    const prompt = vi.fn(async () => ({ data: { parts: [{ type: 'text', text: 'A'.repeat(4000) }] } }))
    const client = makeClient({ prompt })
    const envelope = parse(await runWorkflow(
      options('const r = await subtask("x"); return r.outputText', { client }),
    ))

    expect(envelope.steps[0].truncated).toBe(false)
    expect(envelope.stats.truncated).toBe(false)
  })

  it('serializes an oversized result within the default envelope cap', async () => {
    const raw = await runWorkflow(options('return "r".repeat(20000)'))

    expect(Buffer.byteLength(raw, 'utf8')).toBeLessThanOrEqual(MAX_ENVELOPE_BYTES)
    expect(parse(raw).status).toBe('ok')
  })

  it('reports a positive totalMs for a run with a real delay', async () => {
    const prompt = vi.fn(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 15)
      })
      return { data: { parts: [{ type: 'text', text: 'OUT' }] } }
    })
    const client = makeClient({ prompt })
    const envelope = parse(await runWorkflow(options('await subtask("x"); return 1', { client })))

    expect(typeof envelope.stats.totalMs).toBe('number')
    expect(envelope.stats.totalMs).toBeGreaterThan(0)
    expect(envelope.stats.totalMs).toBeLessThan(60_000)
  })

  it('defaults maxConcurrent to the configured default', async () => {
    const { client, peak } = concurrencyClient()
    const script = parallelSubtasks(5)
    const envelope = parse(await runWorkflow(options(script, { client })))

    expect(envelope.status).toBe('ok')
    expect(peak()).toBe(DEFAULT_MAX_CONCURRENT)
  })

  it.each([
    [0, 1],
    [1, 1],
    [8, 8],
    [9, 8],
  ])('clamps maxConcurrent %i to %i', async (requested, expected) => {
    const { client, peak } = concurrencyClient()
    const script = parallelSubtasks(9)
    const envelope = parse(await runWorkflow(options(script, { client, maxConcurrent: requested })))

    expect(envelope.status).toBe('ok')
    expect(peak()).toBe(expected)
  })
})

describe('runWorkflow timeout grace', () => {
  // A prompt that ignores the abort signal keeps the subtask in flight so the
  // post-timeout grace has something it can legitimately wait for.
  const hangingClient = (): WorkflowSdkClient => makeClient({ prompt: vi.fn(() => new Promise(() => {})) })

  it('waits out the fixed timeout grace while a subtask is in flight', async () => {
    vi.useFakeTimers()
    try {
      const pending = runWorkflow(options('return await subtask("x")', {
        client: hangingClient(),
        timeoutMs: 10,
      }))
      let isSettled = false
      void pending.then(() => {
        isSettled = true
      })

      await vi.advanceTimersByTimeAsync(11)
      await vi.advanceTimersByTimeAsync(248)
      expect(isSettled).toBe(false)

      await vi.advanceTimersByTimeAsync(5)
      const envelope = parse(await pending)
      expect(envelope.status).toBe('timeout')
      expect(envelope.error).toBe('workflow timed out after 0.0s')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('skips the grace entirely when no subtask is in flight', async () => {
    vi.useFakeTimers()
    try {
      const pending = runWorkflow(options('return new Promise(() => {})', { timeoutMs: 10 }))
      let isSettled = false
      void pending.then(() => {
        isSettled = true
      })

      await vi.advanceTimersByTimeAsync(11)
      expect(isSettled).toBe(true)

      const envelope = parse(await pending)
      expect(envelope.status).toBe('timeout')
      expect(envelope.steps).toEqual([])
    }
    finally {
      vi.useRealTimers()
    }
  })

  // Regression: a subtask awaiting `session.create` was not yet in `ctx.active`,
  // so the timeout grace was skipped and the aborted step was dropped. The child
  // controller is now registered before session creation.
  it('waits for a subtask still inside session.create so its aborted step is recorded', async () => {
    const create = vi.fn(() =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ data: { id: 'ses_child' } }), 25)
      }),
    )
    const client = makeClient({ create, prompt: abortablePrompt() })
    const envelope = parse(await runWorkflow(options('return await subtask("x")', {
      client,
      timeoutMs: 10,
    })))

    expect(envelope.status).toBe('timeout')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.steps[0].status).toBe('aborted')
    expect(envelope.stats).toMatchObject({ subtasks: 1, aborted: 1 })
  })
})

describe('runWorkflow failure classification', () => {
  it('reports an Error message from a thrown script error', async () => {
    const envelope = parse(await runWorkflow(options('throw new Error("kaboom")')))

    expect(envelope.status).toBe('error')
    expect(envelope.error).toBe('kaboom')
    expect(envelope.stats.truncated).toBe(false)
  })

  it('reports a thrown string verbatim', async () => {
    const envelope = parse(await runWorkflow(options('throw "plain"')))
    expect(envelope.error).toBe('plain')
    expect(envelope.status).toBe('error')
  })

  it('bounds the serialized envelope for a thrown error larger than the cap', async () => {
    const raw = await runWorkflow(options('throw \'x\'.repeat(9000)'))

    expect(Buffer.byteLength(raw, 'utf8')).toBeLessThanOrEqual(MAX_ENVELOPE_BYTES)
    const envelope = parse(raw)
    expect(envelope.status).toBe('error')
    expect(typeof envelope.error).toBe('string')
  })

  it('bounds a thrown error message larger than 8192 bytes under the real cap', async () => {
    const raw = await runWorkflow(options('throw new Error("E".repeat(9000))'))
    expect(Buffer.byteLength(raw, 'utf8')).toBeLessThanOrEqual(8192)
    expect(parse(raw).status).toBe('error')
  })

  it('JSON-encodes a thrown plain object', async () => {
    const envelope = parse(await runWorkflow(options('throw { code: 7 }')))
    expect(envelope.error).toBe('{"code":7}')
  })

  it('falls back to String when JSON encoding the thrown value throws', async () => {
    const envelope = parse(await runWorkflow(options('throw { toJSON() { throw new Error("nope") } }')))
    expect(envelope.error).toBe('[object Object]')
  })

  it('handles a thrown undefined value', async () => {
    const envelope = parse(await runWorkflow(options('throw undefined')))
    expect(envelope.error).toBe('undefined')
  })

  it('handles a thrown null value without treating it as budget exceeded', async () => {
    const envelope = parse(await runWorkflow(options('throw null')))
    expect(envelope.status).toBe('error')
    expect(envelope.error).toBe('null')
  })

  it('classifies a duck-typed BudgetExceededError name as budget_exceeded', async () => {
    const envelope = parse(await runWorkflow(options('throw { name: "BudgetExceededError" }')))

    expect(envelope.status).toBe('budget_exceeded')
    expect(envelope.error).toBe('{"name":"BudgetExceededError"}')
  })

  it('does not classify an object with another name as budget_exceeded', async () => {
    const envelope = parse(await runWorkflow(options('throw { name: "Other" }')))
    expect(envelope.status).toBe('error')
  })
})

describe('serializeEnvelope', () => {
  it('keeps the envelope intact when it fits the cap', () => {
    const envelope = makeLargeEnvelope()
    const full = JSON.stringify(envelope)
    const size = Buffer.byteLength(full, 'utf8')

    expect(serializeEnvelope(envelope, size)).toBe(full)
    expect(serializeEnvelope(envelope, size + 1)).toBe(full)
  })

  it('keeps logs when the full envelope fits exactly at the cap', () => {
    const envelope = makeLargeEnvelope({ logs: ['a'.repeat(100), 'b'.repeat(100)] })
    const size = Buffer.byteLength(JSON.stringify(envelope), 'utf8')
    const parsed = JSON.parse(serializeEnvelope(envelope, size)) as WorkflowEnvelope

    expect(parsed.logs).toEqual(envelope.logs)
  })

  it('retains the raw result deep-equal when it fits', () => {
    const envelope = makeLargeEnvelope({ result: { deep: { nested: [1, 2, 3] } } })
    const parsed = JSON.parse(serializeEnvelope(envelope)) as WorkflowEnvelope

    expect(parsed.result).toEqual(envelope.result)
  })

  it.each([-1, 0, 1])('stays valid JSON within the cap at offset %i', (offset) => {
    const envelope = makeLargeEnvelope()
    const size = Buffer.byteLength(JSON.stringify(envelope), 'utf8')
    const cap = size + offset
    const json = serializeEnvelope(envelope, cap)

    expect(Buffer.byteLength(json, 'utf8')).toBeLessThanOrEqual(cap)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('is deterministic for the same input', () => {
    const envelope = makeLargeEnvelope({
      result: 'z'.repeat(3000),
      steps: [step(0), step(1)],
      logs: ['x'.repeat(600)],
    })

    expect(serializeEnvelope(envelope, 400)).toBe(serializeEnvelope(envelope, 400))
  })

  it('drops logs before changing the result or steps', () => {
    const envelope = makeLargeEnvelope({
      logs: Array.from({ length: 10 }, () => 'l'.repeat(400)),
    })
    const cap = Buffer.byteLength(JSON.stringify({ ...envelope, logs: [] }), 'utf8') + 10
    const parsed = JSON.parse(serializeEnvelope(envelope, cap)) as WorkflowEnvelope

    expect(parsed.logs).toEqual([])
    expect(parsed.result).toEqual(envelope.result)
    expect(parsed.steps).toEqual(envelope.steps)
  })

  it('marks stats.truncated when logs are dropped at the log-free boundary', () => {
    const envelope = makeLargeEnvelope({
      result: { value: 'kept' },
      steps: [],
      logs: ['l'.repeat(5000)],
    })
    const withoutLogs = { ...envelope, logs: [] }
    const cap = Buffer.byteLength(JSON.stringify(withoutLogs), 'utf8')
    const parsed = JSON.parse(serializeEnvelope(envelope, cap)) as WorkflowEnvelope

    expect(parsed.logs).toEqual([])
    expect(parsed.result).toEqual(envelope.result)
    expect(parsed.stats.truncated).toBe(true)
  })

  it('truncates the result before dropping steps', () => {
    const envelope = makeLargeEnvelope({
      result: 'z'.repeat(5000),
      steps: [step(0), step(1)],
    })
    const parsed = JSON.parse(serializeEnvelope(envelope, 600)) as WorkflowEnvelope

    expect(typeof parsed.result).toBe('string')
    expect((parsed.result as string).endsWith(MARKER)).toBe(true)
    expect(parsed.steps).toHaveLength(2)
    expect(parsed.stats.truncated).toBe(true)
  })

  it('drops steps from the end when truncating the result is not enough', () => {
    const envelope = makeLargeEnvelope({
      result: 'z'.repeat(5000),
      steps: Array.from({ length: 10 }, (_value, index) => step(index, 's'.repeat(150))),
    })
    const parsed = JSON.parse(serializeEnvelope(envelope, 500)) as WorkflowEnvelope

    expect(parsed.steps.length).toBeLessThan(10)
    expect(typeof parsed.result).toBe('string')
    expect(parsed.stats.truncated).toBe(true)
  })

  it('truncates a multi-byte result by UTF-8 bytes without dropping steps', () => {
    // Each '漢' is one UTF-16 code unit but three UTF-8 bytes, so a truncation
    // that budgets in code units overshoots the byte cap by ~3x.
    const envelope = makeLargeEnvelope({
      result: '漢'.repeat(10_000),
      steps: [step(0)],
    })
    const json = serializeEnvelope(envelope)
    const parsed = JSON.parse(json) as WorkflowEnvelope

    expect(Buffer.byteLength(json, 'utf8')).toBeLessThanOrEqual(MAX_ENVELOPE_BYTES)
    expect(parsed.steps).toHaveLength(1)
    expect(typeof parsed.result).toBe('string')
    expect((parsed.result as string).endsWith(MARKER)).toBe(true)
    expect(parsed.stats.truncated).toBe(true)
  })

  it('drops steps when the result is not truncatable', () => {
    const envelope: WorkflowEnvelope = {
      status: 'ok',
      steps: Array.from({ length: 5 }, (_value, index) => step(index, 's'.repeat(200))),
      stats: createEmptyStats(),
      logs: [],
    }
    const parsed = JSON.parse(serializeEnvelope(envelope, 300)) as WorkflowEnvelope

    expect(parsed.result).toBeUndefined()
    expect(parsed.steps.length).toBeLessThan(5)
  })

  it('leaves a null result untouched while dropping steps', () => {
    const envelope = makeLargeEnvelope({
      result: null,
      steps: Array.from({ length: 5 }, (_value, index) => step(index, 's'.repeat(200))),
    })
    const parsed = JSON.parse(serializeEnvelope(envelope, 300)) as WorkflowEnvelope

    expect(parsed.result).toBeNull()
    expect(parsed.steps.length).toBeLessThan(5)
  })

  it('bounds an oversized error to keep the envelope within the cap', () => {
    const envelope = makeLargeEnvelope({ status: 'error', error: 'x'.repeat(9000) })
    const json = serializeEnvelope(envelope)
    const parsed = JSON.parse(json) as WorkflowEnvelope

    expect(Buffer.byteLength(json, 'utf8')).toBeLessThanOrEqual(MAX_ENVELOPE_BYTES)
    expect(parsed.status).toBe('error')
    expect((parsed.error as string).endsWith(MARKER)).toBe(true)
  })

  it('falls back to a minimal envelope when nothing else fits', () => {
    const envelope = makeLargeEnvelope({
      status: 'ok',
      error: 'x'.repeat(500),
      steps: [step(0), step(1)],
    })
    const parsed = JSON.parse(serializeEnvelope(envelope, 3)) as WorkflowEnvelope

    expect(parsed.status).toBe('ok')
    expect(parsed.steps).toBeUndefined()
  })

  it('falls back to stringifying a result that cannot be JSON-encoded', () => {
    const envelope = makeLargeEnvelope({ result: circular() })
    const parsed = JSON.parse(serializeEnvelope(envelope)) as WorkflowEnvelope

    expect(parsed.result).toBe('[object Object]')
  })
})

describe('barrel re-exports', () => {
  it('exposes the workflow building blocks from a single import site', () => {
    expect(typeof checkScript).toBe('function')
    expect(typeof buildWorkflowFunction).toBe('function')
    expect(typeof createSubtask).toBe('function')
    expect(typeof BudgetExceededError).toBe('function')
    expect(typeof DEFAULT_TIMEOUT_SECONDS).toBe('number')
    expect(typeof runWorkflow).toBe('function')
    expect(typeof serializeEnvelope).toBe('function')
  })
})
