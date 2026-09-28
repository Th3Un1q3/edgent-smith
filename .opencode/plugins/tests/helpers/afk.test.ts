// Tests for the AFK denial hint table and generic message — see plugins/helpers/afk.ts
import { describe, it, expect } from 'vitest'

import { AFK_HINTS, AFK_MESSAGE, buildAfkMessage } from '@plugins/helpers/afk'

import type { AfkHintId } from '@plugins/helpers/afk'

interface HintCase {
  permission?: string
  patterns: string[]
  /**
  Expected hint id, or `undefined` when only the generic message applies.
  */
  expected: AfkHintId | undefined
}

/**
 * Behavior rows only — no id list is pinned here. Adding a restriction is one
 * `AFK_HINTS` row in the source plus one row below whose `expected` names the
 * new id; the coverage test fails if the table and this list drift apart.
 */
const HINT_CASES: HintCase[] = [
  // git
  { permission: 'bash', patterns: ['git status'], expected: 'git' },
  { permission: 'bash', patterns: ['git commit -m x'], expected: 'git' },
  { permission: 'bash', patterns: ['FOO=1 git status'], expected: 'git' },
  { permission: 'bash', patterns: ['FOO=1 git commit -m x'], expected: 'git' },
  { permission: 'bash', patterns: ['sudo git commit'], expected: 'git' },
  { permission: 'bash', patterns: ['command git status'], expected: 'git' },
  { permission: 'bash', patterns: ['sudo git status'], expected: 'git' },
  { permission: 'bash', patterns: ['env FOO=1 git status'], expected: 'git' },
  { permission: 'bash', patterns: ['sudo git -C /w status'], expected: 'git' },
  { permission: 'bash', patterns: ['rtk sudo git commit'], expected: 'git' },
  { permission: 'bash', patterns: ['bash -c "git push"'], expected: 'git' },
  { permission: 'bash', patterns: ['bash -c "git status"'], expected: 'git' },
  { permission: 'bash', patterns: ['echo `git push`'], expected: 'git' },
  { permission: 'bash', patterns: ['echo $(git push)'], expected: 'git' },
  { permission: 'bash', patterns: ['git log --grep="a && b"'], expected: 'git' },
  { permission: 'bash', patterns: ['git log --grep="a | b"'], expected: 'git' },
  { permission: 'bash', patterns: ['git log --grep="a;b"'], expected: 'git' },
  { permission: 'bash', patterns: ['git log --pretty="%H | %s"'], expected: 'git' },
  { permission: 'bash', patterns: ['git --version'], expected: 'git' },
  // fetch
  { permission: 'bash', patterns: ['curl https://example.com'], expected: 'fetch' },
  { permission: 'bash', patterns: ['curl x && echo ok'], expected: 'fetch' },
  { permission: 'webfetch', patterns: [], expected: 'fetch' },
  { permission: 'webfetch', patterns: [''], expected: 'fetch' },
  // runner
  { permission: 'bash', patterns: ['vitest run'], expected: 'runner' },
  { permission: 'bash', patterns: ['bun test'], expected: 'runner' },
  { permission: 'bash', patterns: ['tsc --noEmit'], expected: 'runner' },
  { permission: 'bash', patterns: ['pytest tests/'], expected: 'runner' },
  { permission: 'bash', patterns: ['npx vitest run'], expected: 'runner' },
  { permission: 'bash', patterns: ['python -m pytest'], expected: 'runner' },
  { permission: 'bash', patterns: ['python3 -m pytest'], expected: 'runner' },
  { permission: 'bash', patterns: ['uv run pytest'], expected: 'runner' },
  { permission: 'bash', patterns: ['uv run --group dev vitest'], expected: 'runner' },
  { permission: 'bash', patterns: ['FOO=1 vitest run'], expected: 'runner' },
  { permission: 'bash', patterns: ['sudo vitest run'], expected: 'runner' },
  { permission: 'bash', patterns: ['vitest run && echo ok'], expected: 'runner' },
  // compound
  { permission: 'bash', patterns: ['ls -la && echo ok'], expected: 'compound' },
  { permission: 'bash', patterns: ['cat <<EOF'], expected: 'compound' },
  { permission: 'bash', patterns: ['ls | wc -l'], expected: 'compound' },
  { permission: 'bash', patterns: ['echo a; echo b'], expected: 'compound' },
  // generic — nothing in the table matches
  { permission: 'bash', patterns: ['ls -la'], expected: undefined },
  { permission: 'bash', patterns: ['echo vitest'], expected: undefined },
  { permission: 'bash', patterns: [], expected: undefined },
  { permission: 'list_mcp_resources', patterns: [], expected: undefined },
]

const STEERING_WRAPPER = /^<steering priority="warning" reason="user is away from keyboard - permission auto-denied by afk-enforcer plugin" type="instructions">[\s\S]*<\/steering>$/

const CORE_BOUNDARY = [
  'this action is denied and final as-is',
  'Do not retry this command as-is',
  'never reproduce the denied effect through any other tool, wrapper, subprocess, or indirect invocation',
  'Continue the rest of the task with permitted actions',
  'If the action is essential, stop and tell the user what you need',
]

const build = ({ permission, patterns }: HintCase): string =>
  buildAfkMessage(permission ?? 'bash', patterns)

const hintOf = (id: AfkHintId): string => {
  const entry = AFK_HINTS.find(hint => hint.id === id)
  if (entry === undefined) throw new Error(`unknown hint id: ${id}`)
  return entry.hint
}

const casesExpecting = (id: AfkHintId): HintCase[] =>
  HINT_CASES.filter(hintCase => hintCase.expected === id)

const casesNotExpecting = (id: AfkHintId): HintCase[] =>
  HINT_CASES.filter(hintCase => hintCase.expected !== id)

const POLICY_POINTER = '.opencode/instructions/no-permission-workarounds.instructions.md'
const RUNNER_POINTER = '.opencode/instructions/test-run-commands.instructions.md'
const FETCH_POINTER = 'context-gathering'

describe('AFK_HINTS', () => {
  it('covers every table entry with at least one matching case', () => {
    for (const entry of AFK_HINTS) {
      expect(casesExpecting(entry.id).length).toBeGreaterThan(0)
    }
  })

  it('only expects ids that exist in the table', () => {
    const known = new Set(AFK_HINTS.map(entry => entry.id))
    const declared = HINT_CASES.flatMap(hintCase =>
      (hintCase.expected === undefined ? [] : hintCase.expected),
    )
    expect(declared.every(id => known.has(id))).toBe(true)
  })

  it.each(AFK_HINTS)('$id matches every case that expects it', (entry) => {
    for (const hintCase of casesExpecting(entry.id)) {
      expect(build(hintCase)).toContain(entry.hint)
    }
  })

  it.each(AFK_HINTS)('$id omits its hint from every other case', (entry) => {
    for (const hintCase of casesNotExpecting(entry.id)) {
      expect(build(hintCase)).not.toContain(entry.hint)
    }
  })
})

describe('buildAfkMessage', () => {
  it('renders only the generic message when no hint matches', () => {
    expect(buildAfkMessage('list_mcp_resources', [])).toBe(AFK_MESSAGE)
    expect(buildAfkMessage('bash', ['ls -la'])).toBe(AFK_MESSAGE)
    expect(buildAfkMessage('bash', [])).toBe(AFK_MESSAGE)
  })

  it('wraps the built message in the steering element', () => {
    expect(buildAfkMessage('bash', ['git status'])).toMatch(STEERING_WRAPPER)
  })

  it('resolves a hint from any pattern, not just the first', () => {
    expect(buildAfkMessage('bash', ['ls -la', 'git status'])).toContain(hintOf('git'))
    expect(buildAfkMessage('bash', ['ls -la', 'curl x'])).toContain(hintOf('fetch'))
    expect(buildAfkMessage('bash', ['ls -la', 'ls -la && echo ok'])).toContain(hintOf('compound'))
  })

  it('prefers table precedence over pattern order', () => {
    // `curl` is the first pattern, but `git` precedes `fetch` in AFK_HINTS.
    expect(buildAfkMessage('bash', ['curl x', 'git status'])).toContain(hintOf('git'))
  })

  it('treats missing or empty patterns as the generic case', () => {
    expect(buildAfkMessage('bash')).toBe(AFK_MESSAGE)
    expect(buildAfkMessage('bash', [])).toBe(AFK_MESSAGE)
    expect(buildAfkMessage('bash', [''])).toBe(AFK_MESSAGE)
  })

  it.each(HINT_CASES)('always carries the core boundary text for $patterns', (hintCase) => {
    const message = build(hintCase)
    for (const phrase of CORE_BOUNDARY) {
      expect(message).toContain(phrase)
    }
  })

  it.each(HINT_CASES)('never ships unsanctioned recipes for $patterns', (hintCase) => {
    const message = build(hintCase)
    expect(message).not.toContain('urllib')
    expect(message).not.toContain('subprocess.run')
    expect(message).not.toContain('python3 -c')
    expect(message).not.toContain('pkill')
    expect(message).not.toContain('alternative tools')
    expect(message).not.toContain('Common failure modes')
  })
})

/**
 * Mechanics and enumerated forms owned by the policy/runner instructions and
 * the context-gathering skill. A hint may name its owner and give a minimal
 * direction, but must never restate these — that would duplicate the policy.
 */
const ENUMERATED_LEAKS = [
  'git status',
  'git diff',
  'git show',
  'git ls',
  'git log',
  'no -C',
  'workdir',
  'pipes',
  '&&',
  'heredoc',
  'just test',
  'just lint',
  'just typecheck',
  '`just` targets',
  'one simple, canonical command per tool call',
]

describe('hint ownership boundaries', () => {
  it('git hint points at the policy owner without enumerating read forms or mechanics', () => {
    const hint = hintOf('git')
    expect(hint).toContain('canonical read form')
    expect(hint).toContain(POLICY_POINTER)
    for (const leaked of ENUMERATED_LEAKS) {
      expect(hint).not.toContain(leaked)
    }
  })

  it('fetch hint points to the context-gathering skill on a single line', () => {
    const hint = hintOf('fetch')
    expect(hint).toContain(FETCH_POINTER)
    expect(hint).toContain('MCP fetch server')
    expect(hint).not.toContain('\n')
  })

  it('runner hint points at the runner policy without enumerating just targets', () => {
    const hint = hintOf('runner')
    expect(hint).toContain('repository entrypoints')
    expect(hint).toContain(RUNNER_POINTER)
    for (const leaked of ENUMERATED_LEAKS) {
      expect(hint).not.toContain(leaked)
    }
  })

  it('compound hint points at the policy owner without restating the one-command rule', () => {
    const hint = hintOf('compound')
    expect(hint).toContain(POLICY_POINTER)
    for (const leaked of ENUMERATED_LEAKS) {
      expect(hint).not.toContain(leaked)
    }
  })
})

describe('AFK_MESSAGE', () => {
  it('is the generic hint-less message', () => {
    expect(AFK_MESSAGE).toMatch(STEERING_WRAPPER)
    expect(AFK_MESSAGE).not.toContain('Hint:')
  })
})
