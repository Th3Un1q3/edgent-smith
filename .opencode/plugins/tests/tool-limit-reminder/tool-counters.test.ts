import { Exit } from 'effect'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  afterEvent,
  attempt,
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

beforeEach(resetScenario)
afterEach(stopPluginFibers)

describe('tool-limit-reminder tool counters', () => {
  it('counts attempts for the gate but completed calls for the report', async () => {
    tlrConfig.limits = { build: 1 }
    tlrConfig.padding = 1

    const h = makeHarness()

    await register(h)

    // Two calls completed before the gate ever trips.
    await h.after(afterEvent('completed'))
    await h.after(afterEvent('completed'))

    expect(Exit.isSuccess(await attempt(h))).toBe(true)
    expect(Exit.isSuccess(await attempt(h))).toBe(true)
    expect(Exit.isSuccess(await attempt(h))).toBe(true)

    expect(reviewSynthetics(h)[0].text).toContain('Current count: 3, Limit: 1')
    expect(storedProblems(h, 'ses_1')[0].actual).toBe(2)

    // The fourth attempt trips the block: attempts advanced, `actual` did not.
    expect(Exit.isFailure(await attempt(h))).toBe(true)
    expect(storedProblems(h, 'ses_1')[0].actual).toBe(2)
  })

  it('counts an attempt that never completes without inflating the report', async () => {
    tlrConfig.limits = { build: 1 }
    tlrConfig.padding = 1

    const h = makeHarness()

    await register(h)

    // A gate stand-in denies the call from its own `execute.before`,
    // so no `execute.after` ever follows: the attempt still counts.
    await h.before(toolEvent('bash'))
    await h.before(toolEvent('bash'))

    expect(reminderSynthetics(h)).toHaveLength(1)

    await h.before(toolEvent('bash'))

    expect(storedProblems(h, 'ses_1')[0].actual).toBe(0)
  })
})
