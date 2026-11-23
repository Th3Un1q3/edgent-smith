import '@tests/workflow/plugin-mocks'

import { Effect, Logger, Stream } from 'effect'

import type { Context } from '@opencode/plugin/effect/plugin'

import { entryClient, subtaskFactory } from '@tests/workflow/plugin-state'
import { REPO_ROOT } from '@tests/helpers/repo-root'

import plugin, { handleSessionEvent } from '@plugins/workflow'

import type { WorkflowSessionHandlerOptions } from '@plugins/workflow'

// Host context for the workflow suites. The tool, session and event members mirror
// @opencode/plugin/dist/effect/{tool,session,event}.d.ts for the surface production
// touches; a hand-built payload shape must be copied from those files, never invented.

export interface SessionEventPayload {
  type: string
  data: { sessionID: string, agent?: string }
}

export interface Harness {
  context: Context
  tools: Array<Record<string, unknown>>
  logs: Array<ReadonlyArray<unknown>>
  subscriptions: number
}

export const collectLogger = (logs: Harness['logs']): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message : [message])
  })

export const makeHarness = (events: SessionEventPayload[] = [], session: Record<string, unknown> = {}): Harness => {
  const tools: Array<Record<string, unknown>> = []
  const logs: Array<ReadonlyArray<unknown>> = []
  let subscriptions = 0
  const context = {
    options: {},
    location: { directory: REPO_ROOT },
    event: {
      subscribe: () => {
        subscriptions += 1
        return events.length === 0 ? Stream.empty : Stream.fromIterable(events).pipe(Stream.concat(Stream.never))
      },
    },
    tool: {
      transform: (callback: (editor: unknown) => void) => {
        callback({
          add: (tool: unknown) => { tools.push(tool as unknown as Record<string, unknown>) },
          namespace: () => {},
          update: () => {},
          remove: () => {},
          list: () => [],
          get: () => {},
        })
        return Effect.succeed({ dispose: Effect.void })
      },
      hook: () => Effect.succeed({ dispose: Effect.void }),
    },
    session: {
      create: () => Effect.succeed({ id: 'ses_child' }),
      prompt: () => Effect.succeed({}),
      fork: () => Effect.succeed({ id: 'ses_fork' }),
      context: () => Effect.succeed([]),
      interrupt: () => Effect.succeed(undefined),
      update: () => Effect.succeed(undefined),
      ...session,
    },
  } as unknown as Context

  return {
    context,
    tools,
    logs,
    get subscriptions() { return subscriptions },
  }
}

export const emitSessionEvent = async (
  event: SessionEventPayload,
  options?: WorkflowSessionHandlerOptions,
): Promise<Harness['logs']> => {
  const logs: Harness['logs'] = []
  const effect = handleSessionEvent(event, options ?? {
    agentAllowlist: new Set(['rug', 'rug-swe']),
    block: 'BLOCK-BODY',
  })

  await Effect.runPromise(Effect.withLogger(collectLogger(logs))(effect))

  return logs
}

export const register = async (h: Harness): Promise<void> => {
  const effect = Effect.scoped(plugin.effect(h.context))

  await Effect.runPromise(Effect.withLogger(collectLogger(h.logs))(effect))
}

export const executeTool = async <T>(tool: Record<string, unknown>, input: unknown, sessionID = 'ses_parent'): Promise<T> => {
  const execute = tool.execute as (toolInput: unknown, toolContext: { sessionID: string }) => Effect.Effect<T>

  return await Effect.runPromise(execute(input, { sessionID }))
}

// vitest resets every mock before each case (`mockReset: true`); this restores the
// statuses the suites assert on.
export const resetWorkflowMocks = (): void => {
  entryClient.writeEntry.mockReset().mockResolvedValue({ status: 'written' })
  entryClient.removeEntry.mockReset().mockResolvedValue({ status: 'absent' })
  subtaskFactory.createSubtask.mockReset()
}
