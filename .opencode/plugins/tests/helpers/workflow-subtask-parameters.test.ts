import { describe, expect, it } from 'vitest'

import { normalizeParameters } from '@plugins/helpers/workflow-subtask'
// Namespace import so a missing MAX_DESCRIPTION_CHARS export fails this test
// cleanly instead of breaking the whole module at link time.
import * as workflowTypes from '@plugins/helpers/workflow-types'
import type { SubtaskInput } from '@plugins/helpers/workflow-types'

// ── normalizeParameters ──────────────────────────────────────────

describe('normalizeParameters', () => {
  it('derives the description from a string shorthand', () => {
    expect(normalizeParameters('do work')).toEqual({ prompt: 'do work', description: 'do work' })
  })

  it('truncates the derived string description to MAX_DESCRIPTION_CHARS', () => {
    expect(normalizeParameters('x'.repeat(100)).description).toHaveLength(
      workflowTypes.MAX_DESCRIPTION_CHARS,
    )
  })

  it('passes object fields through including the required description', () => {
    const result = normalizeParameters({
      prompt: 'p',
      description: 'does a thing',
      agent: 'a',
      skills: ['s'],
      task_id: 't',
      timeout_seconds: 0.005,
    })

    expect(result).toEqual({
      prompt: 'p',
      description: 'does a thing',
      agent: 'a',
      skills: ['s'],
      task_id: 't',
      timeout_seconds: 0.005,
    })
  })

  it('rejects an object input with no description', () => {
    expect(() => normalizeParameters({ prompt: 'p' })).toThrow(TypeError)
    expect(() => normalizeParameters({ prompt: 'p' })).toThrow(/description/)
  })

  it.each([
    ['empty', ''],
    ['whitespace', ' '.repeat(3)],
  ])('rejects an object input with a %s description', (_label, description) => {
    expect(() => normalizeParameters({ prompt: 'p', description })).toThrow(TypeError)
  })

  it('exports MAX_DESCRIPTION_CHARS as the shared 80-character cap', () => {
    expect(workflowTypes.MAX_DESCRIPTION_CHARS).toBe(80)
  })

  it.each([null, [], 42, { prompt: '' }, { prompt: 7 }])('throws TypeError for invalid input %#', (input) => {
    expect(() => normalizeParameters(input as unknown as SubtaskInput)).toThrow(TypeError)
  })
})

// ── normalizeParameters task_id ──────────────────────────────────

describe('normalizeParameters task_id', () => {
  it('trims surrounding whitespace from a task_id', () => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', task_id: '  ses_x  ' }).task_id).toBe('ses_x')
  })

  it.each([
    ['empty', ''],
    ['whitespace', ' '.repeat(3)],
  ])('treats a %s task_id as absent', (_label, taskId) => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', task_id: taskId }).task_id).toBeUndefined()
  })

  it('does not treat a whitespace-only task_id combined with fork_from as a conflict', () => {
    const result = normalizeParameters({
      prompt: 'p',
      description: 'd',
      task_id: ' '.repeat(3),
      fork_from: 'ses_source',
    })

    expect(result.task_id).toBeUndefined()
    expect(result.fork_from).toBe('ses_source')
  })

  it('still rejects a real task_id combined with fork_from', () => {
    expect(() =>
      normalizeParameters({ prompt: 'p', description: 'd', task_id: 'ses_x', fork_from: 'ses_y' }),
    ).toThrow(/mutually exclusive/)
  })

  it.each([123, true, null, {}])('throws a TypeError naming task_id for a non-string %#', (taskId) => {
    const input = { prompt: 'p', description: 'd', task_id: taskId } as unknown as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(TypeError)
    expect(() => normalizeParameters(input)).toThrow(/task_id/)
  })
})

// ── normalizeParameters prompt/description trimming ──────────────

describe('normalizeParameters prompt and description text', () => {
  it('rejects a whitespace-only prompt for shorthand and object input', () => {
    expect(() => normalizeParameters(' '.repeat(3))).toThrow(TypeError)
    expect(() => normalizeParameters({ prompt: ' '.repeat(3), description: 'd' })).toThrow(/prompt/)
  })

  it('trims surrounding whitespace from the description', () => {
    expect(normalizeParameters({ prompt: 'p', description: '  d  ' }).description).toBe('d')
  })
})

// ── normalizeParameters option validation ────────────────────────

describe('normalizeParameters option validation', () => {
  it.each([0, -1, NaN, Infinity, '5', null])(
    'throws a TypeError naming timeout_seconds for invalid %#',
    (timeout_seconds) => {
      const input = { prompt: 'p', description: 'd', timeout_seconds } as unknown as SubtaskInput

      expect(() => normalizeParameters(input)).toThrow(TypeError)
      expect(() => normalizeParameters(input)).toThrow(/timeout_seconds/)
    },
  )

  it('passes a valid timeout_seconds through', () => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', timeout_seconds: 1 }).timeout_seconds).toBe(1)
  })

  it.each([['a'], [1], [null], [['a', 1]]])('throws a TypeError naming skills for invalid %#', (skills) => {
    const input = { prompt: 'p', description: 'd', skills } as unknown as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(TypeError)
    expect(() => normalizeParameters(input)).toThrow(/skills/)
  })

  it('passes an empty skills array through', () => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', skills: [] }).skills).toEqual([])
  })

  it.each(['', ' '.repeat(2), 5, null])('throws a TypeError naming agent for invalid %#', (agent) => {
    const input = { prompt: 'p', description: 'd', agent } as unknown as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(TypeError)
    expect(() => normalizeParameters(input)).toThrow(/agent/)
  })
})
