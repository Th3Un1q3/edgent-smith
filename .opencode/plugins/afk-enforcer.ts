import type { Plugin, PluginOptions } from '@opencode-ai/plugin'
import type { Event } from '@opencode-ai/sdk'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { log } from './helpers/logger'
import { sendMessage } from './helpers/session-helpers'
import { AFK_MESSAGE } from './helpers/afk'

const PLUGIN_ID = 'afk-enforcer'

type AfkEnforcerOptions = { flagPath?: string } & PluginOptions

/**
 * Narrowed view of the `permission.asked` bus event.
 *
 * Verified against `EventPermissionAsked` in
 * `@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts`, where `properties.id` is the
 * permission request id and `properties.sessionID` the owning session. The v1
 * `Event` union re-exported from the package root still predates this member,
 * so the event is narrowed structurally rather than by discriminant.
 */
type PermissionAskedProperties = { id: string, sessionID: string }

/** Returns the request/session ids when `event` is a well-formed `permission.asked`. */
const readPermissionAsked = (event: Event): PermissionAskedProperties | undefined => {
  const candidate = event as unknown as { type?: string, properties?: Partial<PermissionAskedProperties> }
  if (candidate.type !== 'permission.asked') return undefined

  const { id, sessionID } = candidate.properties ?? {}
  return typeof id === 'string' && typeof sessionID === 'string' ? { id, sessionID } : undefined
}

export const afkEnforcer: Plugin = async ({ client, directory }, options?) => {
  const { flagPath } = (options ?? {}) as AfkEnforcerOptions
  const resolvedFlagPath = flagPath ?? path.join(directory, '.tmp', 'is_afk')

  await log(client, 'info', 'initialized', PLUGIN_ID)

  const checkAfk = async (): Promise<boolean> => {
    try {
      await access(resolvedFlagPath)
      return true
    }
    catch {
      return false
    }
  }

  return {
    'event': async ({ event }) => {
      const asked = readPermissionAsked(event)
      if (!asked) return

      const isAfk = await checkAfk()
      if (!isAfk) return

      const { id: requestID, sessionID } = asked

      await log(client, 'info', `afk active — rejecting permission ${requestID}`, PLUGIN_ID)

      // `PostSessionIdPermissionsPermissionIdData` carries no reason/message field,
      // so the rejection rationale is delivered by the `sendMessage` steering post below.
      await client.postSessionIdPermissionsPermissionId({
        path: { id: sessionID, permissionID: requestID },
        body: { response: 'reject' },
      })

      await sendMessage({ client, sessionId: sessionID, message: AFK_MESSAGE, noReply: true })
    },

    /**
     * Placeholder for forward compatibility: opencode types this hook but has
     * no runtime dispatch for it, so enforcement lives in `event` above.
     * Registering a no-op keeps the hook wired if a future release starts
     * dispatching it, without double-denying today.
     */
    'permission.ask': async () => {},
  }
}
