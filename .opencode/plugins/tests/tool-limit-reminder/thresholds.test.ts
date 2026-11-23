import { Cause, Exit, Option } from 'effect'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Tool } from '@opencode/schema/tool'

import {
  attempt,
  attemptTimes,
  makeHarness,
  register,
  reminderSynthetics,
  resetScenario,
  reviewSynthetics,
  stopPluginFibers,
  storedProblems,
  tlrConfig,
  toolEvent,
} from '@tests/helpers/tool-limit-reminder/harness'

const BLOCK_TEXT
  = 'Error calling tools. Reason: tools are blocked. STOP YOUR WORK. DON\'T change, read, write files, execute commands in this session. Follow the instructions in the previous message to summarize your work and stop.'

beforeEach(resetScenario)
afterEach(stopPluginFibers)

describe('tool-limit-reminder thresholds', () => {
  describe('counting', () => {
    it('treats an agent whose lookup fails as unlimited', async () => {
      const h = makeHarness()

      h.agents.set('build', 'fail')
      await register(h)

      const exit = await h.before(toolEvent('read'))

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.synthetics).toHaveLength(0)

      const prompt = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(prompt)

      expect(prompt.prompt.text).toBe('hello')
    })

    it('treats a non-numeric step budget as unlimited', async () => {
      const h = makeHarness()

      h.agents.set('build', { steps: undefined })
      await register(h)

      const exit = await h.before(toolEvent('read'))

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.synthetics).toHaveLength(0)
    })

    it('allows the first call below the threshold and counts it exactly once', async () => {
      tlrConfig.limits = { build: 1 }

      const h = makeHarness()

      await register(h)

      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(h.synthetics).toHaveLength(0)

      // The single recorded attempt puts the next call exactly at the limit.
      expect(Exit.isSuccess(await attempt(h))).toBe(true)
      expect(reminderSynthetics(h)).toHaveLength(1)
    })
  })

  describe('boundary', () => {
    it('reminds exactly once when the pre-increment count reaches the limit', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 6; index += 1) {
        expect(Exit.isSuccess(await attempt(h))).toBe(true)
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].text).toContain('You\'ve made 4 tool calls which is the limit')
      expect(reminderSynthetics(h)[0].sessionID).toBe('ses_1')
      expect(reminderSynthetics(h)[0].resume).toBe(false)
    })

    it('records one deduped problem in the padding band and flags the session', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 7; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(h.sessions.get('ses_1')?.metadata).toEqual({ needsReview: true })
      expect(storedProblems(h, 'ses_1')).toHaveLength(1)
      expect(storedProblems(h, 'ses_1')[0]).toEqual({
        source: 'agent',
        thresholdName: 'build',
        expectedMax: 4,
        actual: 0,
        message: 'The session took 0 tool calls for agent \'build\', exceeding the agent\'s budget of 4 steps. Investigate why the agent exceeded its step budget.',
      })
      expect(reviewSynthetics(h)).toHaveLength(2)
      expect(reviewSynthetics(h)[0].text).toContain('Current count: 6, Limit: 4')
      expect(reviewSynthetics(h)[0].resume).toBe(false)
    })

    it('blocks past the padding band with the byte-identical v1 text', async () => {
      const h = makeHarness()

      await register(h)

      expect(await attemptTimes(h, 7)).toEqual([true, true, true, true, true, true, true])

      const blocked = await h.before(toolEvent('read'))

      expect(Exit.isFailure(blocked)).toBe(true)
      if (!Exit.isFailure(blocked)) return

      const failure = Option.getOrUndefined(Cause.findErrorOption(blocked.cause))

      expect(failure).toBeInstanceOf(Tool.Error)
      if (!(failure instanceof Tool.Error)) return
      expect(failure.message).toBe(BLOCK_TEXT)
      expect(h.synthetics.some(synthetic => synthetic.text.includes('tools are blocked'))).toBe(false)
    })
  })
})
