import { Cause, Effect, Exit, Fiber } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_NUDGES } from '@plugins/helpers/goal-nudges'

import type { PermissionRule } from '@tests/helpers/goal-continuation-harness'

import {
  ALLOWLIST,
  fibers,
  GOAL_KEY,
  idle,
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

describe('goal-continuation (v2)', () => {
  beforeEach(() => {
    goalConfig.enforceAll = false
    goalConfig.agents = []
    goalConfig.optOut = []
    goalConfig.readOnlyAllowlist = [...ALLOWLIST]
    goalConfig.maxSteeringRepeats = 2
  })

  afterEach(async () => {
    await Promise.all(fibers.map(fiber => Effect.runPromise(Fiber.interrupt(fiber))))
    fibers.length = 0
  })

  describe('goal tool', () => {
    it('registers the goal tool in the Code Mode catalog without disarming the gate', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const tool = h.tools.get('goal') as unknown as { options?: { codemode?: boolean } }
      const denied = await h.before(toolEvent('bash'))
      const allowed = await h.before(toolEvent('goal'))

      expect(tool.options?.codemode).toBe(true)
      expect(Exit.isFailure(denied)).toBe(true)
      expect(Exit.isSuccess(allowed)).toBe(true)
    })

    it('writes {text, nudges: 0} and disarms the gate when a goal is set', async () => {
      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship the plugin', nudges: 0 })

      const armed = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(armed)).toBe(true)
    })

    it('confirms a set with a terse message that omits the goal text', async () => {
      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

      expect(Exit.isSuccess(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        return
      }

      expect(exit.value).toEqual({ content: 'ok' })
      expect(JSON.stringify(exit.value)).not.toContain('Ship the plugin')
    })

    it('confirms a clear with a terse message', async () => {
      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')
      await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

      const exit = await h.runTool('goal', { action: 'clear' })

      expect(Exit.isSuccess(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        return
      }

      expect(exit.value).toEqual({ content: 'ok' })
    })

    it('preserves nudges when the same goal text is set again', async () => {
      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: 2 })

      await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship the plugin', nudges: 2 })
    })

    it('resets nudges when the goal text changes', async () => {
      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Old goal', nudges: 2 })

      await h.runTool('goal', { action: 'set', text: 'New goal' })

      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'New goal', nudges: 0 })
    })

    it('removes the goal record and disarms after a set this turn', async () => {
      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')
      await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

      const exit = await h.runTool('goal', { action: 'clear' })

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.storage.has(GOAL_KEY('ses_1'))).toBe(false)

      const disarmed = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(disarmed)).toBe(true)
    })

    it('leaves the gate armed when clear runs with no goal set this turn', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'clear' })

      expect(Exit.isSuccess(exit)).toBe(true)

      const denied = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(denied)).toBe(true)
    })

    it('fails on an empty text for action set and keeps the gate armed', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'set', text: ' '.repeat(3) })

      expect(Exit.isFailure(exit)).toBe(true)
      expect(h.storage.has(GOAL_KEY('ses_1'))).toBe(false)

      const stillArmed = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(stillArmed)).toBe(true)
    })

    it('rejects an out-of-scope caller with Tool.Error', async () => {
      const h = makeHarness()

      await register(h)

      const exit = await h.runTool('goal', { action: 'set', text: 'Ship the plugin' }, 'ses_1', 'build')

      expect(Exit.isFailure(exit)).toBe(true)
      expect(h.storage.has(GOAL_KEY('ses_1'))).toBe(false)
    })

    it('rejects an unknown action', async () => {
      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'bogus' })

      expect(Exit.isFailure(exit)).toBe(true)
      expect(h.storage.has(GOAL_KEY('ses_1'))).toBe(false)
    })

    it('fails when set is missing its text', async () => {
      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'set' })

      expect(Exit.isFailure(exit)).toBe(true)
      expect(h.storage.has(GOAL_KEY('ses_1'))).toBe(false)
    })
  })

  describe('idle loop', () => {
    it('sends a synthetic nudge on idle while under the cap', async () => {
      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: 0 })

      await h.emit(idle('ses_1'))

      expect(h.synthetics).toHaveLength(1)
      expect(h.synthetics[0].sessionID).toBe('ses_1')
      expect(h.synthetics[0].resume).toBe(true)
      expect(h.synthetics[0].text).toMatch(/goal/i)
    })

    it('skips the nudge once nudges reaches MAX_NUDGES', async () => {
      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: MAX_NUDGES })

      await h.emit(idle('ses_1'))

      expect(h.synthetics).toHaveLength(0)
      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship the plugin', nudges: MAX_NUDGES })
    })

    it('claims the nudge before sending so a failed send still increments nudges', async () => {
      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: 0 })
      h.syntheticFails = true

      await h.emit(idle('ses_1'))

      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship the plugin', nudges: 1 })
    })

    it('ignores idle events with no goal record', async () => {
      const h = makeHarness()

      await register(h)

      await h.emit(idle('ses_missing'))

      expect(h.synthetics).toHaveLength(0)
    })

    it('ignores non-idle events even when they carry a sessionID', async () => {
      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: 0 })

      // Only `session.idle` may nudge; an unrelated session event is filtered out.
      await h.emit({ type: 'session.updated', data: { sessionID: 'ses_1' } })

      expect(h.synthetics).toHaveLength(0)
      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship the plugin', nudges: 0 })
    })

    it('bounds the idle loop with MAX_NUDGES, independent of maxSteeringRepeats', async () => {
      goalConfig.maxSteeringRepeats = 0

      const h = makeHarness()

      await register(h)
      h.storage.set(GOAL_KEY('ses_1'), { text: 'Ship the plugin', nudges: 0 })

      await h.emit(idle('ses_1'))

      expect(h.synthetics).toHaveLength(1)
      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship the plugin', nudges: 1 })
    })

    it('replays open goals at load and drains the scan via next', async () => {
      const h = makeHarness()

      h.storage.set(GOAL_KEY('ses_a'), { text: 'A', nudges: 0 })
      h.storage.set(GOAL_KEY('ses_b'), { text: 'B', nudges: MAX_NUDGES })
      h.storage.set(GOAL_KEY('ses_c'), { text: 'C', nudges: 1 })

      await register(h)

      expect(h.synthetics.map(s => s.sessionID).sort((a, b) => a.localeCompare(b))).toEqual(['ses_a', 'ses_c'])
      expect(h.storage.get(GOAL_KEY('ses_a'))).toEqual({ text: 'A', nudges: 1 })
      expect(h.storage.get(GOAL_KEY('ses_b'))).toEqual({ text: 'B', nudges: MAX_NUDGES })
      expect(h.storage.get(GOAL_KEY('ses_c'))).toEqual({ text: 'C', nudges: 2 })
    })
  })

  describe('goal-first gate', () => {
    it('denies a non-allowlisted tool for an enforced agent while armed', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(exit)).toBe(true)
      if (!Exit.isFailure(exit)) {
        return
      }

      expect(Cause.hasFails(exit.cause)).toBe(true)
      expect(Cause.pretty(exit.cause)).toMatch(/goal/i)
    })

    it('sends one capped steering nudge before denying', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']
      goalConfig.maxSteeringRepeats = 1

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const first = await h.before(toolEvent('bash'))
      const second = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(first)).toBe(true)
      expect(Exit.isFailure(second)).toBe(true)
      expect(h.synthetics).toHaveLength(1)
      expect(h.synthetics[0].delivery).toBe('steer')
      expect(h.synthetics[0].resume).toBe(true)
    })

    it('denies without steering when maxSteeringRepeats is 0', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']
      goalConfig.maxSteeringRepeats = 0

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(exit)).toBe(true)
      expect(h.synthetics).toHaveLength(0)
    })

    it('allows the goal tool for an enforced agent while armed', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('goal'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('allows read-only allowlisted tools for an enforced agent while armed', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('read'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('enforces an agent whose goal allow follows a star deny', async () => {
      goalConfig.enforceAll = true

      const h = makeHarness()

      h.agentList = [{ id: 'build', permissions: [
        { action: '*', resource: '*', effect: 'deny' },
        { action: 'goal', resource: '*', effect: 'allow' },
      ] }]

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('stays inert when the last matching rule denies goal', async () => {
      goalConfig.enforceAll = true

      const h = makeHarness()

      h.agentList = [{ id: 'build', permissions: [
        { action: 'goal', resource: '*', effect: 'deny' },
      ] }]

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('stays inert when the agent has no goal rule', async () => {
      goalConfig.enforceAll = true

      const h = makeHarness()

      h.agentList = [{ id: 'build', permissions: [
        { action: '*', resource: '*', effect: 'deny' },
      ] }]

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('lets a later star deny override an earlier goal allow', async () => {
      goalConfig.enforceAll = true

      const h = makeHarness()

      h.agentList = [{ id: 'build', permissions: [
        { action: 'goal', resource: '*', effect: 'allow' },
        { action: '*', resource: '*', effect: 'deny' },
      ] }]

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('stays inert when no agents are enforced', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = []

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('enforces a configured agent missing from the agent list', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug']

      const h = makeHarness()

      // Load-time `agent.list()` failure: the list is empty, so `rug` is unknown.
      h.agentList = []
      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash', 'ses_1', 'rug'))

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('enforces a configured agent whose permissions cannot be resolved', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug']

      const h = makeHarness()

      h.agentList = [{ id: 'rug', permissions: undefined as unknown as PermissionRule[] }]
      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash', 'ses_1', 'rug'))

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('enforces a configured agent whose goal allow follows a star deny', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug-swe']

      const h = makeHarness()

      h.agentList = [{ id: 'rug-swe', permissions: [
        { action: '*', resource: '*', effect: 'deny' },
        { action: 'goal', resource: '*', effect: 'allow' },
      ] }]
      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash', 'ses_1', 'rug-swe'))

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('drops a configured agent that explicitly denies goal', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug']

      const h = makeHarness()

      h.agentList = [{ id: 'rug', permissions: [
        { action: 'goal', resource: '*', effect: 'deny' },
      ] }]
      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash', 'ses_1', 'rug'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('keeps the goal tool reachable for an enforced agent with an unresolvable list', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug']

      const h = makeHarness()

      h.agentList = []
      await register(h)
      await h.arm('ses_1')

      const exit = await h.runTool('goal', { action: 'set', text: 'Ship it' }, 'ses_1', 'rug')

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(h.storage.get(GOAL_KEY('ses_1'))).toEqual({ text: 'Ship it', nudges: 0 })
    })

    it('honours optOut under enforceAll', async () => {
      goalConfig.enforceAll = true
      goalConfig.optOut = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('lazily arms a session first seen mid-process', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)

      const exit = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('exempts subagent child sessions from the gate', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      h.session = { agent: 'build', parentID: 'ses_parent' }
      await register(h)
      await h.arm('ses_child')

      const exit = await h.before(toolEvent('bash', 'ses_child'))

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    it('re-arms on each user prompt after a disarming set', async () => {
      goalConfig.enforceAll = true
      goalConfig.agents = ['build']

      const h = makeHarness()

      await register(h)
      await h.arm('ses_1')
      await h.runTool('goal', { action: 'set', text: 'Ship the plugin' })

      const afterSet = await h.before(toolEvent('bash'))

      expect(Exit.isSuccess(afterSet)).toBe(true)

      await h.arm('ses_1')

      const afterRearm = await h.before(toolEvent('bash'))

      expect(Exit.isFailure(afterRearm)).toBe(true)
    })
  })

  describe('activation log', () => {
    it('logs the enforced agents at effect start', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug', 'rug-swe']

      const h = makeHarness()

      h.agentList = []
      await register(h)

      expect(h.logs.some(line => line.includes('enforced agents: rug, rug-swe'))).toBe(true)
    })

    it('logs enforcement disabled when nothing is enforced', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = []

      const h = makeHarness()

      await register(h)

      expect(h.logs.some(line => line.includes('enforcement disabled'))).toBe(true)
    })

    it('warns naming a configured agent missing from the agent list', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug']

      const h = makeHarness()

      h.agentList = []
      await register(h)

      expect(h.logs.some(line => line.includes('\'rug\' not in agent list'))).toBe(true)
    })

    it('warns naming a configured agent that denies goal', async () => {
      goalConfig.enforceAll = false
      goalConfig.agents = ['rug']

      const h = makeHarness()

      h.agentList = [{ id: 'rug', permissions: [
        { action: 'goal', resource: '*', effect: 'deny' },
      ] }]
      await register(h)

      expect(h.logs.some(line => line.includes('\'rug\' denies the goal tool'))).toBe(true)
    })
  })
})
