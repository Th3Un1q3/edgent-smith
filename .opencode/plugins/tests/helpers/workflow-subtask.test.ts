import { describe, expect, it, vi } from 'vitest'

import {
  BudgetExceededError,
  createSubtask,
  extractOutputText,
  injectSkills,
  resolveParentModel,
} from '@plugins/helpers/workflow-subtask'
import type { SkillLister, SkillRecord } from '@plugins/helpers/workflow-subtask'
import { MAX_LOGS, MAX_LOG_CHARS, MAX_MAX_SUBTASKS_CAP } from '@plugins/helpers/workflow-types'
// Namespace import so a missing MAX_DESCRIPTION_CHARS export fails this test
// cleanly instead of breaking the whole module at link time.
import * as workflowTypes from '@plugins/helpers/workflow-types'
import type { SkillAwareContext } from '@plugins/helpers/workflow-subtask'
import type { SubtaskInput, SubtaskResult, WorkflowSdkClient } from '@plugins/helpers/workflow-types'

// ── helpers ──────────────────────────────────────────────────────

const abortError = (): { name: string, message: string } => ({
  name: 'AbortError',
  message: 'aborted',
})

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })

const createClient = (
  options: { create?: any, prompt?: any, abort?: any, messages?: any } = {},
): any => ({
  session: {
    create: options.create ?? vi.fn(async () => ({ data: { id: 'ses_child' } })),
    prompt: options.prompt ?? vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
    abort: options.abort ?? vi.fn(async () => true),
    ...(options.messages !== undefined && { messages: options.messages }),
  },
})

// Resolves (rather than rejects) with the given turn data only once its abort
// signal fires — mirrors the live `session.prompt` bug in which a timed-out or
// aborted turn comes back as an empty success instead of an AbortError.
const resolveOnAbortPrompt = (data?: unknown): any =>
  vi.fn(({ signal }: { signal?: AbortSignal } = {}) =>
    new Promise((resolve) => {
      const finish = (): void => resolve(data ?? { data: { info: {}, parts: [] } })
      if (signal?.aborted === true) {
        finish()
      }
      else {
        signal?.addEventListener('abort', finish, { once: true })
      }
    }),
  )

const makeContext = (client: any, partial: Partial<SkillAwareContext> = {}): SkillAwareContext => ({
  client,
  parentSessionID: 'ses_parent',
  signal: new AbortController().signal,
  defaultAgent: 'rug-swe',
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

// ── skill fixtures ───────────────────────────────────────────────

// The workspace root the injected path is relativised against. No skill file
// exists on disk: the native surface is stubbed, which keeps the suite hermetic.
const workspace = '/workspace/demo-repo'

const skillList = (records: SkillRecord[]): SkillLister => async () => records

const demoSkill = (overrides: Partial<SkillRecord> = {}): SkillRecord => ({
  name: 'demo',
  description: 'Demo skill',
  path: `${workspace}/.agents/skills/demo/SKILL.md`,
  content: '---\nname: demo\ndescription: Frontmatter description\n---\nDEMO BODY\n\n---\n\nlater rule\n',
  ...overrides,
})

const render = (records: SkillRecord[], skills: string[] = ['demo']): Promise<string> =>
  injectSkills('PROMPT', skills, { directory: workspace, list: skillList(records) })

const skillCases: Array<[string, SkillRecord, string[], string[]]> = [
  [
    'strips the leading frontmatter, keeps the description and the relative path',
    demoSkill(),
    ['description: Demo skill', 'path: .agents/skills/demo/SKILL.md', 'DEMO BODY\n\n---\n\nlater rule\n</skill>'],
    ['name: demo', 'Frontmatter description', workspace],
  ],
  ['falls back to the frontmatter description', demoSkill({ description: undefined }), ['description: Frontmatter description'], []],
  ['omits a missing path', demoSkill({ path: undefined }), ['<skill name="demo">'], ['path:']],
  ['omits a path outside the directory', demoSkill({ path: '/elsewhere/x/SKILL.md' }), [], ['path:', '/elsewhere']],
]

// ── extractOutputText ────────────────────────────────────────────

describe('extractOutputText', () => {
  it('joins only text parts with newlines', () => {
    const data = {
      parts: [
        { type: 'text', text: 'a' },
        { type: 'reasoning', text: 'skip' },
        { type: 'tool', text: 'skip' },
        { type: 'text', text: 'b' },
      ],
    }

    expect(extractOutputText(data)).toBe('a\nb')
  })

  it('tolerates missing parts and non-string text', () => {
    expect(extractOutputText({})).toBe('')
    expect(extractOutputText(undefined)).toBe('')
    expect(extractOutputText({ parts: [{ type: 'text' }] })).toBe('')
  })
})

// ── skills ───────────────────────────────────────────────────────

describe('injectSkills', () => {
  it.each(skillCases)('%s', async (_label, record, present, absent) => {
    const result = await render([record])
    for (const expected of present) {
      expect(result).toContain(expected)
    }
    for (const unexpected of absent) {
      expect(result).not.toContain(unexpected)
    }
  })

  it('preserves the envelope, the element, and the requested order', async () => {
    const records = [
      demoSkill({ name: 'second', content: 'SECOND', path: undefined, description: 'Second skill' }),
      demoSkill({ name: 'first', content: 'FIRST', path: undefined, description: 'First skill' }),
    ]
    const result = await injectSkills('PROMPT', ['first', 'second'], {
      directory: workspace,
      list: skillList(records),
    })

    expect(result).toBe(
      '<task_skills>\n'
      + '<skill name="first">\ndescription: First skill\nFIRST\n</skill>\n'
      + '<skill name="second">\ndescription: Second skill\nSECOND\n</skill>\n'
      + '</task_skills>\n\nPROMPT',
    )
  })

  it('logs a miss for an unknown or invalid name and skips it', async () => {
    const logs: string[] = []
    const result = await injectSkills('PROMPT', ['missing', '../secret'], {
      directory: workspace,
      list: skillList([]),
      log: (message) => { logs.push(String(message)) },
    })
    expect(result).toBe('PROMPT')
    expect(logs).toEqual(['skill not found: missing', 'skill not found: ../secret'])
  })

  it('leaves the prompt unchanged and logs when the native list fails', async () => {
    const logs: string[] = []
    const list: SkillLister = async () => {
      throw new Error('surface down')
    }
    const result = await injectSkills('PROMPT', ['demo'], {
      directory: workspace,
      list,
      log: (message) => { logs.push(String(message)) },
    })
    expect(result).toBe('PROMPT')
    expect(logs).toEqual(['skill list failed: surface down'])
  })

  it('leaves the prompt unchanged when no skills are requested', async () => {
    await expect(injectSkills('PROMPT', undefined, { directory: workspace })).resolves.toBe('PROMPT')
    await expect(injectSkills('PROMPT', [], { directory: workspace })).resolves.toBe('PROMPT')
  })
})

// ── createSubtask ────────────────────────────────────────────────

describe('createSubtask', () => {
  it('creates a child session with the description as title and the parent id', async () => {
    const client = createClient()
    const context = makeContext(client)
    const result = await createSubtask(context)('do work')

    expect(client.session.create).toHaveBeenCalledWith({
      body: { title: 'do work', parentID: 'ses_parent' },
    })
    expect(result.status).toBe('ok')
    expect(result.task_id).toBe('ses_child')
  })

  it('prompts with the default agent and a text part', async () => {
    const client = createClient()

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: 'ses_child' },
      signal: expect.any(AbortSignal),
      body: {
        agent: 'rug-swe',
        parts: [{ type: 'text', text: 'do work' }],
      },
    })
  })

  it('does not send a tools field', async () => {
    const client = createClient()

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body).not.toHaveProperty('tools')
  })

  it('honours the agent override', async () => {
    const client = createClient()

    await createSubtask(makeContext(client))({ prompt: 'do work', description: 'run work', agent: 'custom' })

    expect(client.session.prompt.mock.calls[0][0].body.agent).toBe('custom')
  })

  it('resumes an existing task_id without creating a session', async () => {
    const client = createClient()
    const result = await createSubtask(makeContext(client))({ prompt: 'do work', description: 'run work', task_id: 'ses_existing' })

    expect(client.session.create).not.toHaveBeenCalled()
    expect(client.session.prompt.mock.calls[0][0].path).toEqual({ id: 'ses_existing' })
    expect(result.task_id).toBe('ses_existing')
  })

  it('returns an error result when the turn reports an error', async () => {
    const prompt = vi.fn(async () => ({ data: { info: { error: new Error('boom') }, parts: [] } }))
    const context = makeContext(createClient({ prompt }))
    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('boom')
    expect(context.steps[0]).toMatchObject({ status: 'error', description: 'do work' })
  })

  it('returns an empty result when the turn has only whitespace text', async () => {
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: ' '.repeat(3) }] } }))
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('empty')
    expect(result.outputText).toBe(' '.repeat(3))
  })

  it('times out when the turn exceeds the per-call timeout', async () => {
    const abort = vi.fn(async () => true)
    const client = createClient({ prompt: abortablePrompt(), abort })
    const result = await createSubtask(makeContext(client))({ prompt: 'slow', description: 'slow work', timeout_minutes: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toContain('0.02 minutes')
    expect(result.outputText).toBe('')
    expect(abort).toHaveBeenCalledWith({ path: { id: 'ses_child' } })
  })

  it('applies the 15-minute subtask default when no timeout is given', async () => {
    vi.useFakeTimers()
    try {
      const context = makeContext(createClient({ prompt: abortablePrompt() }))

      const pending = createSubtask(context)({ prompt: 'slow', description: 'slow work' })

      await vi.advanceTimersByTimeAsync(15 * 60_000)
      const result = await pending

      expect(result.status).toBe('timeout')
      expect(result.error).toBe('subtask timed out after 15 minutes')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('aborts when the parent signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const client = createClient({ prompt: abortablePrompt() })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)('do work')

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(result.error).toBe('subtask aborted')
  })

  it('aborts the child session server-side when the parent signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const abort = vi.fn(async () => true)
    const client = createClient({ prompt: abortablePrompt(), abort })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)('do work')

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(abort).toHaveBeenCalledWith({ path: { id: 'ses_child' } })
  })

  it('throws BudgetExceededError when the budget is exhausted and increments on success', async () => {
    const context = makeContext(createClient(), { maxSubtasks: 1 })
    const subtask = createSubtask(context)

    await expect(subtask('one')).resolves.toMatchObject({ status: 'ok' })
    expect(context.budget.used).toBe(1)

    await expect(subtask('two')).rejects.toBeInstanceOf(BudgetExceededError)
    await expect(subtask('two')).rejects.toThrow('workflow subtask budget exceeded (1)')
  })

  it('returns aborted without creating a session when the parent is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = createClient()
    const context = makeContext(client, { signal: controller.signal })
    const result = await createSubtask(context)('do work')

    expect(result).toMatchObject({ status: 'aborted', task_id: '', durationMs: 0 })
    expect(result.error).toBe('workflow already aborted')
    expect(client.session.create).not.toHaveBeenCalled()
    expect(context.steps[0]).toMatchObject({ status: 'aborted' })
  })

  it('records an error step and does not throw for invalid input', async () => {
    const context = makeContext(createClient())
    const result = await createSubtask(context)({ prompt: '' } as unknown as SubtaskInput)

    expect(result.status).toBe('error')
    expect(result.error).toContain('non-empty')
    expect(result).toMatchObject({ durationMs: 0, outputText: '' })
    expect(context.steps[0]).toMatchObject({ status: 'error', task_id: '', description: 'invalid subtask input' })
  })

  it('returns an error result when the session id is missing', async () => {
    const create = vi.fn(async () => ({ data: {} }))
    const result = await createSubtask(makeContext(createClient({ create })))('do work')

    expect(result.status).toBe('error')
    expect(result.task_id).toBe('')
  })

  it('returns an error result when session creation rejects', async () => {
    const create = vi.fn(async () => {
      throw new Error('no session')
    })
    const result = await createSubtask(makeContext(createClient({ create })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('no session')
  })

  it('returns an error result when the prompt rejects', async () => {
    const prompt = vi.fn(async () => {
      throw new Error('network')
    })
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('network')
  })

  it('injects skills into the prompt body', async () => {
    const client = createClient()
    const context = makeContext(client, { directory: workspace, skill: skillList([demoSkill()]) })

    await createSubtask(context)({ prompt: 'PROMPT', description: 'skill work', skills: ['demo'] })

    expect(client.session.prompt.mock.calls[0][0].body.parts[0].text).toBe(
      '<task_skills>\n'
      + '<skill name="demo">\ndescription: Demo skill\npath: .agents/skills/demo/SKILL.md\n'
      + 'DEMO BODY\n\n---\n\nlater rule\n</skill>\n'
      + '</task_skills>\n\nPROMPT',
    )
  })

  it('returns a long output whole without a truncation marker', async () => {
    const long = 'a'.repeat(10_000)
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: long }] } }))
    const subtask = createSubtask(makeContext(createClient({ prompt })))

    const result = await subtask('long')

    expect(result.outputText).toBe(long)
    expect(Object.hasOwn(result, 'truncated')).toBe(false)
  })

  it('runs every subtask in a Promise.all fan-out', async () => {
    const prompt = vi.fn(async ({ signal }: { signal?: AbortSignal } = {}) => {
      await delay(15, signal)
      return { data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }
    })
    const client = createClient({ prompt })
    const context = makeContext(client)
    const subtask = createSubtask(context)

    const results = await Promise.all(Array.from({ length: 8 }, () => subtask('work')))

    expect(results.map(result => result.status)).toEqual(Array.from({ length: 8 }, () => 'ok'))
    expect(client.session.create).toHaveBeenCalledTimes(8)
  })

  it('records steps and caps them at MAX_MAX_SUBTASKS_CAP', async () => {
    const context = makeContext(createClient(), { maxSubtasks: 100 })
    const subtask = createSubtask(context)

    const results = await Promise.all(
      Array.from({ length: MAX_MAX_SUBTASKS_CAP + 1 }, (_value, index) => subtask(`task ${index}`)),
    )

    expect(results.map(result => result.status)).toEqual(
      Array.from({ length: MAX_MAX_SUBTASKS_CAP + 1 }, () => 'ok'),
    )
    expect(context.steps).toHaveLength(MAX_MAX_SUBTASKS_CAP)
    expect(context.steps[0]).toMatchObject({
      description: 'task 0',
      status: 'ok',
    })
  })
})

// ── createSubtask: parent model inheritance ──────────────────────

describe('createSubtask parent model inheritance', () => {
  const modelCases: Array<[string, Array<{ info: Record<string, unknown> }>, { providerID: string, modelID: string }]> = [
    ['the last assistant message', [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }], { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' }],
    ['the user-message info.model shape', [{ info: { role: 'user', model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } } }], { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' }],
    ['entries without a model, scanning from the end', [{ info: { providerID: 'first', modelID: 'old' } }, { info: { role: 'assistant' } }], { providerID: 'first', modelID: 'old' }],
    ['the last message over earlier ones', [{ info: { providerID: 'first', modelID: 'old' } }, { info: { providerID: 'last', modelID: 'new' } }], { providerID: 'last', modelID: 'new' }],
  ]

  it.each(modelCases)('inherits the model from %s', async (_label, entries, expected) => {
    const messages = vi.fn(async () => ({ data: entries }))
    const client = createClient({ messages })

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual(expected)
  })

  it('resolves the parent model at most once across subtasks', async () => {
    const messages = vi.fn(async () => ({
      data: [{ info: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
    }))
    const context = makeContext(createClient({ messages }))
    const subtask = createSubtask(context)

    await Promise.all([subtask('a'), subtask('b'), subtask('c')])

    expect(messages).toHaveBeenCalledTimes(1)
    expect(messages).toHaveBeenCalledWith({ path: { id: 'ses_parent' } })
  })

  it('proceeds without a model and warns when messages is unavailable', async () => {
    const client = createClient()
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('proceeds without a model and warns when messages rejects', async () => {
    const messages = vi.fn(async () => {
      throw new Error('no history')
    })
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('proceeds without a model when no message carries one', async () => {
    const messages = vi.fn(async () => ({ data: [{ info: { role: 'assistant' } }] }))
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('resolveParentModel returns undefined when messages is missing', async () => {
    await expect(resolveParentModel(createClient(), 'ses_parent')).resolves.toBeUndefined()
  })

  // Regression: the generated SDK methods rely on `this._client`, so a detached
  // `const messages = client.session.messages` throws on every call and silently
  // disables model inheritance. This mock is receiver-sensitive and only resolves
  // when `this` is still the session object.
  it('preserves the session receiver while resolving the parent model', async () => {
    const prompt = vi.fn(async (_input: { body: { model?: unknown } }) => ({
      data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] },
    }))
    const session = {
      create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
      prompt,
      abort: vi.fn(async () => true),
      async messages(this: { __client?: unknown } | undefined) {
        if (this === undefined || this.__client === undefined) {
          throw new TypeError('undefined is not an object (evaluating \'this._client\')')
        }
        return {
          data: [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
        }
      },
    }
    let receiverAccesses = 0
    Object.defineProperty(session, '__client', {
      get() {
        receiverAccesses += 1
        return {}
      },
    })
    const client = { session } as unknown as WorkflowSdkClient
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
    })
    expect(receiverAccesses).toBeGreaterThan(0)
    expect(context.logs.some(line => line.includes('failed to resolve parent model'))).toBe(false)
  })
})

// ── createSubtask: resolved-turn classification ──────────────────

describe('createSubtask resolved-turn classification', () => {
  it('classifies a timeout when the prompt resolves empty after the abort fires', async () => {
    const client = createClient({ prompt: resolveOnAbortPrompt() })
    const context = makeContext(client)

    const result = await createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_minutes: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('subtask timed out after 0.02 minutes')
    expect(context.steps[0]).toMatchObject({ status: 'timeout', error: 'subtask timed out after 0.02 minutes' })
  })

  it('classifies a timeout ahead of an info error when both are present', async () => {
    const client = createClient({
      prompt: resolveOnAbortPrompt({ data: { info: { error: new Error('boom') }, parts: [] } }),
    })
    const context = makeContext(client)

    const result = await createSubtask(context)({ prompt: 'slow', description: 'slow work', timeout_minutes: 0.02 })

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('subtask timed out after 0.02 minutes')
    expect(context.steps[0]).toMatchObject({ status: 'timeout' })
  })

  it('classifies an abort when the parent aborts and the prompt resolves empty', async () => {
    const controller = new AbortController()
    const client = createClient({ prompt: resolveOnAbortPrompt() })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)({ prompt: 'work', description: 'run work', timeout_minutes: 60 })

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(result.error).toBe('subtask aborted')
    expect(context.steps[0]).toMatchObject({ status: 'aborted' })
  })

  it('reports empty only when the turn is neither timed out nor aborted', async () => {
    const prompt = vi.fn(async () => ({ data: { info: {}, parts: [] } }))
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('empty')
    expect(result.error).toBe('subtask produced no output')
  })
})

// ── createSubtask: error normalization, logging, and options ─────

describe('createSubtask error normalization and options', () => {
  it.each([
    ['a thrown string', 'raw', 'raw'],
    ['a thrown object', { code: 7 }, '{"code":7}'],
  ])('renders %s into the failure message', async (_label, thrown, expected) => {
    const prompt = vi.fn().mockRejectedValue(thrown)
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe(expected)
  })

  it('falls back to String() when the thrown error cannot be serialized', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const prompt = vi.fn().mockRejectedValue(circular)
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('error')
    expect(result.error).toBe('[object Object]')
  })

  it('classifies a thrown AbortError by name as aborted', async () => {
    const prompt = vi.fn().mockRejectedValue(abortError())
    const result = await createSubtask(makeContext(createClient({ prompt })))('do work')

    expect(result.status).toBe('aborted')
    expect(result.error).toBe('subtask aborted')
  })

  it('creates a session when task_id is an empty string', async () => {
    const client = createClient()
    const result = await createSubtask(makeContext(client))({ prompt: 'do work', description: 'run work', task_id: '' })

    expect(client.session.create).toHaveBeenCalledTimes(1)
    expect(result.task_id).toBe('ses_child')
  })

  it('uses the description as the step description and records it on the step', async () => {
    const context = makeContext(createClient())
    await createSubtask(context)({ prompt: 'do work', description: 'short label' })

    expect(context.steps[0]).toMatchObject({ description: 'short label' })
  })

  it('rejects an object subtask without a description and records an error step', async () => {
    const client = createClient()
    const context = makeContext(client)
    const result = await createSubtask(context)({ prompt: 'do work' } as SubtaskInput)

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/description/)
    expect(client.session.create).not.toHaveBeenCalled()
    expect(context.steps[0]).toMatchObject({ status: 'error', task_id: '' })
  })

  it('rejects an object subtask with a whitespace-only description', async () => {
    const context = makeContext(createClient())
    const result = await createSubtask(context)({ prompt: 'do work', description: ' '.repeat(3) })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/description/)
    expect(context.steps[0]).toMatchObject({ status: 'error' })
  })

  it('truncates a long description onto the step to MAX_DESCRIPTION_CHARS', async () => {
    const context = makeContext(createClient())
    const description = 'd'.repeat(100)
    await createSubtask(context)({ prompt: 'do work', description })

    expect(context.steps[0].description).toHaveLength(workflowTypes.MAX_DESCRIPTION_CHARS)
    expect(context.steps[0].description).toBe(description.slice(0, workflowTypes.MAX_DESCRIPTION_CHARS))
  })

  it('derives the step description from a string shorthand', async () => {
    const context = makeContext(createClient())
    await createSubtask(context)('do work')

    expect(context.steps[0]).toMatchObject({ description: 'do work' })
  })

  it('JSON-stringifies and truncates long logs with a shared marker', async () => {
    const long = 'x'.repeat(MAX_LOG_CHARS + 500)
    const messages = vi.fn(() => Promise.reject(new Error(long)))
    const context = makeContext(createClient({ messages }))

    await createSubtask(context)('do work')

    expect(context.logs.length).toBeGreaterThan(0)
    expect(context.logs.every(line => line.length <= MAX_LOG_CHARS + '…[truncated]'.length)).toBe(true)
    expect(context.logs.some(line => line.includes('"failed to resolve parent model'))).toBe(true)
  })

  it('caps recorded logs at MAX_LOGS', async () => {
    const skills = Array.from({ length: MAX_LOGS + 5 }, (_value, index) => `missing-${index}`)
    const context = makeContext(createClient(), { directory: workspace, skill: skillList([]) })

    await createSubtask(context)({ prompt: 'P', description: 'skill work', skills })

    expect(context.logs).toHaveLength(MAX_LOGS)
  })

  it('reads the nested model shape and tolerates an empty response', async () => {
    const empty = vi.fn(async () => {})
    await expect(resolveParentModel(createClient({ messages: empty }), 'ses_parent')).resolves.toBeUndefined()

    const nested = vi.fn(async () => ({
      data: [{ info: { model: { providerID: 'p', modelID: 'm' } } }],
    }))
    await expect(resolveParentModel(createClient({ messages: nested }), 'ses_parent')).resolves.toEqual({
      providerID: 'p',
      modelID: 'm',
    })
  })

  it('swallows errors from the server-side abort', async () => {
    const controller = new AbortController()
    const abort = vi.fn(() => {
      throw new Error('abort failed')
    })
    const client = createClient({ prompt: abortablePrompt(), abort })
    const context = makeContext(client, { signal: controller.signal })
    const pending = createSubtask(context)('do work')

    controller.abort()
    const result = await pending

    expect(result.status).toBe('aborted')
    expect(abort).toHaveBeenCalled()
  })
})

describe('createSubtask duration, cleanup, and bookkeeping', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const runAt = async (advanceMs: number): Promise<SubtaskResult> => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1_700_000_000_000))
    const prompt = vi.fn(async () => {
      vi.setSystemTime(new Date(1_700_000_000_000 + advanceMs))
      return { data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } }
    })
    return createSubtask(makeContext(createClient({ prompt })))('do work')
  }

  it.each([1500, 0])('reports durationMs %i from the clock delta', async (advanceMs) => {
    const result = await runAt(advanceMs)

    expect(result).toMatchObject({ status: 'ok', durationMs: advanceMs })
  })

  it('clears the timer and the parent listener once the attempt settles', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const abort = vi.fn(async () => true)
    const result = await createSubtask(makeContext(createClient({ abort }), { signal: controller.signal }))({
      prompt: 'work',
      description: 'run work',
      timeout_minutes: 1,
    })

    controller.abort()
    await vi.advanceTimersByTimeAsync(2 * 60_000)

    expect(result.status).toBe('ok')
    expect(abort).not.toHaveBeenCalled()
  })

  it('backfills startedAt from the clock at creation time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1_700_000_000_000))
    const context = makeContext(createClient())

    createSubtask(context)

    expect(context.startedAt).toBe(1_700_000_000_000)
  })

  it('rethrows a BudgetExceededError raised mid-attempt without recording a step', async () => {
    const prompt = vi.fn(async () => {
      throw new BudgetExceededError('child budget exceeded')
    })
    const context = makeContext(createClient({ prompt }))

    await expect(createSubtask(context)('do work')).rejects.toBeInstanceOf(BudgetExceededError)
    await expect(createSubtask(context)('do work')).rejects.toThrow('child budget exceeded')
    expect(context.steps).toHaveLength(0)
  })
})
