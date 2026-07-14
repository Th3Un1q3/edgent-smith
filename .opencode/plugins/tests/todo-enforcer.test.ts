

import { describe, it, expect, vi } from "vitest"
import { makeKvStoreMockFactory } from "./__utils__/kv-store.mock"
import { defaultCreateClient, } from "./helpers/mock-utils"

import { pluginContextBuilder } from "./__utils__/plugin-builder"

import { log } from "../helpers/logger"
import { sendMessage } from "../helpers/session-helpers"
import { SessionStorage, type State } from "../helpers/kv-store"

import { todoEnforcer } from "../todo-enforcer"
import { opencodeClientFactory } from "./__utils__/factories/client-factory"

vi.mock(
  "../helpers/kv-store",
  () => makeKvStoreMockFactory(),
)

vi.mock("../helpers/logger")

vi.mock("../helpers/session-helpers")


interface TodoEnforcerPlugin {
  dispose?: () => Promise<void>
  "event"?: (input: Record<string, unknown>) => Promise<void>
  "tool.execute.before": (input: { sessionID?: string; tool: string }) => Promise<void>
}

/** Create a client mock that also includes `.client.session.todo` returning the given todos array. */
function defaultCreateClientWithTodo(todos: Array<Record<string, unknown>>) {
  const todoMock = vi.fn().mockResolvedValue({ data: todos }) as ReturnType<typeof vi.fn>

  // Build the nested session object with both get and todo on the same object reference.
  const clientSession = Object.assign(
    Object.create(null),
    { get: vi.fn().mockResolvedValue({ data: { agent: "rug" } }), todo: todoMock },
  )

  // Build the full client mock. The Plugin destructures `{ client }` from the argument,
  // so we must provide `.client.session`. Use `as never` to bypass type-checking on property access.
  const base: Record<string, unknown> & { client?: Record<string, unknown> } = defaultCreateClient("rug") as any
  return Object.assign(base, {
    client: Object.assign({}, (base.client || {}), { session: clientSession }),
  }) as never
}

describe("todoEnforcer", () => {
  let pluginContext: ReturnType<typeof pluginContextBuilder>
  beforeEach(() => {
    SessionStorage.reset()
    pluginContext = pluginContextBuilder({
      clientFactory: () => opencodeClientFactory({
        agentName: "rug",
        todoList: [],
      }) as never,
    })
  })

  describe("tool.execute.before", () => {
    it("blocks non-todowrite tools for rug agent that has not used todos yet", async () => {
      const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin

      const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

      await expect(
        beforeHook({ sessionID: "ses_test", tool: "question" }),
      ).rejects.toThrow(/Error calling question\. All tools are suspended until `todowrite` is called with updated todo list\./)
    })

    describe("guard condition: todowrite pass-through", () => {
      it("passes todowrite through unconditionally regardless of agent or todo state", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin

        const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

        await expect(
          beforeHook({ sessionID: "ses_test", tool: "todowrite" }),
        ).resolves.toBeUndefined()
      })
    })

    describe("guard condition: non-rug agent bypass", () => {
      beforeEach(() => {
        pluginContext = pluginContextBuilder({
          clientFactory: () => opencodeClientFactory({
            agentName: "non-rug",
            todoList: [],
          }) as never,
        })
      })


      it("allows non-rug agents to use any tool without enforcement when readState returns false", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin

        const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

        await expect(
          beforeHook({ sessionID: "ses_test", tool: "write" }),
        ).resolves.toBeUndefined()
      })
    })

    describe("guard condition: missing sessionID skips enforcement", () => {
      it("returns early without error when sessionID is undefined even for rug agent with non-todowrite tool", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin

        const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

        await expect(
          beforeHook({ sessionID: undefined, tool: "question" }),
        ).resolves.toBeUndefined()
      })
    })

    describe("event", () => {
      beforeEach(() => {
        pluginContext = pluginContextBuilder({
          clientFactory: () => opencodeClientFactory({
            agentName: "rug",
            todoList: [{ status: 'pending', content: 'content of todo item', priority: 'medium', id: '1' }],
          }) as never,
        })
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it("sends follow-up when shouldFollowUp is true", async () => {
        vi.mocked(log).mockImplementation((_client, ...params) => Promise.resolve(console.log(...params)))
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })

        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
      })

      it("skips follow-up when cancelled after last message", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T01:00:00Z", lastMessageSentAt: "2026-01-01T00:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        expect(log).toHaveBeenCalledWith(
          expect.any(Object),
          "info",
          expect.stringContaining("Session was cancelled after last message — skipping followup."),
        )

        expect(sendMessage).not.toHaveBeenCalled()
      })

      it("follows up when cancelled before last message", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining("content of todo item"),
        }))
      })

      describe('when there are no todos remaining', () => {
        beforeEach(() => {
          SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
          pluginContext = pluginContextBuilder({
            clientFactory: () => opencodeClientFactory({
              agentName: "rug",
              todoList: [],
            }) as never,
          })
        })

        it("returns early when no remaining todos", async () => {
          const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
          const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
          await plugin["event"]?.(eventInput)
          expect(log).toHaveBeenCalledWith(
            expect.any(Object),
            "info",
            expect.stringContaining("No remaining todos"),
          )
          vi.advanceTimersByTime(1001)
          expect(sendMessage).not.toHaveBeenCalled()
        })
      })
    })

    describe("dispose", () => {
      it("logs dispose message on cleanup", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        await plugin?.dispose?.()
        expect(log).toHaveBeenCalledWith(
          expect.any(Object),
          "info",
          expect.stringContaining("todo-enforcer disposed"),
        )
      })
    })
  })
})
