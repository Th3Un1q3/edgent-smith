import { Effect, Exit, Fiber } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fibers,
  GATE_KEY,
  GOAL_KEY,
  makeHarness,
  register,
  toolEvent,
} from '@tests/helpers/goal-continuation-harness'

// Config is read at plugin-registration time; mutate this hoisted object before
// `register()` to steer enforcement per scenario.
const goalConfig = vi.hoisted(() => ({
  enforceAll: false,
  agents: [] as string[],
  optOut: [] as string[],
  readOnlyAllowlist: ['question', 'read', 'glob', 'grep', 'skill'],
  maxSteeringRepeats: 2,
}))

vi.mock('@plugins/config/harness.config', () => ({
  harnessConfig: { plugins: { 'goal-continuation': goalConfig } },
}))

/**
 * Gate persistence across a plugin hot reload.
 *
 * The persisted gate record is `goal-gate/<sessionID>` with shape
 * `{ armed: boolean, goalSet: boolean, steeringSent: number }`; a fresh effect
 * closure over the same storage must hydrate it without re-arming.
 */
describe('goal-continuation gate persistence (hot reload)', () => {
  beforeEach(() => {
    goalConfig.enforceAll = false
    goalConfig.agents = []
    goalConfig.optOut = []
    goalConfig.maxSteeringRepeats = 2
  })

  afterEach(async () => {
    await Promise.all(fibers.map(fiber => Effect.runPromise(Fiber.interrupt(fiber))))
    fibers.length = 0
  })

  it('persists an armed gate when the prompt arm hook fires', async () => {
    const h = makeHarness()

    await register(h)
    await h.arm('ses_1')

    expect(h.storage.get(GATE_KEY('ses_1'))).toEqual({ armed: true, goalSet: false, steeringSent: 0 })
  })

  it('persists disarm on goal set and keeps it on clear', async () => {
    goalConfig.enforceAll = true
    goalConfig.agents = ['build']

    const h = makeHarness()

    await register(h)
    await h.arm('ses_1')
    await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

    expect(h.storage.get(GATE_KEY('ses_1'))).toEqual({ armed: false, goalSet: true, steeringSent: 0 })

    await h.runTool('goal', { action: 'clear' })

    expect(h.storage.get(GATE_KEY('ses_1'))).toEqual({ armed: false, goalSet: true, steeringSent: 0 })
  })

  it('leaves the persisted gate armed when clear runs with no goal set this turn', async () => {
    const h = makeHarness()

    await register(h)
    await h.arm('ses_1')
    await h.runTool('goal', { action: 'clear' })

    expect(h.storage.get(GATE_KEY('ses_1'))).toEqual({ armed: true, goalSet: false, steeringSent: 0 })
  })

  it('does not falsely re-arm after a reload once a goal is set', async () => {
    goalConfig.enforceAll = true
    goalConfig.agents = ['build']

    const a = makeHarness()

    await register(a)
    await a.arm('ses_1')
    await a.runTool('goal', { action: 'set', text: 'Ship the plugin' })

    // Reload: a fresh effect closure over the same storage.
    const b = makeHarness(a.storage)

    await register(b)

    const exit = await b.before(toolEvent('bash'))

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('restores a persisted steering count at load and increments it on deny', async () => {
    goalConfig.enforceAll = true
    goalConfig.agents = ['build']
    goalConfig.maxSteeringRepeats = 2

    const h = makeHarness()

    h.storage.set(GATE_KEY('ses_1'), { armed: true, goalSet: false, steeringSent: 1 })

    await register(h)

    const exit = await h.before(toolEvent('bash'))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(h.synthetics).toHaveLength(1)
    expect(h.storage.get(GATE_KEY('ses_1'))).toEqual({ armed: true, goalSet: false, steeringSent: 2 })
  })

  it('hydrates an open goal with no gate record as disarmed on load', async () => {
    goalConfig.enforceAll = true
    goalConfig.agents = ['build']

    const h = makeHarness()

    h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: 0 })

    await register(h)

    const exit = await h.before(toolEvent('bash'))

    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
