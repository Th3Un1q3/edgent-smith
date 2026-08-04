// Cross-plugin integration smoke test: skill-usage-tracker + tool-limit-reminder
// drive the REAL review consolidation pipeline against a shared mocked SessionStorage:
//   threshold breach → session.idle → ONE export → problems.md → review state cleared.
//
// Both plugins construct `new SessionStorage()`; the kv-store mock factory makes every
// instance share the same in-memory state, so the smoke test verifies the plugins
// coordinate through the KV store exactly as they would in the OpenCode runtime.

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

import { defaultCreateClient, makeLoggerMockFactory, makeSessionHelpersMockFactory } from '@tests/helpers/mock-utilities'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeKvStoreMockFactory, resetMockState } from '@tests/__utils/kv-store.mock'

vi.mock('@plugins/helpers/logger', () => makeLoggerMockFactory())
vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/session-helpers', () => makeSessionHelpersMockFactory())
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }))

import { skillUsageTracker } from '@plugins/skill-usage-tracker'

import { toolLimitReminder } from '@plugins/tool-limit-reminder'

import { SessionStorage } from '@plugins/helpers/kv-store'

import { readProblems } from '@plugins/helpers/review'

import { writeFile } from 'node:fs/promises'

interface ToolExecuteBeforeInput {
  sessionID: string
  tool: string
  callID: string
}

interface ToolExecuteAfterInput extends ToolExecuteBeforeInput {
  args: { name?: string }
}

interface ToolExecuteAfterOutput {
  title: string
  output: string
  metadata: object
}

interface EventInput {
  event: { type: string, properties?: Record<string, unknown> }
}

interface SkillUsageTrackerHooks {
  'tool.execute.before': (input: ToolExecuteBeforeInput) => Promise<void>
  'tool.execute.after': (input: ToolExecuteAfterInput, output: ToolExecuteAfterOutput) => Promise<void>
}

interface ToolLimitReminderHooks {
  'tool.execute.before': (input: ToolExecuteBeforeInput) => Promise<void>
  'event': (input: EventInput) => Promise<void>
}

type TestClient = ClientMock & { client: { app: { agents: ReturnType<typeof vi.fn> } } }

describe('review pipeline (skill-usage-tracker + tool-limit-reminder)', () => {
  let sutHooks: SkillUsageTrackerHooks
  let tlrHooks: ToolLimitReminderHooks
  let client: TestClient
  let shell: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    resetMockState({})
    vi.mocked(writeFile).mockClear()
    shell = vi.fn().mockReturnValue({
      nothrow: () => ({ quiet: vi.fn().mockResolvedValue({ exitCode: 0 }) }),
    })
    client = defaultCreateClient({ agent: 'rug-swe' }, undefined, [{ name: 'rug-swe', steps: 25 }]) as TestClient
    client.$ = shell
    sutHooks = await skillUsageTracker(client as unknown as PluginInput) as unknown as SkillUsageTrackerHooks
    tlrHooks = await toolLimitReminder(client as unknown as PluginInput) as unknown as ToolLimitReminderHooks
  })

  it('writes both problems, exports exactly once on idle, seeds problems.md, and clears review state', async () => {
    const sessionID = 'smoke-sess'

    // 1. skill 'test-design' loaded via the skill tool (threshold from the live harness.config)
    await sutHooks['tool.execute.after'](
      { sessionID, tool: 'skill', callID: 'c0', args: { name: 'test-design' } },
      { title: '', output: '', metadata: {} },
    )

    // 2. push the step count past 10 via non-skill calls; both plugins observe every call
    for (let index = 0; index < 12; index++) {
      const input = { sessionID, tool: 'write', callID: `w${index}` }

      await sutHooks['tool.execute.before'](input)
      await tlrHooks['tool.execute.before'](input)
    }

    // 3. cross the agent budget: floor(25 * 0.8) = 20, crossing at the 22nd call
    for (let index = 0; index < 10; index++) {
      const input = { sessionID, tool: 'read', callID: `r${index}` }

      await sutHooks['tool.execute.before'](input)
      await tlrHooks['tool.execute.before'](input)
    }

    // 4. both problems are in the shared sessionReview key with distinct composite keys
    const problems = readProblems(new SessionStorage(), sessionID)

    expect(problems.map(p => `${p.source}:${p.thresholdName}`)).toEqual(['skill:test-design', 'agent:rug-swe'])

    // 5. session.idle fires the single collector → export runs exactly once
    await tlrHooks.event({ event: { type: 'session.idle', properties: { sessionID } } })

    expect(shell).toHaveBeenCalledTimes(1)
    expect(shell).toHaveBeenCalledWith(['just agent_utils/export-opencode-session ', ''], sessionID)

    // 6. problems.md holds both human-readable statements; review state is cleared
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith(
      `/workspace/.tmp/session-review/${sessionID}/problems.md`,
      expect.stringContaining('## skill: test-design'),
    )
    expect(writeFile).toHaveBeenCalledWith(
      `/workspace/.tmp/session-review/${sessionID}/problems.md`,
      expect.stringContaining('## agent: rug-swe'),
    )

    const stateAfterExport = new SessionStorage().readState(sessionID, s => s as Record<string, unknown>) ?? {}

    expect(stateAfterExport.sessionReview).toBeUndefined()
    expect(stateAfterExport.needsReview).toBeUndefined()

    // 7. a second idle fires no further export (nothing left to trigger)
    await tlrHooks.event({ event: { type: 'session.idle', properties: { sessionID } } })
    expect(shell).toHaveBeenCalledTimes(1)
  })
})
