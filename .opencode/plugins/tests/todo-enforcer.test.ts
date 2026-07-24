

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"
import { pluginContextBuilder } from "@tests/__utils/plugin-builder"

import { log } from "@plugins/helpers/logger"
import { sendMessage } from "@plugins/helpers/session-helpers"
import { SessionStorage } from "@plugins/helpers/kv-store"

import { todoEnforcer } from "@plugins/todo-enforcer"
import { opencodeClientFactory } from "@tests/__utils/factories/client-factory"

vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())
vi.mock("@plugins/helpers/logger")
vi.mock("@plugins/helpers/session-helpers")


interface TodoEnforcerPlugin {
  dispose?: () => Promise<void>
  "event"?: (input: Record<string, unknown>) => Promise<void>
  "tool.execute.before": (
    input: { sessionID?: string; tool: string },
    output?: { args?: Record<string, unknown> },
  ) => Promise<void>
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

  describe("plugin initialization", () => {
    it("logs init message with exact plugin ID and log level", async () => {
      await todoEnforcer(pluginContext as never)
      expect(log).toHaveBeenCalledWith(
        expect.any(Object), "info",
        "todo-enforcer initialized",
      )
    })
  })

  describe("tool.execute.before", () => {
    it("blocks the task tool for rug agent that has not used todos yet", async () => {
      const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
      const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

      await expect(
        beforeHook({ sessionID: "ses_test", tool: "task" }),
      ).rejects.toThrow(/Error calling task\. All tools are suspended until `todowrite` is called with updated todo list\./)

      // Verify log was called before the error was thrown (kills mutants #15, #16)
      expect(log).toHaveBeenCalledWith(
        expect.any(Object), "info",
        expect.stringContaining("[todo-enforcer] enforcing todo requirement for task tool on session ses_test"),
      )
    })

    it("allows non-task tools freely regardless of agent or todo state", async () => {
      const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
      const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

      for (const tool of ["question", "bash", "write", "edit"]) {
        await expect(
          beforeHook({ sessionID: `ses_${tool}`, tool }),
        ).resolves.toBeUndefined()
      }
    })

    it("includes the full sample todo structure with all fields in the error message for task tool", async () => {
      const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
      const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

      await expect(
        beforeHook({ sessionID: "ses_test1", tool: "task" }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('"content":"#plan express the plan in todos; assignee: @rug"'),
        }),
      )
      await expect(
        beforeHook({ sessionID: "ses_test2", tool: "task" }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('"status":"pending"'),
        }),
      )
      await expect(
        beforeHook({ sessionID: "ses_test3", tool: "task" }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('"priority":"high"'),
        }),
      )
      await expect(
        beforeHook({ sessionID: "ses_test4", tool: "task" }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('"id":"1"'),
        }),
      )
    })

    it("passes todowrite through unconditionally regardless of agent or todo state", async () => {
      const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
      const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }, output?: { args?: Record<string, unknown> }) => Promise<void>

      await expect(
        beforeHook({ sessionID: "ses_test", tool: "todowrite" }),
      ).resolves.toBeUndefined()
    })

    describe("task tool edge cases", () => {
      it("skips enforcement for task tool with undefined sessionID (early return on line 61)", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]
        await expect(
          beforeHook({ sessionID: undefined, tool: "task" }),
        ).resolves.toBeUndefined()
      })

      it("bypasses todo enforcement when task tool has output.args.command", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_test", tool: "task" }, { args: { command: "some-command" } }),
        ).resolves.toBeUndefined()
      })

      it("logs skipping enforcement message when task tool has command", async () => {
        vi.mocked(log).mockClear()
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]
        await beforeHook({ sessionID: "ses_test", tool: "task" }, { args: { command: "some-command" } })
        expect(log).toHaveBeenCalledWith(
          expect.any(Object), "info",
          expect.stringContaining("skipping enforcement"),
        )
      })

      it("handles output without args gracefully (kills optional chaining mutant)", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as any
        await expect(
          plugin["tool.execute.before"]({ sessionID: "ses_test", tool: "task" }, {}),
        ).rejects.toThrow(/Error calling task/)
      })
    })



    describe("hasUsedTodos true skips enforcement for task tool", () => {
      it("skips task enforcement when readState returns true (todos already used since last message)", async () => {
        SessionStorage.reset({
          ses_has_todos: {
            toolCalls: { todowrite: "2026-01-01T02:00:00Z" },
            lastMessageSentAt: "2026-01-01T01:00:00Z",
          },
        })

        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_has_todos", tool: "task" }),
        ).resolves.toBeUndefined()
      })

      it("blocks task when todowrite call is older than last message (hasUsedTodos is false)", async () => {
        SessionStorage.reset({
          ses_old_todo: {
            toolCalls: { todowrite: "2026-01-01T00:00:00Z" },
            lastMessageSentAt: "2026-01-01T01:00:00Z",
          },
        })

        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_old_todo", tool: "task" }),
        ).rejects.toThrow(/Error calling task\. All tools are suspended/)
      })

      it("blocks task when todowrite timestamp equals last message timestamp (strict-greater-than boundary)", async () => {
        SessionStorage.reset({
          ses_equal_times: {
            toolCalls: { todowrite: "2026-01-01T01:00:00Z" },
            lastMessageSentAt: "2026-01-01T01:00:00Z",
          },
        })

        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_equal_times", tool: "task" }),
        ).rejects.toThrow(/Error calling task\. All tools are suspended/)
      })

      it("blocks task when toolCalls state exists but todowrite key is missing", async () => {
        SessionStorage.reset({
          ses_no_todowrite: {
            toolCalls: { someOtherTool: "2026-01-01T02:00:00Z" },
            lastMessageSentAt: "2026-01-01T01:00:00Z",
          },
        })

        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_no_todowrite", tool: "task" }),
        ).rejects.toThrow(/Error calling task\. All tools are suspended/)
      })

      it("allows task when todowrite exists but lastMessageSentAt is missing (treated as true)", async () => {
        SessionStorage.reset({
          ses_no_msg_at: {
            toolCalls: { todowrite: "2026-01-01T02:00:00Z" },
          },
        })

        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_no_msg_at", tool: "task" }),
        ).resolves.toBeUndefined()
      })

      it("blocks task when todowrite missing and lastMessageSentAt absent (kills mutant #18)", async () => {
        SessionStorage.reset({
          ses_no_todowrite_no_msg: {
            toolCalls: { someOtherTool: "2026-01-01T02:00:00Z" },
            // Intentionally OMIT lastMessageSentAt so the mutated path differs
          },
        })

        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"]

        await expect(
          beforeHook({ sessionID: "ses_no_todowrite_no_msg", tool: "task" }),
        ).rejects.toThrow(/Error calling task\. All tools are suspended/)
      })
    })

    describe("non-rug agent bypass", () => {
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

      it("allows non-rug agents to use task tool without todos", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        const beforeHook = plugin["tool.execute.before"] as (input: { sessionID?: string; tool: string }) => Promise<void>

        await expect(
          beforeHook({ sessionID: "ses_test", tool: "task" }),
        ).resolves.toBeUndefined()
      })
    })

    describe("missing sessionID skips enforcement", () => {
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
        vi.mocked(log).mockImplementation(async () => {})
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
          expect.any(Object), "info",
          expect.stringContaining("Session was cancelled after last message — skipping followup."),
        )

        expect(sendMessage).not.toHaveBeenCalled()
      })

      it("follows up when cancelled before last message", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
         
        const client = (pluginContext as any).client as { session: { todo: ReturnType<typeof vi.fn> } }
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
        expect(client.session.todo).toHaveBeenCalledWith({ path: { id: "test_session" } })
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining('<steering priority="high" reason="incomplete todos remain" type="todo">'),
        }))
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining("content of todo item"),
        }))
      })

      it("returns early when no remaining todos", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        pluginContext = pluginContextBuilder({
          clientFactory: () => opencodeClientFactory({
            agentName: "rug",
            todoList: [],
          }) as never,
        })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        expect(log).toHaveBeenCalledWith(
          expect.any(Object), "info",
          expect.stringContaining("No remaining todos"),
        )
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
      })

      it("handles null todo data gracefully (kills no-coverage mutant on line 53)", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        vi.useFakeTimers()

        // Override client.session.todo to return null data, forcing the || [] fallback
        const client = (pluginContext as any).client as { session: { todo: ReturnType<typeof vi.fn> } }
        vi.mocked(client.session.todo).mockResolvedValue({ data: null })

        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as any
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)

        // Without mutation: null || [] gives [] -> remainingTodos empty -> logs "No remaining todos"
        // With mutation: null || ["Stryker was here"] gives items -> sendMessage called instead
        await vi.waitFor(() =>
          expect(log).toHaveBeenCalledWith(
            expect.any(Object), "info",
            "No remaining todos — clearing cancellation state.",
          ),
        )
        vi.useRealTimers()
      })

      it("ignores non-idle events without extracting todos or sending messages even after timeout elapses", async () => {
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.started" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
        vi.useRealTimers()
      })

      it("ignores idle event when sessionID is missing from properties even after timeout elapses", async () => {
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: {} } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        expect(sendMessage).not.toHaveBeenCalled()
        vi.useRealTimers()
      })

      it("filters out completed and cancelled todos, keeping only pending and in_progress", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        pluginContext = pluginContextBuilder({
          clientFactory: () => opencodeClientFactory({
            agentName: "rug",
            todoList: [
              { status: "pending" as const, content: "pending item", priority: "medium", id: "1" },
              { status: "completed" as const, content: "completed item", priority: "medium", id: "2" },
              { status: "cancelled" as const, content: "cancelled item", priority: "medium", id: "3" },
              { status: "in_progress" as const, content: "in progress item", priority: "medium", id: "4" },
            ],
          }) as never,
        })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining("pending item"),
        }))
        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining("in progress item"),
        }))
        expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining("completed item"),
        }))
        expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
          message: expect.stringContaining("cancelled item"),
        }))
      })

      it("sends follow-up when cancelledAt is missing from session state", async () => {
        SessionStorage.reset({ test_session: { lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
      })

      it("sends follow-up when lastMessageSentAt is missing from session state", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
      })

      it("skips follow-up when cancelledAt equals lastMessageSentAt (boundary for strict-less-than comparison)", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T01:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() =>
          expect(log).toHaveBeenCalledWith(
            expect.any(Object), "info",
            expect.stringContaining("Session was cancelled after last message — skipping followup."),
          ),
        )
        expect(sendMessage).not.toHaveBeenCalled()
      })

      it("verifies sendMessage is called with the correct steering message payload and todo content", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() =>
          expect(sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              client: expect.any(Object),
              sessionId: "test_session",
              message: expect.stringContaining('<steering priority="high" reason="incomplete todos remain" type="todo">'),
            }),
          ),
        )
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("content of todo item"),
          }),
        )
      })

      it("renders exact status symbols [ ] and [•] for pending and in_progress todos in the follow-up message", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        pluginContext = pluginContextBuilder({
          clientFactory: () => opencodeClientFactory({
            agentName: "rug",
            todoList: [
              { status: "pending" as const, content: "pending task", priority: "medium", id: "1" },
              { status: "in_progress" as const, content: "in progress task", priority: "medium", id: "2" },
            ],
          }) as never,
        })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("[ ] pending task"),
          }),
        )
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("[•] in progress task"),
          }),
        )
      })

      it("separates multiple remaining todos with newlines in the follow-up message", async () => {
        SessionStorage.reset({ test_session: { cancelledAt: "2026-01-01T00:00:00Z", lastMessageSentAt: "2026-01-01T01:00:00Z" } })
        pluginContext = pluginContextBuilder({
          clientFactory: () => opencodeClientFactory({
            agentName: "rug",
            todoList: [
              { status: "pending" as const, content: "first todo", priority: "medium", id: "1" },
              { status: "pending" as const, content: "second todo", priority: "medium", id: "2" },
              { status: "in_progress" as const, content: "third todo", priority: "medium", id: "3" },
            ],
          }) as never,
        })
        vi.useFakeTimers()
        const eventInput = { event: { type: "session.idle" as const, properties: { sessionID: "test_session" } } }
        const plugin = await todoEnforcer(pluginContext as never) as unknown as TodoEnforcerPlugin
        await plugin["event"]?.(eventInput)
        vi.advanceTimersByTime(1001)
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
        expect(sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringMatching(/\[ \] first todo\n\[ \] second todo\n\[•\] third todo/),
          }),
        )
      })
    })

    describe("dispose", () => {
      it("logs dispose message on cleanup", async () => {
        const plugin = await todoEnforcer(pluginContext as never) as TodoEnforcerPlugin
        await plugin?.dispose?.()
        expect(log).toHaveBeenCalledWith(
          expect.any(Object), "info",
          expect.stringContaining("todo-enforcer disposed"),
        )
      })
    })
  })
})
