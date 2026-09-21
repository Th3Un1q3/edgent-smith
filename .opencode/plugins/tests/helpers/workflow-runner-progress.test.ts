import { describe, expect, it, vi } from 'vitest'

import { runWorkflow } from '@plugins/helpers/workflow-runner'
import type { RunWorkflowOptions } from '@plugins/helpers/workflow-runner'
import type { WorkflowEnvelope, WorkflowSdkClient } from '@plugins/helpers/workflow-types'

// Locked progress transport for the workflow runner:
//   - transient TUI toasts via `client.tui.showToast({ body })` (start, one
//     milestone per completed subtask, one terminal toast on settle). Every
//     message carries the run id `wf#<6 hex>`: `started · wf#<id>`,
//     `<status> <ok>/<total> · wf#<id> · <description>` (status `ok` on
//     success, the failing status otherwise),
//     `workflow ok · <ok>/<n> subtasks · wf#<id> · <n>.<d>s`,
//   - live child-session titles via `client.session.update({ path, body })`
//     (`wf#<id> · [running] <description>` -> `wf#<id> · [ok]`/`[error]`/`[aborted]`).
// The old `context.metadata` transport is a proven dead end and must no longer
// be the mechanism these tests exercise.

interface ToastBody {
  title?: string
  message: string
  variant: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

interface ToastSummary {
  title?: string
  message: string
  variant: string
}

interface SessionUpdateArguments {
  path: { id: string }
  body: { title: string }
}

interface FakeNotifyClient {
  client: WorkflowSdkClient
  showToast: ReturnType<typeof vi.fn>
  sessionUpdate: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  prompt: ReturnType<typeof vi.fn>
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

const makeFakeClient = (overrides: {
  showToast?: any
  sessionUpdate?: any
  create?: any
  prompt?: any
  abort?: any
} = {}): FakeNotifyClient => {
  const showToast = overrides.showToast ?? vi.fn(async () => ({ data: true }))
  const sessionUpdate = overrides.sessionUpdate ?? vi.fn(async () => ({ data: {} }))
  const create = overrides.create ?? vi.fn(async () => ({ data: { id: 'ses_child' } }))
  const prompt = overrides.prompt
    ?? vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }))
  const abort = overrides.abort ?? vi.fn(async () => true)
  const client = {
    session: { create, prompt, abort, update: sessionUpdate },
    tui: { showToast },
  } as unknown as WorkflowSdkClient
  return { client, showToast, sessionUpdate, create, prompt }
}

const makeOptions = (
  script: string,
  fake: FakeNotifyClient,
  overrides: Partial<RunWorkflowOptions> = {},
): RunWorkflowOptions => ({
  script,
  client: fake.client,
  parentSessionID: 'ses_parent',
  timeoutMs: 1000,
  ...overrides,
})

const toastSummaries = (fake: FakeNotifyClient): ToastSummary[] =>
  fake.showToast.mock.calls.map(([argument]) => {
    const body = (argument as { body: ToastBody }).body
    return { title: body.title, message: body.message, variant: body.variant }
  })

const RUN_ID_PATTERN = /wf#[0-9a-f]{6}/

// Derive the dynamic run id from a toast that carries it, so assertions compare
// against the same id the runner actually generated rather than a literal.
const runIdOf = (summary: ToastSummary): string => {
  const match = RUN_ID_PATTERN.exec(summary.message)
  if (match === null) {
    throw new Error(`toast does not carry a run id: ${summary.message}`)
  }
  return match[0]
}

const sessionUpdates = (fake: FakeNotifyClient): SessionUpdateArguments[] =>
  fake.sessionUpdate.mock.calls.map(([argument]) => argument as SessionUpdateArguments)

const sessionTitles = (fake: FakeNotifyClient): string[] =>
  sessionUpdates(fake).map(update => update.body.title)

const parse = (json: string): WorkflowEnvelope => JSON.parse(json) as WorkflowEnvelope

const waitUntil = async (isDone: () => boolean): Promise<void> => {
  for (let index = 0; index < 200 && !isDone(); index += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1)
    })
  }
}

describe('runWorkflow notifications', () => {
  it('fires a start toast, one milestone per completed subtask, and a success toast', async () => {
    const fake = makeFakeClient()
    const script = [
      'await subtask({ prompt: "a", description: "first" })',
      'await subtask({ prompt: "b", description: "second" })',
      'return "done"',
    ].join('\n')

    const envelope = parse(await runWorkflow(makeOptions(script, fake)))

    expect(envelope.status).toBe('ok')
    const summaries = toastSummaries(fake)

    expect(summaries).toHaveLength(4)
    expect(summaries[0]).toMatchObject({ title: 'workflow', variant: 'info' })
    expect(summaries[0].message).toMatch(/^started · wf#[0-9a-f]{6}$/)
    const runId = runIdOf(summaries[0])

    expect(summaries[1]).toEqual({ title: 'workflow', message: `ok 1/1 · ${runId} · first`, variant: 'info' })
    expect(summaries[2]).toEqual({ title: 'workflow', message: `ok 2/2 · ${runId} · second`, variant: 'info' })
    expect(summaries[3]).toMatchObject({ title: 'workflow', variant: 'success' })
    expect(summaries[3].message).toMatch(
      new RegExp(String.raw`^workflow ok · 2\/2 subtasks · ${runId} · \d+\.\d+s$`),
    )
  })

  it('labels a failing subtask milestone with the failing status, not ok', async () => {
    const fake = makeFakeClient({
      prompt: vi.fn(async () => ({ data: { info: { error: 'boom' }, parts: [] } })),
    })
    const script = 'await subtask({ prompt: "a", description: "first" }); return "done"'

    const envelope = parse(await runWorkflow(makeOptions(script, fake)))

    expect(envelope.status).toBe('ok')
    const summaries = toastSummaries(fake)
    const runId = runIdOf(summaries[0])

    const milestone = summaries[1]
    expect(milestone).toEqual({ title: 'workflow', message: `error 0/1 · ${runId} · first`, variant: 'info' })
    expect(milestone.message.startsWith('ok ')).toBe(false)
  })

  it('does not fire extra toasts while a subtask is in flight', async () => {
    vi.useFakeTimers()
    try {
      const pending: Array<(value: unknown) => void> = []
      const prompt = vi.fn(() => new Promise((resolve) => {
        pending.push(resolve)
      }))
      const fake = makeFakeClient({ prompt })
      const script = 'await subtask({ prompt: "a", description: "long" }); return "done"'

      const pendingRun = runWorkflow(makeOptions(script, fake, { timeoutMs: 60_000 }))

      for (let index = 0; index < 20 && pending.length === 0; index += 1) {
        await vi.advanceTimersByTimeAsync(0)
      }
      expect(pending).toHaveLength(1)
      // Only the start toast exists so far.
      expect(toastSummaries(fake)).toHaveLength(1)

      // Nothing should notify while a subtask runs; the next toast is terminal.
      // Any per-tick emission would explode this count.
      await vi.advanceTimersByTimeAsync(35)
      expect(toastSummaries(fake)).toHaveLength(1)

      for (const resolve of pending) {
        resolve({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })
      }
      const envelope = parse(await pendingRun)

      expect(envelope.status).toBe('ok')
      expect(toastSummaries(fake)).toHaveLength(3)
      expect(toastSummaries(fake).at(-1)?.variant).toBe('success')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('fires one error toast and no success toast when the run fails', async () => {
    const fake = makeFakeClient()
    const envelope = parse(await runWorkflow(makeOptions('throw new Error("boom")', fake)))

    expect(envelope.status).toBe('error')
    const summaries = toastSummaries(fake)
    expect(summaries.filter(summary => summary.variant === 'success')).toEqual([])
    expect(summaries).toHaveLength(2)
    expect(summaries.at(-1)).toMatchObject({ title: 'workflow', variant: 'error' })
    expect(summaries.at(-1)?.message).toMatch(/^workflow error · wf#[0-9a-f]{6} · boom$/)
  })

  it('fires a warning toast when the run times out', async () => {
    const fake = makeFakeClient({ prompt: abortablePrompt() })
    const envelope = parse(await runWorkflow(makeOptions('return await subtask("x")', fake, { timeoutMs: 30 })))

    expect(envelope.status).toBe('timeout')
    const summaries = toastSummaries(fake)
    expect(summaries.filter(summary => summary.variant === 'success')).toEqual([])
    expect(summaries.at(-1)).toMatchObject({ title: 'workflow', variant: 'warning' })
    expect(summaries.at(-1)?.message).toMatch(/^workflow timed out after 0\.0s · wf#[0-9a-f]{6}$/)
  })

  it('fires a warning toast when the run is aborted', async () => {
    const controller = new AbortController()
    const fake = makeFakeClient({ prompt: abortablePrompt() })
    const pendingRun = runWorkflow(makeOptions('return await subtask("x")', fake, {
      timeoutMs: 5000,
      abort: controller.signal,
    }))

    await new Promise((resolve) => {
      setTimeout(resolve, 5)
    })
    controller.abort()

    const envelope = parse(await pendingRun)

    expect(envelope.status).toBe('aborted')
    const summaries = toastSummaries(fake)
    expect(summaries.filter(summary => summary.variant === 'success')).toEqual([])
    expect(summaries.at(-1)).toMatchObject({ title: 'workflow', variant: 'warning' })
    expect(summaries.at(-1)?.message).toMatch(/^workflow aborted · wf#[0-9a-f]{6}$/)
  })

  it('keeps the run successful when showToast rejects', async () => {
    const fake = makeFakeClient({
      showToast: vi.fn(async () => {
        throw new Error('toast down')
      }),
    })

    const envelope = parse(await runWorkflow(makeOptions('return await subtask("x")', fake)))

    expect(envelope.status).toBe('ok')
    expect(envelope.steps).toHaveLength(1)
    expect(envelope.steps[0]).toMatchObject({ status: 'ok' })
    // A rejecting toast must neither surface as an error nor silently disable
    // the rest of the reporting: the toast is attempted and the title still moves.
    const runId = runIdOf(toastSummaries(fake)[0])
    expect(fake.showToast).toHaveBeenCalled()
    expect(sessionTitles(fake)).toContain(`${runId} · [ok] x`)
  })

  it('completes without a notifications channel when the client exposes none', async () => {
    const create = vi.fn(async () => ({ data: { id: 'ses_child' } }))
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }))
    const client = { session: { create, prompt } } as unknown as WorkflowSdkClient

    const envelope = parse(await runWorkflow({
      script: 'return await subtask("x")',
      client,
      parentSessionID: 'ses_parent',
      timeoutMs: 1000,
    }))

    expect(envelope.status).toBe('ok')
  })

  it('keeps notifying through the live toast sink when a toast throws synchronously', async () => {
    const fake = makeFakeClient({
      showToast: vi.fn(() => {
        throw new Error('toast boom')
      }),
    })

    const envelope = parse(await runWorkflow(makeOptions('return await subtask("x")', fake)))

    expect(envelope.status).toBe('ok')
    expect(toastSummaries(fake).map(summary => summary.variant)).toContain('success')
    const runId = runIdOf(toastSummaries(fake)[0])
    expect(sessionTitles(fake)).toContain(`${runId} · [ok] x`)
  })

  it('updates the child session title from running to ok', async () => {
    const fake = makeFakeClient()
    const script = 'await subtask({ prompt: "hi", description: "run work" }); return "done"'

    const envelope = parse(await runWorkflow(makeOptions(script, fake)))

    expect(envelope.status).toBe('ok')
    const runId = runIdOf(toastSummaries(fake)[0])
    expect(sessionUpdates(fake)).toEqual([
      { path: { id: 'ses_child' }, body: { title: `${runId} · [running] run work` } },
      { path: { id: 'ses_child' }, body: { title: `${runId} · [ok] run work` } },
    ])
  })

  it('updates the child session title to error when a subtask fails', async () => {
    const fake = makeFakeClient({
      prompt: vi.fn(async () => ({ data: { info: { error: 'boom' }, parts: [] } })),
    })
    const script = 'await subtask({ prompt: "x", description: "work" }); return "done"'

    const envelope = parse(await runWorkflow(makeOptions(script, fake)))

    expect(envelope.status).toBe('ok')
    const runId = runIdOf(toastSummaries(fake)[0])
    expect(sessionTitles(fake)).toEqual([
      `${runId} · [running] work`,
      `${runId} · [error] work`,
    ])
  })

  it('truncates the child session title to the 80-char description convention', async () => {
    const fake = makeFakeClient()
    const description = 'x'.repeat(120)
    const script = `await subtask({ prompt: "hi", description: ${JSON.stringify(description)} }); return "done"`

    await runWorkflow(makeOptions(script, fake))

    const runId = runIdOf(toastSummaries(fake)[0])
    expect(sessionTitles(fake)[0]).toBe(`${runId} · [running] ${'x'.repeat(80)}`)
  })

  it('keeps the run successful when session.update rejects', async () => {
    const fake = makeFakeClient({
      sessionUpdate: vi.fn(async () => {
        throw new Error('update down')
      }),
    })

    const envelope = parse(await runWorkflow(makeOptions('return await subtask("x")', fake)))

    expect(envelope.status).toBe('ok')
    expect(envelope.steps).toHaveLength(1)
  })

  it('tracks concurrent subtasks by moving each child title from running to ok', async () => {
    const pending: Array<{ resolve: (value: unknown) => void }> = []
    let sequence = 0
    const create = vi.fn(async () => {
      sequence += 1
      return { data: { id: `ses_${sequence}` } }
    })
    const prompt = vi.fn(() => new Promise((resolve) => {
      pending.push({ resolve })
    }))
    const fake = makeFakeClient({ create, prompt })
    const script = 'await Promise.all(['
      + 'subtask({ prompt: "a", description: "alpha" }), '
      + 'subtask({ prompt: "b", description: "beta" })'
      + ']); return "done"'

    const pendingRun = runWorkflow(makeOptions(script, fake, { maxConcurrent: 2 }))

    await waitUntil(() => pending.length === 2)

    const runId = runIdOf(toastSummaries(fake)[0])
    const inFlight = sessionTitles(fake)
    expect(inFlight).toEqual(expect.arrayContaining([
      `${runId} · [running] alpha`,
      `${runId} · [running] beta`,
    ]))
    expect(inFlight.some(title => title.startsWith(`${runId} · [ok]`))).toBe(false)

    for (const entry of pending) {
      entry.resolve({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })
    }
    const envelope = parse(await pendingRun)

    expect(envelope.status).toBe('ok')
    expect(sessionTitles(fake)).toEqual(expect.arrayContaining([
      `${runId} · [ok] alpha`,
      `${runId} · [ok] beta`,
    ]))
  })

  it('fires exactly one terminal error toast for an invalid script', async () => {
    const fake = makeFakeClient()
    const envelope = parse(await runWorkflow(makeOptions('const x = ;', fake)))

    expect(envelope.status).toBe('invalid_script')
    const summaries = toastSummaries(fake)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ title: 'workflow', variant: 'error' })
    expect(summaries[0].message).toMatch(/^workflow invalid_script · wf#[0-9a-f]{6} · /)
  })

  it('fires exactly one terminal error toast for a forbidden script', async () => {
    const fake = makeFakeClient()
    const envelope = parse(await runWorkflow(makeOptions('const x = require(\'fs\')', fake)))

    expect(envelope.status).toBe('forbidden_script')
    const summaries = toastSummaries(fake)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ title: 'workflow', variant: 'error' })
    expect(summaries[0].message).toMatch(/^workflow forbidden_script · wf#[0-9a-f]{6} · /)
  })

  it('bounds milestone toasts for a large fan-out while still reporting progress', async () => {
    const fake = makeFakeClient()
    const script = 'await Promise.all(Array.from({ length: 64 }, (_, i) => '
      + 'subtask({ prompt: "p" + i, description: "d" + i }))); return "done"'

    const envelope = parse(await runWorkflow(makeOptions(script, fake, { maxSubtasks: 64 })))

    expect(envelope.status).toBe('ok')
    const summaries = toastSummaries(fake)
    // Milestones are the only toasts whose message opens with `ok <n>/<n> ·`
    // (the terminal success toast opens with `workflow ok`).
    const milestones = summaries.filter(summary => summary.message.startsWith('ok '))
    // Small runs report per-subtask (5), then only every 5th completion.
    expect(milestones.length).toBeGreaterThan(0)
    expect(milestones.length).toBeLessThanOrEqual(16)
    for (const milestone of milestones) {
      expect(milestone.message).toMatch(/^ok \d+\/\d+ · wf#[0-9a-f]{6} · d\d+$/)
    }
    expect(summaries.at(-1)?.variant).toBe('success')
  })

  it('does not emit further notifications after the run settles', async () => {
    vi.useFakeTimers()
    try {
      const fake = makeFakeClient()
      const pendingRun = runWorkflow(makeOptions('return await subtask("x")', fake, {
        timeoutMs: 60_000,
      }))

      for (let index = 0; index < 20; index += 1) {
        await vi.advanceTimersByTimeAsync(0)
      }
      const envelope = parse(await pendingRun)
      expect(envelope.status).toBe('ok')

      const settledToasts = toastSummaries(fake).length
      const settledUpdates = sessionUpdates(fake).length
      await vi.advanceTimersByTimeAsync(200)

      expect(toastSummaries(fake).length).toBe(settledToasts)
      expect(sessionUpdates(fake).length).toBe(settledUpdates)
    }
    finally {
      vi.useRealTimers()
    }
  })
})
