import { describe, expect, it } from 'vitest'

import { normalizeParameters } from '@plugins/workflow/subtask'
import type { SubtaskInput, SubtaskParameters, SubtaskResult } from '@plugins/workflow/contracts'

describe('normalizeParameters label', () => {
  it('keeps a valid label on the normalized parameters', () => {
    expect(normalizeParameters({ prompt: 'p', description: 'd', label: 'build.api' }).label).toBe('build.api')
  })

  it('carries a label on the SubtaskParameters and SubtaskResult contracts', () => {
    const parameters: SubtaskParameters = { prompt: 'p', label: 'build' }
    const result: SubtaskResult = { outputText: '', task_id: 't', status: 'ok', durationMs: 1, label: 'build' }

    expect(parameters.label).toBe('build')
    expect(result.label).toBe('build')
  })

  it.each([
    ['an uppercase start', 'Build'],
    ['an embedded space', 'build api'],
    ['a ses_ prefix', 'ses_build'],
    ['33 characters', 'a'.repeat(33)],
  ])('refuses %s and names the value', (_case, label) => {
    const input = { prompt: 'p', description: 'd', label } as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(TypeError)
    expect(() => normalizeParameters(input)).toThrow(label)
  })

  it('refuses label with fork_from as label_fork_conflict', () => {
    const input = { prompt: 'p', description: 'd', label: 'build', fork_from: 'ses_source' } as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(/label_fork_conflict/)
  })

  it('refuses label with task_id as label_task_conflict', () => {
    const input = { prompt: 'p', description: 'd', label: 'build', task_id: 'ses_child' } as SubtaskInput

    expect(() => normalizeParameters(input)).toThrow(/label_task_conflict/)
  })

  it('normalizes a call without label, task_id or fork_from unchanged', () => {
    const result = normalizeParameters({ prompt: 'p', description: 'd' })

    expect(result).toEqual({ prompt: 'p', description: 'd' })
    expect(result.label).toBeUndefined()
  })

  it('still normalizes a bare string input', () => {
    expect(normalizeParameters('do work')).toEqual({ prompt: 'do work', description: 'do work' })
  })
})
