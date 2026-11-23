import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Imported before `node:fs/promises` so the harness mocks are registered first.
import {
  idle,
  makeHarness,
  register,
  reminderSynthetics,
  resetScenario,
  reviewKey,
  shell,
  statusIdle,
  stopPluginFibers,
  storedProblems,
  storedReview,
  tlrConfig,
  toolEvent,
} from '@tests/helpers/tool-limit-reminder/harness'

import { writeFile } from 'node:fs/promises'

beforeEach(resetScenario)
afterEach(stopPluginFibers)

describe('tool-limit-reminder review export', () => {
  describe('review export', () => {
    it('retains review state when the export fails and retries on the next idle', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      expect(storedProblems(h, 'ses_1')).toHaveLength(1)

      shell.exitCode = 1
      await h.emit(idle('ses_1'))

      expect(storedProblems(h, 'ses_1')).toHaveLength(1)
      expect(h.sessions.get('ses_1')?.metadata).toEqual({ needsReview: true })
      expect(vi.mocked(writeFile)).not.toHaveBeenCalled()

      shell.exitCode = 0
      await h.emit(idle('ses_1'))

      expect(h.storage.has(reviewKey('ses_1'))).toBe(false)
      expect(h.sessions.get('ses_1')?.metadata).toEqual({})
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(writeFile).mock.calls[0][0]).toBe('/workspace/.tmp/session-review/ses_1/problems.md')
      expect(String(vi.mocked(writeFile).mock.calls[0][1])).toContain('# Reported Threshold Violations')
    })

    it('clears the flag with a read-modify-write that preserves sibling metadata', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      h.sessions.set('ses_1', { agent: 'build', metadata: { keep: 'yes' } })
      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      await h.emit(idle('ses_1'))

      expect(h.sessions.get('ses_1')?.metadata).toEqual({ keep: 'yes' })
      expect(h.sessionUpdates.at(-1)?.metadata).toEqual({ keep: 'yes' })
      expect(h.sessionUpdates.every(update => update.metadata !== undefined)).toBe(true)
    })
  })

  describe('idle triggers', () => {
    it('exports on a session.status idle event', async () => {
      tlrConfig.limits = { build: 1 }
      tlrConfig.padding = 1

      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      await h.emit(statusIdle('ses_1'))

      expect(h.storage.has(reviewKey('ses_1'))).toBe(false)
    })

    it('resets the attempt counter on idle', async () => {
      tlrConfig.limits = { build: 1 }

      const h = makeHarness()

      await register(h)
      await h.before(toolEvent('read'))
      await h.before(toolEvent('read'))

      expect(reminderSynthetics(h)).toHaveLength(1)

      await h.emit(idle('ses_1'))
      await h.before(toolEvent('read'))

      expect(reminderSynthetics(h)).toHaveLength(1)
    })

    it('replays a pre-existing review record at registration and drains the scan', async () => {
      const h = makeHarness()

      h.storage.set(reviewKey('ses_a'), storedReview(5))
      h.storage.set(reviewKey('ses_b'), storedReview(6))

      await register(h)

      expect(h.storage.has(reviewKey('ses_a'))).toBe(false)
      expect(h.storage.has(reviewKey('ses_b'))).toBe(false)
      expect(shell.commands).toHaveLength(2)
      expect(shell.commands.every(command => command.includes('export-opencode-session'))).toBe(true)
    })
  })
})
