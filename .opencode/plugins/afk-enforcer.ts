import type { Plugin, PluginOptions } from '@opencode-ai/plugin'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { log } from './helpers/logger'
import { sendMessage } from './helpers/session-helpers'

const PLUGIN_ID = 'afk-enforcer'

export const AFK_MESSAGE = '<steering priority="warning" reason="user is away from keyboard — permission auto-denied by afk-enforcer plugin">Permission auto-denied: the user is AFK and cannot approve this request. Do not retry; continue with available tools or stop and report the blocked step.</steering>'

type AfkEnforcerOptions = { flagPath?: string } & PluginOptions

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
    'permission.ask': async (input, output) => {
      const isAfk = await checkAfk()

      await log(client, 'info', `afk evaluatied as ${isAfk ? 'true' : 'false'}`, PLUGIN_ID)

      if (!isAfk) return

      output.status = 'deny'

      if (input.sessionID && client) {
        await sendMessage({
          client,
          sessionId: input.sessionID,
          message: AFK_MESSAGE,
          noReply: true,
        })
      }
    },
  }
}
