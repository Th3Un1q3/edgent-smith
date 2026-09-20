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
      timeout_ms: 5,
    })

    expect(result).toEqual({
      prompt: 'p',
      description: 'does a thing',
      agent: 'a',
      skills: ['s'],
      task_id: 't',
      timeout_ms: 5,
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
