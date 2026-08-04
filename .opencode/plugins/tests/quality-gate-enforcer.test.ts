import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { makeKvStoreMockFactory, resetMockState, mockState } from '@tests/__utils/kv-store.mock'

import { opencodeClientFactory } from '@tests/__utils/factories/client-factory'

vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
vi.mock('@plugins/helpers/session-helpers', () => ({ sendMessage: vi.fn() }))
vi.mock('@plugins/helpers/gate-config', () => ({ loadQualityGates: vi.fn() }))
vi.mock('@plugins/helpers/gate-runner', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, runGate: vi.fn() }
})
vi.mock('@plugins/helpers/logger', () => ({ log: vi.fn() }))

import { sendMessage } from '@plugins/helpers/session-helpers'

import { loadQualityGates } from '@plugins/helpers/gate-config'

import { runGate } from '@plugins/helpers/gate-runner'

import { log } from '@plugins/helpers/logger'

import { qualityGateEnforcer } from '@plugins/quality-gate-enforcer'

import type { QualityGatesConfig } from '@plugins/types/quality-gate'

import type { CommandResult } from '@plugins/helpers/gate-runner'

// ── Fixtures ──────────────────────────────────────────────────────────────

const fixtureConfig: QualityGatesConfig = {
  gates: [
    { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] },
    { name: 'test', patterns: ['**/*.test.ts'], commands: ['just test'] },
  ],
}

const successResult: CommandResult = { exitCode: 0, stdout: 'ok', stderr: '' }

const failureResult: CommandResult = {
  exitCode: 1,
  stdout: 'error line 1',
  stderr: 'error line 2',
}

const baseInput = (sessionID: string, filePath: string) => ({
  tool: 'edit',
  sessionID,
  args: { filePath },
})

const baseOutput = { title: '', output: '', metadata: {} }

// Typed cast for plugin hook calls — avoids bare `Function` lint errors
type PluginHook = (...arguments_: unknown[]) => Promise<unknown>

// ── Tests ─────────────────────────────────────────────────────────────────

describe('qualityGateEnforcer', () => {
  let mockClient: ReturnType<typeof opencodeClientFactory>
  let mockContext: Record<string, unknown>
  let plugin: Record<string, unknown>

  beforeEach(async () => {
    mockClient = opencodeClientFactory()
    mockContext = {
      client: mockClient,
      project: {},
      directory: '/workspace',
      worktree: '/workspace/.git',
      experimental_workspace: { register: vi.fn() },
      serverUrl: new URL('http://localhost'),
      $: vi.fn(),
    }

    resetMockState()
    vi.mocked(loadQualityGates).mockReturnValue(fixtureConfig)
    vi.mocked(sendMessage).mockResolvedValue(undefined)
    vi.mocked(runGate).mockResolvedValue(successResult)

    plugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)
  })

  // ── Plugin structure ───────────────────────────────────────────────────

  describe('plugin structure', () => {
    it('exports qualityGateEnforcer with tool.execute.after hook only', () => {
      expect(typeof plugin['tool.execute.after']).toBe('function')
      expect(plugin.setup).toBeUndefined()
      expect(plugin.dispose).toBeUndefined()
    })

    it('returns a non-empty plugin with expected hook', () => {
      expect(plugin).toEqual(expect.objectContaining({
        'tool.execute.after': expect.any(Function),
      }))
    })
  })

  // ── Tool filtering ─────────────────────────────────────────────────────

  describe('tool filtering', () => {
    it.each([
      {
        name: 'non-edit/write tool',
        input: { tool: 'read', sessionID: 'ses_1' },
        output: {},
      },
      {
        name: 'missing filePath',
        input: { tool: 'edit', sessionID: 'ses_2', args: {} },
        output: baseOutput,
      },
      {
        name: 'empty filePath',
        input: { tool: 'write', sessionID: 'ses_3', args: { filePath: '' } },
        output: baseOutput,
      },
      {
        name: 'file matching no patterns',
        input: baseInput('ses_nomatch', '/workspace/README.md'),
        output: baseOutput,
      },
    ])('skips gates for $name', async ({ input, output }) => {
      await (plugin['tool.execute.after'] as PluginHook)(input, output)
      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  // ── Gate execution ────────────────────────────────────────────────────

  describe('gate execution', () => {
    it('runs matching gate immediately after edit', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_exec', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalled()
      expect(sendMessage).toHaveBeenCalled()
    })

    it('only runs gates whose patterns match the file', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_selective', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalledTimes(1)
    })

    it('runs all gates for a file matching multiple patterns', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_multi', '/workspace/src/util.test.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalledTimes(2)
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ── Status transitions ────────────────────────────────────────────────

  describe('status transitions', () => {
    it('sends message on status change but not when status is unchanged', async () => {
      // First call: unknown → pass — message sent
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_trans1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      // Second call: pass → pass — no message
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_trans1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalledTimes(2)
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('sends message again on new transition from pass to fail', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_trans2', '/workspace/src/main.ts'),
        baseOutput,
      )
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_trans2', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(2)
    })
  })

  // ── Session handling ─────────────────────────────────────────────────

  describe('session handling', () => {
    it('falls back to log when no sessionID', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'edit', sessionID: undefined, args: { filePath: '/workspace/src/main.ts' } },
        baseOutput,
      )
      expect(vi.mocked(log)).toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  // ── Diagnostic logging ────────────────────────────────────────────────

  describe('diagnostic logging', () => {
    it('logs transition message before sending', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_diag', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(log)).toHaveBeenCalledWith(
        mockClient,
        'info',
        expect.stringContaining('Sending transition message for 1 gate(s)'),
        'quality-gate-enforcer',
      )
    })
  })

  // ── gatesState tracking ───────────────────────────────────────────────

  describe('gatesState tracking', () => {
    it('tracks gate status across sessions and detects new transitions', async () => {
      // First session triggers gate — status changes from unknown to pass
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_gs1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      // Second session — status unchanged (pass→pass), no new message
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_gs2', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)
      expect(runGate).toHaveBeenCalledTimes(2)

      // Gate fails — transition from pass to fail
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_gs1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(2)

      // Gate passes again — transition from fail to pass
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_gs1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(3)
    })
  })

  // ── tool.execute.before ───────────────────────────────────────────────

  describe('tool.execute.before', () => {
    it('runs unknown-status gates before edit and reports baseline', async () => {
      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_before1' },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(runGate).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('<steering'),
        }),
      )
    })

    it('does not run gates that already have status in gatesState', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_gs_before', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledTimes(1)

      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_gs_before' },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(runGate).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it.each([
      {
        name: 'non-edit/write tool',
        input: { tool: 'read', sessionID: 'ses_before2' },
        output: { args: { filePath: '/workspace/src/main.ts' } },
      },
      {
        name: 'no matching patterns',
        input: { tool: 'edit', sessionID: 'ses_before3' },
        output: { args: { filePath: '/workspace/README.md' } },
      },
    ])('skips gates for $name', async ({ input, output }) => {
      await (plugin['tool.execute.before'] as PluginHook)(input, output)
      expect(runGate).not.toHaveBeenCalled()
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('empty gates config does nothing', async () => {
      vi.mocked(loadQualityGates).mockReturnValue({ gates: [] })
      plugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_empty', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })

    it('normalizes absolute paths and trailing slashes for glob matching', async () => {
      vi.mocked(loadQualityGates).mockReturnValue({
        gates: [{ name: 'opencode-typecheck', patterns: ['.opencode/plugins/**/*.ts'], commands: ['just typecheck'] }],
      })
      plugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      // Absolute path normalized to workspace-relative
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_norm1', '/workspace/.opencode/plugins/foo.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalled()

      // Trailing slash in workspaceRoot
      vi.mocked(loadQualityGates).mockReturnValue({
        gates: [{ name: 'lint', patterns: ['src/**/*.ts'], commands: ['just lint'] }],
      })
      mockContext.directory = '/workspace/'
      plugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_slash', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalled()
    })

    it('treats gate command errors as failures', async () => {
      vi.mocked(runGate).mockRejectedValue(new Error('command not found'))

      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_err', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      const message = vi.mocked(sendMessage).mock.calls[0][0].message as string

      expect(message).toContain('→ fail')
    })

    it('handles null result from runGate as failure', async () => {
      vi.mocked(runGate).mockResolvedValue(null as unknown as CommandResult)

      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_null', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ── runGatePooled ───────────────────────────────────────────────────────

  describe('runGatePooled', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('consolidates same-gate runs under a single promise with debounce', async () => {
      vi.useFakeTimers()
      vi.mocked(loadQualityGates).mockReturnValue({
        gates: fixtureConfig.gates,
        debounceMs: 100,
      })
      plugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)

      const input = { tool: 'edit', sessionID: 'ses_pool_debounce', args: { filePath: '/workspace/src/main.ts' } }

      const handler1 = (plugin['tool.execute.after'] as PluginHook)(input, {})

      const handler2 = (plugin['tool.execute.after'] as PluginHook)(input, {})

      await vi.advanceTimersByTimeAsync(100)
      await handler1
      await handler2

      expect(runGate).toHaveBeenCalledTimes(1)
    })

    it('executes immediately when debounceMs is 0', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_immediate', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalled()
    })

    it('caches the same gate promise while running without debounce', async () => {
      const neverResolving = new Promise<CommandResult>(() => { /* never resolves */ })

      vi.mocked(runGate).mockReturnValue(neverResolving)

      const input = { tool: 'edit', sessionID: undefined, args: { filePath: '/workspace/src/main.ts' } }

      const _handler1 = (plugin['tool.execute.after'] as PluginHook)(input, {})

      const _handler2 = (plugin['tool.execute.after'] as PluginHook)(input, {})

      expect(runGate).toHaveBeenCalledTimes(1)
    })
  })

  // ── Task tool handling ──────────────────────────────────────────────────

  describe('task tool handling', () => {
    it('appends failing gates to task output when task tool completes', async () => {
      resetMockState({
        ses_child_1: {
          qualityGateStatuses: { lint: { dirty: false, status: 'fail' } },
        },
      })

      const output = {
        output: 'Task completed successfully.',
        title: '',
        metadata: { sessionId: 'ses_child_1' },
      }

      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'task', sessionID: 'ses_parent', callID: 'call_1', args: {} },
        output,
      )

      expect(mockState.readState).toHaveBeenCalledWith('ses_child_1', expect.any(Function))
      expect(output.output).toContain('Task completed successfully.')
      expect(output.output).toContain('FAILING QUALITY GATES: lint')
    })

    it('skips when all child gates pass', async () => {
      resetMockState({
        ses_child_1: {
          qualityGateStatuses: { lint: { dirty: false, status: 'pass' } },
        },
      })

      const output = {
        output: 'Task done.',
        title: '',
        metadata: { sessionId: 'ses_child_1' },
      }

      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'task', sessionID: 'ses_parent', callID: 'call_2', args: {} },
        output,
      )

      expect(output.output).toBe('Task done.')
      expect(output.output).not.toContain('FAILING QUALITY GATES')
    })

    it('skips when no child session ID in metadata', async () => {
      const output = { output: 'Task done.', title: '', metadata: {} }

      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'task', sessionID: 'ses_parent', callID: 'call_3', args: {} },
        output,
      )

      expect(output.output).toBe('Task done.')
      expect(mockState.readState).not.toHaveBeenCalled()
    })

    it('skips when task state has no qualityGateStatuses or is null', async () => {
      resetMockState({ ses_child_ns: {} })

      const outputNoStatuses = {
        output: 'Task done.',
        title: '',
        metadata: { sessionId: 'ses_child_ns' },
      }

      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'task', sessionID: 'ses_parent', callID: 'call_4', args: {} },
        outputNoStatuses,
      )
      expect(outputNoStatuses.output).not.toContain('FAILING QUALITY GATES')

      resetMockState({})

      const outputNull = {
        output: 'Task done.',
        title: '',
        metadata: { sessionId: 'ses_child_null' },
      }

      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'task', sessionID: 'ses_parent', callID: 'call_5', args: {} },
        outputNull,
      )
      expect(outputNull.output).toBe('Task done.')
    })

    it('skips non-task tools normally', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_edit', '/workspace/src/main.ts'),
        { output: '', title: '', metadata: {} },
      )
      expect(runGate).toHaveBeenCalled()
    })
  })

  // ── Mutation-killing tests ────────────────────────────────────────────

  describe('mutation killing', () => {
    it('handles undefined args without throwing (optional chaining)', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_mut1', args: undefined },
        baseOutput,
      )
      expect(runGate).not.toHaveBeenCalled()
    })

    it('matches gate when only one pattern matches (some vs every)', async () => {
      vi.mocked(loadQualityGates).mockReturnValue({
        gates: [
          { name: 'mixed', patterns: ['**/*.test.ts', '**/*.spec.ts'], commands: ['just test'] },
        ],
      })
      plugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_mut2', '/workspace/src/main.test.ts'),
        baseOutput,
      )
      expect(runGate).toHaveBeenCalledTimes(1)
    })

    it('uses exact log level string \'info\' (not empty or other value)', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_mut3', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(log)).toHaveBeenCalledWith(
        expect.anything(),
        'info',
        expect.any(String),
        expect.any(String),
      )
      expect(vi.mocked(log)).not.toHaveBeenCalledWith(
        expect.anything(),
        '',
        expect.any(String),
        expect.any(String),
      )
    })

    it('passes noReply: true to sendMessage (not false or omitted)', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_mut4', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
        expect.objectContaining({ noReply: true }),
      )
      expect(vi.mocked(sendMessage)).not.toHaveBeenCalledWith(
        expect.objectContaining({ noReply: false }),
      )
    })

    it('treats exitCode 0 as pass and non-zero as fail', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_mut6a', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(1)

      vi.mocked(runGate).mockResolvedValue({ exitCode: 2, stdout: '', stderr: '' })
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_mut6a', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(2)
    })

    it('deduplicates session IDs in affectedSessions (filter removal kills test)', async () => {
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_dup1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(1)

      // Second call with same session — status unchanged, no new message
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_dup1', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(1)

      // Different session on same gate — still one message total (gate already failed)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_dup2', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(vi.mocked(sendMessage)).toHaveBeenCalledTimes(1)
    })

    it('maps exitCode 0 to \'pass\' in before-handler (line 135 inversion kills test)', async () => {
      vi.mocked(runGate).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_bexit0', args: { filePath: '/workspace/src/main.ts' } },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      const message = vi.mocked(sendMessage).mock.calls[0][0].message as string

      expect(message).toContain('→ pass')
      expect(message).not.toContain('→ fail')
    })

    it('calls sendMessage when tool name is \'write\' (line 49 removal kills test)', async () => {
      await (plugin['tool.execute.after'] as PluginHook)(
        { tool: 'write', sessionID: 'ses_write1', args: { filePath: '/workspace/src/main.ts' } },
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalled()
    })

    it('writes gatesState in before-handler so second call skips known gates (lines 137-145 kill test)', async () => {
      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_gsw1', args: { filePath: '/workspace/src/main.ts' } },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(runGate).toHaveBeenCalledTimes(1)

      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_gsw2', args: { filePath: '/workspace/src/main.ts' } },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(runGate).toHaveBeenCalledTimes(1)
      expect(mockState.readState).toHaveBeenCalledTimes(2)
    })

    it('falls back to default \'/workspace\' when directory is undefined (line 45 nullish coalescing)', async () => {
      const fallbackPlugin = await (qualityGateEnforcer as (context: unknown) => Promise<Record<string, unknown>>)({
        ...mockContext,
        directory: undefined,
      })

      await (fallbackPlugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_dir_undef', args: { filePath: '/workspace/src/main.ts' } },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(runGate).toHaveBeenCalled()
    })

    it('does not read session state when sessionID is undefined (line 59 if-guard)', async () => {
      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: undefined, args: { filePath: '/workspace/src/main.ts' } },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(mockState.readState).not.toHaveBeenCalled()
    })

    it('reads session gate data through the state reader (line 60 cast reader)', async () => {
      resetMockState({
        ses_reader_1: {
          qualityGateStatuses: { lint: { dirty: false, status: 'pass' } },
        },
      })
      await (plugin['tool.execute.before'] as PluginHook)(
        { tool: 'edit', sessionID: 'ses_reader_1', args: { filePath: '/workspace/src/main.ts' } },
        { args: { filePath: '/workspace/src/main.ts' } },
      )
      expect(mockState.readState).toHaveBeenCalledWith('ses_reader_1', expect.any(Function))
      expect(runGate).not.toHaveBeenCalled()
    })

    // ── Line 199: exitCode → status mapping ──────────────────────────────

    it('maps exitCode 0 to \'pass\' and non-zero to \'fail\' in after-handler (line 199)', async () => {
      // exitCode 0 → pass
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_m199_pass', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      const passMessage = vi.mocked(sendMessage).mock.calls[0][0].message as string

      expect(passMessage).toContain('→ pass')
      expect(passMessage).not.toContain('→ fail')

      // exitCode 1 → fail
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_m199_pass', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(2)

      const failMessage = vi.mocked(sendMessage).mock.calls[1][0].message as string

      expect(failMessage).toContain('→ fail')
      expect(failMessage).not.toContain('→ pass')
    })

    // ── Lines 205-206: affectedSessions dedup filter ────────────────────

    it('deduplicates affectedSessions when same session calls after twice (lines 205-206)', async () => {
      vi.mocked(runGate).mockResolvedValue(failureResult)

      // First call — status changes from unknown to fail, session recorded
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_m205_dedup', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      // Second call with same session — status unchanged (fail → fail), no new message
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_m205_dedup', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)
      expect(runGate).toHaveBeenCalledTimes(2)
    })

    // ── Lines 210-211: affectedSessions cleared on pass ─────────────────

    it('clears affectedSessions when gate passes after failure (lines 210-211)', async () => {
      vi.mocked(runGate).mockResolvedValue(failureResult)

      // Gate fails — status changes to fail
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_m210_clear', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      const failMessage = vi.mocked(sendMessage).mock.calls[0][0].message as string

      expect(failMessage).toContain('→ fail')

      // Gate passes — status changes to pass, affectedSessions cleared
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin['tool.execute.after'] as PluginHook)(
        baseInput('ses_m210_clear', '/workspace/src/main.ts'),
        baseOutput,
      )
      expect(sendMessage).toHaveBeenCalledTimes(2)

      const passMessage = vi.mocked(sendMessage).mock.calls[1][0].message as string

      expect(passMessage).toContain('→ pass')
      expect(passMessage).not.toContain('→ fail')
    })
  })
})
