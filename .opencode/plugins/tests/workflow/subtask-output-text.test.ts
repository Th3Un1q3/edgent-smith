import { describe, expect, it } from 'vitest'

import { extractOutputText } from '@plugins/workflow/subtask'

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
