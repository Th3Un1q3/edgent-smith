// RED scaffold for the skill-usage-tracker plugin (TDD workflow).
// it.todo placeholders only — bodies are implemented one-at-a-time following
// tdd-enforcement.instructions.md and the test-design skill conventions
// (ZOMBIES order, one behavior per case, mocks configured in beforeEach).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

import { defaultCreateClient, makeLoggerMockFactory, makeSessionHelpersMockFactory } from '@tests/helpers/mock-utilities'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeKvStoreMockFactory, resetMockState } from '@tests/__utils/kv-store.mock'

// Module mocks (BEFORE stub imports — vitest hoists these)
vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/logger', () => makeLoggerMockFactory())
vi.mock('@plugins/helpers/session-helpers', () => makeSessionHelpersMockFactory())

// Stub imports (after vi.mock)
import { log } from '@plugins/helpers/logger'

import { sendMessage } from '@plugins/helpers/session-helpers'

import { SessionStorage } from '@plugins/helpers/kv-store'

import { readProblems, skillProblemStatement } from '@plugins/helpers/review'

import { skillUsageTracker } from '@plugins/skill-usage-tracker'

import { harnessConfig } from '@plugins/config/harness.config'

describe('skillUsageTracker', () => {
  let client: ClientMock
  let plugin: Awaited<ReturnType<typeof skillUsageTracker>>
  let mockUpdateState: ReturnType<typeof vi.fn>
  let _mockReadState: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    resetMockState()
    client = defaultCreateClient()
    plugin = await skillUsageTracker({ client, directory: '/workspace' } as unknown as PluginInput)
    mockUpdateState = vi.mocked(new SessionStorage().updateState)
    _mockReadState = vi.mocked(new SessionStorage().readState)
  })

  afterEach(async () => {
    await plugin?.dispose?.()
  })

  // DI helper: instantiate the plugin with injected thresholds so tests are
  // deterministic and immune to harness.config.ts value changes. The default
  // `plugin` above (no options) exercises the real config via loadThresholdConfig().
  const createPlugin = (thresholds: Record<string, number>) =>
    skillUsageTracker({ client, directory: '/workspace' } as unknown as PluginInput, { thresholds })

  it('records a configured skill in the session storage after skill tool called with skill name', async () => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: 0, loadedSkills: {} } },
    })
    await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: { name: 'test-design' } }, { title: '', output: '', metadata: {} })
    expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { source: string, loadedAtStep: number }> }>

    expect(result.skillUsageTracker.loadedSkills).toHaveProperty('test-design')
    expect(result.skillUsageTracker.loadedSkills['test-design']).toEqual({ source: 'tool', loadedAtStep: 0 })
  })
  it('does not process non-skill tools in the after hook', async () => {
    await plugin['tool.execute.after']!({ tool: 'write', sessionID: 's1', callID: 'c1', args: {} }, { title: '', output: '', metadata: {} })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('does not process non-skill tools in the after hook even when args accidentally contain a name property', async () => {
    // Without the guard (if false): extractSkillNameFromToolCall returns 'write',
    // code proceeds to call readTrackedState and potentially writeTrackedState
    await plugin['tool.execute.after']!({ tool: 'write', sessionID: 's1', callID: 'c1', args: { name: 'something' } }, { title: '', output: '', metadata: {} })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('does not process skill tool call with missing name in args', async () => {
    await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: {} }, { title: '', output: '', metadata: {} })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('does not process skill tool call with non-string name in args', async () => {
    await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: { name: 123 } }, { title: '', output: '', metadata: {} })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('initializes default state when loading a skill with no prior tracker state in session', async () => {
    resetMockState({ s1: {} })
    await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: { name: 'test-design' } }, { title: '', output: '', metadata: {} })

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { source: string }>, stepCount: number }>

    expect(result.skillUsageTracker.loadedSkills['test-design'].source).toBe('tool')
    expect(result.skillUsageTracker.stepCount).toBe(0)
  })
  it('records a configured skill initial user prompt contains skill as XML <skill name="${name}">', async () => {
    resetMockState({
      s1: {},
    })
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [{ type: 'text', text: 'use <skill name="test-design"> skill', id: 'p1', messageID: 'm1', sessionID: 's1' }] })
    expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { source: string, loadedAtStep: number }> }>

    expect(result.skillUsageTracker.loadedSkills).toHaveProperty('test-design')
    expect(result.skillUsageTracker.loadedSkills['test-design']).toEqual({ source: 'prompt', loadedAtStep: 0 })
  })
  it('does not re-scan for skill XML on subsequent messages (only first message)', async () => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: 5, loadedSkills: { 'test-design': { source: 'prompt', loadedAtStep: 0 } } } },
    })
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [{ type: 'text', text: 'use <skill name="session-insights"> skill', id: 'p1', messageID: 'm1', sessionID: 's1' }] })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('does not persist state when first message contains no skill XML tags', async () => {
    resetMockState({ s1: {} })
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [{ type: 'text', text: 'No skills here', id: 'p1', messageID: 'm1', sessionID: 's1' }] })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('parses skill XML with multiple whitespace characters between skill and name', async () => {
    resetMockState({ s1: {} })
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [{ type: 'text', text: 'use <skill   name="test-design"> skill', id: 'p1', messageID: 'm1', sessionID: 's1' }] })
    expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { source: string }> }>

    expect(result.skillUsageTracker.loadedSkills).toHaveProperty('test-design')
  })
  it('ignores non-text parts and text parts with non-string text content during XML parsing', async () => {
    resetMockState({ s1: {} })
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [
      { type: 'image', id: 'p1', messageID: 'm1', sessionID: 's1' },
      { type: 'text', text: 123, id: 'p2', messageID: 'm1', sessionID: 's1' },
      { type: 'text', text: 'use <skill name="test-design"> skill', id: 'p3', messageID: 'm1', sessionID: 's1' },
    ] as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['parts'] })

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, unknown> }>

    expect(Object.keys(result.skillUsageTracker.loadedSkills)).toHaveLength(1)
    expect(result.skillUsageTracker.loadedSkills).toHaveProperty('test-design')
  })
  it('skips parts with null text values (guard prevents crash)', async () => {
    resetMockState({ s1: {} })
    // With the guard: typeof null !== 'string' → continue, no crash
    // Without the guard: pattern.exec(null) → TypeError, would crash the plugin
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [
      { type: 'text', text: null, id: 'p1', messageID: 'm1', sessionID: 's1' },
    ] as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['parts'] })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('records steps since skill loaded in to session storage every time a non skill tool call', async () => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: 3, loadedSkills: { 'test-design': { source: 'tool', loadedAtStep: 2 } } } },
    })
    await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c2' }, { args: {} })
    expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { stepCount: number, loadedSkills: Record<string, { loadedAtStep: number }> }>

    expect(result.skillUsageTracker.stepCount).toBe(4)
    expect(result.skillUsageTracker.loadedSkills['test-design'].loadedAtStep).toBe(2)
  })
  it('writes a problem statement when a step crosses the loaded skill threshold', async () => {
    const injectedPlugin = await createPlugin({ 'test-design': 10 })

    resetMockState({
      s1: { skillUsageTracker: { stepCount: 12, loadedSkills: { 'test-design': { source: 'prompt', loadedAtStep: 0 } } } },
    })
    await injectedPlugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(readProblems(new SessionStorage(), 's1')).toEqual([skillProblemStatement('test-design', 10, 13)])
  })
  it('records multiple distinct configured skills in one session', async () => {
    // First: user sends prompt containing session-insights XML (no prior state)
    resetMockState({
      s1: {},
    })
    await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [{ type: 'text', text: 'use <skill name="session-insights"> skill', id: 'p1', messageID: 'm1', sessionID: 's1' }] })

    // Then: tool loads test-design
    await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: { name: 'test-design' } }, { title: '', output: '', metadata: {} })

    // The last write should include both skills
    const updaterFunction = mockUpdateState.mock.calls.at(-1)?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, unknown> }>

    expect(result.skillUsageTracker.loadedSkills).toHaveProperty('test-design')
    expect(result.skillUsageTracker.loadedSkills).toHaveProperty('session-insights')
    expect((result.skillUsageTracker.loadedSkills['test-design'] as { source: string }).source).toBe('tool')
    expect((result.skillUsageTracker.loadedSkills['session-insights'] as { source: string }).source).toBe('prompt')
  })
  it('does not re-record a skill that was already loaded (first load wins)', async () => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: 5, loadedSkills: { 'test-design': { source: 'prompt', loadedAtStep: 0 } } } },
    })
    await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: { name: 'test-design' } }, { title: '', output: '', metadata: {} })

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { source: string, loadedAtStep: number }> }>

    expect(result.skillUsageTracker.loadedSkills['test-design'].source).toBe('prompt')
    expect(result.skillUsageTracker.loadedSkills['test-design'].loadedAtStep).toBe(0)
  })
  it('stores its session state under the skillUsageTracker namespace key', async () => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: 0, loadedSkills: {} } },
    })
    await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

    const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
    const result = updaterFunction({})

    expect(result).toHaveProperty('skillUsageTracker')
  })
  it('does not count skill tool calls as steps', async () => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: 3, loadedSkills: {} } },
    })
    await plugin['tool.execute.before']!({ tool: 'skill', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('does not count steps when no tracker state exists yet', async () => {
    resetMockState({ s1: {} })
    await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
  it('writes a problem statement for every loaded skill whose threshold is exceeded on the same call', async () => {
    const injectedPlugin = await createPlugin({ 'test-design': 10, 'session-insights': 5 })

    resetMockState({
      s1: { skillUsageTracker: { stepCount: 15, loadedSkills: { 'test-design': { source: 'tool', loadedAtStep: 0 }, 'session-insights': { source: 'prompt', loadedAtStep: 0 } } } },
    })
    await injectedPlugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })

    const problems = readProblems(new SessionStorage(), 's1')

    expect(problems.map(p => p.thresholdName)).toEqual(expect.arrayContaining(['session-insights', 'test-design']))
  })
  it('uses injected thresholds instead of the values in harness.config.ts (injection wins)', async () => {
    // Injected 99 must override the real config's 8 for 'test-design': if the plugin
    // fell back to the real config, expectedMax would be 8 and this assertion fails.
    const injectedPlugin = await createPlugin({ 'test-design': 99 })

    resetMockState({
      s1: { skillUsageTracker: { stepCount: 100, loadedSkills: { 'test-design': { source: 'tool', loadedAtStep: 0 } } } },
    })
    await injectedPlugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(readProblems(new SessionStorage(), 's1')).toEqual([skillProblemStatement('test-design', 99, 101)])
  })

  // C2 — real-config wiring integration. harnessConfig is intentionally NOT mocked
  // here to verify the plugin reads the live config end-to-end. The tables are
  // generic over Object.entries, so they pass for ANY thresholds the user sets in
  // harness.config.ts — including an empty thresholds object (trivially, no rows).
  const configuredThresholds = Object.entries(harnessConfig.plugins['skill-usage-tracker'].thresholds)

  it.each(configuredThresholds)('writes a problem from the real config when configured skill %s exceeds its threshold', async (skill, threshold) => {
    resetMockState({
      s1: { skillUsageTracker: { stepCount: threshold + 1, loadedSkills: { [skill]: { source: 'tool', loadedAtStep: 0 } } } },
    })
    await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(readProblems(new SessionStorage(), 's1')).toEqual([skillProblemStatement(skill, threshold, threshold + 2)])
  })

  it.each(configuredThresholds)('does not write a problem from the real config when configured skill %s has exactly its threshold steps', async (skill, threshold) => {
    // The hook counts the current call first, so seed threshold - 1 to land exactly
    // ON the threshold after the increment (actual === threshold → no problem).
    resetMockState({
      s1: { skillUsageTracker: { stepCount: threshold - 1, loadedSkills: { [skill]: { source: 'tool', loadedAtStep: 0 } } } },
    })
    await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(readProblems(new SessionStorage(), 's1')).toEqual([])
  })
  it('does not send a steering message when writing a problem statement', async () => {
    // Injected threshold 10: seed 12 -> actual 13 > 10, so exactly one problem is
    // written regardless of harness.config.ts values (real config's 8 would also
    // cross, but 13 > 8 only holds while the config threshold stays < 13).
    const injectedPlugin = await createPlugin({ 'test-design': 10 })

    resetMockState({
      s1: { skillUsageTracker: { stepCount: 12, loadedSkills: { 'test-design': { source: 'prompt', loadedAtStep: 0 } } } },
    })
    await injectedPlugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
    expect(readProblems(new SessionStorage(), 's1')).toHaveLength(1)
    expect(sendMessage).not.toHaveBeenCalled()
  })
  it('writes a problem only once across repeated crossing checks (dedupe by source:thresholdName)', async () => {
    // Injected threshold 10: seed 12 -> actual 13 > 10 on the first call, so the
    // crossing deterministically happens regardless of harness.config.ts values
    // (with the real config it only happens while the threshold stays < 13).
    const injectedPlugin = await createPlugin({ 'test-design': 10 })

    resetMockState({
      s1: { skillUsageTracker: { stepCount: 12, loadedSkills: { 'test-design': { source: 'prompt', loadedAtStep: 0 } } } },
    })

    const beforeInput = { tool: 'write', sessionID: 's1', callID: 'c1' } as const

    await injectedPlugin['tool.execute.before']!(beforeInput, { args: {} })
    await injectedPlugin['tool.execute.before']!(beforeInput, { args: {} })
    await injectedPlugin['tool.execute.before']!(beforeInput, { args: {} })

    expect(readProblems(new SessionStorage(), 's1')).toHaveLength(1)

    const sessionReviewWrites = mockUpdateState.mock.calls.filter(([sessionID, updater]) =>
      sessionID === 's1' && typeof updater === 'function' && Object.hasOwn((updater as (s: Record<string, unknown>) => Record<string, unknown>)({}), 'sessionReview'),
    )

    expect(sessionReviewWrites).toHaveLength(1)
  })

  describe('when the same skill was loaded more than once', () => {
    describe('when skill loaded via the tool', () => {
      it('counts steps from the first skill load', async () => {
        resetMockState({
          s1: { skillUsageTracker: { stepCount: 5, loadedSkills: {} } },
        })
        await plugin['tool.execute.after']!({ tool: 'skill', sessionID: 's1', callID: 'c1', args: { name: 'test-design' } }, { title: '', output: '', metadata: {} })
        expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

        const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
        const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { loadedAtStep: number }> }>

        expect(result.skillUsageTracker.loadedSkills['test-design'].loadedAtStep).toBe(5)
      })
    })

    describe('when skill was supplied in the user prompt(first message)', () => {
      it('counts steps from the first message', async () => {
        resetMockState({
          s1: {},
        })
        await plugin['chat.message']!({ sessionID: 's1' }, { message: {} as unknown as Parameters<NonNullable<typeof plugin['chat.message']>>[1]['message'], parts: [{ type: 'text', text: 'use <skill name="test-design"> skill', id: 'p1', messageID: 'm1', sessionID: 's1' }] })
        expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

        const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
        const result = updaterFunction({}) as Record<string, { loadedSkills: Record<string, { loadedAtStep: number }> }>

        expect(result.skillUsageTracker.loadedSkills['test-design'].loadedAtStep).toBe(0)
      })
    })
  })

  describe('when no skill was loaded', () => {
    it('increments step count even when no skill was loaded', async () => {
      resetMockState({
        s1: { skillUsageTracker: { stepCount: 0, loadedSkills: {} } },
      })
      await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
      expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))

      const updaterFunction = mockUpdateState.mock.calls[0]?.[1] as (s: Record<string, unknown>) => Record<string, unknown>
      const result = updaterFunction({}) as Record<string, { stepCount: number }>

      expect(result.skillUsageTracker.stepCount).toBe(1)
    })
    it('does not write a problem statement when no skill was loaded', async () => {
      resetMockState({
        s1: { skillUsageTracker: { stepCount: 0, loadedSkills: {} } },
      })
      await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
      expect(readProblems(new SessionStorage(), 's1')).toEqual([])
    })
  })

  describe('when steps equal the configured threshold', () => {
    it('does not write a problem statement when steps equal the configured threshold', async () => {
      const injectedPlugin = await createPlugin({ 'test-design': 10 })

      // The hook counts the current call, so seeding stepCount 9 lands exactly ON the
      // injected threshold of 10 after the increment: actual = 10, and 10 > 10 is false.
      resetMockState({
        s1: { skillUsageTracker: { stepCount: 9, loadedSkills: { 'test-design': { source: 'prompt', loadedAtStep: 0 } } } },
      })
      await injectedPlugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
      expect(readProblems(new SessionStorage(), 's1')).toEqual([])
    })
    it('uses subtraction (not addition) when computing steps since skill load', async () => {
      // Injected threshold 10 makes this deterministic: with the real config the
      // test only passes while its threshold stays >= 5 (actual 5 must not cross).
      // With subtraction: 13 - 8 = 5, 5 > 10 → false (no review)
      // With addition:   13 + 8 = 21, 21 > 10 → true (review — would be wrong)
      const injectedPlugin = await createPlugin({ 'test-design': 10 })

      resetMockState({
        s1: { skillUsageTracker: { stepCount: 12, loadedSkills: { 'test-design': { source: 'tool', loadedAtStep: 8 } } } },
      })
      await injectedPlugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
      expect(readProblems(new SessionStorage(), 's1')).toEqual([])
    })
  })

  describe('exceptional', () => {
    it('logs initialization with the correct level and plugin ID', () => {
      expect(log).toHaveBeenCalledWith(expect.anything(), 'info', 'init', 'skill-usage-tracker')
    })
    it('resets per-session state when the plugin is disposed', async () => {
      await plugin.dispose!()
      expect(log).toHaveBeenCalledWith(expect.anything(), 'info', 'dispose', 'skill-usage-tracker')
    })
    it('keeps step counts isolated between two concurrent sessions', async () => {
      resetMockState({
        s1: { skillUsageTracker: { stepCount: 5, loadedSkills: {} } },
        s2: { skillUsageTracker: { stepCount: 3, loadedSkills: {} } },
      })
      await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
      await plugin['tool.execute.before']!({ tool: 'read', sessionID: 's2', callID: 'c2' }, { args: {} })
      expect(mockUpdateState).toHaveBeenCalledWith('s1', expect.any(Function))
      expect(mockUpdateState).toHaveBeenCalledWith('s2', expect.any(Function))
    })
    it('does not write a problem statement when the loaded skill has no configured threshold', async () => {
      resetMockState({
        s1: { skillUsageTracker: { stepCount: 50, loadedSkills: { 'unconfigured-skill': { source: 'tool', loadedAtStep: 0 } } } },
      })
      await plugin['tool.execute.before']!({ tool: 'write', sessionID: 's1', callID: 'c1' }, { args: {} })
      expect(readProblems(new SessionStorage(), 's1')).toEqual([])
    })
  })
})
