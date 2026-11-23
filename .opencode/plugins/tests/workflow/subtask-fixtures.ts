import { vi } from 'vitest'

import type { SkillAwareContext, SkillLister, SkillRecord } from '@plugins/workflow/subtask'

// ── subtask harness ──────────────────────────────────────────────
// Setup shared by the subtask suites: a fake SDK client whose session
// methods each test stubs, and a context whose collections are real arrays so an
// assertion reads exactly what production wrote.

export const abortError = (): { name: string, message: string } => ({
  name: 'AbortError',
  message: 'aborted',
})

const messagesOf = (options: { messages?: any }): object =>
  options.messages === undefined ? {} : { messages: options.messages }

export const sessionDefaults = (): object => ({
  create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
  prompt: vi.fn(async () => ({ data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] } })),
  abort: vi.fn(async () => true),
})

export const createClient = (
  options: { create?: any, prompt?: any, abort?: any, messages?: any } = {},
): any => ({
  session: {
    ...sessionDefaults(),
    ...options,
    ...messagesOf(options),
  },
})

export const makeContext = (client: any, partial: Partial<SkillAwareContext> = {}): SkillAwareContext => ({
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

// Rejects with an AbortError when the caller's signal fires, so the timeout and
// parent-abort paths see the same shape the live client produces.
const watchAbort = (signal: AbortSignal | undefined, onAbort: () => void): void => {
  if (signal === undefined) return
  if (signal.aborted) {
    onAbort()
    return
  }
  signal.addEventListener('abort', onAbort, { once: true })
}

export const abortablePrompt = (): any =>
  vi.fn(({ signal }: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      watchAbort(signal, () => reject(abortError()))
    }),
  )

// Resolves (rather than rejects) with the given turn data only once its abort
// signal fires — mirrors the live `session.prompt` bug in which a timed-out or
// aborted turn comes back as an empty success instead of an AbortError.
export const resolveOnAbortPrompt = (data?: unknown): any =>
  vi.fn(({ signal }: { signal?: AbortSignal }) =>
    new Promise((resolve) => {
      watchAbort(signal, () => resolve(data ?? { data: { info: {}, parts: [] } }))
    }),
  )

// ── skill fixtures ───────────────────────────────────────────────

// The workspace root the injected path is relativised against. No skill file
// exists on disk: the native surface is stubbed, which keeps the suite hermetic.
export const workspace = '/workspace/demo-repo'

export const skillList = (records: SkillRecord[]): SkillLister => async () => records

export const demoSkill = (overrides: Partial<SkillRecord> = {}): SkillRecord => ({
  name: 'demo',
  description: 'Demo skill',
  path: `${workspace}/.agents/skills/demo/SKILL.md`,
  content: '---\nname: demo\ndescription: Frontmatter description\n---\nDEMO BODY\n\n---\n\nlater rule\n',
  ...overrides,
})
