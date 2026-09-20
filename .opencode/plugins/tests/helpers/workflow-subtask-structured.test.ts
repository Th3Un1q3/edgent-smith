import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSubtask, parseStructured } from '@plugins/helpers/workflow-subtask'
import { MAX_STEP_OUTPUT_CHARS } from '@plugins/helpers/workflow-types'
import type { SubtaskInput, SubtaskResult, WorkflowContext } from '@plugins/helpers/workflow-types'

// ── helpers ──────────────────────────────────────────────────────

const abortError = (): { name: string, message: string } => ({ name: 'AbortError', message: 'aborted' })

const text = (value: string): any => ({ data: { info: {}, parts: [{ type: 'text', text: value }] } })

const createClient = (options: { prompt?: any } = {}): any => ({
  session: {
    create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: options.prompt ?? vi.fn(async () => text('OUT')),
    abort: vi.fn(async () => true),
  },
})

const makeContext = (client: any, partial: Partial<WorkflowContext> = {}): WorkflowContext => ({
  client,
  parentSessionID: 'ses_parent',
  signal: new AbortController().signal,
  defaultAgent: 'rug-swe',
  maxConcurrent: 4,
  maxSubtasks: 32,
  budget: { used: 0 },
  steps: [],
  logs: [],
  active: new Set(),
  ...partial,
})

const abortablePrompt = (): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((_resolve, reject) => {
      const onAbort = (): void => reject(abortError())
      if (signal?.aborted === true) {
        onAbort()
      }
      else {
        signal?.addEventListener('abort', onAbort, { once: true })
      }
    }),
  )

// Resolves with the turn data when the abort signal fires — mirrors the live SDK
// bug where a cancelled turn resolves instead of rejecting.
const resolveOnAbortPrompt = (data: any): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((resolve) => {
      const finish = (): void => resolve(data)
      if (signal?.aborted === true) {
        finish()
      }
      else {
        signal?.addEventListener('abort', finish, { once: true })
      }
    }),
  )

const structured = (
  prompt: any,
  parameters: Record<string, unknown>,
  context: WorkflowContext = makeContext(createClient({ prompt })),
): Promise<SubtaskResult> =>
  createSubtask(context)({ prompt: 'emit', description: 'emit structured', ...parameters } as SubtaskInput)

// ── parseStructured ──────────────────────────────────────────────

describe('parseStructured', () => {
  interface ParseCase {
    name: string
    body: string
    schema: Record<string, unknown>
    expected: { usable: boolean, value?: unknown }
  }

  const cases: ParseCase[] = [
    // whole-text fallback when no <result_json> block is present (backward compat)
    { name: 'parses pure JSON with no tags', body: '{"a":1}', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'parses a ```json fence with no tags', body: '```json\n{"a":1}\n```', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'parses a bare ``` fence with no tags', body: '```\n{"a":1}\n```', schema: {}, expected: { usable: true, value: { a: 1 } } },
    // tag extraction
    { name: 'parses a tag-only result', body: '<result_json>{"a":1}</result_json>', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'parses prose surrounding one tagged result', body: 'Here is the answer:\n<result_json>{"a":1}</result_json>\nDone.', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'keeps trailing prose after the close tag', body: '<result_json>{"a":1}</result_json>\n\nAll done.', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'unwraps a code fence inside the tag body', body: '<result_json>\n```json\n{"a":1}\n```\n</result_json>', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'uses the last opening when two tagged blocks are valid', body: '<result_json>{"a":1}</result_json>\n<result_json>{"a":2}</result_json>', schema: {}, expected: { usable: true, value: { a: 2 } } },
    { name: 'falls back to an earlier opening when the last block is not JSON', body: '<result_json>{"a":1}</result_json>\n<result_json>not json</result_json>', schema: {}, expected: { usable: true, value: { a: 1 } } },
    { name: 'recovers a JSON string containing a literal close tag', body: '<result_json>{"a":"</result_json>"}</result_json>', schema: {}, expected: { usable: true, value: { a: '</result_json>' } } },
    // unusable
    { name: 'rejects non-JSON text with no tags', body: 'nope', schema: {}, expected: { usable: false } },
    { name: 'rejects empty text', body: '', schema: {}, expected: { usable: false } },
    { name: 'rejects an unclosed opening tag', body: '<result_json>{"a":1}', schema: {}, expected: { usable: false } },
    { name: 'ignores a tag-looking prose example whose body is not JSON', body: 'Example: <result_json>not json</result_json>', schema: {}, expected: { usable: false } },
    // required-key validation
    { name: 'accepts a tagged object with every required key', body: '<result_json>{"a":1,"b":2}</result_json>', schema: { required: ['a', 'b'] }, expected: { usable: true, value: { a: 1, b: 2 } } },
    { name: 'rejects a tagged object missing a required key', body: '<result_json>{"a":1}</result_json>', schema: { required: ['a', 'b'] }, expected: { usable: false } },
    { name: 'rejects a non-object tagged value when keys are required', body: '<result_json>5</result_json>', schema: { required: ['a'] }, expected: { usable: false } },
    { name: 'accepts any tagged JSON when required is absent', body: '<result_json>5</result_json>', schema: {}, expected: { usable: true, value: 5 } },
    { name: 'accepts any tagged JSON when required is empty', body: '<result_json>5</result_json>', schema: { required: [] }, expected: { usable: true, value: 5 } },
    { name: 'accepts any tagged JSON when required has non-string entries', body: '<result_json>5</result_json>', schema: { required: [1] }, expected: { usable: true, value: 5 } },
    { name: 'accepts any tagged JSON when required is not an array', body: '<result_json>5</result_json>', schema: { required: 'a' }, expected: { usable: true, value: 5 } },
  ]

  it.each(cases)('$name', ({ body, schema, expected }) => {
    expect(parseStructured(body, schema)).toEqual(expected)
  })
})

// ── createSubtask: structured output ─────────────────────────────

const SCHEMA = { type: 'object', required: ['answer'] }
const SCHEMA_BLOCK = '{"type":"object","required":["answer"]}'

describe('createSubtask structured output', () => {
  let prompt: ReturnType<typeof vi.fn>
  let context: WorkflowContext

  beforeEach(() => {
    prompt = vi.fn(async () => text('OUT'))
    context = makeContext(createClient({ prompt }))
  })

  const run = (parameters: Record<string, unknown> = {}): Promise<SubtaskResult> =>
    createSubtask(context)({ prompt: 'emit', description: 'emit structured', ...parameters } as SubtaskInput)

  const cases: Array<{ name: string, body: string, data: unknown, status: string, calls: number }> = [
    { name: 'a tagged JSON result', body: '<result_json>{"answer":42}</result_json>', data: { answer: 42 }, status: 'ok', calls: 1 },
    { name: 'prose mixed with a tagged result', body: 'Analysis first.\n<result_json>{"answer":7}</result_json>', data: { answer: 7 }, status: 'ok', calls: 1 },
    { name: 'a plain JSON fallback without tags', body: '{"answer":42}', data: { answer: 42 }, status: 'ok', calls: 1 },
    { name: 'a fenced JSON fallback without tags', body: '```json\n{"answer":1}\n```', data: { answer: 1 }, status: 'ok', calls: 1 },
    { name: 'an unclosed tag', body: '<result_json>{"answer":1}', data: undefined, status: 'error', calls: 2 },
    { name: 'invalid JSON', body: 'not json', data: undefined, status: 'error', calls: 2 },
    { name: 'empty text', body: ' '.repeat(3), data: undefined, status: 'empty', calls: 1 },
  ]

  it.each(cases)('handles $name with the expected data and prompt count', async ({ body, data, status, calls }) => {
    prompt.mockResolvedValue(text(body))
    const result = await run({ schema: { type: 'object' } })

    expect(result.status).toBe(status)
    expect(result.data).toEqual(data)
    expect(prompt).toHaveBeenCalledTimes(calls)
  })

  it('injects the tagged contract and retries once on the same session when a required key is missing', async () => {
    prompt.mockResolvedValueOnce(text('{"other":1}')).mockResolvedValueOnce(text('<result_json>{"answer":1}</result_json>'))
    const result = await run({ schema: SCHEMA })

    expect(result).toMatchObject({ status: 'ok', data: { answer: 1 } })
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(prompt.mock.calls.map(call => call[0].path)).toEqual([{ id: 'ses_child' }, { id: 'ses_child' }])

    const firstPrompt = prompt.mock.calls[0][0].body.parts[0].text
    expect(firstPrompt).toContain('emit')
    expect(firstPrompt).toContain('<result_json>')
    expect(firstPrompt).toContain('</result_json>')
    expect(firstPrompt).toContain('exactly one')
    expect(firstPrompt).toContain('MAY include free-form prose')
    expect(firstPrompt).toContain('no markdown fence')
    expect(firstPrompt).toContain(SCHEMA_BLOCK)

    const retryPrompt = prompt.mock.calls[1][0].body.parts[0].text
    expect(retryPrompt).toContain('did not contain a usable <result_json>')
    expect(retryPrompt).toContain('markdown fence')
    expect(retryPrompt).toContain(SCHEMA_BLOCK)
  })

  it('keeps prose in outputText while returning the tagged data', async () => {
    const body = 'Here is my analysis.\n\n<result_json>{"answer":42}</result_json>\n\nThanks.'
    prompt.mockResolvedValue(text(body))
    const result = await run({ schema: SCHEMA })

    expect(result).toMatchObject({ status: 'ok', data: { answer: 42 } })
    expect(result.outputText).toBe(body)
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('retries a prose-only reply with the tagged contract on the same task_id', async () => {
    prompt.mockResolvedValueOnce(text('Only prose, no JSON.')).mockResolvedValueOnce(text('<result_json>{"answer":1}</result_json>'))
    const result = await run({ task_id: 'ses_fixed', schema: SCHEMA })

    expect(result).toMatchObject({ status: 'ok', data: { answer: 1 }, task_id: 'ses_fixed' })
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(prompt.mock.calls.map(call => call[0].path)).toEqual([{ id: 'ses_fixed' }, { id: 'ses_fixed' }])
  })

  it('does not retry when the first turn reports an error', async () => {
    prompt.mockResolvedValue({ data: { info: { error: new Error('boom') }, parts: [{ type: 'text', text: 'oops' }] } })
    const result = await run({ schema: { type: 'object' } })

    expect(result).toMatchObject({ status: 'error', error: 'boom' })
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('errors with the schema message after two unusable turns and keeps outputText', async () => {
    const body = 'Prose only.\n<result_json>not json</result_json>'
    prompt.mockResolvedValue(text(body))
    const result = await run({ schema: { type: 'object' } })

    expect(result).toMatchObject({
      status: 'error',
      error: 'subtask did not return valid JSON matching the schema',
      outputText: body,
    })
    expect(prompt).toHaveBeenCalledTimes(2)
  })

  it.each([[], 'nope', null])('rejects an invalid schema (%s)', async (schema) => {
    const result = await createSubtask(context)({ prompt: 'emit', description: 'emit structured', schema } as unknown as SubtaskInput)

    expect(result).toMatchObject({ status: 'error', error: 'schema must be a JSON-serializable object' })
    expect(context.steps[0]).toMatchObject({ status: 'error', task_id: '' })
  })

  it('leaves the result shape unchanged and skips the contract without a schema', async () => {
    prompt.mockResolvedValue(text('OUT'))
    const result = await createSubtask(context)('do work')

    expect(result).toMatchObject({ status: 'ok', outputText: 'OUT' })
    expect(Object.hasOwn(result, 'data')).toBe(false)
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(prompt.mock.calls[0][0].body.parts[0].text).toBe('do work')
    expect(prompt.mock.calls[0][0].body.parts[0].text).not.toContain('<result_json>')
  })

  it('keeps the result object keys unchanged', async () => {
    prompt.mockResolvedValue(text('<result_json>{"answer":1}</result_json>'))
    const result = await run({ schema: SCHEMA })

    expect(Object.keys(result).sort((a, b) => a.localeCompare(b))).toEqual(
      ['data', 'durationMs', 'error', 'outputText', 'status', 'task_id', 'truncated'].sort((a, b) => a.localeCompare(b)),
    )
  })

  it('carries a description truncated onto the structured step record', async () => {
    const description = 's'.repeat(100)
    prompt.mockResolvedValue(text('<result_json>{"answer":1}</result_json>'))
    await run({ description, schema: SCHEMA })

    expect(context.steps[0].description).toBe(description.slice(0, 80))
  })

  it('retries on the provided task_id session without creating one', async () => {
    prompt.mockResolvedValueOnce(text('bad')).mockResolvedValueOnce(text('<result_json>{"answer":1}</result_json>'))
    const result = await run({ task_id: 'ses_existing', schema: SCHEMA })

    expect(context.client.session.create).not.toHaveBeenCalled()
    expect(prompt.mock.calls[1][0].path).toEqual({ id: 'ses_existing' })
    expect(result).toMatchObject({ task_id: 'ses_existing', data: { answer: 1 } })
  })

  it('times out without a retry when the turn resolves unusable after the abort fires', async () => {
    const hanging = resolveOnAbortPrompt(text('bad'))
    const result = await structured(hanging, { schema: { type: 'object' }, timeout_ms: 20 })

    expect(result).toMatchObject({ status: 'timeout', error: 'subtask timed out after 20ms' })
    expect(hanging).toHaveBeenCalledTimes(1)
  })

  it('aborts without a retry when the parent aborts and the turn resolves unusable', async () => {
    const controller = new AbortController()
    const hanging = resolveOnAbortPrompt(text('bad'))
    const pending = structured(
      hanging,
      { schema: { type: 'object' } },
      makeContext(createClient({ prompt: hanging }), { signal: controller.signal }),
    )

    controller.abort()
    const result = await pending

    expect(result).toMatchObject({ status: 'aborted', error: 'subtask aborted' })
    expect(hanging).toHaveBeenCalledTimes(1)
  })

  it('times out a hanging structured turn without a retry', async () => {
    const hanging = abortablePrompt()
    const result = await structured(hanging, { schema: { type: 'object' }, timeout_ms: 20 })

    expect(result).toMatchObject({ status: 'timeout', error: 'subtask timed out after 20ms' })
    expect(hanging).toHaveBeenCalledTimes(1)
  })

  it('truncates outputText while keeping the parsed tagged data intact', async () => {
    const answer = 'a'.repeat(MAX_STEP_OUTPUT_CHARS + 10)
    prompt.mockResolvedValue(text(`<result_json>${JSON.stringify({ answer })}</result_json>`))
    const result = await run({ schema: { type: 'object', required: ['answer'] } })

    expect(result.data).toEqual({ answer })
    expect(result.truncated).toBe(true)
    expect(result.outputText).toContain('…[truncated')
  })
})
