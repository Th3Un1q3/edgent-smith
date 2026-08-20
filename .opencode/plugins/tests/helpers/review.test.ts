// Tests for helpers/review.ts — shared session-review problem tracking.
// Written via TDD (RED → GREEN per test case); see tdd-enforcement.instructions.md.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Synchronous mock factories — no dynamic imports to avoid circular dependency issues.
import { makeKvStoreMockFactory, resetMockState, mockState } from '@tests/__utils/kv-store.mock'

vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }))

import { mkdir, writeFile } from 'node:fs/promises'

import { SessionStorage, SESSION_FIELDS } from '@plugins/helpers/kv-store'

import { skillProblemStatement, agentProblemStatement, readProblems, addProblem, clearReviewState, renderProblemsMarkdown, writeProblemsMarkdown, REVIEW_KEY } from '@plugins/helpers/review'

describe('skillProblemStatement', () => {
  it('builds a skill problem with the exact message string', () => {
    const problem = skillProblemStatement('test-design', 3, 5)

    expect(problem).toEqual({
      source: 'skill',
      thresholdName: 'test-design',
      expectedMax: 3,
      actual: 5,
      message: 'The session took 5 steps after skill \'test-design\' was loaded, exceeding the expected 3 steps for the task. The skill may not have been effective — investigate.',
    })
  })
})

describe('agentProblemStatement', () => {
  it('builds an agent problem with the exact message string', () => {
    const problem = agentProblemStatement('rug-swe', 20, 23)

    expect(problem).toEqual({
      source: 'agent',
      thresholdName: 'rug-swe',
      expectedMax: 20,
      actual: 23,
      message: 'The session took 23 tool calls for agent \'rug-swe\', exceeding the agent\'s budget of 20 steps. Investigate why the agent exceeded its step budget.',
    })
  })
})

describe('readProblems', () => {
  let storage: SessionStorage

  beforeEach(() => {
    resetMockState()
    storage = new SessionStorage()
  })

  it('returns an empty array when the session has no sessionReview key', () => {
    resetMockState({ s1: { toolCalls: 5 } })

    expect(readProblems(storage, 's1')).toEqual([])
  })

  it('returns an empty array when the session has no stored state', () => {
    resetMockState()

    expect(readProblems(storage, 's2')).toEqual([])
  })

  it('returns the stored problems when the sessionReview key exists', () => {
    const problems = [skillProblemStatement('test-design', 3, 5)]
    resetMockState({ s1: { [REVIEW_KEY]: problems } })

    expect(readProblems(storage, 's1')).toEqual(problems)
  })
})

describe('addProblem', () => {
  let storage: SessionStorage
  let mockUpdateState: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetMockState()
    storage = new SessionStorage()
    mockUpdateState = vi.mocked(storage.updateState)
  })

  it('writes a new problem under the sessionReview key', () => {
    const problem = skillProblemStatement('test-design', 3, 5)

    const result = addProblem(storage, 's1', problem)

    expect(result).toEqual([problem])
    expect(readProblems(storage, 's1')).toEqual([problem])
    expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))
    const updater = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    expect(updater({})).toEqual({ sessionReview: [problem] })
  })

  it('dedupes by thresholdName: a second add of the same name is a no-op without a KV write', () => {
    const problem = skillProblemStatement('test-design', 3, 5)

    addProblem(storage, 's1', problem)
    mockUpdateState.mockClear()
    const result = addProblem(storage, 's1', skillProblemStatement('test-design', 3, 7))

    expect(result).toEqual([problem])
    expect(readProblems(storage, 's1')).toEqual([problem])
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it('dedupes on the composite (source, thresholdName) key: same key dedupes, same name across sources coexists', () => {
    const skillProblem = skillProblemStatement('test-design', 3, 5)
    const agentProblem = agentProblemStatement('test-design', 20, 23)

    addProblem(storage, 's1', skillProblem)
    const dupResult = addProblem(storage, 's1', skillProblemStatement('test-design', 3, 7))
    expect(dupResult).toEqual([skillProblem])

    const mixedResult = addProblem(storage, 's1', agentProblem)
    expect(mixedResult).toEqual([skillProblem, agentProblem])
  })

  it('stores a skill problem and an agent problem with the same thresholdName as two distinct problems', () => {
    const skillProblem = skillProblemStatement('foo', 3, 5)
    const agentProblem = agentProblemStatement('foo', 20, 23)

    addProblem(storage, 's1', skillProblem)
    const result = addProblem(storage, 's1', agentProblem)

    expect(result).toHaveLength(2)
    expect(result).toEqual([skillProblem, agentProblem])
    expect(readProblems(storage, 's1')).toEqual([skillProblem, agentProblem])
  })

  it('appends problems with distinct threshold names (skill and agent coexist)', () => {
    const skillProblem = skillProblemStatement('test-design', 3, 5)
    const agentProblem = agentProblemStatement('rug-swe', 20, 23)

    addProblem(storage, 's1', skillProblem)
    addProblem(storage, 's1', agentProblem)

    expect(readProblems(storage, 's1')).toEqual([skillProblem, agentProblem])
  })

  it('stores problems for two different skills, both with source skill, keeping both thresholdNames', () => {
    const skillA = skillProblemStatement('test-design', 3, 5)
    const skillB = skillProblemStatement('session-insights', 4, 9)

    addProblem(storage, 's1', skillA)
    addProblem(storage, 's1', skillB)

    const stored = readProblems(storage, 's1')
    expect(stored).toHaveLength(2)
    expect(stored.map(p => p.thresholdName)).toEqual(['test-design', 'session-insights'])
    expect(stored.every(p => p.source === 'skill')).toBe(true)
    expect(stored).toEqual([skillA, skillB])
  })

  it('stores the same skill exactly once across three add attempts, writing to KV only on the first', () => {
    const problem = skillProblemStatement('test-design', 3, 5)

    addProblem(storage, 's1', problem)
    addProblem(storage, 's1', skillProblemStatement('test-design', 3, 7))
    const result = addProblem(storage, 's1', skillProblemStatement('test-design', 3, 8))

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    expect(result).toEqual([problem])
    expect(readProblems(storage, 's1')).toEqual([problem])
  })

  it('stores the same agent exactly once across three add attempts, writing to KV only on the first', () => {
    const problem = agentProblemStatement('rug-swe', 20, 23)

    addProblem(storage, 's1', problem)
    addProblem(storage, 's1', agentProblemStatement('rug-swe', 20, 25))
    const result = addProblem(storage, 's1', agentProblemStatement('rug-swe', 20, 26))

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    expect(result).toEqual([problem])
    expect(readProblems(storage, 's1')).toEqual([problem])
  })

  it('stores skill foo, agent foo, and skill bar as three distinct problems', () => {
    const skillFoo = skillProblemStatement('foo', 3, 5)
    const agentFoo = agentProblemStatement('foo', 20, 23)
    const skillBar = skillProblemStatement('bar', 4, 6)

    addProblem(storage, 's1', skillFoo)
    addProblem(storage, 's1', agentFoo)
    addProblem(storage, 's1', skillBar)

    expect(readProblems(storage, 's1')).toEqual([skillFoo, agentFoo, skillBar])
  })

  it('treats thresholdName case-sensitively: skill Foo and skill foo are distinct problems', () => {
    const skillLower = skillProblemStatement('foo', 3, 5)
    const skillUpper = skillProblemStatement('Foo', 3, 5)

    addProblem(storage, 's1', skillLower)
    addProblem(storage, 's1', skillUpper)

    const stored = readProblems(storage, 's1')
    expect(stored).toHaveLength(2)
    expect(stored).toEqual([skillLower, skillUpper])
  })

  it('preserves other root keys when writing a problem', () => {
    resetMockState({ s1: { toolCalls: 42 } })
    const problem = skillProblemStatement('test-design', 3, 5)

    addProblem(storage, 's1', problem)

    const updater = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    expect(updater({ toolCalls: 42 })).toEqual({ toolCalls: 42, sessionReview: [problem] })
    expect(readProblems(storage, 's1')).toEqual([problem])
  })
})

describe('clearReviewState', () => {
  let storage: SessionStorage
  let mockUpdateState: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetMockState()
    storage = new SessionStorage()
    mockUpdateState = vi.mocked(storage.updateState)
  })

  it('removes both sessionReview and needsReview in one updateState, preserving the rest', () => {
    resetMockState({ s1: { [REVIEW_KEY]: [skillProblemStatement('test-design', 3, 5)], [SESSION_FIELDS.needsReview]: true, toolCalls: 42 } })

    clearReviewState(storage, 's1')

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    const updater = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    expect(updater({ [REVIEW_KEY]: [], [SESSION_FIELDS.needsReview]: true, toolCalls: 42 })).toEqual({ toolCalls: 42 })
    expect(mockState.inMemory['s1']).toEqual({ toolCalls: 42 })
  })
})

describe('renderProblemsMarkdown', () => {
  it('renders the full markdown for a skill and an agent problem verbatim, each section carrying its problem-id comment', () => {
    const problems = [
      skillProblemStatement('test-design', 3, 5),
      agentProblemStatement('rug-swe', 20, 23),
    ]

    expect(renderProblemsMarkdown(problems)).toBe(
      [
        '# Reported Threshold Violations',
        '',
        '## skill: test-design',
        '<!-- problem-id: skill:test-design -->',
        'The session took 5 steps after skill \'test-design\' was loaded, exceeding the expected 3 steps for the task. The skill may not have been effective — investigate.',
        '',
        '## agent: rug-swe',
        '<!-- problem-id: agent:rug-swe -->',
        'The session took 23 tool calls for agent \'rug-swe\', exceeding the agent\'s budget of 20 steps. Investigate why the agent exceeded its step budget.',
        '',
      ].join('\n'),
    )
  })

  it('renders the none-reported variant for an empty problems array', () => {
    expect(renderProblemsMarkdown([])).toBe('# Reported Threshold Violations\n\n*None reported.*\n')
  })

  it('renders two skill problems as two separate ## skill sections verbatim', () => {
    const problems = [
      skillProblemStatement('test-design', 3, 5),
      skillProblemStatement('session-insights', 4, 9),
    ]

    expect(renderProblemsMarkdown(problems)).toBe(
      [
        '# Reported Threshold Violations',
        '',
        '## skill: test-design',
        '<!-- problem-id: skill:test-design -->',
        'The session took 5 steps after skill \'test-design\' was loaded, exceeding the expected 3 steps for the task. The skill may not have been effective — investigate.',
        '',
        '## skill: session-insights',
        '<!-- problem-id: skill:session-insights -->',
        'The session took 9 steps after skill \'session-insights\' was loaded, exceeding the expected 4 steps for the task. The skill may not have been effective — investigate.',
        '',
      ].join('\n'),
    )
  })

  it('emits one problem-id comment under each section, with the id equal to source:thresholdName', () => {
    const problems = [
      skillProblemStatement('test-design', 3, 5),
      skillProblemStatement('session-insights', 4, 9),
      agentProblemStatement('rug-swe', 20, 23),
    ]

    const markdown = renderProblemsMarkdown(problems)
    const headings = markdown.match(/^## .+$/gm) ?? []
    const ids = markdown.match(/^<!-- problem-id: (.+) -->$/gm) ?? []

    expect(headings).toEqual([
      '## skill: test-design',
      '## skill: session-insights',
      '## agent: rug-swe',
    ])
    expect(ids).toEqual([
      '<!-- problem-id: skill:test-design -->',
      '<!-- problem-id: skill:session-insights -->',
      '<!-- problem-id: agent:rug-swe -->',
    ])
    // each heading is immediately followed by its id comment line
    const idValues = ids.map(id => id.replaceAll(/^<!-- problem-id: | -->$/g, ''))
    for (const [index, heading] of headings.entries()) {
      const [source, thresholdName] = heading.replace(/^## /, '').split(': ')
      expect(idValues[index]).toBe(`${source}:${thresholdName}`)
    }
  })

  it('renders no problem-id lines in the none-reported zero case', () => {
    const markdown = renderProblemsMarkdown([])

    expect(markdown).toContain('*None reported.*')
    expect(markdown).not.toMatch(/problem-id/)
  })
})

describe('round-trip: two skills through add, read, and render', () => {
  let storage: SessionStorage

  beforeEach(() => {
    resetMockState()
    storage = new SessionStorage()
  })

  it('persists both skills and renders one section per skill without duplicates', () => {
    addProblem(storage, 's1', skillProblemStatement('test-design', 3, 5))
    addProblem(storage, 's1', skillProblemStatement('session-insights', 4, 9))

    const stored = readProblems(storage, 's1')
    const markdown = renderProblemsMarkdown(stored)

    expect(stored.map(p => p.thresholdName)).toEqual(['test-design', 'session-insights'])
    expect(markdown).toContain('## skill: test-design')
    expect(markdown).toContain('## skill: session-insights')
    expect(markdown.match(/^## skill: /gm)).toHaveLength(2)
  })
})

describe('writeProblemsMarkdown', () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
  })

  it('creates the session directory recursively and writes the rendered markdown to the absolute path', async () => {
    const problems = [
      skillProblemStatement('test-design', 3, 5),
      agentProblemStatement('rug-swe', 20, 23),
    ]

    await writeProblemsMarkdown('s1', problems)

    expect(mkdir).toHaveBeenCalledWith('/workspace/.tmp/session-review/s1', { recursive: true })
    expect(writeFile).toHaveBeenCalledWith('/workspace/.tmp/session-review/s1/problems.md', renderProblemsMarkdown(problems))
  })

  it('writes the none-reported markdown when there are no problems', async () => {
    await writeProblemsMarkdown('s1', [])

    expect(writeFile).toHaveBeenCalledWith('/workspace/.tmp/session-review/s1/problems.md', '# Reported Threshold Violations\n\n*None reported.*\n')
  })
})
