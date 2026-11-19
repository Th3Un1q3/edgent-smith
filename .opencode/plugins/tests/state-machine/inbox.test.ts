import { describe, expect, it } from 'vitest'

import { isUserItem, readUserText } from '@plugins/state-machine/core/inbox'

describe('isUserItem', () => {
  it('accepts a user item', () => {
    expect(isUserItem({ type: 'user', payload: { text: 'hi' } })).toBe(true)
  })

  it('rejects every other item kind and a non-object', () => {
    expect(isUserItem({ type: 'synthetic', payload: { text: 'hi' } })).toBe(false)
    expect(isUserItem({ type: 'compaction' })).toBe(false)
    expect(isUserItem({ type: 'move' })).toBe(false)
    expect(isUserItem('user')).toBe(false)
    expect(isUserItem(undefined)).toBe(false)
  })
})

describe('readUserText', () => {
  it('reads the text from payload.text', () => {
    expect(readUserText({ type: 'user', payload: { text: 'new direction' } })).toBe('new direction')
  })

  it('returns an empty string when the payload or text is missing', () => {
    expect(readUserText({ type: 'user' })).toBe('')
    expect(readUserText({ type: 'user', payload: {} })).toBe('')
    expect(readUserText({ type: 'user', payload: { text: 42 } })).toBe('')
    expect(readUserText(undefined)).toBe('')
  })
})
