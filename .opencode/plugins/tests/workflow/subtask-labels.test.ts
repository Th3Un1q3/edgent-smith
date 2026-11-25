import { describe, expect, it } from 'vitest'

import {
  bindLabel,
  checkResume,
  decodeLabelDocument,
  encodeLabelDocument,
  findBinding,
  LABEL_PATTERN,
  MAX_LABEL_BINDINGS,
  parseLabel,
  renderLabelSummary,
} from '@plugins/workflow/subtask-labels'
import type { LabelBinding, LabelDocument } from '@plugins/workflow/subtask-labels'

const BOUND_AT = '2026-11-24T10:00:00.000Z'

function binding(label: string, taskId: string): LabelBinding {
  return { label, taskId, boundAt: BOUND_AT }
}

function documentOf(bindings: LabelBinding[]): LabelDocument {
  return { version: 1, bindings }
}

function filledDocument(count: number): LabelDocument {
  const bindings: LabelBinding[] = []
  for (let index = 0; index < count; index += 1) {
    bindings.push(binding(`l${index}`, `ses_${index}`))
  }
  return documentOf(bindings)
}

function refusalMessage(verdict: ReturnType<typeof checkResume>): string {
  return verdict.ok ? '' : verdict.message
}

describe('LABEL_PATTERN and parseLabel', () => {
  it('accepts a plain lowercase label', () => {
    expect(parseLabel('reviewer')).toBe('reviewer')
  })

  it('accepts an internal hyphen', () => {
    expect(parseLabel('memory-manager')).toBe('memory-manager')
  })

  it('accepts dots and underscores after the first character', () => {
    expect(parseLabel('us.09_x')).toBe('us.09_x')
  })

  it('accepts a 32-character label, matching the pattern exactly', () => {
    const label = `a${'b'.repeat(31)}`
    expect(label).toHaveLength(32)
    expect(LABEL_PATTERN.test(label)).toBe(true)
    expect(parseLabel(label)).toBe(label)
  })

  it('rejects an uppercase first character', () => {
    expect(() => parseLabel('Reviewer')).toThrow(TypeError)
  })

  it('rejects a leading hyphen', () => {
    expect(() => parseLabel('-reviewer')).toThrow(TypeError)
  })

  it('rejects a label longer than 32 characters', () => {
    expect(() => parseLabel(`a${'b'.repeat(32)}`)).toThrow(TypeError)
  })

  it('rejects the empty string', () => {
    expect(() => parseLabel('')).toThrow(TypeError)
  })

  it('rejects a session id, so ids cannot pass as labels', () => {
    expect(() => parseLabel('ses_abc')).toThrow(TypeError)
  })

  it('rejects a label containing a space', () => {
    expect(() => parseLabel('with space')).toThrow(TypeError)
  })

  it('rejects a non-string value and names it in the message', () => {
    expect(() => parseLabel(42)).toThrow(TypeError)
    expect(() => parseLabel(42)).toThrow(/42/)
  })

  it('never normalizes: uppercase input throws instead of being lowercased', () => {
    const attempt = () => parseLabel('Reviewer')
    expect(attempt).toThrow(TypeError)
    expect(attempt).toThrow(/Reviewer/)
  })
})

describe('encodeLabelDocument and decodeLabelDocument', () => {
  it('encodes compact JSON without whitespace', () => {
    const text = encodeLabelDocument(documentOf([binding('reviewer', 'ses_x')]))
    expect(text).toBe(
      `{"version":1,"bindings":[{"label":"reviewer","taskId":"ses_x","boundAt":"${BOUND_AT}"}]}`,
    )
  })

  it('round-trips a document through encode and decode', () => {
    const document = filledDocument(3)
    expect(decodeLabelDocument(encodeLabelDocument(document))).toEqual(document)
  })

  it('decodes an absent document as empty', () => {
    expect(decodeLabelDocument(undefined)).toEqual(documentOf([]))
  })

  it('decodes an empty string as empty', () => {
    expect(decodeLabelDocument('')).toEqual(documentOf([]))
  })

  it('decodes non-JSON garbage as empty', () => {
    expect(decodeLabelDocument('not json')).toEqual(documentOf([]))
  })

  it('decodes a foreign document version as empty', () => {
    expect(decodeLabelDocument('{"version":2,"bindings":[]}')).toEqual(documentOf([]))
  })

  it('drops malformed rows and keeps the valid ones', () => {
    const text = JSON.stringify({
      version: 1,
      bindings: [
        binding('reviewer', 'ses_x'),
        { label: 'BAD', taskId: 'ses_bad', boundAt: BOUND_AT },
        { label: 'missing-task' },
        'not a row',
        binding('researcher', 'ses_y'),
      ],
    })
    const expected = documentOf([binding('reviewer', 'ses_x'), binding('researcher', 'ses_y')])
    expect(decodeLabelDocument(text)).toEqual(expected)
  })

  it('never throws on structurally hostile input', () => {
    expect(decodeLabelDocument('[1,2,3]')).toEqual(documentOf([]))
    expect(decodeLabelDocument('{"version":1,"bindings":"nope"}')).toEqual(documentOf([]))
    expect(decodeLabelDocument('null')).toEqual(documentOf([]))
    expect(decodeLabelDocument('{"version":1,"bindings":[null]}}')).toEqual(documentOf([]))
  })
})

describe('findBinding', () => {
  it('returns the row for a bound label', () => {
    const document = documentOf([binding('reviewer', 'ses_x'), binding('researcher', 'ses_y')])
    expect(findBinding(document, 'researcher')).toEqual(binding('researcher', 'ses_y'))
  })

  it('returns undefined for an unbound label', () => {
    const document = documentOf([binding('reviewer', 'ses_x')])
    expect(findBinding(document, 'writer')).toBeUndefined()
  })
})

describe('bindLabel', () => {
  it('appends a row for a new label', () => {
    const document = bindLabel(documentOf([]), 'reviewer', 'ses_x', BOUND_AT)
    expect(document.bindings).toEqual([binding('reviewer', 'ses_x')])
  })

  it('never rebinds: a second bind for the same label returns the same document with one row', () => {
    const first = bindLabel(documentOf([]), 'reviewer', 'ses_x', BOUND_AT)
    const second = bindLabel(first, 'reviewer', 'ses_y', BOUND_AT)
    expect(second).toBe(first)
    expect(second.bindings).toHaveLength(1)
    expect(second.bindings[0]).toEqual(binding('reviewer', 'ses_x'))
  })

  it(`throws RangeError naming MAX_LABEL_BINDINGS (${MAX_LABEL_BINDINGS}) at the cap`, () => {
    const full = filledDocument(MAX_LABEL_BINDINGS)
    const bindOneTooMany = () => bindLabel(full, 'one-too-many', 'ses_over', BOUND_AT)
    expect(bindOneTooMany).toThrow(RangeError)
    expect(bindOneTooMany).toThrow(String(MAX_LABEL_BINDINGS))
  })
})

describe('checkResume', () => {
  it('allows a finished child in state ok', () => {
    expect(checkResume(binding('reviewer', 'ses_x'), 'ok')).toEqual({ ok: true })
  })

  it('allows an empty child, since a finished child is resumed', () => {
    expect(checkResume(binding('reviewer', 'ses_x'), 'empty')).toEqual({ ok: true })
  })

  it('allows an unknown child and lets the resume itself report', () => {
    expect(checkResume(binding('reviewer', 'ses_x'), 'unknown')).toEqual({ ok: true })
  })

  it('refuses a running child and names the child task id', () => {
    const verdict = checkResume(binding('reviewer', 'ses_x'), 'running')
    expect(verdict).toMatchObject({ ok: false, reason: 'running' })
    expect(refusalMessage(verdict)).toContain('ses_x')
    expect(refusalMessage(verdict)).toContain('reviewer')
  })

  it('refuses an aborted child as dead and names the child task id', () => {
    const verdict = checkResume(binding('reviewer', 'ses_x'), 'aborted')
    expect(verdict).toMatchObject({ ok: false, reason: 'dead' })
    expect(refusalMessage(verdict)).toContain('ses_x')
    expect(refusalMessage(verdict)).toContain('reviewer')
  })

  it('refuses an errored child as dead and names the child task id', () => {
    const verdict = checkResume(binding('researcher', 'ses_y'), 'error')
    expect(verdict).toMatchObject({ ok: false, reason: 'dead' })
    expect(refusalMessage(verdict)).toContain('ses_y')
    expect(refusalMessage(verdict)).toContain('researcher')
  })
})

describe('renderLabelSummary', () => {
  it('renders an empty string when nothing is bound', () => {
    expect(renderLabelSummary(documentOf([]))).toBe('')
  })

  it('renders one line naming every label and child', () => {
    const document = documentOf([binding('reviewer', 'ses_x'), binding('researcher', 'ses_y')])
    expect(renderLabelSummary(document)).toBe(`labels: reviewer=ses_x (${BOUND_AT}), researcher=ses_y (${BOUND_AT})`)
  })
})
