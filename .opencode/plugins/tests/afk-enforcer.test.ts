// Tests for afkEnforcer — see plugins/afk-enforcer.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { PluginInput, PluginOptions } from '@opencode-ai/plugin'

import type { Permission } from '@opencode-ai/sdk'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeSessionHelpersMockFactory } from '@tests/helpers/mock-utilities'

import { pluginContextBuilder } from '@tests/__utils/plugin-builder'

import { opencodeClientFactory } from '@tests/__utils/factories/client-factory'

// vi.mock factories come from __utils, avoiding circular dependency with mocked modules
vi.mock('@plugins/helpers/session-helpers', () => makeSessionHelpersMockFactory())
vi.mock('node:fs/promises', () => ({ access: vi.fn() }))

import { sendMessage } from '@plugins/helpers/session-helpers'

import { access } from 'node:fs/promises'

import { afkEnforcer, AFK_MESSAGE } from '@plugins/afk-enforcer'

const DEFAULT_FLAG_PATH = '/workspace/.tmp/is_afk'

interface AfkEnforcerPlugin {
  'permission.ask': (input: Permission, output: { status: 'ask' | 'deny' | 'allow' }) => Promise<void>
}

const makePermissionInput = (sessionID: string): Permission => ({
  id: 'perm_afk_test',
  type: 'bash',
  sessionID,
  messageID: 'msg_afk_test',
  title: 'Run command',
  metadata: {},
  time: { created: 1_700_000_000_000 },
})

describe('afkEnforcer', () => {
  let client: ReturnType<typeof opencodeClientFactory>
  let plugin: AfkEnforcerPlugin

  const makePlugin = async (options?: PluginOptions): Promise<void> => {
    client = opencodeClientFactory()
    plugin = (await afkEnforcer(
      pluginContextBuilder({ clientFactory: () => client as unknown as ClientMock }) as unknown as PluginInput,
      options,
    )) as AfkEnforcerPlugin
  }

  beforeEach(async () => {
    await makePlugin()
  })

  describe('permission.ask', () => {
    describe('when the afk flag file exists', () => {
      beforeEach(() => {
        vi.mocked(access).mockResolvedValue(undefined)
      })

      it('denies the permission and posts the afk message with noReply', async () => {
        const output = { status: 'ask' as const }

        await plugin['permission.ask'](makePermissionInput('ses_afk'), output)
        expect(output.status).toBe('deny')
        expect(sendMessage).toHaveBeenCalledWith({ client, sessionId: 'ses_afk', message: AFK_MESSAGE, noReply: true })
      })

      it('checks the default flag path under the workspace directory when no options are given', async () => {
        const output = { status: 'ask' as const }

        await plugin['permission.ask'](makePermissionInput('ses_default'), output)
        expect(vi.mocked(access)).toHaveBeenCalledWith(DEFAULT_FLAG_PATH)
      })
    })

    describe('when the afk flag file is missing', () => {
      beforeEach(() => {
        vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      })

      it('leaves the permission status unchanged and does not send a message', async () => {
        const output = { status: 'ask' as const }

        await plugin['permission.ask'](makePermissionInput('ses_present'), output)
        expect(output.status).toBe('ask')
        expect(sendMessage).not.toHaveBeenCalled()
      })
    })

    describe('when a custom flagPath option is provided', () => {
      beforeEach(async () => {
        await makePlugin({ flagPath: '/custom/path/is_afk' })
        vi.mocked(access).mockResolvedValue(undefined)
      })

      it('checks the custom flag path instead of the default', async () => {
        const output = { status: 'ask' as const }

        await plugin['permission.ask'](makePermissionInput('ses_custom'), output)
        expect(vi.mocked(access)).toHaveBeenCalledWith('/custom/path/is_afk')
        expect(vi.mocked(access)).not.toHaveBeenCalledWith(DEFAULT_FLAG_PATH)
      })
    })

    describe('when the permission input lacks a sessionID', () => {
      beforeEach(() => {
        vi.mocked(access).mockResolvedValue(undefined)
      })

      it('still denies the permission without sending a message or throwing', async () => {
        const input = { ...makePermissionInput('ses_missing'), sessionID: undefined } as unknown as Permission
        const output = { status: 'ask' as const }

        await expect(plugin['permission.ask'](input, output)).resolves.toBeUndefined()
        expect(output.status).toBe('deny')
        expect(sendMessage).not.toHaveBeenCalled()
      })
    })
  })
})
