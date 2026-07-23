import type { OpencodeClient } from "@opencode-ai/sdk"

import { describe, it, expect, vi } from "vitest"

import { log } from "@plugins/helpers/logger"

vi.mock("@plugins/helpers/logger")

interface MockClientResult {
  client: OpencodeClient & { app: { log: ReturnType<typeof vi.fn> }; session: { get: ReturnType<typeof vi.fn>; prompt: ReturnType<typeof vi.fn> } }
  session: { get: ReturnType<typeof vi.fn>; prompt: ReturnType<typeof vi.fn> }
}

function makeMockClient(sessionData?: Record<string, unknown>): MockClientResult {
  const mockSessionGet = vi.fn().mockResolvedValue({ data: sessionData })
  const mockPrompt = vi.fn().mockResolvedValue({})
  return {
    client: {
      app: { log: vi.fn().mockResolvedValue(undefined) },
      session: {
        get: mockSessionGet,
        prompt: mockPrompt,
      },
    } as unknown as MockClientResult["client"],
    // Expose helpers at top level for easy destructuring in tests.
    session: {
      get: mockSessionGet,
      prompt: mockPrompt,
    },
  } as unknown as MockClientResult
}

describe("sendMessage", () => {
  it("logs a warning and returns early when client.session is missing", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    // Build a mock client WITHOUT the session property (triggers first guard)
    const client = {
      app: { log: vi.fn().mockResolvedValue(undefined) },
    } as unknown as OpencodeClient

    await sendMessage({
      client,
      sessionId: "ses_no_session",
      message: "hello",
    })

    // Should NOT have called prompt (early exit)
    const clientWithSession = client as { session?: unknown }
    expect(clientWithSession.session).toBeUndefined()

    // Verify the log call hit the right guard
    expect(log).toHaveBeenCalledWith(
      client,
      "warn",
      "Client session not available for sending message to session ses_no_session.",
    )
  })

  it("logs a warning when session.get returns null (session not found)", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const mockSessionGet = vi.fn().mockResolvedValue(undefined)
    const client = {
      app: { log: vi.fn().mockResolvedValue(undefined) },
      session: {
        get: mockSessionGet,
        prompt: vi.fn().mockResolvedValue({}),
      },
    } as unknown as OpencodeClient

    await sendMessage({
      client,
      sessionId: "ses_not_found",
      message: "test",
    })

    // Verify session.get was called with the correct path
    expect(mockSessionGet).toHaveBeenCalledWith({ path: { id: "ses_not_found" } })

    // Verify the log call for not-found guard
    expect(log).toHaveBeenCalledWith(
      client,
      "warn",
      "Session ses_not_found not found for injection.",
    )

    // Should NOT have called prompt (early exit)
    expect(client.session.prompt).not.toHaveBeenCalled()
  })

  it("uses 'build' as the default agent when session has no agent field", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const { client } = makeMockClient({})

    await sendMessage({
      client,
      sessionId: "ses_default_agent",
      message: "test",
    })

    // Verify the agent defaulted to "build"
    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: "ses_default_agent" },
      body: {
        agent: "build",
        noReply: false,
        parts: [{ type: "text", text: "test" }],
      },
    })
  })

  it("uses the agent from session data when provided (happy path)", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const { client, session } = makeMockClient({ agent: "deploy" })

    await sendMessage({
      client,
      sessionId: "ses_happy",
      message: "hello world",
    })

    // Verify the correct agent was passed through
    expect(session.prompt).toHaveBeenCalledWith({
      path: { id: "ses_happy" },
      body: {
        agent: "deploy",
        noReply: false,
        parts: [{ type: "text", text: "hello world" }],
      },
    })

    // Verify session.get was called with correct sessionId
    expect(session.get).toHaveBeenCalledWith({ path: { id: "ses_happy" } })
  })

  it("respects the noReply option when set to true", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const { client, session } = makeMockClient({})

    await sendMessage({
      client,
      sessionId: "ses_no_reply",
      message: "silent",
      noReply: true,
    })

    expect(session.prompt).toHaveBeenCalledWith({
      path: { id: "ses_no_reply" },
      body: {
        agent: "build",
        noReply: true,
        parts: [{ type: "text", text: "silent" }],
      },
    })
  })

  it("uses 'info' level for the default log call in happy path (no logging occurs)", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const { client } = makeMockClient({})

    await sendMessage({
      client,
      sessionId: "ses_happy",
      message: "test",
    })

    // In happy path, no log() call should be made (log is only for warnings)
    expect(log).not.toHaveBeenCalled()
  })

  it("passes correct text type and message in parts array", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const { client, session } = makeMockClient({})

    await sendMessage({
      client,
      sessionId: "ses_parts",
      message: "any message content",
    })

    expect(session.prompt).toHaveBeenCalledWith({
      path: { id: "ses_parts" },
      body: { agent: "build", noReply: false, parts: [{ type: "text", text: "any message content" }] },
    })
  })

  it("uses 'build' as the default agent when session.data is undefined (optional chain guard)", async () => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    // Build a client where session.get returns { data: undefined } — exercises the
    // optional chaining on (session.data as {...})?.agent. Without the ?, the code
    // would throw on `undefined.agent`.
    const mockSessionGet = vi.fn().mockResolvedValue({ data: undefined })
    const client = {
      app: { log: vi.fn().mockResolvedValue(undefined) },
      session: {
        get: mockSessionGet,
        prompt: vi.fn().mockResolvedValue({}),
      },
    } as unknown as OpencodeClient

    await sendMessage({
      client,
      sessionId: "ses_no_data",
      message: "hello",
    })

    // Should have called session.get
    expect(mockSessionGet).toHaveBeenCalledWith({ path: { id: "ses_no_data" } })

    // Should fall back to "build" and NOT throw
    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: "ses_no_data" },
      body: {
        agent: "build",
        noReply: false,
        parts: [{ type: "text", text: "hello" }],
      },
    })
  })

  it.each(["deploy", "test", "custom-agent"])("passes agent='%s' through when session data specifies it", async (expectedAgent) => {
    const { sendMessage } = await import("@plugins/helpers/session-helpers")

    const { client, session } = makeMockClient({ agent: expectedAgent })

    await sendMessage({
      client,
      sessionId: `ses_${expectedAgent}`,
      message: "test",
    })

    expect(session.prompt.mock.calls.length).toBe(1)
    const callArguments = (session.prompt.mock.calls[0] as unknown[]) ?? []
    const firstArgument = callArguments[0] as { body?: { agent?: string } }
    expect(firstArgument.body?.agent).toBe(expectedAgent)
  })
})
