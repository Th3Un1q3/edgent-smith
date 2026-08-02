import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OpencodeClient } from '@opencode-ai/sdk'

const makeMockClient = () => {
  return {
    app: { log: vi.fn().mockResolvedValue(undefined) },
  } as unknown as OpencodeClient & { app: { log: ReturnType<typeof vi.fn> } }
}

const loadLog = async () => {
  const { log } = await import('@plugins/helpers/logger')
  return { log, client: makeMockClient() }
}

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('log levels', () => {
    const levels = ['debug', 'info', 'warn', 'error'] as const

    it.each(levels)('logs with level \'%s\'', async (level) => {
      const { log, client } = await loadLog()

      await log(client, level, `test ${level}`)
      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: 'harness-plugin', level, message: `[harness-plugin] test ${level}` },
      })
    })

    it('defaults to \'info\' when level is omitted', async () => {
      const { log, client } = await loadLog()

      await log(client, undefined as unknown as 'debug' | 'info' | 'warn' | 'error', 'default test')
      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: 'harness-plugin', level: 'info', message: '[harness-plugin] default test' },
      })
    })
  })

  describe('plugin ID', () => {
    it('uses provided pluginId for service and message prefix', async () => {
      const { log, client } = await loadLog()

      await log(client, 'info', 'custom test', 'my-plugin')
      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: 'my-plugin', level: 'info', message: '[my-plugin] custom test' },
      })
    })

    it('falls back to PLUGIN_ID when pluginId is undefined', async () => {
      const { log, client } = await loadLog()

      await log(client, 'warn', 'fallback test', undefined)
      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: 'harness-plugin', level: 'warn', message: '[harness-plugin] fallback test' },
      })
    })

    it('exports PLUGIN_ID as \'harness-plugin\'', async () => {
      const { PLUGIN_ID } = await import('@plugins/helpers/logger')

      expect(PLUGIN_ID).toBe('harness-plugin')
    })
  })

  describe('edge cases', () => {
    it('returns void on success', async () => {
      const { log, client } = await loadLog()

      expect(await log(client, 'info', 'test')).toBeUndefined()
    })

    it('handles empty string message', async () => {
      const { log, client } = await loadLog()

      await log(client, 'info', '')
      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: 'harness-plugin', level: 'info', message: '[harness-plugin] ' },
      })
    })

    it('throws when client is null', async () => {
      const { log } = await loadLog()

      await expect(log(null as unknown as OpencodeClient, 'warn', 'no client')).rejects.toThrow()
    })
  })
})
