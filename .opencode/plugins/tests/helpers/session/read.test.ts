import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import { describe, expect, it } from 'vitest'

import { createSessionReader } from '@plugins/helpers/session/read'

const SESSION_ID = 'ses_read'

interface SessionPayload {
  agent?: string
  parentID?: string
}

const readerOver = (payload: { current: SessionPayload }, calls: string[]) => {
  const context = {
    session: {
      get: (input: { sessionID: string }) => {
        calls.push(input.sessionID)
        return Effect.succeed(payload.current)
      },
    },
  } as unknown as Context
  return createSessionReader(context)
}

describe('createSessionReader', () => {
  it('calls through on a miss and reads both identity fields', () => {
    const calls: string[] = []
    const reader = readerOver({ current: { agent: 'rug', parentID: 'ses_parent' } }, calls)

    expect(Effect.runSync(reader.read(SESSION_ID, 'cached'))).toEqual({
      agent: 'rug',
      parentID: 'ses_parent',
    })
    expect(calls).toEqual([SESSION_ID])
  })

  it('serves a cached read from memory without another call', () => {
    const calls: string[] = []
    const reader = readerOver({ current: { agent: 'rug' } }, calls)

    Effect.runSync(reader.read(SESSION_ID, 'cached'))
    expect(Effect.runSync(reader.read(SESSION_ID, 'cached')).agent).toBe('rug')
    expect(calls).toEqual([SESSION_ID])
  })

  it('replaces the memoised agent when a fresh read sees the session change agent', () => {
    const calls: string[] = []
    const payload: { current: SessionPayload } = { current: { agent: 'rug' } }
    const reader = readerOver(payload, calls)

    expect(Effect.runSync(reader.read(SESSION_ID, 'cached')).agent).toBe('rug')

    payload.current = { agent: 'build' }
    expect(Effect.runSync(reader.read(SESSION_ID, 'fresh')).agent).toBe('build')
    expect(Effect.runSync(reader.read(SESSION_ID, 'cached')).agent).toBe('build')
    expect(calls).toHaveLength(2)
  })
})
