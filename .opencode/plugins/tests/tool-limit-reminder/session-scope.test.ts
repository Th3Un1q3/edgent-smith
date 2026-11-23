import { Exit } from 'effect'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  attempt,
  makeHarness,
  register,
  reminderSynthetics,
  resetScenario,
  stopPluginFibers,
  tlrConfig,
  toolEvent,
} from '@tests/helpers/tool-limit-reminder/harness'

beforeEach(resetScenario)
afterEach(stopPluginFibers)

describe('tool-limit-reminder session scope', () => {
  describe('prompt reset', () => {
    it('restarts the attempt count when a new prompt arrives in the same session', async () => {
      const h = makeHarness()

      await register(h)

      const first = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(first)

      // Four attempts leave `ses_1` one call short of the limit.
      for (let index = 0; index < 4; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      expect(reminderSynthetics(h)).toHaveLength(0)

      const second = { sessionID: 'ses_1', prompt: { text: 'again' } }

      await h.prompt(second)

      expect(second.prompt.text).toBe('again')
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(reminderSynthetics(h)).toHaveLength(0)

      for (let index = 0; index < 4; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
    })

    it('keeps the count of another session when a prompt arrives for a different session', async () => {
      const h = makeHarness()

      h.sessions.set('ses_2', { agent: 'build', metadata: {} })
      await register(h)

      await h.prompt({ sessionID: 'ses_1', prompt: { text: 'hello' } })

      // Four attempts leave `ses_1` one call short of the limit.
      for (let index = 0; index < 4; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      const other = { sessionID: 'ses_2', prompt: { text: 'hi' } }

      await h.prompt(other)

      expect(other.prompt.text).toBe('<task-budget tool-calls="4" />\nhi')
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].sessionID).toBe('ses_1')
    })
  })

  describe('isolation and concurrency', () => {
    it('exempts a child session from blocking and keeps the parent counters separate', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 0

      const h = makeHarness()

      h.sessions.set('ses_child', { agent: 'build', parentID: 'ses_parent', metadata: {} })
      await register(h)

      expect(Exit.isSuccess(await attempt(h, 'ses_child'))).toBe(true)
      expect(Exit.isSuccess(await attempt(h, 'ses_child'))).toBe(true)
      expect(reminderSynthetics(h).filter(synthetic => synthetic.sessionID === 'ses_child')).toHaveLength(1)

      // The attempt past the block edge would fail for a top-level session.
      expect(Exit.isSuccess(await attempt(h, 'ses_child'))).toBe(true)

      // The child's calls left the parent's own counter untouched.
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(h.synthetics.filter(synthetic => synthetic.sessionID === 'ses_1')).toHaveLength(0)
    })

    it('lands both increments for two parallel execute.before calls', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 0

      const h = makeHarness()

      await register(h)

      const [first, second] = await Promise.all([h.before(toolEvent('read')), h.before(toolEvent('read'))])

      expect(Exit.isSuccess(first)).toBe(true)
      expect(Exit.isSuccess(second)).toBe(true)
      // Exactly one call read the pre-increment value 1: no increment was lost.
      expect(reminderSynthetics(h)).toHaveLength(1)
    })
  })
})
