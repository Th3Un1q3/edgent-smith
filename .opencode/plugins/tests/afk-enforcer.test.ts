// Tests for afkEnforcer — see plugins/afk-enforcer.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { PluginInput, PluginOptions } from '@opencode-ai/plugin'

import type { Event, Permission } from '@opencode-ai/sdk'

import type { ClientMock } from '@tests/helpers/mock-utilities'

import { makeSessionHelpersMockFactory } from '@tests/helpers/mock-utilities'

import { pluginContextBuilder } from '@tests/__utils/plugin-builder'

import { opencodeClientFactory } from '@tests/__utils/factories/client-factory'

// vi.mock factories come from __utils, avoiding circular dependency with mocked modules
vi.mock('@plugins/helpers/session-helpers', () => makeSessionHelpersMockFactory())
vi.mock('node:fs/promises', () => ({ access: vi.fn() }))

import { sendMessage } from '@plugins/helpers/session-helpers'

import { access } from 'node:fs/promises'

import { afkEnforcer } from '@plugins/afk-enforcer'

import { AFK_MESSAGE } from '@plugins/helpers/afk'

const DEFAULT_FLAG_PATH = '/workspace/.tmp/is_afk'
const REQUEST_ID = 'perm_afk_test'

interface AfkEnforcerPlugin {
  'event': (input: { event: Event }) => Promise<void>
  'permission.ask': (input: Permission, output: { status: 'ask' | 'deny' | 'allow' }) => Promise<void>
}

/**
 * Mirrors `EventPermissionAsked` from
 * `@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts`. The v1 `Event` union exported
 * from the package root predates this member, hence the cast.
 */
const makePermissionAskedEvent = (sessionID: string): Event => ({
  id: 'evt_afk_test',
  type: 'permission.asked',
  properties: {
    id: REQUEST_ID,
    sessionID,
    permission: 'bash',
    patterns: ['*'],
    metadata: {},
    always: [],
  },
} as unknown as Event)

const makeClient = () => ({
  ...opencodeClientFactory(),
  postSessionIdPermissionsPermissionId: vi.fn().mockResolvedValue({}),
})

describe('afkEnforcer', () => {
  let client: ReturnType<typeof makeClient>
  let plugin: AfkEnforcerPlugin

  const makePlugin = async (options?: PluginOptions): Promise<void> => {
    client = makeClient()
    plugin = (await afkEnforcer(
      pluginContextBuilder({ clientFactory: () => client as unknown as ClientMock }) as unknown as PluginInput,
      options,
    )) as unknown as AfkEnforcerPlugin
  }

  beforeEach(async () => {
    await makePlugin()
  })

  describe('event — permission.asked', () => {
    describe('when the afk flag file exists', () => {
      beforeEach(() => {
        vi.mocked(access).mockResolvedValue(undefined)
      })

      it('rejects the pending permission request via the client', async () => {
        await plugin.event({ event: makePermissionAskedEvent('ses_afk') })
        expect(client.postSessionIdPermissionsPermissionId).toHaveBeenCalledWith({
          path: { id: 'ses_afk', permissionID: REQUEST_ID },
          body: { response: 'reject' },
        })
      })

      it('posts the steering afk message into the session with noReply', async () => {
        await plugin.event({ event: makePermissionAskedEvent('ses_afk') })
        expect(sendMessage).toHaveBeenCalledWith({ client, sessionId: 'ses_afk', message: AFK_MESSAGE, noReply: true })
      })

      it('checks the default flag path under the workspace directory when no options are given', async () => {
        await plugin.event({ event: makePermissionAskedEvent('ses_default') })
        expect(vi.mocked(access)).toHaveBeenCalledWith(DEFAULT_FLAG_PATH)
      })

      it('ignores events that are not permission.asked', async () => {
        await plugin.event({ event: { type: 'session.idle', properties: { sessionID: 'ses_idle' } } as unknown as Event })
        expect(client.postSessionIdPermissionsPermissionId).not.toHaveBeenCalled()
        expect(sendMessage).not.toHaveBeenCalled()
      })
    })

    describe('when the afk flag file is missing', () => {
      beforeEach(() => {
        vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      })

      it('does not reject the permission request', async () => {
        await plugin.event({ event: makePermissionAskedEvent('ses_present') })
        expect(client.postSessionIdPermissionsPermissionId).not.toHaveBeenCalled()
      })

      it('does not send a message', async () => {
        await plugin.event({ event: makePermissionAskedEvent('ses_present') })
        expect(sendMessage).not.toHaveBeenCalled()
      })
    })

    describe('when a custom flagPath option is provided', () => {
      beforeEach(async () => {
        await makePlugin({ flagPath: '/custom/path/is_afk' })
        vi.mocked(access).mockResolvedValue(undefined)
      })

      it('checks the custom flag path instead of the default', async () => {
        await plugin.event({ event: makePermissionAskedEvent('ses_custom') })
        expect(vi.mocked(access)).toHaveBeenCalledWith('/custom/path/is_afk')
        expect(vi.mocked(access)).not.toHaveBeenCalledWith(DEFAULT_FLAG_PATH)
      })
    })
  })

  describe('permission.ask placeholder', () => {
    beforeEach(() => {
      vi.mocked(access).mockResolvedValue(undefined)
    })

    it('is a no-op that leaves the permission status unchanged', async () => {
      const input = { id: REQUEST_ID, sessionID: 'ses_placeholder' } as unknown as Permission
      const output = { status: 'ask' as const }

      await expect(plugin['permission.ask'](input, output)).resolves.toBeUndefined()
      expect(output.status).toBe('ask')
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })
})

describe('AFK_MESSAGE', () => {
  it('is wrapped in a steering element with warning priority and a reason attribute', () => {
    expect(AFK_MESSAGE).toMatch(/^<steering\s+priority="warning"\s+reason="[^"]+"[^>]*>[\s\S]*<\/steering>$/)
  })

  it('pushes the agent to continue with alternative tools when not completely blocked', () => {
    expect(AFK_MESSAGE).toContain('continue')
    expect(AFK_MESSAGE).toContain('alternative')
  })

  it('tells the agent to report progress and the exact blockage when fully blocked', () => {
    expect(AFK_MESSAGE).toContain('report')
    expect(AFK_MESSAGE).toContain('blockage')
  })
})
