import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  afterEvent,
  makeHarness,
  register,
  reminderSynthetics,
  resetScenario,
  stopPluginFibers,
  storedProblems,
  tlrConfig,
  toolEvent,
} from '@tests/helpers/tool-limit-reminder/harness'

beforeEach(resetScenario)
afterEach(stopPluginFibers)

describe('tool-limit-reminder budget resolution', () => {
  describe('budget resolution', () => {
    it('resolves an agent budget once and reuses the cache', async () => {
      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 3; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(h.agentGets).toEqual(['build'])
    })

    it('invalidates the cached budget when the agent selection changes', async () => {
      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))

      await h.emit({ type: 'session.agent.selected', data: { sessionID: 'ses_1', agent: 'build' } })
      await h.before(toolEvent('read'))

      expect(h.agentGets).toEqual(['build', 'build'])
    })

    it('resolves a budget at load even though agent.list is empty', async () => {
      const h = makeHarness()

      h.agentList = []
      await register(h)

      for (let index = 0; index < 5; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(h.agentGets).toEqual(['build'])
    })
  })

  describe('config', () => {
    it('falls back to DEFAULT_TOOL_LIMIT when the section is missing', async () => {
      tlrConfig.present = false

      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 5; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].text).toContain('You\'ve made 4 tool calls which is the limit')

      // The default `ignoreTools: ['signal_send']` keeps the control tool out of the counters.
      await h.before(toolEvent('signal_send'))

      expect(h.synthetics).toHaveLength(1)
    })

    it('prefers a per-agent limit override over floor(steps * factor)', async () => {
      tlrConfig.limits = { build: 3 }

      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 3; index += 1) {
        await h.before(toolEvent('read'))
      }

      expect(h.synthetics).toHaveLength(0)

      await h.before(toolEvent('read'))

      expect(reminderSynthetics(h)).toHaveLength(1)
      expect(reminderSynthetics(h)[0].text).toContain('You\'ve made 3 tool calls which is the limit')

      const prompt = { sessionID: 'ses_1', prompt: { text: 'hello' } }

      await h.prompt(prompt)

      expect(prompt.prompt.text).toBe('<task-budget tool-calls="3" />\nhello')
    })

    it('exempts signal_send from both counters', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)

      for (let index = 0; index < 3; index += 1) {
        await h.before(toolEvent('signal_send'))
        await h.after(afterEvent('completed', 'signal_send'))
      }

      expect(h.synthetics).toHaveLength(0)

      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      expect(storedProblems(h, 'ses_1')[0].actual).toBe(0)
    })
  })
})
